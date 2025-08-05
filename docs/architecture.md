# Architecture Guide

This document provides detailed technical information about PPP's architecture, design decisions, and implementation details.

## System Overview

PPP (Product Prompt Planner) is built as a Node.js CLI application with the following key components:

- **CLI Interface**: Command-line interface built with Commander.js
- **MCP Server**: Model Context Protocol server for AI integration
- **File System**: YAML + Markdown based data storage
- **Issue Management**: Hierarchical issue tracking system

## Technology Stack

### Runtime & Build System
- **Bun**: Primary runtime, bundler, and package manager
- **TypeScript**: Main language with native Bun support
- **ESM Modules**: Modern JavaScript module system

### Core Dependencies
- **Commander.js**: CLI framework and command parsing
- **Prompts**: Interactive user input (lightweight alternative to inquirer)
- **cli-table3**: Terminal table formatting
- **js-yaml**: YAML parsing and generation
- **MCP SDK**: Model Context Protocol integration

### Development Tools
- **TypeScript Compiler**: Type checking and transpilation
- **Bun Build**: Bundling TypeScript to single executable
- **ESLint**: Code linting (planned)
- **Prettier**: Code formatting (planned)

## Architecture Patterns

### Command Pattern
Each CLI command is implemented as a separate module with consistent interface:

```typescript
interface Command {
  name: string;
  description: string;
  options: CommandOption[];
  action: (args: any, options: any) => Promise<void>;
}
```

### Repository Pattern
Data access is abstracted through repository interfaces:

```typescript
interface IssueRepository {
  create(issue: Issue): Promise<void>;
  update(id: string, data: Partial<Issue>): Promise<void>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<Issue | null>;
  findByParent(parentId: string): Promise<Issue[]>;
}
```

### Factory Pattern
Issue ID generation uses factory pattern for different issue types:

```typescript
interface IDGenerator {
  generate(type: IssueType, parent?: string): string;
  validate(id: string): boolean;
}
```

## Data Model

### Issue Hierarchy

PPP implements a 3-layer feature hierarchy:

```
Layer 1: F01, F02, ..., F99
Layer 2: F0101, F0102, ..., F9999
Layer 3: F010101, F010102, ..., F999999
```

Tasks and bugs follow parent issue numbering:
```
Tasks: T010101, T010102 (under feature F0101)
Bugs: B010101, B010102 (under feature/task)
```

### File System Structure

```
.ppp/
├── settings.json          # Project configuration
├── database.yml          # Issue database and counters
├── README.md             # Generated project overview
├── TRACK.md              # Task tracking
├── SPEC.md               # Project specifications
├── IMPL.md               # Implementation notes
├── Feature_Bill.md       # Feature hierarchy index
├── Release.md            # Sprint management
├── Sprint-01.md          # Individual sprint files
├── F01-feature_name/     # Feature folders
│   ├── spec.md          # Feature specification
│   ├── F01-subfeature/  # Sub-features
│   ├── T01-task_name/   # Task folders
│   └── B01-bug_name/    # Bug folders
└── _archived/           # Deleted issues backup
```

### Database Schema

The `database.yml` file contains:

```yaml
counters:
  features:
    layer1: 2  # Next F01, F02 counter
    layer2:    # Next F0101, F0201 counters
      "01": 3
      "02": 1
    layer3:    # Next F010101 counters
      "0101": 2
      "0201": 1
  tasks:       # Next T010101 counters
    "01": 5
    "0101": 3
  bugs:        # Next B010101 counters
    "01": 2
    "0101": 1

issues:
  F01:
    id: "F01"
    name: "User Management"
    type: "feature"
    status: "new"
    created: "2025-01-15T10:00:00Z"
    # ... other metadata
```

## Issue Management System

### ID Generation Algorithm

1. **Parse parent ID** to determine hierarchy level
2. **Look up counter** for the specific parent context
3. **Generate next ID** with proper formatting
4. **Update counter** atomically
5. **Validate uniqueness** before creation

### Folder Location Algorithm

PPP uses dynamic folder location without storing paths:

1. **Start from .ppp root**
2. **Parse issue ID** to determine hierarchy
3. **Search by prefix matching** at each level
4. **Build path dynamically** using parent relationships

This makes the system resilient to manual folder renames.

### Issue Lifecycle

```
Create → Update → Archive → Delete
   ↓        ↓        ↓
 Files   Metadata  Backup
Created  Updated   Created
```

## MCP Server Architecture

### Transport Layer
- **stdio**: Standard input/output for process communication
- **JSON-RPC 2.0**: Message protocol for requests/responses

### Capability Registration
```typescript
interface MCPCapabilities {
  tools: ToolDefinition[];
  resources: ResourceDefinition[];
  prompts: PromptDefinition[];
}
```

### Tool Implementation
Each MCP tool maps to CLI commands:

```typescript
async function handleToolCall(name: string, arguments: any) {
  switch (name) {
    case 'ppp_init':
      return await executeCommand('init', arguments);
    case 'ppp_status':
      return await executeCommand('status', arguments);
  }
}
```

### Resource Access
Resources provide read-only access to project files:

```typescript
interface Resource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}
```

## Performance Considerations

### File System Optimization
- **Lazy loading**: Only read files when needed
- **Caching**: Cache frequently accessed data
- **Atomic operations**: Ensure data consistency
- **Batch updates**: Group related file operations

### Memory Management
- **Stream processing**: Handle large files efficiently
- **Garbage collection**: Clean up temporary objects
- **Resource pooling**: Reuse expensive objects

### Scalability Limits
- **File system**: ~10,000 issues per project recommended
- **Memory**: Depends on issue content size
- **Performance**: Degrades linearly with project size

## Error Handling Strategy

### Error Categories
1. **Validation Errors**: Invalid input data
2. **File System Errors**: I/O operations
3. **Business Logic Errors**: Rule violations
4. **System Errors**: Runtime failures

### Error Recovery
- **Graceful degradation**: Continue with reduced functionality
- **Automatic retry**: Retry transient failures
- **User guidance**: Provide actionable error messages
- **Logging**: Comprehensive error logging

### Data Integrity
- **Atomic operations**: All-or-nothing updates
- **Backup on change**: Automatic backups before modifications
- **Validation**: Strict input validation
- **Recovery**: Ability to restore from corruption

## Security Considerations

### File System Security
- **Path validation**: Prevent directory traversal
- **Permission checks**: Verify file access rights
- **Sandboxing**: Limit file system access scope
- **Input sanitization**: Clean user input

### Configuration Security
- **API key storage**: Secure credential management
- **Access control**: Limit MCP server access
- **Audit logging**: Track security-relevant operations

## Extension Points

PPP is designed for extensibility:

### Custom Issue Types
Add new issue types by extending the type system:

```typescript
interface CustomIssueType extends IssueType {
  name: string;
  prefix: string;
  idPattern: RegExp;
  generator: IDGenerator;
}
```

### Plugin System
Future plugin architecture:

```typescript
interface Plugin {
  name: string;
  version: string;
  commands?: Command[];
  mcpTools?: ToolDefinition[];
  hooks?: EventHooks;
}
```

### Template Engine
Support for custom project templates:

```typescript
interface ProjectTemplate {
  name: string;
  description: string;
  files: TemplateFile[];
  hooks: TemplateHooks;
}
```

## Development Workflow

### Build Process
1. **TypeScript compilation**: Check types and transpile
2. **Bun bundling**: Create single executable
3. **Permission setting**: Make binary executable
4. **Testing**: Run automated tests

### Release Process
1. **Version bump**: Update package.json version
2. **Build**: Create production bundle
3. **Testing**: Run full test suite
4. **Packaging**: Create npm package
5. **Publishing**: Publish to npm registry

### Development Commands
```bash
bun run dev        # Watch mode development
bun run build      # Production build
bun run test       # Run tests
bun run lint       # Code linting
bun run format     # Code formatting
```

## Future Architecture

### Planned Improvements
- **Plugin system**: Extensible architecture
- **Database backend**: Optional SQL storage
- **Web interface**: Browser-based UI
- **API server**: REST/GraphQL endpoints
- **Real-time sync**: Multi-user collaboration

### Migration Strategy
- **Backward compatibility**: Support existing projects
- **Data migration**: Automated upgrade path
- **Feature flags**: Gradual feature rollout
- **Version detection**: Handle multiple formats