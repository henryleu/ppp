# Welcome to PPP (Product Prompt Planner) 🚀

**PPP** is your personal command-line tool for managing product backlogs, tasks, and bugs using well-structured markdown files, designed for AI-assisted development.

## Quick Start

### Initialize a New Project
```bash
ppp init
```
This creates a `.ppp/` folder in your current directory with project-specific files.

### Generate Project Artifacts
```bash
ppp generate
```
Generate various project artifacts based on your specifications.

### MCP Integration (AI Assistants)
```bash
ppp --mcp-server
```
Start MCP server mode for integration with AI assistants like Cursor or Claude Code.

## Your PPP Home Directory

This folder (`~/.ppp/`) contains your personal PPP configuration:

- **settings.json** - Your personal PPP preferences
- **README.md** - This guide (you're reading it now!)
- **TRACK.md** - Your personal task tracking template
- **SPEC.md** - Your personal project specification template
- **IMPL.md** - Your personal implementation notes template

## Project vs Personal Files

- **Project files** (`.ppp/` in project directories) - Project-specific data
- **Personal files** (`~/.ppp/` in home directory) - Your global settings and templates

## Getting Help

- Run `ppp --help` for command-line help
- Check the official documentation
- Report issues at the project repository

## Tips for AI-Assisted Development

1. **Use descriptive file names** - Helps AI understand context
2. **Keep specifications updated** - AI works better with current info
3. **Use consistent formatting** - Maintains readability
4. **Regular backups** - Enable auto-backup in settings

---

*PPP is designed to work seamlessly with AI assistants. Happy coding! 🤖*