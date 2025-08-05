# PPP - Product Prompt Planner

PPP (Product Prompt Planner) is a command-line tool designed to manage and track product backlogs, tasks, and bugs using well-structured folders and markdown files. It's built for AI-assisted development with tools like Cursor, Claude Code, and other AI coding assistants.

## Key Features

- **Hierarchical Issue Management**: 3-layer feature structure with tasks and bugs
- **Robust Folder System**: Finds folders by ID prefix, resilient to manual renames
- **Unicode Support**: Full support for Chinese and international characters
- **Sprint Management**: Complete sprint lifecycle with issue tracking
- **Database Integration**: YAML metadata with markdown content files
- **AI Integration**: MCP server for seamless AI assistant workflows

## Installation

### Global Installation (Recommended)

```bash
npm install -g @ppp/cli
```

### Verify Installation

```bash
ppp --version
ppp --help
```

## Quick Start

### 1. Initialize PPP in Your Project

```bash
# Initialize with default project name
ppp init

# Initialize with custom project name
ppp init --name my-awesome-project
```

This creates a `.ppp` directory with:
- `settings.json` - Project configuration
- `database.yml` - Issue tracking database  
- `README.md` - Project overview
- `TRACK.md` - Task tracking
- `SPEC.md` - Project specifications
- `IMPL.md` - Implementation notes

### 2. Basic Usage

```bash
# Create issues
ppp issue create feature "User Management"
ppp issue create task F01 "Login API"

# Manage sprints
ppp sprint create "Setup phase"
ppp sprint add T010101 01

# List issues
ppp issue list
ppp issue list F01
```

## MCP Integration

PPP includes an MCP (Model Context Protocol) server that integrates with AI coding assistants.

### Supported Tools

- **Claude Code CLI**
- **VSCode-based IDEs** (Cursor, Trae, Cline)
- **Any MCP-compatible AI assistant**

### Quick Setup

Run the automated setup command:

```bash
ppp setup-mcp
```

This will:
1. Detect your installed IDEs
2. Create appropriate configuration files
3. Guide you through the setup process

### Manual Configuration

#### For Claude Code

Add to your `~/.claude.json`:

```json
{
  "mcpServers": {
    "ppp": {
      "type": "stdio",
      "command": "ppp",
      "args": ["--mcp-server"],
      "description": "Product Prompt Planner - CLI tool for managing product backlogs"
    }
  }
}
```

#### For VSCode-based IDEs (Cursor, etc.)

Create `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "ppp": {
      "type": "stdio", 
      "command": "ppp",
      "args": ["--mcp-server"],
      "description": "Product Prompt Planner - CLI tool for managing product backlogs"
    }
  }
}
```

### Using with AI Assistants

After setup, restart your IDE and PPP tools will be available:

- **Tools**: `ppp_init`, `ppp_status` - Direct CLI integration
- **Resources**: Access to `.ppp/` files (settings, specs, tracking)
- **Prompts**: `project_init`, `project_review` - Workflow templates

## Core Concepts

### Issues

PPP manages different types of issues with a hierarchical ID system:

- **Features** (F01, F0101, F010101) - 3-layer nested features
- **Tasks/Stories** (T010101) - Work items under features  
- **Bugs** (B010101) - Issues under features or tasks

### Sprints

Time-boxed iterations with issue tracking:
- Only one active sprint at a time
- Automatic state transitions
- Velocity tracking

### File Structure

```
.ppp/
├── settings.json           # Configuration
├── database.yml           # Issue database
├── Feature_Bill.md        # Feature hierarchy
├── Release.md             # Sprint index
├── Sprint-01.md           # Sprint files
└── F01-feature_name/      # Feature folders
    ├── spec.md           # Feature specification
    ├── T01-task_name/    # Task folders
    └── B01-bug_name/     # Bug folders
```

## Commands

For detailed command reference and examples, see the full documentation or run `ppp --help`.

### Configuration
```bash
ppp config list                    # List all settings
ppp config set <key> <value>       # Set configuration value
ppp config get <key>               # Get configuration value
```

### Issues
```bash
ppp issue create <type> [parent] [name]  # Create new issue
ppp issue update <id> <name>             # Update issue name
ppp issue delete <id>                    # Delete issue
ppp issue list [id]                      # List issues (hierarchical)
ppp issue list --parent <id>             # List direct children
```

### Sprints
```bash
ppp sprint create <description>     # Create new sprint
ppp sprint activate <number>        # Activate sprint
ppp sprint add <issue_id> <number>  # Add issue to sprint
ppp sprint remove <issue_id> <number> # Remove issue from sprint
ppp sprint delete <number>          # Delete sprint
```

## Development

### Requirements

- **Bun** runtime (https://bun.sh)
- Node.js 18+ (if using npm/yarn)

### Local Development

```bash
# Clone and install
git clone <repository>
cd ppp
bun install

# Build and test
bun run build
bun run dist/index.js --help

# Test MCP server
bun run dist/index.js --mcp-server
```

## Troubleshooting

### Common Issues

**"PPP is not globally installed"**
```bash
npm install -g @ppp/cli
ppp --version
```

**MCP server not responding**
- Restart your IDE after configuration
- Verify PPP is in PATH: `which ppp`
- Test manually: `ppp --mcp-server`

**Configuration issues**
- Check file permissions for config directories
- Ensure `.vscode/mcp.json` exists in workspace
- Verify `~/.claude.json` for Claude Code

For detailed troubleshooting, see [docs/troubleshooting.md](docs/troubleshooting.md).

## Documentation

- [MCP Setup Guide](docs/mcp-setup.md) - Detailed MCP configuration
- [Architecture Guide](docs/architecture.md) - Technical details
- [Troubleshooting](docs/troubleshooting.md) - Problem resolution

## License

MIT License - see LICENSE file for details.