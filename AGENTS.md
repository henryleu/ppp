# AGENTS.md - PPP Development Guide

## Build & Run Commands
- `bun run build` - Build TypeScript to dist/
- `bun run dev` - Watch mode development
- `bun run start` - Run built CLI
- `bun run dev:init` - Test init command
- No tests configured (use `echo "no tests"`)

## Code Style
- **Language**: TypeScript with strict mode
- **Imports**: ES modules, use `.js` extensions
- **Formatting**: No formatter configured, follow existing patterns
- **Types**: Use explicit types, avoid `any`
- **Naming**: camelCase for variables/functions, PascalCase for types
- **Error handling**: Use try/catch with console.error + process.exit(1)
- **File structure**: One command per file in src/commands/
- **No comments** unless explaining complex logic