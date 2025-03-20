# Minecraft MCP Server

A Minecraft bot powered by large language models. This bot uses the Model Context Protocol (MCP) to enable Claude and other supported models to control a Minecraft character.

## Prerequisites

- Node.js
- A running Minecraft game
- Claude Desktop (the setup below was tested with Minecraft 1.21.4 Java Edition included in Microsoft Game Pass)

## Getting started

This bot is designed to be used with Claude Desktop through the Model Context Protocol (MCP).

### Run Minecraft

Create a singleplayer world and open it to LAN (`ESC -> Open to LAN`). Bot will try to connect using port `25565` and hostname `localhost`. These parameters could be configured in `claude_desktop_config.json` on a next step. 

### MCP Configuration

Make sure that [Claude Desktop](https://claude.ai/download) is installed. Open `File -> Settings -> Developer -> Edit Config`. It should open installation directory. Find file with a name `claude_desktop_config.json` and insert the following code:

```json
{
  "mcpServers": {
    "minecraft": {
      "command": "npx",
      "args": [
        "-y",
        "github:yuniko-software/minecraft-mcp-server",
        "--host",
        "localhost",
        "--port",
        "25565",
        "--username",
        "ClaudeBot"
      ]
    }
  }
}
```

Double-check that right `--port` and `--host` parameters were used. Make sure to completely reboot the Claude Desktop application (should be closed in OS tray). 

## Running

Make sure Minecraft game is running and the world is opened to LAN. Then start Claude Desktop application and the bot should join the game. 

You can give bot any commands through any active Claude Desktop chat. You can also upload images of buildings and ask bot to build them 😁

Don't forget to mention that bot should do something in Minecraft in your prompt. Because saying this is a trigger to run MCP server. It will ask for your permissions.

Using Claude 3.7 Sonnet could give you some interesting results. The bot-agent would be really smart 🫡

## Available Commands

Once connected to a Minecraft server, Claude can use these commands:

### Movement
- `get-position` - Get the current position of the bot
- `move-to-position` - Move to specific coordinates
- `look-at` - Make the bot look at specific coordinates
- `jump` - Make the bot jump
- `move-in-direction` - Move in a specific direction for a duration

### Inventory
- `list-inventory` - List all items in the bot's inventory
- `find-item` - Find a specific item in inventory
- `equip-item` - Equip a specific item

### Block Interaction
- `place-block` - Place a block at specified coordinates
- `dig-block` - Dig a block at specified coordinates
- `get-block-info` - Get information about a block
- `find-block` - Find the nearest block of a specific type

### Entity Interaction
- `find-entity` - Find the nearest entity of a specific type

### Communication
- `send-chat` - Send a chat message in-game

## Contributing

This application was made in just two days, and the code is really simple and straightforward. All refactoring commits, functional and test contributions, issues and discussion are greatly appreciated!

Feel free to submit pull requests or open issues for improvements. Some areas that could use enhancement:

- Additional documentation
- More robust error handling
- Tests for different components
- New functionality and commands
