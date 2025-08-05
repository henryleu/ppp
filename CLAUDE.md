# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Plan & Review

### Before starting work
- Always in plan mode to make a plan
- After get the plan, make sure you Write the plan to .claude/tasks/TASK_NAME.md.
- The plan should be a detailed implementation plan and the reasoning behind them, as well as tasks broken down.
- If the task require external knowledge or certain package, also research to get latest knowledge (Use Task tool for research)
- Don't over plan it, always think MVP.
- Once you write the plan, firstly ask me to review it. Do not continue until I approve the plan.

### While implementing
- You should update the plan as you work.
- After you complete tasks in the plan, you should update and append detailed descriptions of the changes you made, so following tasks can be easily hand over to other engineers.

## Development Guidelines

- Whenever take a temp test which need to create a temp test folder, just use temp-test folder under the root folder.

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
7. **Styled Output**: ASCII tables and emojis for better UX (compatible with all terminals)
8. **MCP Integration**: Server mode enables AI integration via stdio transport

## MCP Integration

### MCP Server Features
- **Tools**: `ppp_init`, `ppp_status` - CLI command integration
- **Resources**: Read `.ppp/` files (settings.json, SPEC.md, TRACK.md, IMPL.md)
- **Prompts**: `project_init`, `project_review` - Common workflow templates

### Development Configuration

The project includes MCP configurations for development:
- `.vscode/mcp.json` and `.cursor/mcp.json` point to local build commands
- These use `bun run dist/index.js --mcp-server` for local development
- For production use, see [docs/mcp-setup.md](docs/mcp-setup.md)

### MCP Server Testing
```bash
# Test MCP server startup
bun run dist/index.js --mcp-server

# Build and test
bun run build
bun run dist/index.js --mcp-server
```

## Issue Management System

### Hierarchical Structure
PPP uses a 3-layer feature hierarchy with specific ID patterns:
- **Layer 1 Features**: F01, F02, ..., F99
- **Layer 2 Features**: F0101, F0102, ..., F9999  
- **Layer 3 Features**: F010101, F010102, ..., F999999
- **Tasks/Stories**: T010101, T010102 (under parent features)
- **Bugs**: B010101, B010102 (under features or tasks)

### File System Design
- **Robust folder location**: Finds folders by ID prefix, resilient to renames
- **No stored paths**: Dynamically computes locations using parent relationships
- **Unicode support**: Full support for Chinese and international characters
- **Folder consistency**: All issues create folders with `spec.md` files

### Database System
- **YAML + Markdown**: Hybrid storage with structured metadata and content
- **Counter-based IDs**: Auto-incrementing counters prevent conflicts
- **Atomic operations**: Ensures data consistency during updates
- **Backup system**: Archives deleted issues to `_archived` folder

## Code Conventions

### TypeScript Standards
- Use strict TypeScript configuration
- Prefer interfaces over types for object definitions
- Use async/await over Promises chains
- Implement proper error handling with try/catch

### File Organization
- One main export per file
- Group related functionality in modules
- Use index.ts files for clean imports
- Keep CLI commands in separate files

### Error Handling
- Use custom error classes for different error types
- Provide actionable error messages to users
- Log errors appropriately for debugging
- Handle file system errors gracefully

### Testing Strategy
- Unit tests for core business logic
- Integration tests for CLI commands
- MCP server functionality tests
- File system operation tests

## Performance Guidelines

### File System Operations
- Use streaming for large files
- Batch related operations
- Cache frequently accessed data
- Implement proper cleanup

### Memory Management
- Avoid loading entire directory trees
- Use generators for large data sets
- Clean up temporary objects
- Monitor memory usage in development

## Security Considerations

- Validate all user inputs
- Sanitize file paths to prevent traversal attacks
- Secure API key storage in configuration
- Limit MCP server access scope
- Never commit sensitive data to repository

## Documentation

User-facing documentation is now organized as follows:
- **README.md**: Installation, quick start, basic usage
- **docs/mcp-setup.md**: Detailed MCP configuration guide  
- **docs/troubleshooting.md**: Common issues and solutions
- **docs/architecture.md**: Technical implementation details

This file (CLAUDE.md) focuses on AI development context and should not contain end-user documentation.