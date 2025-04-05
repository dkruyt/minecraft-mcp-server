#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import mineflayer from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';
const { pathfinder, Movements, goals } = pathfinderPkg;
import { Vec3 } from 'vec3';
import minecraftData from 'minecraft-data';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// ========== Type Definitions ==========

type TextContent = {
  type: "text";
  text: string;
};

type ContentItem = TextContent;

type McpResponse = {
  content: ContentItem[];
  _meta?: Record<string, unknown>;
  isError?: boolean;
  [key: string]: unknown;
};

interface InventoryItem {
  name: string;
  count: number;
  slot: number;
}

interface FaceOption {
  direction: string;
  vector: Vec3;
}

type Direction = 'forward' | 'back' | 'left' | 'right';
type FaceDirection = 'up' | 'down' | 'north' | 'south' | 'east' | 'west';

// ========== Command Line Argument Parsing ==========

function parseCommandLineArgs() {
  return yargs(hideBin(process.argv))
    .option('host', {
      type: 'string',
      description: 'Minecraft server host',
      default: 'localhost'
    })
    .option('port', {
      type: 'number',
      description: 'Minecraft server port',
      default: 25565
    })
    .option('username', {
      type: 'string',
      description: 'Bot username',
      default: 'LLMBot'
    })
    .help()
    .alias('help', 'h')
    .parseSync();
}

// ========== Response Helpers ==========

function createResponse(text: string): McpResponse {
  return {
    content: [{ type: "text", text }]
  };
}

function createErrorResponse(error: Error | string): McpResponse {
  const errorMessage = typeof error === 'string' ? error : error.message;
  console.error(`Error: ${errorMessage}`);
  return {
    content: [{ type: "text", text: `Failed: ${errorMessage}` }],
    isError: true
  };
}

// ========== Bot Setup ==========

function setupBot(argv: any) {
  // Configure bot options based on command line arguments
  const botOptions = {
    host: argv.host,
    port: argv.port,
    username: argv.username,
    plugins: { pathfinder },
    version: "1.21.5" // Explicitly set version to support 1.21.5
  };

  // Log connection information
  console.error(`Connecting to Minecraft server at ${argv.host}:${argv.port} as ${argv.username}`);
  
  // Create a bot instance
  const bot = mineflayer.createBot(botOptions);
  
  // Set up the bot when it spawns
  bot.once('spawn', async () => {
    console.error('Bot has spawned in the world');
    console.error(`Connected to Minecraft server using protocol version: ${bot.version}`);
    
    try {
      // Set up pathfinder movements with fallback for 1.21.5
      const mcData = minecraftData(bot.version);
      
      if (!mcData) {
        console.error('Warning: minecraft-data not found for this version, falling back to 1.21.4');
        // Fall back to 1.21.4 data if 1.21.5 isn't available in minecraft-data
        const fallbackData = minecraftData('1.21.4');
        const defaultMove = new Movements(bot, fallbackData);
        bot.pathfinder.setMovements(defaultMove);
      } else {
        const defaultMove = new Movements(bot, mcData);
        bot.pathfinder.setMovements(defaultMove);
      }
      
      bot.chat('Claude-powered bot ready to receive instructions!');
    } catch (error) {
      console.error(`Error during bot setup: ${error}`);
      bot.chat('Bot initialized with limited functionality due to version compatibility issues');
    }
  });
  
  // Register common event handlers
  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    console.error(`[CHAT] ${username}: ${message}`);
  });
  
  bot.on('kicked', (reason) => {
    console.error(`Bot was kicked: ${reason}`);
  });
  
  bot.on('error', (err) => {
    console.error(`Bot error: ${err.message}`);
  });
  
  return bot;
}

// ========== MCP Server Configuration ==========

function createMcpServer(bot: any) {
  const server = new McpServer({
    name: "minecraft-bot",
    version: "1.0.0",
  });
  
  // Register all tool categories
  registerPositionTools(server, bot);
  registerInventoryTools(server, bot);
  registerBlockTools(server, bot);
  registerEntityTools(server, bot);
  registerChatTools(server, bot);
  
  return server;
}

// ========== Position and Movement Tools ==========

function registerPositionTools(server: McpServer, bot: any) {
  server.tool(
    "get-position",
    "Get the current position of the bot",
    {},
    async (): Promise<McpResponse> => {
      try {
        const position = bot.entity.position;
        const pos = {
          x: Math.floor(position.x),
          y: Math.floor(position.y),
          z: Math.floor(position.z)
        };
        
        return createResponse(`Current position: (${pos.x}, ${pos.y}, ${pos.z})`);
      } catch (error) {
        return createErrorResponse(error as Error);
      }
    }
  );

  server.tool(
    "move-to-position",
    "Move the bot to a specific position",
    {
      x: z.number().describe("X coordinate"),
      y: z.number().describe("Y coordinate"),
      z: z.number().describe("Z coordinate"),
      range: z.number().optional().describe("How close to get to the target (default: 1)")
    },
    async ({ x, y, z, range = 1 }): Promise<McpResponse> => {
      try {
        const goal = new goals.GoalNear(x, y, z, range);
        await bot.pathfinder.goto(goal);
        
        return createResponse(`Successfully moved to position near (${x}, ${y}, ${z})`);
      } catch (error) {
        return createErrorResponse(error as Error);
      }
    }
  );

  server.tool(
    "look-at",
    "Make the bot look at a specific position",
    {
      x: z.number().describe("X coordinate"),
      y: z.number().describe("Y coordinate"),
      z: z.number().describe("Z coordinate"),
    },
    async ({ x, y, z }): Promise<McpResponse> => {
      try {
        await bot.lookAt(new Vec3(x, y, z), true);
        
        return createResponse(`Looking at position (${x}, ${y}, ${z})`);
      } catch (error) {
        return createErrorResponse(error as Error);
      }
    }
  );

  server.tool(
    "jump",
    "Make the bot jump",
    {},
    async (): Promise<McpResponse> => {
      try {
        bot.setControlState('jump', true);
        setTimeout(() => bot.setControlState('jump', false), 250);
        
        return createResponse("Successfully jumped");
      } catch (error) {
        return createErrorResponse(error as Error);
      }
    }
  );

  server.tool(
    "move-in-direction",
    "Move the bot in a specific direction for a duration",
    {
      direction: z.enum(['forward', 'back', 'left', 'right']).describe("Direction to move"),
      duration: z.number().optional().describe("Duration in milliseconds (default: 1000)")
    },
    async ({ direction, duration = 1000 }: { direction: Direction, duration?: number }): Promise<McpResponse> => {
      return new Promise((resolve) => {
        try {
          bot.setControlState(direction, true);
          
          setTimeout(() => {
            bot.setControlState(direction, false);
            resolve(createResponse(`Moved ${direction} for ${duration}ms`));
          }, duration);
        } catch (error) {
          bot.setControlState(direction, false);
          resolve(createErrorResponse(error as Error));
        }
      });
    }
  );
}

// ========== Inventory Management Tools ==========

function registerInventoryTools(server: McpServer, bot: any) {
  server.tool(
    "list-inventory",
    "List all items in the bot's inventory",
    {},
    async (): Promise<McpResponse> => {
      try {
        const items = bot.inventory.items();
        const itemList: InventoryItem[] = items.map((item: any) => ({
          name: item.name,
          count: item.count,
          slot: item.slot
        }));
        
        if (items.length === 0) {
          return createResponse("Inventory is empty");
        }
        
        let inventoryText = `Found ${items.length} items in inventory:\n\n`;
        itemList.forEach(item => {
          inventoryText += `- ${item.name} (x${item.count}) in slot ${item.slot}\n`;
        });
        
        return createResponse(inventoryText);
      } catch (error) {
        return createErrorResponse(error as Error);
      }
    }
  );

  server.tool(
    "find-item",
    "Find a specific item in the bot's inventory",
    {
      nameOrType: z.string().describe("Name or type of item to find")
    },
    async ({ nameOrType }): Promise<McpResponse> => {
      try {
        const items = bot.inventory.items();
        const item = items.find((item: any) => 
          item.name.includes(nameOrType.toLowerCase())
        );
        
        if (item) {
          return createResponse(`Found ${item.count} ${item.name} in inventory (slot ${item.slot})`);
        } else {
          return createResponse(`Couldn't find any item matching '${nameOrType}' in inventory`);
        }
      } catch (error) {
        return createErrorResponse(error as Error);
      }
    }
  );

  server.tool(
    "equip-item",
    "Equip a specific item",
    {
      itemName: z.string().describe("Name of the item to equip"),
      destination: z.string().optional().describe("Where to equip the item (default: 'hand')")
    },
    async ({ itemName, destination = 'hand' }): Promise<McpResponse> => {
      try {
        const items = bot.inventory.items();
        const item = items.find((item: any) => 
          item.name.includes(itemName.toLowerCase())
        );
        
        if (!item) {
          return createResponse(`Couldn't find any item matching '${itemName}' in inventory`);
        }
        
        await bot.equip(item, destination as mineflayer.EquipmentDestination);
        return createResponse(`Equipped ${item.name} to ${destination}`);
      } catch (error) {
        return createErrorResponse(error as Error);
      }
    }
  );
}

// ========== Block Interaction Tools ==========

function registerBlockTools(server: McpServer, bot: any) {
  server.tool(
    "place-block",
    "Place a block at the specified position",
    {
      x: z.number().describe("X coordinate"),
      y: z.number().describe("Y coordinate"),
      z: z.number().describe("Z coordinate"),
      faceDirection: z.enum(['up', 'down', 'north', 'south', 'east', 'west']).optional().describe("Direction to place against (default: 'down')")
    },
    async ({ x, y, z, faceDirection = 'down' }: { x: number, y: number, z: number, faceDirection?: FaceDirection }): Promise<McpResponse> => {
      try {
        const placePos = new Vec3(x, y, z);
        const blockAtPos = bot.blockAt(placePos);
        if (blockAtPos && blockAtPos.name !== 'air') {
          return createResponse(`There's already a block (${blockAtPos.name}) at (${x}, ${y}, ${z})`);
        }
        
        const possibleFaces: FaceOption[] = [
          { direction: 'down', vector: new Vec3(0, -1, 0) },
          { direction: 'north', vector: new Vec3(0, 0, -1) },
          { direction: 'south', vector: new Vec3(0, 0, 1) },
          { direction: 'east', vector: new Vec3(1, 0, 0) },
          { direction: 'west', vector: new Vec3(-1, 0, 0) },
          { direction: 'up', vector: new Vec3(0, 1, 0) }
        ];
        
        // Prioritize the requested face direction
        if (faceDirection !== 'down') {
          const specificFace = possibleFaces.find(face => face.direction === faceDirection);
          if (specificFace) {
            possibleFaces.unshift(possibleFaces.splice(possibleFaces.indexOf(specificFace), 1)[0]);
          }
        }
        
        // Try each potential face for placing
        for (const face of possibleFaces) {
          const referencePos = placePos.plus(face.vector);
          const referenceBlock = bot.blockAt(referencePos);
          
          if (referenceBlock && referenceBlock.name !== 'air') {
            if (!bot.canSeeBlock(referenceBlock)) {
              // Try to move closer to see the block
              const goal = new goals.GoalNear(referencePos.x, referencePos.y, referencePos.z, 2);
              await bot.pathfinder.goto(goal);
            }
            
            await bot.lookAt(placePos, true);
            
            try {
              await bot.placeBlock(referenceBlock, face.vector.scaled(-1));
              return createResponse(`Placed block at (${x}, ${y}, ${z}) using ${face.direction} face`);
            } catch (placeError) {
              console.error(`Failed to place using ${face.direction} face: ${(placeError as Error).message}`);
              continue;
            }
          }
        }
        
        return createResponse(`Failed to place block at (${x}, ${y}, ${z}): No suitable reference block found`);
      } catch (error) {
        return createErrorResponse(error as Error);
      }
    }
  );

  server.tool(
    "dig-block",
    "Dig a block at the specified position",
    {
      x: z.number().describe("X coordinate"),
      y: z.number().describe("Y coordinate"),
      z: z.number().describe("Z coordinate"),
    },
    async ({ x, y, z }): Promise<McpResponse> => {
      try {
        const blockPos = new Vec3(x, y, z);
        const block = bot.blockAt(blockPos);
        
        if (!block || block.name === 'air') {
          return createResponse(`No block found at position (${x}, ${y}, ${z})`);
        }
        
        if (!bot.canDigBlock(block) || !bot.canSeeBlock(block)) {
          // Try to move closer to dig the block
          const goal = new goals.GoalNear(x, y, z, 2);
          await bot.pathfinder.goto(goal);
        }
        
        await bot.dig(block);
        
        return createResponse(`Dug ${block.name} at (${x}, ${y}, ${z})`);
      } catch (error) {
        return createErrorResponse(error as Error);
      }
    }
  );

  server.tool(
    "get-block-info",
    "Get information about a block at the specified position",
    {
      x: z.number().describe("X coordinate"),
      y: z.number().describe("Y coordinate"),
      z: z.number().describe("Z coordinate"),
    },
    async ({ x, y, z }): Promise<McpResponse> => {
      try {
        const blockPos = new Vec3(x, y, z);
        const block = bot.blockAt(blockPos);
        
        if (!block) {
          return createResponse(`No block information found at position (${x}, ${y}, ${z})`);
        }
        
        return createResponse(`Found ${block.name} (type: ${block.type}) at position (${block.position.x}, ${block.position.y}, ${block.position.z})`);
      } catch (error) {
        return createErrorResponse(error as Error);
      }
    }
  );

  server.tool(
    "find-block",
    "Find the nearest block of a specific type",
    {
      blockType: z.string().describe("Type of block to find"),
      maxDistance: z.number().optional().describe("Maximum search distance (default: 16)")
    },
    async ({ blockType, maxDistance = 16 }): Promise<McpResponse> => {
      try {
        // Get Minecraft data with fallback for 1.21.5
        let mcData = minecraftData(bot.version);
        let usedFallback = false;
        
        // If data for current version is not available, fall back to 1.21.4
        if (!mcData || !mcData.blocksByName) {
          console.error(`Warning: minecraft-data not found for version ${bot.version}, falling back to 1.21.4`);
          mcData = minecraftData('1.21.4');
          usedFallback = true;
        }
        
        const blocksByName = mcData.blocksByName;
        
        if (!blocksByName[blockType]) {
          if (usedFallback) {
            return createResponse(`Unknown block type: ${blockType}. Note: Using 1.21.4 compatibility data for 1.21.5.`);
          }
          return createResponse(`Unknown block type: ${blockType}`);
        }
        
        const blockId = blocksByName[blockType].id;
        
        // Use try/catch specifically for findBlock which might fail with new 1.21.5 blocks
        try {
          const block = bot.findBlock({
            matching: blockId,
            maxDistance: maxDistance
          });
          
          if (!block) {
            return createResponse(`No ${blockType} found within ${maxDistance} blocks`);
          }
          
          return createResponse(`Found ${blockType} at position (${block.position.x}, ${block.position.y}, ${block.position.z})`);
        } catch (findError) {
          console.error(`Error finding block: ${findError}`);
          return createResponse(`Error finding ${blockType}. This may be due to Minecraft 1.21.5 compatibility issues.`);
        }
      } catch (error) {
        return createErrorResponse(error as Error);
      }
    }
  );
}

// ========== Entity Interaction Tools ==========

function registerEntityTools(server: McpServer, bot: any) {
  server.tool(
    "find-entity",
    "Find the nearest entity of a specific type",
    {
      type: z.string().optional().describe("Type of entity to find (empty for any entity)"),
      maxDistance: z.number().optional().describe("Maximum search distance (default: 16)")
    },
    async ({ type = '', maxDistance = 16 }): Promise<McpResponse> => {
      try {
        const entityFilter = (entity: any) => {
          if (!type) return true;
          if (type === 'player') return entity.type === 'player';
          if (type === 'mob') return entity.type === 'mob';
          return entity.name && entity.name.includes(type.toLowerCase());
        };
        
        const entity = bot.nearestEntity(entityFilter);
        
        if (!entity || bot.entity.position.distanceTo(entity.position) > maxDistance) {
          return createResponse(`No ${type || 'entity'} found within ${maxDistance} blocks`);
        }
        
        return createResponse(`Found ${entity.name || (entity as any).username || entity.type} at position (${Math.floor(entity.position.x)}, ${Math.floor(entity.position.y)}, ${Math.floor(entity.position.z)})`);
      } catch (error) {
        return createErrorResponse(error as Error);
      }
    }
  );
}

// ========== Chat Tool ==========

function registerChatTools(server: McpServer, bot: any) {
  server.tool(
    "send-chat",
    "Send a chat message in-game",
    {
      message: z.string().describe("Message to send in chat")
    },
    async ({ message }): Promise<McpResponse> => {
      try {
        bot.chat(message);
        return createResponse(`Sent message: "${message}"`);
      } catch (error) {
        return createErrorResponse(error as Error);
      }
    }
  );
}

// ========== Main Application ==========

async function main() {
  let bot: mineflayer.Bot | undefined;
  
  try {
    // Parse command line arguments
    const argv = parseCommandLineArgs();
    
    // Set up the Minecraft bot
    bot = setupBot(argv);
    
    // Create and configure MCP server
    const server = createMcpServer(bot);
    
    // Handle stdin end - this will detect when Claude Desktop is closed
    process.stdin.on('end', () => {
      console.error("Claude has disconnected. Shutting down...");
      if (bot) {
        bot.quit();
      }
      process.exit(0);
    });
    
    // Connect to the transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Minecraft MCP Server running on stdio"); 
  } catch (error) {
    console.error("Failed to start server:", error);
    if (bot) bot.quit();
    process.exit(1);
  }
}

// Start the application
main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});