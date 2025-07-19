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

## Architecture Rules

### Issue Folder Location
- **Never store `folder_path` in database** - compute dynamically
- **Use parent hierarchy** from database to find folders
- **Search by ID prefix** (F01-, T02-) not full folder names
- **Robust against manual renames** - users can rename folders freely
- **Algorithm**: Build parent chain → traverse .ppp/ → find by prefix

### Database Schema
- **YAML database** in `.ppp/database.yml` for metadata
- **Markdown files** for issue content (spec.md)
- **No folder paths stored** - computed when needed
- **Parent relationships** via `parent_id` field
- **Issue hierarchy**: F01 → F0102 → T010201 → B010201

### Unicode Support
- **Use Unicode-aware regex** `/[^\p{L}\p{N}\s]/gu` not ASCII-only
- **Handle Chinese text** with separate processing
- **Display length calculation** for mixed-width characters
- **Preserve all Unicode** in issue names and keywords