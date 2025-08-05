# Claude Code Tools Inventory

This document provides a comprehensive list of all tools available to Claude Code in this workspace.

## File Operations

### Read
**Purpose**: Read files from the local filesystem  
**Inputs**:
- `file_path` (required): Absolute path to the file
- `limit` (optional): Number of lines to read
- `offset` (optional): Line number to start reading from

**Description**: Reads up to 2000 lines by default. Supports images, PDFs, and various text formats. Returns content with line numbers.

### Write
**Purpose**: Write or overwrite files on the filesystem  
**Inputs**:
- `file_path` (required): Absolute path to the file
- `content` (required): Content to write to the file

**Description**: Creates new files or overwrites existing ones. Must read existing files first before overwriting.

### Edit
**Purpose**: Make exact string replacements in files  
**Inputs**:
- `file_path` (required): Absolute path to the file
- `old_string` (required): Text to replace (must be unique)
- `new_string` (required): Replacement text
- `replace_all` (optional): Replace all occurrences (default: false)

**Description**: Performs precise find-and-replace operations. Requires exact string matching.

### MultiEdit
**Purpose**: Make multiple edits to a single file in one operation  
**Inputs**:
- `file_path` (required): Absolute path to the file
- `edits` (required): Array of edit operations, each containing `old_string`, `new_string`, and optional `replace_all`

**Description**: Applies multiple edits sequentially. All edits must succeed or none are applied.

## Search & Navigation

### Glob
**Purpose**: Find files using pattern matching  
**Inputs**:
- `pattern` (required): Glob pattern (e.g., "**/*.js", "src/**/*.ts")
- `path` (optional): Directory to search in

**Description**: Fast file pattern matching. Returns matching file paths sorted by modification time.

### Grep
**Purpose**: Search file contents using regular expressions  
**Inputs**:
- `pattern` (required): Regular expression pattern
- `path` (optional): File or directory to search
- `output_mode` (optional): "content", "files_with_matches", "count"
- `glob` (optional): Filter files by glob pattern
- `type` (optional): Filter by file type (js, py, rust, etc.)
- `-i` (optional): Case insensitive search
- `-n` (optional): Show line numbers
- `-A`, `-B`, `-C` (optional): Context lines after/before/around matches

**Description**: Powerful search using ripgrep. Supports multiline matching and various output formats.

### LS
**Purpose**: List files and directories  
**Inputs**:
- `path` (required): Absolute path to directory
- `ignore` (optional): Array of glob patterns to ignore

**Description**: Lists directory contents with optional filtering.

## Command Execution

### Bash
**Purpose**: Execute shell commands in persistent session  
**Inputs**:
- `command` (required): Shell command to execute
- `description` (optional): Brief description of what command does
- `timeout` (optional): Timeout in milliseconds (max 600000)

**Description**: Runs commands with proper quoting for paths with spaces. Maintains working directory across calls.

## Task Management & Planning

### TodoWrite
**Purpose**: Create and manage structured task lists  
**Inputs**:
- `todos` (required): Array of todo items, each with:
  - `content` (required): Task description
  - `status` (required): "pending", "in_progress", "completed"
  - `priority` (required): "high", "medium", "low"
  - `id` (required): Unique identifier

**Description**: Tracks progress on complex multi-step tasks. Essential for organizing work and demonstrating thoroughness.

### Task
**Purpose**: Launch specialized agents for complex tasks  
**Inputs**:
- `description` (required): Short 3-5 word task description
- `prompt` (required): Detailed task instructions
- `subagent_type` (required): Type of agent ("general-purpose")

**Description**: Delegates complex, multi-step tasks to autonomous agents. Use for open-ended searches or multi-round operations.

### ExitPlanMode
**Purpose**: Exit planning mode and present implementation plan  
**Inputs**:
- `plan` (required): Implementation plan in markdown format

**Description**: Used when ready to transition from planning to execution. Prompts user to approve the plan.

## Jupyter Notebooks

### NotebookRead
**Purpose**: Read Jupyter notebook cells and outputs  
**Inputs**:
- `notebook_path` (required): Absolute path to .ipynb file
- `cell_id` (optional): Specific cell ID to read

**Description**: Reads interactive notebook documents with code, text, and visualizations.

### NotebookEdit
**Purpose**: Edit Jupyter notebook cells  
**Inputs**:
- `notebook_path` (required): Absolute path to .ipynb file
- `new_source` (required): New cell content
- `cell_id` (optional): Cell ID to edit
- `cell_type` (optional): "code" or "markdown"
- `edit_mode` (optional): "replace", "insert", "delete"

**Description**: Modifies notebook cells. Can replace content, insert new cells, or delete existing ones.

## Web & Research

### WebFetch
**Purpose**: Retrieve and analyze web content with AI  
**Inputs**:
- `url` (required): URL to fetch content from
- `prompt` (required): Analysis instructions for the content

**Description**: Fetches web pages, converts HTML to markdown, and processes with AI model. Includes 15-minute cache.

### WebSearch
**Purpose**: Search the web for current information  
**Inputs**:
- `query` (required): Search query
- `allowed_domains` (optional): Only include results from these domains
- `blocked_domains` (optional): Exclude results from these domains

**Description**: Provides up-to-date information beyond Claude's knowledge cutoff. US-only availability.

## Browser Tools (MCP Server)

### Screenshot & Debugging
- **mcp__browser-tools__takeScreenshot**: Capture current browser tab
- **mcp__browser-tools__getConsoleLogs**: Get browser console logs
- **mcp__browser-tools__getConsoleErrors**: Get console error logs
- **mcp__browser-tools__getNetworkErrors**: Get network error logs
- **mcp__browser-tools__getNetworkLogs**: Get all network logs
- **mcp__browser-tools__getSelectedElement**: Get selected DOM element
- **mcp__browser-tools__wipeLogs**: Clear all browser logs from memory

### Development Modes
- **mcp__browser-tools__runDebuggerMode**: Debug application issues
- **mcp__browser-tools__runAuditMode**: Optimize for SEO, accessibility, performance

### Audits
- **mcp__browser-tools__runAccessibilityAudit**: Check accessibility compliance
- **mcp__browser-tools__runPerformanceAudit**: Analyze performance metrics
- **mcp__browser-tools__runSEOAudit**: Evaluate SEO optimization
- **mcp__browser-tools__runBestPracticesAudit**: Check development best practices
- **mcp__browser-tools__runNextJSAudit**: Next.js specific optimizations

## GitHub Integration (MCP Server)

### Repository Management
- **mcp__github__create_repository**: Create new GitHub repository
- **mcp__github__fork_repository**: Fork repository to account
- **mcp__github__search_repositories**: Search GitHub repositories

### File Operations
- **mcp__github__get_file_contents**: Get file/directory contents from repo
- **mcp__github__create_or_update_file**: Create or update single file
- **mcp__github__push_files**: Push multiple files in single commit

### Collaboration
- **mcp__github__create_issue**: Create new issue
- **mcp__github__create_pull_request**: Create pull request
- **mcp__github__create_branch**: Create new branch
- **mcp__github__list_commits**: Get commit history
- **mcp__github__list_issues**: List repository issues
- **mcp__github__update_issue**: Update existing issue
- **mcp__github__add_issue_comment**: Add comment to issue

### Pull Request Management
- **mcp__github__get_pull_request**: Get PR details
- **mcp__github__list_pull_requests**: List repository PRs
- **mcp__github__create_pull_request_review**: Create PR review
- **mcp__github__merge_pull_request**: Merge pull request
- **mcp__github__get_pull_request_files**: Get files changed in PR
- **mcp__github__get_pull_request_status**: Get PR status checks
- **mcp__github__update_pull_request_branch**: Update PR branch
- **mcp__github__get_pull_request_comments**: Get PR comments
- **mcp__github__get_pull_request_reviews**: Get PR reviews

### Search
- **mcp__github__search_code**: Search code across repositories
- **mcp__github__search_issues**: Search issues and pull requests
- **mcp__github__search_users**: Search GitHub users

## Documentation (MCP Server)

### Context7 Library Documentation
- **mcp__context7__resolve-library-id**: Find Context7-compatible library ID
  - `libraryName` (required): Library name to search for
- **mcp__context7__get-library-docs**: Get up-to-date library documentation
  - `context7CompatibleLibraryID` (required): Library ID from resolve step
  - `tokens` (optional): Maximum tokens to retrieve (default: 10000)
  - `topic` (optional): Focus documentation on specific topic

**Description**: Retrieves current documentation and code examples for any library. Must resolve library ID first unless user provides exact ID format.

## IDE Integration (MCP Server)

### VS Code Integration
- **mcp__ide__getDiagnostics**: Get language diagnostics
  - `uri` (optional): Specific file URI for diagnostics
- **mcp__ide__executeCode**: Execute Python code in Jupyter kernel
  - `code` (required): Python code to execute

**Description**: Integrates with VS Code language servers and Jupyter kernels for development workflow.

## Tool Usage Guidelines

### Best Practices
- **Batch Operations**: Use multiple tool calls in single response for parallel execution
- **Context Efficiency**: Prefer Task tool for complex searches to reduce context usage
- **File Operations**: Always read files before editing; prefer editing over creating new files
- **Error Handling**: Check tool results and handle errors appropriately
- **Security**: Never expose secrets or credentials in tool operations

### Common Workflows
1. **Code Search**: Glob → Grep → Read → Edit
2. **Task Planning**: TodoWrite → Task execution → TodoWrite updates
3. **Web Research**: WebSearch → WebFetch → Analysis
4. **GitHub Workflow**: Search → Clone/Fork → Edit → Commit → PR
5. **Documentation**: Context7 resolve → Get docs → Implementation

---

*Last updated: 2025-07-31*
*Tool count: 50+ tools across 8 categories*