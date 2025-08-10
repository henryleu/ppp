# PPP Interactive UI Mode Design

## Overview

This document outlines the design for an interactive UI mode for the PPP (Product Prompt Planner) CLI tool. The interactive mode provides a modern, user-friendly interface that allows users to navigate, select, and execute commands without leaving the interactive session.

## Current CLI Analysis

### Existing Commands Structure
```
ppp
├── init [--name] [--template]
├── config 
│   ├── get <key>
│   ├── set <key> <value>
│   └── list
├── keywords <text>
├── issue
│   ├── create <type> [parent_id] [name] [options]
│   ├── update <issue_id> [name] [options]
│   ├── delete <issue_id> [--force]
│   └── list [issue_id] [filters]
├── sprint
│   ├── create [name]
│   ├── activate <sprint_id>
│   ├── delete <sprint_id>
│   ├── complete <sprint_id>
│   ├── list
│   ├── add <issue_id> <sprint_id>
│   └── remove <issue_id> <sprint_id>
├── generate
├── setup-mcp
└── --mcp-server
```

### Current Issue System
- **Hierarchical Structure**: 3-layer feature hierarchy (F01 → F0101 → F010101)
- **Issue Types**: Features (F), Tasks/Stories (T), Bugs (B)
- **Sprint Management**: Database-driven with Object ID normalization
- **Rich Metadata**: Status, priority, assignee, labels, parent relationships

### Current Tech Stack
- **Runtime**: Bun (ESM modules)
- **CLI Framework**: Commander.js
- **UI Components**: cli-table3 (tables), prompts (basic interactions)
- **Styling**: ANSI color codes, Unicode characters for icons
- **Data Management**: Hybrid YAML + Markdown storage

## Interactive Library Research Results

### Recommended Primary Choice: Terminal-Kit

**Why Terminal-Kit:**
- ✅ Native keyboard navigation and input handling
- ✅ Built-in autocomplete and live filtering capabilities
- ✅ Excellent Bun runtime compatibility (pure JavaScript)
- ✅ Rich widget library (menus, lists, forms, progress bars)
- ✅ Small bundle size (~200KB uncompressed)
- ✅ TypeScript declarations available
- ✅ Active maintenance and good documentation

**Key Features:**
```javascript
// Interactive menu with keyboard navigation
const menu = terminal.singleLineMenu([
  'Issue Management',
  'Sprint Management', 
  'Configuration',
  'Exit'
]);

// Auto-complete with live filtering
const autoComplete = terminal.inputField({
  autoComplete: issueList,
  autoCompleteMenu: true
});

// Multi-select list with search
const selectedItems = terminal.gridMenu(items, {
  style: terminal.inverse,
  selectedStyle: terminal.dim.blue.bgGreen
});
```

### Alternative Options Evaluated

**Ink (React for CLI):**
- ✅ Component-based architecture
- ✅ Excellent TypeScript support
- ❌ Larger bundle size (~1MB+)
- ❌ Adds React dependency complexity
- ✅ Good for complex layouts

**Inquirer.js:**
- ✅ Most popular choice
- ✅ Rich prompt types
- ❌ Heavier bundle size
- ❌ Not designed for persistent interactive sessions

**@clack/prompts:**
- ✅ Modern, beautiful prompts
- ❌ Bun compatibility issues found in research
- ❌ Limited persistent session support

## Top-Level Interactive UI Architecture

### Entry Command
```bash
ppp ui          # Launch interactive mode
ppp interactive # Alternative command
```

### Main Interface Layout
```
┌─ PPP Interactive Mode ─────────────────────────────────────────┐
│                                                                │
│  🏗️  Issue Management                                          │
│  🏃  Sprint Management                                         │
│  ⚙️   Configuration                                             │
│  📋  Project Status                                            │
│  🔧  Utilities                                                 │
│  ❌  Exit                                                       │
│                                                                │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Status: .ppp initialized | Active Sprint: S02           │ │
│ │ Navigation: ↑↓ Select | Enter: Confirm | Esc: Back     │ │
│ └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

### Context-Aware Navigation
- **Status Bar**: Always shows current project status and navigation help
- **Breadcrumb Trail**: Shows navigation path (Main → Issue Management → List Issues)
- **Dynamic Menus**: Menu options change based on project state and available data
- **Keyboard Shortcuts**: Quick access to common actions

## Detailed UX Flows

### 1. Issue Management Flow

#### Issue List Browser
```
┌─ Issue Management ─────────────────────────────────────────────┐
│                                                                │
│ Search: [F01 user auth          ] 🔍  Filter: [All Types ▼]   │
│                                                                │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ ✓ F01      User Authentication         │ NEW    │ HIGH  │ │
│ │   ├─ F0101 Login System              │ PROG   │ MED   │ │
│ │   │   ├─ T010101 Login Form          │ NEW    │ LOW   │ │
│ │   │   └─ T010102 Password Reset      │ BLOCKED│ HIGH  │ │
│ │   └─ F0102 OAuth Integration         │ NEW    │ MED   │ │
│ │ ✓ F02      User Profile Management   │ DONE   │ LOW   │ │
│ │ ✓ B010101  Login Form Bug            │ NEW    │ HIGH  │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                                │
│ Actions: [Create] [Edit] [Delete] [View Details] [Sprint]     │
│ Navigation: ↑↓ Select | Enter: Action Menu | /: Search       │
└────────────────────────────────────────────────────────────────┘
```

**Features:**
- **Hierarchical Tree View**: Shows parent-child relationships with indent levels
- **Live Type-Ahead Search**: Filter by ID, name, or keywords as you type
- **Multi-Column Filtering**: Separate filters for type, status, priority, assignee, sprint
- **Visual Status Indicators**: Color-coded status with icons
- **Quick Actions**: Context menu for common operations

#### Issue Creation Flow
```
┌─ Create New Issue ─────────────────────────────────────────────┐
│                                                                │
│ Issue Type: ● Feature  ○ Story  ○ Task  ○ Bug                 │
│                                                                │
│ Name: [User Authentication System                      ]       │
│                                                                │
│ Parent (optional): [F01 - User Management     ▼] [Browse]     │
│                                                                │
│ Priority: [● High  ○ Medium  ○ Low]                           │
│                                                                │
│ Description:                                                   │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Implement comprehensive user authentication system         │ │
│ │ with login, logout, and password management features      │ │
│ │                                                            │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                │
│ Assignee: [john.doe@company.com            ] [Browse Users]   │
│                                                                │
│ Labels: [authentication, security, backend ] [+ Add]         │
│                                                                │
│ [Create Issue] [Cancel] [Save as Draft]                       │
└────────────────────────────────────────────────────────────────┘
```

**Features:**
- **Smart Parent Selection**: Browse existing issues in tree format
- **Auto-completion**: User names, labels, and common values
- **Preview Mode**: See generated ID and folder structure before creation
- **Validation**: Real-time validation of required fields

### 2. Sprint Management Flow

#### Sprint Dashboard
```
┌─ Sprint Management ────────────────────────────────────────────┐
│                                                                │
│ Active Sprint: S02 - Q1 Feature Development                   │
│ ┌────────────┬─────────────┬──────────────┬───────────────┐   │
│ │ Status     │ Issues      │ Completed    │ Velocity      │   │
│ │ ●  ACTIVE  │ 12 total    │ 7 (58%)     │ 23 points    │   │
│ └────────────┴─────────────┴──────────────┴───────────────┘   │
│                                                                │
│ All Sprints:                                                   │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ ● S02  Q1 Feature Development    │ ACTIVE  │ 12 issues │ │
│ │   S01  Initial Setup Sprint      │ DONE    │  8 issues │ │
│ │   S03  Q1 Bug Fix Sprint         │ PLANNED │  0 issues │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                                │
│ Actions: [Create Sprint] [Activate] [Complete] [Manage Issues] │
│ Navigation: ↑↓ Select | Enter: Sprint Details | c: Create     │
└────────────────────────────────────────────────────────────────┘
```

#### Sprint Issue Management
```
┌─ Sprint S02 - Issue Management ────────────────────────────────┐
│                                                                │
│ Sprint Issues (12):                   Available Issues (45):  │
│ ┌─────────────────────────────────┐ ┌──────────────────────────┐ │
│ │ ✓ F0101 Login System           │ │ F0102 OAuth Integration  │ │
│ │ ✓ T010101 Login Form           │ │ F02 Profile Management   │ │
│ │ ● T010102 Password Reset       │ │ B010201 Profile Bug      │ │
│ │ ● F0103 Session Management     │ │ F03 Settings System      │ │
│ │                                │ │ T030101 User Preferences │ │
│ └─────────────────────────────────┘ └──────────────────────────┘ │
│                                                                │
│ Multi-Select Mode: Space to select, Enter to add/remove       │
│ Search: [profile                ] Filter: [All Types ▼]       │
│                                                                │
│ [Add Selected] [Remove Selected] [Auto-Assign] [Back]         │
└────────────────────────────────────────────────────────────────┘
```

**Features:**
- **Dual-Pane Interface**: Sprint issues vs available issues
- **Drag-and-Drop Style**: Visual indication of add/remove operations
- **Batch Operations**: Multi-select for bulk issue assignment
- **Smart Auto-Assignment**: Suggest issues based on dependencies and priority

### 3. Type-Ahead Search and Autocompletion Design

#### Search Implementation
```typescript
interface SearchConfig {
  items: SearchableItem[];
  searchFields: string[];           // ['id', 'name', 'description', 'assignee']
  fuzzyMatch: boolean;             // Enable fuzzy string matching
  maxResults: number;              // Limit results for performance
  groupBy?: string;                // Group results by field
  sortBy?: string;                 // Default sort field
}

interface SearchableItem {
  id: string;
  name: string;
  type: 'issue' | 'sprint' | 'user';
  searchText: string;              // Computed search index
  metadata: Record<string, any>;   // Additional filterable fields
}
```

#### Live Filtering Features
```
Search: [F01 auth                    ] 🔍
├─ Searching in: Names, IDs, Descriptions
├─ Filters Active: Type=Feature, Status=New  [×] Clear
├─ Sort: Priority ↑  [Change]
└─ Found: 3 of 45 items

Auto-complete dropdown:
┌─────────────────────────────────────┐
│ F01 - User Authentication System    │ ← Exact match (highlighted)
│ F0101 - Login System               │
│ F0102 - OAuth Authentication       │
│ T010101 - Auth Form Validation     │ ← Fuzzy matches
└─────────────────────────────────────┘
```

**Features:**
- **Real-Time Filtering**: Results update as you type
- **Multi-Field Search**: Search across ID, name, description, assignee
- **Fuzzy Matching**: Find items with partial or misspelled terms
- **Search History**: Remember recent searches within session
- **Keyboard Navigation**: Arrow keys to navigate suggestions
- **Quick Filters**: Predefined filter buttons for common queries

### 4. Command Execution and Results Display

#### In-Session Command Execution
```
┌─ Command: Create Issue ────────────────────────────────────────┐
│                                                                │
│ ⟳ Executing: ppp issue create feature "User Authentication"   │
│                                                                │
│ ✓ Issue ID generated: F03                                     │
│ ✓ Keywords extracted: user, authentication, login, security   │
│ ✓ Folder created: .ppp/F03-user-authentication/               │
│ ✓ Spec file initialized: .ppp/F03-user-authentication/spec.md │
│                                                                │
│ Result:                                                        │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Issue: F03 - User Authentication                           │ │
│ │ Type: Feature                                              │ │
│ │ Status: New                                                │ │
│ │ Priority: Medium                                           │ │
│ │ Created: 2025-08-10 10:30:45                              │ │
│ │ Folder: .ppp/F03-user-authentication/                     │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                │
│ Next Actions: [View Issue] [Create Child] [Add to Sprint]     │
│ [Continue in UI] [Back to List] [Exit]                        │
└────────────────────────────────────────────────────────────────┘
```

#### Persistent Session Management
- **Stay in Interactive Mode**: Commands execute and return to UI
- **Command History**: Track executed commands in session
- **Undo Support**: Ability to undo recent operations where possible
- **Session State**: Remember current view, filters, and selections
- **Quick Actions**: Context-sensitive action buttons

## Implementation Architecture

### File Structure
```
src/
├── commands/
│   └── interactive.ts          # Main interactive command
├── ui/
│   ├── terminal-kit-adapter.ts # Terminal-kit wrapper
│   ├── components/
│   │   ├── menu.ts            # Main menu component
│   │   ├── issue-list.ts      # Issue browser component
│   │   ├── sprint-dashboard.ts # Sprint management component
│   │   ├── search-input.ts    # Search and autocomplete
│   │   └── status-bar.ts      # Status bar component
│   ├── layouts/
│   │   ├── main-layout.ts     # Base layout structure
│   │   └── dialog-layout.ts   # Modal dialogs
│   └── utils/
│       ├── keyboard-handler.ts # Key binding management
│       ├── search-engine.ts   # Search and filter logic
│       └── state-manager.ts   # UI state management
└── types/
    └── ui.ts                  # UI-specific type definitions
```

### Core Classes

#### InteractiveSession
```typescript
class InteractiveSession {
  private terminal: TerminalKit.Terminal;
  private currentView: UIView;
  private state: SessionState;
  private keyboardHandler: KeyboardHandler;

  async start(): Promise<void>;
  async navigate(view: UIView): Promise<void>;
  async executeCommand(command: string, args: any[]): Promise<CommandResult>;
  async showDialog(dialog: DialogConfig): Promise<any>;
  cleanup(): void;
}
```

#### SearchEngine
```typescript
class SearchEngine {
  private index: SearchIndex;
  
  buildIndex(items: SearchableItem[]): void;
  search(query: string, filters?: FilterConfig): SearchResult[];
  suggest(partial: string): string[];
  addFilter(field: string, value: any): void;
  clearFilters(): void;
}
```

#### UIComponent Base Class
```typescript
abstract class UIComponent {
  abstract render(): Promise<void>;
  abstract handleInput(key: string, data: any): Promise<boolean>;
  onMount?(): Promise<void>;
  onUnmount?(): Promise<void>;
}
```

### Integration Points

#### Command Integration
```typescript
// Reuse existing command logic
import { hybridManager } from '../utils/hybrid-manager.js';
import { sprintManager } from '../utils/sprint.js';

// Execute CLI commands programmatically
async function executeCreateIssue(data: IssueCreationData): Promise<Issue> {
  return hybridManager.createIssue(data);
}
```

#### Data Layer Compatibility
- **Maintain Existing APIs**: Use current hybridManager and sprintManager
- **No Schema Changes**: Interactive mode works with existing data structures
- **Command Parity**: Every interactive action has CLI command equivalent
- **State Synchronization**: Changes made in interactive mode reflect in CLI and vice versa

## Advanced Features

### Smart Suggestions
- **Related Issues**: Suggest related issues when creating or editing
- **Sprint Recommendations**: Auto-suggest issues for sprint based on priority and dependencies
- **Completion Predictions**: Predict likely next actions based on current context

### Accessibility
- **Keyboard Only**: Full navigation without mouse
- **Screen Reader Support**: ARIA-compatible terminal output
- **High Contrast Mode**: Color schemes for visibility
- **Reduced Motion**: Option to disable animations

### Performance Optimizations
- **Lazy Loading**: Load issue/sprint data on demand
- **Virtual Scrolling**: Handle large lists efficiently
- **Search Debouncing**: Optimize search performance
- **Caching**: Cache frequently accessed data

### Error Handling
- **Graceful Degradation**: Fallback to CLI mode if interactive fails
- **Error Recovery**: Handle network issues, file permissions, etc.
- **User Feedback**: Clear error messages with suggested solutions
- **Session Recovery**: Save and restore session state on crashes

## Development Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Install and configure terminal-kit
- [ ] Create basic interactive session framework
- [ ] Implement main menu navigation
- [ ] Basic keyboard handling and layout system

### Phase 2: Core Features (Week 3-4)
- [ ] Issue list browser with search
- [ ] Sprint dashboard and management
- [ ] Command execution integration
- [ ] Status bar and navigation breadcrumbs

### Phase 3: Advanced UI (Week 5-6)
- [ ] Type-ahead search and autocompletion
- [ ] Multi-select and batch operations
- [ ] Form-based issue/sprint creation
- [ ] Enhanced visual styling and colors

### Phase 4: Polish & Testing (Week 7-8)
- [ ] Error handling and edge cases
- [ ] Performance optimization
- [ ] User testing and feedback integration
- [ ] Documentation and help system

## Testing Strategy

### Unit Tests
- Search engine functionality
- UI component rendering
- Keyboard input handling
- State management

### Integration Tests
- Command execution integration
- Data layer compatibility
- Session management
- Error recovery

### Manual Testing
- User experience flows
- Accessibility testing
- Performance with large datasets
- Cross-platform compatibility (macOS, Linux, Windows)

## Conclusion

This interactive UI mode will transform the PPP CLI from a command-based tool into a modern, user-friendly interface while preserving all existing functionality. The design prioritizes:

1. **Ease of Use**: Intuitive navigation and visual feedback
2. **Efficiency**: Quick access to common operations
3. **Compatibility**: Full integration with existing CLI commands and data
4. **Extensibility**: Architecture supports future enhancements
5. **Performance**: Efficient handling of large datasets

The interactive mode will make PPP more accessible to users who prefer GUI-style interactions while maintaining the power and flexibility of the underlying CLI system.