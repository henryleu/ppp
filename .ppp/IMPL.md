# IMPL.md

## Implementation Notes

### Architecture

- TypeScript/Bun-based CLI tool
- Commander.js for command parsing
- Vercel AI SDK for LLM integration
- File-based storage with markdown files

### Development Notes

- ESM modules with native TypeScript support
- Dual-level configuration (global/project)
- MCP integration for AI assistants
- ASCII tables for universal terminal compatibility

## Issue & Sprint Commands - Implementation Decision Points

### Decision 1: Issue Type Mapping
**Question**: How should command issue types map to ID prefixes and file structures?

**Current Documentation**:
- Command types: `module`, `feature`, `epic`, `story`, `task`, `bug`
- ID prefixes: `F` (Module/Feature), `T` (Epic/Story/Task), `B` (Bug)

**Options**:
- A) `module`/`feature` → `F`, `epic`/`story`/`task` → `T`, `bug` → `B`
- B) Keep all types distinct with different prefixes
- C) Merge `module` and `feature` into single `feature` type

**Recommendation**: Option A - simpler mapping, aligns with documented ID rules

**Your Decision**: A

---

### Decision 2: File vs Folder Structure Logic
**Question**: When should issues create folders vs markdown files?

**Current Spec**:
- Modules/Features: Folders with `spec.md` inside
- Tasks/Epics/Stories: Direct `.md` files
- Bugs: Direct `.md` files

**Options**:
- A) Strict folder/file distinction as documented
- B) All issues create folders for extensibility
- C) All issues create files for simplicity

**Recommendation**: Option A - follows documented structure, clear separation

**Your Decision**: B

---

### Decision 3: Issue ID Auto-Generation Strategy
**Question**: How should we auto-generate unique issue IDs?

**Options**:
- A) Scan existing files/folders to find next available ID
- B) Maintain ID counter files (`.ppp/.counters.json`)
- C) Use timestamp-based IDs
- D) Let user specify IDs manually

**Recommendation**: Option A - simple, self-healing, no additional files

**Your Decision**: B

---

### Decision 4: Parent-Child Relationship Validation
**Question**: How strict should parent-child relationships be?

**Options**:
- A) Strict validation - parent must exist before creating child
- B) Soft validation - warn but allow creation
- C) No validation - trust user input
- D) Auto-create parent hierarchy if missing

**Recommendation**: Option A - prevents orphaned issues, maintains hierarchy

**Your Decision**: [TO BE FILLED]

---

### Decision 5: Interactive UI vs Command Line Priority
**Question**: Which interface should we implement first?

**Current Spec**: Both interactive and command-line modes

**Options**:
- A) Command-line first, interactive later
- B) Interactive first, command-line later
- C) Both simultaneously
- D) Command-line only

**Recommendation**: Option A - simpler to implement, easier to test

**Your Decision**: [TO BE FILLED]

---

### Decision 6: Sprint Integration Coupling
**Question**: How tightly should issues and sprints be coupled?

**Options**:
- A) Issues can exist without sprint assignment
- B) All issues must be assigned to a sprint
- C) Only tasks/bugs need sprint assignment
- D) Sprint assignment is purely optional metadata

**Recommendation**: Option A - flexibility for backlog management

**Your Decision**: [TO BE FILLED]

---

### Decision 7: Feature Bill Management
**Question**: How should the Feature Bill be maintained?

**Options**:
- A) Auto-generated on every issue create/update/delete
- B) Manual maintenance via separate command
- C) Generated on-demand via `ppp feature-bill generate`
- D) Real-time updates with change tracking

**Recommendation**: Option A - always up-to-date, no manual maintenance

**Your Decision**: [TO BE FILLED]

---

### Decision 8: File Content Templates
**Question**: What should be included in generated issue files?

**Options**:
- A) Rich templates with all attributes (ID, type, status, priority, etc.)
- B) Minimal templates with just ID and name
- C) YAML frontmatter + markdown content
- D) Configurable templates

**Recommendation**: Option A - comprehensive, consistent structure

**Your Decision**: [TO BE FILLED]

---

### Decision 9: Error Handling & Validation
**Question**: How should we handle various error scenarios?

**Key Scenarios**:
- LLM keyword generation fails
- File system permission errors
- Duplicate issue names
- Invalid parent references
- Missing project initialization

**Options**:
- A) Graceful degradation with fallbacks
- B) Strict validation with clear error messages
- C) Interactive retry mechanisms
- D) Combination of above

**Recommendation**: Option D - robust error handling with user-friendly recovery

**Your Decision**: [TO BE FILLED]

---

### Decision 10: Sprint Workflow & State Management
**Question**: How should sprint lifecycle be managed?

**Options**:
- A) Single active sprint at a time
- B) Multiple active sprints allowed
- C) Sprint states: planned, active, completed, archived
- D) Simple binary: active/inactive

**Recommendation**: Option A + C - clear workflow, simple state management

**Your Decision**: [TO BE FILLED]

---

## Implementation Plan

### Phase 1: Core Issue Management
1. Create issue utilities and types
2. Implement ID generation logic
3. Add file/folder creation logic
4. Create `ppp issue create` command (command-line mode)

### Phase 2: Issue Operations
1. Implement `ppp issue update` command
2. Add `ppp issue delete` command
3. Create `ppp issue list` command
4. Add parent-child relationship management

### Phase 3: Sprint Management
1. Create sprint utilities and types
2. Implement `ppp sprint create` command
3. Add `ppp sprint activate/delete` commands
4. Create `ppp issue put` command for sprint assignment

### Phase 4: Advanced Features
1. Interactive UI mode
2. Feature Bill auto-generation
3. Enhanced validation and error handling
4. Issue search and filtering

### Phase 5: Integration
1. Release.md management
2. MCP integration for AI assistants
3. Performance optimization
4. Documentation and examples

---

## Technical Architecture

### File Structure
```
src/
├── commands/
│   ├── issue.ts          # Issue command implementation
│   ├── sprint.ts         # Sprint command implementation
│   └── feature-bill.ts   # Feature Bill management
├── utils/
│   ├── issue.ts          # Issue utilities
│   ├── sprint.ts         # Sprint utilities
│   ├── id-generator.ts   # ID generation logic
│   └── file-manager.ts   # File system operations
└── types/
    ├── issue.ts          # Issue type definitions
    └── sprint.ts         # Sprint type definitions
```

### Core Types
```typescript
interface Issue {
  id: string;
  type: IssueType;
  name: string;
  keywords: string;
  status: IssueStatus;
  priority: IssuePriority;
  // ... other attributes
}

interface Sprint {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate?: string;
  issues: string[];
  // ... other attributes
}
```

---

## Next Steps

1. **Review and fill in your decisions above**
2. **Prioritize which commands to implement first**
3. **Confirm technical approach and file structure**
4. **Begin implementation based on your decisions**

Please edit the "[TO BE FILLED]" sections with your preferences, and I'll implement accordingly!
