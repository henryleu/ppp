/**
 * Issue list browser component for PPP interactive UI
 * Provides browsing, searching, and management of issues
 */

import { TerminalAdapter } from '../terminal-kit-adapter.js';
import { SearchEngine } from '../utils/search-engine.js';
import { KeyboardHandler, KeyBindingPresets } from '../utils/keyboard-handler.js';
import { SessionManager } from '../utils/session-manager.js';
import { hybridManager } from '../../utils/hybrid-manager.js';
import { SearchableItem, UIView, UIColors, MenuOption } from '../../types/ui.js';
import { Issue, IssueType, IssueStatus, IssuePriority } from '../../types/issue.js';

export interface IssueListOptions {
  parentId?: string;
  showHierarchy?: boolean;
  level?: number;
  filters?: Record<string, any>;
}

export class IssueListComponent {
  private terminal: TerminalAdapter;
  private session: SessionManager;
  private keyboard: KeyboardHandler;
  private searchEngine: SearchEngine;
  
  private issues: Issue[] = [];
  private searchableItems: SearchableItem[] = [];
  private filteredItems: SearchableItem[] = [];
  private selectedIndex = 0;
  private selectedItems: Set<string> = new Set();
  private isSearchMode = false;
  private searchQuery = '';
  private currentFilters: Record<string, any> = {};
  private options: IssueListOptions;

  constructor(session: SessionManager, options: IssueListOptions = {}) {
    this.session = session;
    this.terminal = session.getTerminal();
    this.keyboard = new KeyboardHandler();
    this.searchEngine = new SearchEngine();
    this.options = options;
    
    this.setupKeyBindings();
  }

  /**
   * Initialize and render the component
   */
  async init(): Promise<void> {
    await this.loadIssues();
    await this.render();
  }

  /**
   * Handle key press events
   */
  async handleKey(keyName: string): Promise<boolean> {
    if (this.isSearchMode) {
      return await this.handleSearchKey(keyName);
    }
    
    return await this.keyboard.handle(keyName);
  }

  /**
   * Load issues from database
   */
  private async loadIssues(): Promise<void> {
    try {
      const filters: any = {
        parentId: this.options.parentId,
        ...this.options.filters
      };

      if (this.options.showHierarchy && this.options.parentId) {
        this.issues = await hybridManager.listIssuesHierarchical(this.options.parentId, filters);
      } else {
        this.issues = await hybridManager.listIssues(filters);
      }

      // Convert to searchable items
      this.searchableItems = this.issues.map(issue => ({
        id: issue.id,
        name: issue.name,
        type: 'issue' as const,
        searchText: `${issue.id} ${issue.name} ${issue.description} ${issue.assignee || ''} ${issue.labels.join(' ')}`,
        metadata: {
          issueType: issue.type,
          status: issue.status,
          priority: issue.priority,
          assignee: issue.assignee,
          parentId: issue.parentId,
          sprintId: issue.sprintId,
          labels: issue.labels,
          createdAt: issue.createdAt,
          updatedAt: issue.updatedAt
        }
      }));

      // Build search index
      this.searchEngine.buildIndex(this.searchableItems);
      this.filteredItems = [...this.searchableItems];

    } catch (error) {
      console.error('Error loading issues:', error);
      this.issues = [];
      this.searchableItems = [];
      this.filteredItems = [];
    }
  }

  /**
   * Render the component
   */
  private async render(): Promise<void> {
    this.terminal.clear();
    
    const { width, height } = this.terminal.getSize();
    
    // Header
    await this.renderHeader();
    
    // Search bar
    await this.renderSearchBar();
    
    // Filters
    await this.renderFilters();
    
    // Issue list
    await this.renderIssueList();
    
    // Status bar
    await this.renderStatusBar();
    
    // Action buttons
    await this.renderActions();
  }

  private async renderHeader(): Promise<void> {
    const title = this.options.parentId 
      ? `Issues under ${this.options.parentId}` 
      : 'All Issues';
      
    this.terminal.writeAt(2, 2, `🏗️  ${title}`, UIColors.PRIMARY);
    
    if (this.options.level) {
      this.terminal.writeAt(2, 3, `Showing issues up to level ${this.options.level}`);
    }
    
    this.terminal.writeAt(2, 4, '─'.repeat(60));
  }

  private async renderSearchBar(): Promise<void> {
    const searchPrompt = 'Search: ';
    const searchValue = this.isSearchMode ? this.searchQuery + '█' : this.searchQuery;
    const filterCount = Object.keys(this.currentFilters).length;
    
    this.terminal.writeAt(2, 6, searchPrompt);
    this.terminal.writeAt(2 + searchPrompt.length, 6, `[${searchValue.padEnd(30)}]`);
    this.terminal.writeAt(35, 6, '🔍');
    
    if (filterCount > 0) {
      this.terminal.writeAt(40, 6, `Filters: ${filterCount} active`, UIColors.INFO);
    }
  }

  private async renderFilters(): Promise<void> {
    const filterY = 8;
    let x = 2;
    
    // Quick filter buttons
    const typeFilters = ['All', 'Feature', 'Task', 'Story', 'Bug'];
    typeFilters.forEach((type, index) => {
      const isActive = this.currentFilters.type === type.toLowerCase() || (type === 'All' && !this.currentFilters.type);
      const color = isActive ? UIColors.HIGHLIGHT : UIColors.DISABLED;
      
      this.terminal.writeAt(x, filterY, `[${index + 1}] ${type}`, color);
      x += type.length + 6;
    });
  }

  private async renderIssueList(): Promise<void> {
    const listStartY = 10;
    const { height } = this.terminal.getSize();
    const maxItems = height - 15; // Leave space for header, search, and status
    
    if (this.filteredItems.length === 0) {
      this.terminal.writeAt(4, listStartY, 'No issues found.');
      if (this.searchQuery) {
        this.terminal.writeAt(4, listStartY + 1, 'Try adjusting your search or filters.');
      } else {
        this.terminal.writeAt(4, listStartY + 1, 'Create your first issue to get started.');
      }
      return;
    }

    // Table headers
    this.terminal.writeAt(2, listStartY, '┌─────────────┬─────────────────────────────────────┬──────────┬─────────────┬─────────────┐');
    this.terminal.writeAt(2, listStartY + 1, '│ ID          │ Name                               │ Type     │ Status      │ Priority    │');
    this.terminal.writeAt(2, listStartY + 2, '├─────────────┼─────────────────────────────────────┼──────────┼─────────────┼─────────────┤');

    // Issue rows
    const startIndex = Math.max(0, this.selectedIndex - Math.floor(maxItems / 2));
    const endIndex = Math.min(startIndex + maxItems, this.filteredItems.length);

    for (let i = startIndex; i < endIndex; i++) {
      const item = this.filteredItems[i];
      const issue = this.issues.find(iss => iss.id === item.id);
      if (!issue) continue;

      const y = listStartY + 3 + (i - startIndex);
      const isSelected = i === this.selectedIndex;
      const isChecked = this.selectedItems.has(issue.id);
      
      // Background for selected item
      if (isSelected) {
        this.terminal.terminal.moveTo(1, y);
        this.terminal.terminal.bgBlue(' '.repeat(this.terminal.getSize().width));
      }

      // Row content
      const color = isSelected ? UIColors.HIGHLIGHT : UIColors.RESET;
      const checkbox = isChecked ? '☑' : '☐';
      
      this.terminal.writeAt(2, y, '│', color);
      this.terminal.writeAt(4, y, `${checkbox} ${issue.id.padEnd(9)}`, color);
      this.terminal.writeAt(16, y, '│', color);
      this.terminal.writeAt(18, y, this.truncateText(issue.name, 33), color);
      this.terminal.writeAt(54, y, '│', color);
      this.terminal.writeAt(56, y, this.getTypeIcon(issue.type) + ' ' + issue.type.padEnd(6), this.getTypeColor(issue.type));
      this.terminal.writeAt(66, y, '│', color);
      this.terminal.writeAt(68, y, issue.status.padEnd(11), this.getStatusColor(issue.status));
      this.terminal.writeAt(81, y, '│', color);
      this.terminal.writeAt(83, y, issue.priority.padEnd(11), this.getPriorityColor(issue.priority));
      this.terminal.writeAt(96, y, '│', color);
    }

    // Table bottom
    const tableBottomY = listStartY + 3 + (endIndex - startIndex);
    this.terminal.writeAt(2, tableBottomY, '└─────────────┴─────────────────────────────────────┴──────────┴─────────────┴─────────────┘');

    // Pagination info
    if (this.filteredItems.length > maxItems) {
      const pageInfo = `Showing ${startIndex + 1}-${endIndex} of ${this.filteredItems.length}`;
      this.terminal.writeAt(2, tableBottomY + 2, pageInfo, UIColors.INFO);
    }
  }

  private async renderStatusBar(): Promise<void> {
    const { height } = this.terminal.getSize();
    const shortcuts = this.isSearchMode 
      ? ['ESC: Exit search', 'Enter: Search']
      : ['↑↓: Navigate', 'Space: Select', '/: Search', 'Enter: Action Menu'];
    
    this.terminal.showStatusBar(`Issues: ${this.filteredItems.length}`, shortcuts);
  }

  private async renderActions(): Promise<void> {
    const { height } = this.terminal.getSize();
    const actionsY = height - 3;
    
    const actions = ['[C] Create', '[E] Edit', '[D] Delete', '[S] Sprint', '[F] Filter'];
    this.terminal.writeAt(2, actionsY, actions.join('  '));
  }

  private setupKeyBindings(): void {
    // Navigation
    this.keyboard.register({
      ...KeyBindingPresets.MOVE_UP,
      action: () => this.moveSelection(-1)
    });

    this.keyboard.register({
      ...KeyBindingPresets.MOVE_DOWN,
      action: () => this.moveSelection(1)
    });

    this.keyboard.register({
      ...KeyBindingPresets.PAGE_UP,
      action: () => this.moveSelection(-10)
    });

    this.keyboard.register({
      ...KeyBindingPresets.PAGE_DOWN,
      action: () => this.moveSelection(10)
    });

    // Selection
    this.keyboard.register({
      ...KeyBindingPresets.TOGGLE_SELECT,
      action: () => this.toggleSelection()
    });

    // Search
    this.keyboard.register({
      ...KeyBindingPresets.SEARCH,
      action: () => this.enterSearchMode()
    });

    // Actions
    this.keyboard.register({
      key: 'ENTER',
      description: 'Show action menu',
      action: () => this.showActionMenu()
    });

    this.keyboard.register({
      ...KeyBindingPresets.CREATE,
      action: () => this.createIssue()
    });

    this.keyboard.register({
      ...KeyBindingPresets.EDIT,
      action: () => this.editIssue()
    });

    this.keyboard.register({
      ...KeyBindingPresets.DELETE,
      action: () => this.deleteIssue()
    });

    this.keyboard.register({
      ...KeyBindingPresets.REFRESH,
      action: () => this.refresh()
    });

    // Type filters
    for (let i = 1; i <= 5; i++) {
      this.keyboard.register({
        key: i.toString(),
        description: `Filter by type ${i}`,
        action: () => this.applyTypeFilter(i)
      });
    }
  }

  private async moveSelection(delta: number): Promise<void> {
    if (this.filteredItems.length === 0) return;
    
    this.selectedIndex = Math.max(0, Math.min(this.selectedIndex + delta, this.filteredItems.length - 1));
    await this.render();
  }

  private async toggleSelection(): Promise<void> {
    if (this.filteredItems.length === 0) return;
    
    const item = this.filteredItems[this.selectedIndex];
    if (this.selectedItems.has(item.id)) {
      this.selectedItems.delete(item.id);
    } else {
      this.selectedItems.add(item.id);
    }
    
    await this.render();
  }

  private async enterSearchMode(): Promise<void> {
    this.isSearchMode = true;
    await this.render();
  }

  private async handleSearchKey(keyName: string): Promise<boolean> {
    switch (keyName) {
      case 'ESCAPE':
        this.isSearchMode = false;
        this.searchQuery = '';
        await this.performSearch();
        await this.render();
        return true;
        
      case 'ENTER':
        this.isSearchMode = false;
        await this.performSearch();
        await this.render();
        return true;
        
      case 'BACKSPACE':
        this.searchQuery = this.searchQuery.slice(0, -1);
        await this.performSearch();
        await this.render();
        return true;
        
      default:
        if (keyName.length === 1 && keyName.match(/[a-zA-Z0-9\s]/)) {
          this.searchQuery += keyName;
          await this.performSearch();
          await this.render();
          return true;
        }
        return false;
    }
  }

  private async performSearch(): Promise<void> {
    const result = this.searchEngine.search(this.searchQuery, {
      fuzzyMatch: true,
      maxResults: 100
    });
    
    this.filteredItems = result.items;
    this.selectedIndex = 0;
  }

  private async applyTypeFilter(filterIndex: number): Promise<void> {
    const typeMap = ['', 'feature', 'task', 'story', 'bug'];
    const type = typeMap[filterIndex];
    
    if (type) {
      this.searchEngine.addFilter({ field: 'issueType', value: type });
      this.currentFilters.type = type;
    } else {
      this.searchEngine.removeFilter('issueType');
      delete this.currentFilters.type;
    }
    
    await this.performSearch();
    await this.render();
  }

  private async showActionMenu(): Promise<void> {
    if (this.filteredItems.length === 0) return;
    
    const selectedIssue = this.issues.find(iss => iss.id === this.filteredItems[this.selectedIndex].id);
    if (!selectedIssue) return;

    const options: MenuOption[] = [
      { id: 'view', label: 'View Details', icon: '👁️' },
      { id: 'edit', label: 'Edit Issue', icon: '✏️' },
      { id: 'assign-sprint', label: 'Assign to Sprint', icon: '🏃' },
      { id: 'delete', label: 'Delete Issue', icon: '🗑️' },
      { id: 'create-child', label: 'Create Child Issue', icon: '➕' }
    ];

    const selected = await this.terminal.showMenu(options, `Actions for ${selectedIssue.id}`);
    
    if (selected) {
      switch (selected.id) {
        case 'view':
          await this.viewIssueDetails(selectedIssue);
          break;
        case 'edit':
          await this.editIssue();
          break;
        case 'assign-sprint':
          await this.assignToSprint(selectedIssue);
          break;
        case 'delete':
          await this.deleteIssue();
          break;
        case 'create-child':
          await this.createChildIssue(selectedIssue);
          break;
      }
    }
    
    await this.render();
  }

  private async viewIssueDetails(issue: Issue): Promise<void> {
    this.terminal.clear();
    this.terminal.writeAt(2, 2, `Issue Details: ${issue.id}`, UIColors.PRIMARY);
    this.terminal.writeAt(2, 4, `Name: ${issue.name}`);
    this.terminal.writeAt(2, 5, `Type: ${this.getTypeIcon(issue.type)} ${issue.type}`);
    this.terminal.writeAt(2, 6, `Status: ${issue.status}`);
    this.terminal.writeAt(2, 7, `Priority: ${issue.priority}`);
    this.terminal.writeAt(2, 8, `Assignee: ${issue.assignee || 'Unassigned'}`);
    this.terminal.writeAt(2, 9, `Sprint: ${issue.sprintId || 'No sprint'}`);
    this.terminal.writeAt(2, 10, `Created: ${new Date(issue.createdAt).toLocaleString()}`);
    
    if (issue.description) {
      this.terminal.writeAt(2, 12, 'Description:');
      this.terminal.writeAt(2, 13, issue.description);
    }
    
    this.terminal.writeAt(2, 16, 'Press any key to go back...');
    
    await new Promise<void>((resolve) => {
      this.terminal.terminal.once('key', () => resolve());
    });
  }

  private async createIssue(): Promise<void> {
    // TODO: Implement create issue form
    await this.session.showDialog('Create Issue', 'Issue creation form not yet implemented');
  }

  private async editIssue(): Promise<void> {
    // TODO: Implement edit issue form
    await this.session.showDialog('Edit Issue', 'Issue editing form not yet implemented');
  }

  private async deleteIssue(): Promise<void> {
    if (this.filteredItems.length === 0) return;
    
    const item = this.filteredItems[this.selectedIndex];
    const confirmed = await this.session.showDialog('Confirm Delete', `Are you sure you want to delete issue ${item.id}?`, 'confirm') as boolean;
    
    if (confirmed) {
      try {
        await this.session.executeCommand('issue.delete', [item.id]);
        await this.refresh();
        await this.session.showDialog('Success', `Issue ${item.id} deleted successfully`);
      } catch (error) {
        await this.session.showDialog('Error', `Failed to delete issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  private async assignToSprint(issue: Issue): Promise<void> {
    // TODO: Implement sprint assignment
    await this.session.showDialog('Assign to Sprint', 'Sprint assignment not yet implemented');
  }

  private async createChildIssue(parent: Issue): Promise<void> {
    // TODO: Implement child issue creation
    await this.session.showDialog('Create Child Issue', `Child issue creation for ${parent.id} not yet implemented`);
  }

  private async refresh(): Promise<void> {
    await this.loadIssues();
    await this.render();
  }

  // Helper methods for styling
  private getTypeIcon(type: IssueType): string {
    switch (type) {
      case IssueType.FEATURE: return '🎯';
      case IssueType.STORY: return '📖';
      case IssueType.TASK: return '✅';
      case IssueType.BUG: return '🐛';
      default: return '📋';
    }
  }

  private getTypeColor(type: IssueType): UIColors {
    switch (type) {
      case IssueType.FEATURE: return UIColors.INFO;
      case IssueType.STORY: return UIColors.PRIMARY;
      case IssueType.TASK: return UIColors.SUCCESS;
      case IssueType.BUG: return UIColors.ERROR;
      default: return UIColors.RESET;
    }
  }

  private getStatusColor(status: IssueStatus): UIColors {
    switch (status) {
      case IssueStatus.NEW: return UIColors.PRIMARY;
      case IssueStatus.IN_PROGRESS: return UIColors.WARNING;
      case IssueStatus.DONE: return UIColors.SUCCESS;
      case IssueStatus.BLOCKED: return UIColors.ERROR;
      case IssueStatus.CANCELLED: return UIColors.DISABLED;
      default: return UIColors.RESET;
    }
  }

  private getPriorityColor(priority: IssuePriority): UIColors {
    switch (priority) {
      case IssuePriority.HIGH: return UIColors.ERROR;
      case IssuePriority.MEDIUM: return UIColors.WARNING;
      case IssuePriority.LOW: return UIColors.SUCCESS;
      default: return UIColors.RESET;
    }
  }

  private truncateText(text: string, maxLength: number): string {
    return text.length > maxLength ? text.slice(0, maxLength - 3) + '...' : text.padEnd(maxLength);
  }
}