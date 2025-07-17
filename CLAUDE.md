# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ppp** is a command-line tool designed to manage and track product backlogs, tasks, and bugs using well-structured folders and markdown files. It's built for AI-assisted development with tools like Cursor, Codeium, or Claude Code.

Key details:
- **Full name**: Product Prompt Planner
- **Package name**: `@ppp/cli`
- **Binary name**: `ppp`
- **License**: MIT
- **Target**: Node.js & TypeScript implementation
- **Installation**: Global npm package
- **MCP Integration**: Designed to work as MCP stdio for Cursor IDE and Claude Code CLI
- **Current Date**: 2025-07-17, remember it.

## Project Status

**Active Development** - Core CLI structure implemented with TypeScript and essential commands.

## Development Commands

- `bun run build` - Bundle TypeScript to JavaScript with Bun
- `bun run dev` - Watch mode development with Bun
- `bun run start` - Run the built CLI with Bun
- `bun run dist/index.js --help` - Show CLI help
- `bun run dist/index.js --version` - Show version
- `bun run dist/index.js --mcp-server` - Start MCP server mode for AI integration

## Architecture

### Tech Stack
- **Bun** - Runtime, bundler, and package manager
- **TypeScript** - Main language (native Bun support)
- **Commander.js** - Command parsing and CLI framework
- **Prompts** - Interactive user input (lightweight alternative to inquirer)
- **cli-table3** - Beautiful table displays
- **MCP SDK** - Model Context Protocol integration for AI assistants

### Core Commands
- `ppp init` - Initialize ppp in current directory (✅ implemented)
- `ppp generate` - Generate project artifacts (🚧 planned)

### Directory Structure
When `ppp init` is run, it creates:
```
.ppp/
├── settings.json   # Project configuration
├── README.md       # Project overview
├── TRACK.md        # Task tracking
├── SPEC.md         # Project specifications
└── IMPL.md         # Implementation notes
```

### Source Code Structure
```
src/
├── index.ts        # Main CLI entry point (supports --mcp-server flag)
├── commands/
│   └── init.ts     # Initialize command implementation
└── mcp/
    └── server.ts   # MCP server implementation
```

### Command Line Interface
- Global flags: `-h`/`--help`, `-v`/`--version`, `--mcp-server`
- Interactive prompts for user input
- Beautiful table displays for status and results
- ESM module support
- MCP server mode for AI integration

## Development Notes

1. **Bun Runtime**: Uses Bun instead of Node.js for better performance
2. **Engine Enforcement**: `engines.bun >=1.0.0` in package.json forces Bun usage
3. **ESM Modules**: Uses ESM modules (`"type": "module"` in package.json)
4. **Bundling**: Bun build bundles TypeScript directly to `dist/index.js`
5. **Shebang**: CLI entry point uses `#!/usr/bin/env bun`
6. **Interactive Prompts**: Handle project setup with native TypeScript support
7. **Styled Output**: Tables and emojis for better UX
8. **MCP Integration**: Server mode enables AI integration via stdio transport

## MCP Integration

### MCP Server Features
- **Tools**: `ppp_init`, `ppp_status` - CLI command integration
- **Resources**: Read `.ppp/` files (settings.json, SPEC.md, TRACK.md, IMPL.md)
- **Prompts**: `project_init`, `project_review` - Common workflow templates

### Supported IDEs and Configurations
PPP supports VSCode-based IDEs and Claude Code (not Claude Desktop).

#### VSCode and VSCode-based IDEs (Cursor, Trae, Cline)
Create `.vscode/mcp.json` in your workspace:
```json
{
  "servers": {
    "ppp": {
      "type": "stdio",
      "command": "ppp",
      "args": ["--mcp-server"],
      "description": "Product Prompt Planner - CLI tool for managing product backlogs, tasks and bugs with AI assistance"
    }
  }
}
```

#### Claude Code
Add to your `~/.claude.json` file:
```json
{
  "mcpServers": {
    "ppp": {
      "type": "stdio",
      "command": "ppp",
      "args": ["--mcp-server"],
      "description": "Product Prompt Planner - CLI tool for managing product backlogs, tasks and bugs with AI assistance"
    }
  }
}
```


### Setup Instructions

#### For End Users (Production)
1. **Install PPP globally**: `npm install -g @ppp/cli`
2. **Run the setup command**: `ppp setup-mcp`
3. **Select your IDE(s)** from the interactive menu
4. **Restart your IDE** to load the MCP server
5. **Verify installation**: Use `/mcp` command (Claude Code) or check MCP status in your IDE

#### For Developers (Local Development)
1. **Clone the repository** and run `bun install`
2. **Build the project**: `bun run build`
3. **Use the development configurations**:
   - The included `.vscode/mcp.json` and `.cursor/mcp.json` use local build commands
   - These point to `bun run dist/index.js --mcp-server` for local development
4. **Test the MCP server**: `bun run dist/index.js --mcp-server`

### Usage
```bash
# Start MCP server mode manually
ppp --mcp-server

# Or use through your configured IDE
```

### Requirements
- **Bun**: Install Bun runtime (https://bun.sh)
- **Dependencies**: Run `bun install` to install packages
