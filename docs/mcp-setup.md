# MCP Setup Guide

This guide provides detailed instructions for setting up PPP's MCP (Model Context Protocol) server with various AI assistants and IDEs.

## Automatic Setup (Recommended)

PPP includes an automated setup command that detects your installed IDEs:

```bash
ppp setup-mcp
```

This command will:
1. Check for supported IDEs on your system
2. Create appropriate configuration files
3. Guide you through the setup process
4. Verify the installation

## Manual Configuration

### Claude Code CLI

Add PPP to your Claude Code configuration by editing `~/.claude.json`:

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

#### Verification for Claude Code
1. Restart Claude Code CLI
2. Use the `/mcp` command to list available servers
3. Look for "ppp" in the server list
4. Test with `/mcp ppp_status` to verify connection

### VSCode-based IDEs

For Cursor, Trae, Cline, and other VSCode-based IDEs, create `.vscode/mcp.json` in your workspace:

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

#### Alternative Configuration Path

Some IDEs may use different configuration files:

**For Cursor:**
Create `.cursor/mcp.json`:
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

## Development Setup

For local development and testing:

### Global Installation Testing
```bash
# Install PPP globally for testing
npm install -g @ppp/cli

# Verify installation
ppp --version
ppp --help

# Test MCP server
ppp --mcp-server
```

### Local Development Configuration

When developing PPP locally, use these configurations:

**For VSCode/Cursor (Local Development):**
```json
{
  "servers": {
    "ppp": {
      "type": "stdio",
      "command": "bun",
      "args": ["run", "dist/index.js", "--mcp-server"],
      "cwd": "/path/to/your/ppp/project",
      "description": "PPP Local Development Server"
    }
  }
}
```

**For Claude Code (Local Development):**
```json
{
  "mcpServers": {
    "ppp": {
      "type": "stdio",
      "command": "bun",
      "args": ["run", "dist/index.js", "--mcp-server"],
      "cwd": "/path/to/your/ppp/project",
      "description": "PPP Local Development Server"
    }
  }
}
```

## Available Tools and Resources

Once configured, PPP provides these MCP capabilities:

### Tools
- **ppp_init**: Initialize PPP in current directory
- **ppp_status**: Get project status and information

### Resources
- **settings.json**: Project configuration
- **SPEC.md**: Project specifications
- **TRACK.md**: Task tracking
- **IMPL.md**: Implementation notes

### Prompts
- **project_init**: Template for initializing new projects
- **project_review**: Template for reviewing project status

## Testing Your Setup

### Manual Testing
```bash
# Test PPP installation
ppp --version

# Test MCP server startup
ppp --mcp-server

# Should show JSON-RPC messages when working correctly
```

### IDE Testing

1. **Restart your IDE** after configuration
2. **Check MCP Status**: Most IDEs show MCP server status in their UI
3. **Test Commands**: Try using PPP tools through your AI assistant
4. **Verify Resources**: Check if PPP files are accessible through the AI assistant

## Environment Variables

You can configure PPP behavior with environment variables:

```bash
# Set custom PPP directory
export PPP_DIR="/custom/path/.ppp"

# Enable debug logging
export PPP_DEBUG=true

# Set custom configuration file
export PPP_CONFIG="/path/to/custom/settings.json"
```

## Multiple Projects

PPP works on a per-project basis. Each project with a `.ppp` directory can use PPP tools through MCP:

```bash
# Project A
cd /path/to/project-a
ppp init --name "Project A"

# Project B  
cd /path/to/project-b
ppp init --name "Project B"
```

When using MCP, PPP automatically detects the current project based on the working directory.

## Advanced Configuration

### Custom Command Paths

If PPP is installed in a non-standard location:

```json
{
  "servers": {
    "ppp": {
      "type": "stdio",
      "command": "/custom/path/to/ppp",
      "args": ["--mcp-server"],
      "description": "PPP with custom path"
    }
  }
}
```

### Environment-Specific Configurations

For different environments (development, staging, production):

```json
{
  "servers": {
    "ppp-dev": {
      "type": "stdio",
      "command": "ppp",
      "args": ["--mcp-server", "--env", "development"],
      "description": "PPP Development Environment"
    },
    "ppp-prod": {
      "type": "stdio",
      "command": "ppp",
      "args": ["--mcp-server", "--env", "production"],
      "description": "PPP Production Environment"
    }
  }
}
```

## Troubleshooting

For configuration issues, see [troubleshooting.md](troubleshooting.md).