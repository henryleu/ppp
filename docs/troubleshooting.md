# Troubleshooting Guide

This guide helps resolve common issues with PPP (Product Prompt Planner).

## Installation Issues

### "PPP is not globally installed"

**Symptoms:**
- Command `ppp` not found
- `ppp setup-mcp` fails with installation check

**Solutions:**
```bash
# Install PPP globally
npm install -g @ppp/cli

# Verify installation
ppp --version
which ppp

# If still not found, check PATH
echo $PATH
npm config get prefix
```

**Alternative Installation Methods:**
```bash
# Using Yarn
yarn global add @ppp/cli

# Using pnpm
pnpm add -g @ppp/cli

# Direct from source (development)
git clone <repository>
cd ppp
bun install
bun run build
npm link
```

### Permission Issues

**Symptoms:**
- "Permission denied" errors during installation
- Cannot write to global npm directory

**Solutions:**
```bash
# Use npm with proper permissions
sudo npm install -g @ppp/cli

# Or configure npm to use different directory
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
npm install -g @ppp/cli
```

## MCP Integration Issues

### MCP Server Not Responding

**Symptoms:**
- AI assistant cannot find PPP tools
- MCP server doesn't start
- Connection timeouts

**Diagnostic Steps:**
```bash
# Test PPP installation
ppp --version

# Test MCP server manually
ppp --mcp-server

# Check if PPP is in PATH
which ppp
echo $PATH
```

**Solutions:**

1. **Restart your IDE** after configuration
2. **Verify configuration files** exist and are valid JSON
3. **Check file permissions** for configuration directories
4. **Test MCP server manually** to isolate issues

### Configuration File Issues

**Symptoms:**
- IDE doesn't recognize MCP configuration
- JSON parsing errors
- Configuration not loaded

**For Claude Code (`~/.claude.json`):**
```bash
# Check if file exists
ls -la ~/.claude.json

# Validate JSON syntax
cat ~/.claude.json | python -m json.tool

# Check permissions
chmod 644 ~/.claude.json
```

**For VSCode-based IDEs (`.vscode/mcp.json`):**
```bash
# Check if file exists in workspace
ls -la .vscode/mcp.json

# Validate JSON syntax  
cat .vscode/mcp.json | python -m json.tool

# Ensure workspace is correct
pwd
```

### Tools Not Available in AI Assistant

**Symptoms:**
- MCP server starts but tools don't appear
- "Unknown tool" errors
- Resources not accessible

**Diagnostic Steps:**
```bash
# Verify PPP version
ppp --version

# Check if in PPP project directory
ls -la .ppp/

# Test tools manually
ppp init --help
```

**Solutions:**

1. **Ensure you're in a PPP project directory** or initialize one:
   ```bash
   ppp init --name "test-project"
   ```

2. **Check IDE MCP integration** is enabled
3. **Look for error messages** in IDE console/logs
4. **Restart IDE** and test again

## Project Initialization Issues

### ".ppp Directory Already Exists"

**Symptoms:**
- `ppp init` fails
- "Directory already exists" errors

**Solutions:**
```bash
# Remove existing .ppp directory
rm -rf .ppp

# Or backup and reinitialize
mv .ppp .ppp.backup
ppp init --name "my-project"
```

### Database/Settings Corruption

**Symptoms:**
- YAML parsing errors
- Invalid settings.json
- Commands fail with data errors

**Solutions:**
```bash
# Backup current data
cp .ppp/settings.json .ppp/settings.json.backup
cp .ppp/database.yml .ppp/database.yml.backup

# Reset to defaults
ppp init --name "recovered-project"

# Manually restore important data from backups
```

## Command Execution Issues

### Unicode/Character Encoding Issues

**Symptoms:**
- Chinese/international characters display incorrectly
- File name encoding problems
- Terminal output garbled

**Solutions:**
```bash
# Set proper locale
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# For macOS
export LANG=en_US.UTF-8

# Test unicode support
echo "测试 Unicode Support"
```

### Issue ID Conflicts

**Symptoms:**
- "Issue ID already exists" errors
- Duplicate ID generation
- Database inconsistencies

**Solutions:**
```bash
# Check database state
cat .ppp/database.yml

# Reset counters if needed (manual edit)
# Edit .ppp/database.yml carefully

# Verify issue folders match database
find .ppp -name "F*" -o -name "T*" -o -name "B*"
```

## Performance Issues

### Slow Command Execution

**Symptoms:**
- Commands take long time to complete
- High CPU/memory usage
- File system delays

**Diagnostic Steps:**
```bash
# Check project size
du -sh .ppp

# Check number of issues
find .ppp -name "spec.md" | wc -l

# Check file system performance
time ls -la .ppp
```

**Solutions:**

1. **Clean up archived issues:**
   ```bash
   rm -rf .ppp/_archived
   ```

2. **Optimize file structure** (for very large projects)
3. **Check available disk space**
4. **Consider project splitting** for massive backlogs

## Table Display Issues

### Garbled Table Characters

**Symptoms:**
- Table borders display as question marks
- Misaligned columns
- Unicode rendering problems

**Solutions:**
```bash
# Ensure terminal supports UTF-8
echo $TERM
locale

# Try different terminal
# PPP uses ASCII fallback for compatibility

# Check if latest version fixes issue
ppp --version
npm update -g @ppp/cli
```

## Network/API Issues

### LLM API Connection Problems

**Symptoms:**
- API timeout errors
- Authentication failures
- Feature generation fails

**Solutions:**
```bash
# Check API configuration
ppp config list

# Test API connectivity
curl -H "Authorization: Bearer YOUR_API_KEY" https://api.moonshot.cn/v1/models

# Update API settings
ppp config set llm_api_key "your-new-key"
ppp config set llm_api_url "https://api.your-provider.com/v1"
```

## Debug Mode

Enable debug logging for detailed troubleshooting:

```bash
# Set debug environment variable
export PPP_DEBUG=true

# Run commands with debug output
ppp issue list

# Check debug logs
cat ~/.ppp/debug.log
```

## Getting Help

### Log Collection

When reporting issues, collect these logs:

```bash
# System information
ppp --version
node --version
npm --version
bun --version

# Configuration
cat ~/.claude.json  # (remove sensitive data)
cat .vscode/mcp.json

# Project state
ls -la .ppp/
cat .ppp/settings.json
head .ppp/database.yml

# Debug output
PPP_DEBUG=true ppp issue list > debug.log 2>&1
```

### Common File Locations

- **Global PPP config**: `~/.ppp/`
- **Claude Code config**: `~/.claude.json`
- **VSCode MCP config**: `.vscode/mcp.json`
- **Project PPP data**: `./.ppp/`
- **Debug logs**: `~/.ppp/debug.log`

### Reset Everything

If all else fails, complete reset:

```bash
# Remove global configuration
rm -rf ~/.ppp/

# Remove project data
rm -rf .ppp/

# Remove IDE configurations
rm -f ~/.claude.json
rm -f .vscode/mcp.json

# Reinstall PPP
npm uninstall -g @ppp/cli
npm install -g @ppp/cli

# Reconfigure
ppp setup-mcp
ppp init --name "fresh-start"
```