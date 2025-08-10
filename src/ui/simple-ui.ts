/**
 * Simple UI implementation that works reliably across all terminals
 * Falls back when advanced terminal features aren't available
 */

import { hybridManager } from '../utils/hybrid-manager.js';
import { sprintManager } from '../utils/sprint.js';
import { Issue } from '../types/issue.js';

export class SimpleUI {
  private isActive = false;
  private currentView = 'main';
  private issues: Issue[] = [];
  private selectedIndex = 0;
  private searchQuery = '';
  private initialView = 'main';
  private selectedMenuItem = 0; // For main menu navigation
  private selectedActionIndex = 0; // For issue actions navigation
  private mainInputHandler?: (data: Buffer | string) => Promise<void>; // Reference to main input handler
  private menuItems = [
    { id: 'issues', label: 'Issue Management', icon: '🏗️' },
    { id: 'sprints', label: 'Sprint Management', icon: '🏃' },
    { id: 'config', label: 'Configuration', icon: '⚙️' },
    { id: 'status', label: 'Project Status', icon: '📋' },
    { id: 'exit', label: 'Exit', icon: '❌' }
  ];
  private actionItems = [
    { id: '1', label: 'View Details', icon: '🔍', action: 'showDetails' },
    { id: '2', label: 'Edit Issue', icon: '📝', action: 'editIssue' },
    { id: '3', label: 'Change Status', icon: '📋', action: 'changeStatus' },
    { id: '4', label: 'Delete Issue', icon: '🗑️', action: 'deleteIssue' },
    { id: '5', label: 'Add to Sprint', icon: '🏃', action: 'addToSprint' },
    { id: '6', label: 'View Spec File', icon: '📄', action: 'viewSpec' }
  ];

  /**
   * Set the initial view to show
   */
  setInitialView(view: string): void {
    this.initialView = view;
    this.currentView = view;
  }

  /**
   * Parse key input and return normalized key names
   */
  private parseKeyInput(data: Buffer | string): string {
    const input = data.toString();
    
    // Handle escape sequences for arrow keys
    if (input === '\u001b[A' || input === '\u001bOA') return 'UP';
    if (input === '\u001b[B' || input === '\u001bOB') return 'DOWN';
    if (input === '\u001b[C' || input === '\u001bOC') return 'RIGHT';
    if (input === '\u001b[D' || input === '\u001bOD') return 'LEFT';
    
    // Handle common keys
    if (input === '\r' || input === '\n') return 'ENTER';
    if (input === '\u001b') return 'ESCAPE';
    if (input === '\u0003') return 'CTRL_C';
    if (input === '\u007f' || input === '\u0008') return 'BACKSPACE';
    if (input === '\t') return 'TAB';
    
    // Handle vim-style navigation
    if (input === 'k') return 'UP';
    if (input === 'j') return 'DOWN';
    if (input === 'h') return 'LEFT';
    if (input === 'l') return 'RIGHT';
    
    // Return the input as-is for regular characters
    return input;
  }

  async start(): Promise<void> {
    try {
      this.isActive = true;
      this.currentView = this.initialView;
      await this.loadData();
      
      // Show initial view
      await this.render();
      await this.inputLoop();
    } catch (error) {
      console.error('UI Error:', error);
    } finally {
      this.cleanup();
    }
  }

  private async loadData(): Promise<void> {
    try {
      this.issues = await hybridManager.listIssues({});
    } catch (error) {
      console.log('⚠️  Could not load issues data');
      this.issues = [];
    }
  }

  private async showMainMenu(): Promise<void> {
    console.clear();
    console.log('\n┌─ PPP Interactive Mode ─────────────────────────────────────────┐');
    console.log('│                                                                │');
    
    // Display menu items with selection indicator
    this.menuItems.forEach((item, index) => {
      const isSelected = index === this.selectedMenuItem;
      const indicator = isSelected ? '► ' : '  ';
      const number = `${index + 1}.`;
      const line = `${indicator}${item.icon}  ${number} ${item.label}`;
      console.log(`│  ${line.padEnd(62)} │`);
    });
    
    console.log('│                                                                │');
    console.log('│ ┌──────────────────────────────────────────────────────────┐ │');
    console.log(`│ │ Status: ${this.issues.length} issues loaded                              │ │`);
    console.log('│ │ Navigation: ↑↓ or j/k | Enter: Select | 1-5: Direct     │ │');
    console.log('│ │ ESC/Q: Exit                                             │ │');
    console.log('│ └──────────────────────────────────────────────────────────┘ │');
    console.log('└────────────────────────────────────────────────────────────────┘\n');
  }

  private async showIssueList(): Promise<void> {
    console.clear();
    console.log('\n🏗️  Issue Management');
    console.log('═'.repeat(50));
    
    if (this.issues.length === 0) {
      console.log('\n💭 No issues found.');
      console.log('   Create one with: ppp issue create feature "<name>"');
    } else {
      console.log(`\nFound ${this.issues.length} issues:\n`);
      
      // Filter issues based on search query
      let filteredIssues = this.issues;
      if (this.searchQuery) {
        filteredIssues = this.issues.filter(issue => 
          issue.id.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
          issue.name.toLowerCase().includes(this.searchQuery.toLowerCase())
        );
      }
      
      // Display issues in a properly aligned table
      console.log('┌─────────────┬─────────────────────────────────────┬──────────┬─────────────┐');
      console.log('│ ID          │ Name                                │ Type     │ Status      │');
      console.log('├─────────────┼─────────────────────────────────────┼──────────┼─────────────┤');
      
      const displayIssues = filteredIssues.slice(0, 15); // Show first 15
      displayIssues.forEach((issue, index) => {
        const isSelected = index === this.selectedIndex && displayIssues.length > 0;
        const indicator = isSelected ? '►' : ' ';
        
        // Calculate exact column widths: ID(11) + Name(35) + Type(8) + Status(11)
        const idWithIndicator = indicator + issue.id;
        const id = idWithIndicator.length > 11 ? idWithIndicator.substring(0, 11) : idWithIndicator.padEnd(11);
        const name = this.formatColumn(issue.name, 35);
        const type = this.formatColumn(issue.type, 8);
        const status = this.formatColumn(issue.status, 11);
        
        console.log(`│ ${id} │ ${name} │ ${type} │ ${status} │`);
      });
      
      console.log('└─────────────┴─────────────────────────────────────┴──────────┴─────────────┘');
      
      if (filteredIssues.length > 15) {
        console.log(`\n... and ${filteredIssues.length - 15} more issues`);
      }
    }
    
    console.log('\nCommands:');
    console.log('  ↑↓ or j/k  - Navigate');
    console.log('  Enter      - Issue actions');
    console.log('  /          - Search');
    console.log('  c          - Create issue');
    console.log('  d          - Delete selected');
    console.log('  r          - Refresh');
    console.log('  b          - Back to main menu');
    console.log('  q          - Quit');
    
    if (this.searchQuery) {
      console.log(`\nSearch: "${this.searchQuery}" (ESC to clear)`);
    }
    
    console.log('\nEnter command: ');
  }

  private async showSprintDashboard(): Promise<void> {
    console.clear();
    console.log('\n🏃  Sprint Management');
    console.log('═'.repeat(50));
    
    try {
      const sprints = await hybridManager.getSprintSummaries();
      const activeSprint = await hybridManager.getActiveSprint();
      
      if (activeSprint) {
        console.log(`\n🚀 Active Sprint: ${activeSprint.id} - ${activeSprint.name}`);
        console.log(`   Issues: ${activeSprint.issues.length}`);
      } else {
        console.log('\n💡 No active sprint');
      }
      
      console.log(`\nTotal Sprints: ${sprints.length}`);
      
      if (sprints.length > 0) {
        console.log('\nRecent Sprints:');
        sprints.slice(0, 5).forEach(sprint => {
          const statusIcon = sprint.status === 'active' ? '🚀' : 
                           sprint.status === 'completed' ? '✅' : '📋';
          console.log(`  ${statusIcon} ${sprint.id} - ${sprint.name} (${sprint.status})`);
        });
      }
      
    } catch (error) {
      console.log('⚠️  Error loading sprint data');
    }
    
    console.log('\nCommands:');
    console.log('  c - Create sprint');
    console.log('  l - List all sprints');
    console.log('  b - Back to main menu');
    console.log('  q - Quit');
    console.log('\nEnter command: ');
  }

  private async inputLoop(): Promise<void> {
    return new Promise((resolve) => {
      const stdin = process.stdin;
      
      // Check if setRawMode is available
      if (typeof stdin.setRawMode === 'function') {
        stdin.setRawMode(true);
      }
      
      stdin.resume();
      stdin.setEncoding('utf8');

      const handleInput = async (data: Buffer | string) => {
        if (!this.isActive) {
          resolve();
          return;
        }

        // Parse the key input
        const key = this.parseKeyInput(data);

        // Handle Ctrl+C
        if (key === 'CTRL_C') {
          this.isActive = false;
          resolve();
          return;
        }

        switch (this.currentView) {
          case 'main':
            await this.handleMainMenuInput(key);
            break;
          case 'issues':
            await this.handleIssueListInput(key);
            break;
          case 'sprints':
            await this.handleSprintInput(key);
            break;
        }

        if (this.isActive) {
          await this.render();
        } else {
          resolve();
        }
      };

      // Store reference to main input handler for later use
      this.mainInputHandler = handleInput;
      stdin.on('data', handleInput);
    });
  }

  private async handleMainMenuInput(key: string): Promise<void> {
    switch (key) {
      // Arrow key navigation
      case 'UP':
        this.selectedMenuItem = Math.max(0, this.selectedMenuItem - 1);
        break;
      case 'DOWN':
        this.selectedMenuItem = Math.min(this.menuItems.length - 1, this.selectedMenuItem + 1);
        break;
      
      // Enter key to select current menu item
      case 'ENTER':
        await this.selectMenuItem(this.selectedMenuItem);
        break;
      
      // Direct number selection (keep existing behavior)
      case '1':
        this.selectedMenuItem = 0;
        await this.selectMenuItem(0);
        break;
      case '2':
        this.selectedMenuItem = 1;
        await this.selectMenuItem(1);
        break;
      case '3':
        this.selectedMenuItem = 2;
        await this.selectMenuItem(2);
        break;
      case '4':
        this.selectedMenuItem = 3;
        await this.selectMenuItem(3);
        break;
      case '5':
        this.selectedMenuItem = 4;
        await this.selectMenuItem(4);
        break;
      
      // Exit keys
      case 'q':
      case 'Q':
      case 'ESCAPE':
        this.isActive = false;
        break;
    }
  }

  private async selectMenuItem(index: number): Promise<void> {
    const item = this.menuItems[index];
    if (!item) return;

    switch (item.id) {
      case 'issues':
        this.currentView = 'issues';
        break;
      case 'sprints':
        this.currentView = 'sprints';
        break;
      case 'config':
        console.log('\n⚙️  Configuration not implemented yet');
        await this.delay(1500);
        break;
      case 'status':
        console.log(`\n📋 Project Status: ${this.issues.length} issues loaded`);
        await this.delay(1500);
        break;
      case 'exit':
        this.isActive = false;
        break;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async handleIssueListInput(key: string): Promise<void> {
    // Get filtered issues for navigation
    let filteredIssues = this.issues;
    if (this.searchQuery) {
      filteredIssues = this.issues.filter(issue => 
        issue.id.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        issue.name.toLowerCase().includes(this.searchQuery.toLowerCase())
      );
    }
    
    const maxDisplayItems = Math.min(filteredIssues.length, 15);
    
    switch (key) {
      case 'UP':
        if (this.selectedIndex > 0) {
          this.selectedIndex--;
        }
        break;
      case 'DOWN':
        if (this.selectedIndex < maxDisplayItems - 1) {
          this.selectedIndex++;
        }
        break;
      case 'ENTER':
        if (filteredIssues.length > 0 && this.selectedIndex < filteredIssues.length) {
          await this.showIssueActions(filteredIssues[this.selectedIndex]);
          // No need to call render() here - the main loop will handle it
        }
        break;
      case '/':
        const query = await this.getInput('Enter search query: ');
        if (query !== null) {
          this.searchQuery = query;
          this.selectedIndex = 0;
        }
        break;
      case 'ESCAPE':
        if (this.searchQuery) {
          this.searchQuery = '';
          this.selectedIndex = 0;
        } else {
          this.currentView = 'main';
        }
        break;
      case 'c':
      case 'C':
        console.log('\n📝 Create issue functionality would be implemented here');
        console.log('For now, use: ppp issue create <type> "<name>"');
        await this.delay(2000);
        break;
      case 'd':
      case 'D':
        if (this.issues.length > 0 && this.selectedIndex < this.issues.length) {
          const issue = this.issues[this.selectedIndex];
          console.log(`\n🗑️  Delete ${issue.id}? (y/N): `);
          // Would implement confirmation here
          await this.delay(1500);
        }
        break;
      case 'r':
      case 'R':
        await this.loadData();
        break;
      case 'b':
      case 'B':
        this.currentView = 'main';
        this.searchQuery = '';
        this.selectedIndex = 0;
        break;
      case 'q':
      case 'Q':
        this.isActive = false;
        break;
    }
  }

  private async handleSprintInput(key: string): Promise<void> {
    switch (key) {
      case 'c':
      case 'C':
        console.log('\n📝 Create sprint functionality would be implemented here');
        console.log('For now, use: ppp sprint create "<name>"');
        await this.delay(2000);
        break;
      case 'l':
      case 'L':
        console.log('\n📋 Full sprint list would be shown here');
        console.log('For now, use: ppp sprint list');
        await this.delay(2000);
        break;
      case 'b':
      case 'B':
      case 'ESCAPE':
        this.currentView = 'main';
        break;
      case 'q':
      case 'Q':
        this.isActive = false;
        break;
    }
  }

  private async render(): Promise<void> {
    switch (this.currentView) {
      case 'main':
        await this.showMainMenu();
        break;
      case 'issues':
        await this.showIssueList();
        break;
      case 'sprints':
        await this.showSprintDashboard();
        break;
    }
  }

  private async getInput(prompt: string): Promise<string | null> {
    return new Promise((resolve) => {
      console.log(prompt);
      const stdin = process.stdin;
      
      if (typeof stdin.setRawMode === 'function') {
        stdin.setRawMode(false);
      }
      
      const handleLine = (line: string) => {
        stdin.off('data', handleLine);
        if (typeof stdin.setRawMode === 'function') {
          stdin.setRawMode(true);
        }
        resolve(line.trim());
      };
      
      stdin.on('data', handleLine);
    });
  }

  private truncateText(text: string, maxLength: number): string {
    return text.length > maxLength ? text.slice(0, maxLength - 3) + '...' : text.padEnd(maxLength);
  }

  private formatColumn(text: string, width: number): string {
    if (text.length > width) {
      // If text is too long, truncate with ellipsis
      return text.slice(0, width - 3) + '...';
    } else {
      // If text is shorter, pad with spaces to exact width
      return text.padEnd(width);
    }
  }


  private renderIssueActions(issue: Issue): void {
    console.clear();
    console.log(`\n🏗️  Issue Actions: ${issue.id}`);
    console.log('═'.repeat(50));
    console.log(`Name: ${issue.name}`);
    console.log(`Type: ${issue.type}`);
    console.log(`Status: ${issue.status}`);
    if (issue.description) {
      console.log(`Description: ${issue.description.slice(0, 100)}${issue.description.length > 100 ? '...' : ''}`);
    }
    
    console.log('\nAvailable Actions:');
    this.actionItems.forEach((action, index) => {
      const isSelected = index === this.selectedActionIndex;
      const indicator = isSelected ? '►' : ' ';
      console.log(`  ${indicator} ${action.icon}  ${action.id}. ${action.label}`);
    });
    
    console.log('\nNavigation:');
    console.log('  ↑↓ or j/k  - Navigate actions');
    console.log('  Enter      - Execute selected action');
    console.log('  1-6        - Direct action selection');
    console.log('  b/ESC      - Back to issue list');
    console.log('  q          - Quit');
  }

  private async showIssueActions(issue: Issue): Promise<void> {
    this.selectedActionIndex = 0; // Reset selection
    
    // Temporarily disable main input listener to prevent conflicts
    const stdin = process.stdin;
    if (this.mainInputHandler) {
      stdin.off('data', this.mainInputHandler);
    }
    
    try {
      while (this.isActive) {
        this.renderIssueActions(issue);
        
        const choice = await this.getSingleKeyInput();
        const shouldReturn = await this.handleActionInput(choice, issue);
        
        if (shouldReturn) {
          break;
        }
      }
    } finally {
      // Ensure terminal raw mode is restored
      if (typeof stdin.setRawMode === 'function') {
        stdin.setRawMode(true);
      }
      
      // Always restore main input listener, preventing duplicates
      if (this.mainInputHandler) {
        // Remove any existing listeners first to prevent duplicates
        stdin.removeAllListeners('data');
        stdin.on('data', this.mainInputHandler);
        // Ensure stdin is properly resumed and encoded
        stdin.resume();
        stdin.setEncoding('utf8');
      }
    }
  }

  private async handleActionInput(key: string, issue: Issue): Promise<boolean> {
    switch (key) {
      // Arrow key navigation
      case 'UP':
        this.selectedActionIndex = this.selectedActionIndex > 0 
          ? this.selectedActionIndex - 1 
          : this.actionItems.length - 1; // Wrap to bottom
        return false;
        
      case 'DOWN':
        this.selectedActionIndex = this.selectedActionIndex < this.actionItems.length - 1 
          ? this.selectedActionIndex + 1 
          : 0; // Wrap to top
        return false;
        
      // Enter key to execute selected action
      case 'ENTER':
        const selectedAction = this.actionItems[this.selectedActionIndex];
        await this.executeAction(selectedAction.action, issue);
        return false;
        
      // Direct number selection (existing behavior)
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
        const actionIndex = parseInt(key) - 1;
        if (actionIndex >= 0 && actionIndex < this.actionItems.length) {
          this.selectedActionIndex = actionIndex;
          const action = this.actionItems[actionIndex];
          await this.executeAction(action.action, issue);
        }
        return false;
        
      // Back to issue list
      case 'b':
      case 'B':
      case 'ESCAPE':
        return true;
        
      // Quit application
      case 'q':
      case 'Q':
        this.isActive = false;
        return true;
        
      default:
        // Invalid input - stay in menu
        return false;
    }
  }

  private async executeAction(actionId: string, issue: Issue): Promise<void> {
    switch (actionId) {
      case 'showDetails':
        await this.showIssueDetails(issue);
        break;
      case 'editIssue':
        console.log('\n📝 Edit functionality would be implemented here');
        console.log('For now, edit the spec file manually or use: ppp issue update');
        await this.delay(2000);
        break;
      case 'changeStatus':
        await this.changeIssueStatus(issue);
        break;
      case 'deleteIssue':
        await this.confirmDeleteIssue(issue);
        break;
      case 'addToSprint':
        await this.addIssueToSprint(issue);
        break;
      case 'viewSpec':
        await this.openIssueSpec(issue);
        break;
      default:
        console.log(`\n❌ Unknown action: ${actionId}`);
        await this.delay(1000);
        break;
    }
  }

  private async showIssueDetails(issue: Issue): Promise<void> {
    console.clear();
    console.log(`\n🔍 Issue Details: ${issue.id}`);
    console.log('═'.repeat(50));
    console.log(`ID: ${issue.id}`);
    console.log(`Name: ${issue.name}`);
    console.log(`Type: ${issue.type}`);
    console.log(`Status: ${issue.status}`);
    if (issue.description) {
      console.log(`Description: ${issue.description}`);
    }
    if (issue.created) {
      console.log(`Created: ${new Date(issue.created).toLocaleDateString()}`);
    }
    if (issue.assignee) {
      console.log(`Assignee: ${issue.assignee}`);
    }
    if (issue.sprint) {
      console.log(`Sprint: ${issue.sprint}`);
    }
    if (issue.parent) {
      console.log(`Parent: ${issue.parent}`);
    }
    
    console.log('\nPress any key to continue...');
    await this.getSingleKeyInput();
  }

  private async changeIssueStatus(issue: Issue): Promise<void> {
    console.clear();
    console.log(`\n📋 Change Status: ${issue.id}`);
    console.log('═'.repeat(50));
    console.log(`Current Status: ${issue.status}`);
    
    const statuses = ['new', 'in_progress', 'blocked', 'done'];
    console.log('\nAvailable Statuses:');
    statuses.forEach((status, index) => {
      console.log(`  ${index + 1}. ${status}`);
    });
    
    console.log('\nSelect new status (1-4) or ESC to cancel: ');
    const choice = await this.getSingleKeyInput();
    
    const statusIndex = parseInt(choice) - 1;
    if (statusIndex >= 0 && statusIndex < statuses.length) {
      const newStatus = statuses[statusIndex];
      try {
        await hybridManager.updateIssue(issue.id, { status: newStatus });
        console.log(`\n✅ Status updated to: ${newStatus}`);
        await this.delay(1500);
        // Reload issues
        await this.loadData();
      } catch (error) {
        console.log(`\n❌ Failed to update status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        await this.delay(2000);
      }
    }
  }

  private async confirmDeleteIssue(issue: Issue): Promise<void> {
    console.clear();
    console.log(`\n🗑️  Delete Issue: ${issue.id}`);
    console.log('═'.repeat(50));
    console.log(`Name: ${issue.name}`);
    console.log(`Type: ${issue.type}`);
    
    console.log('\n⚠️  This will permanently delete the issue and its spec file.');
    console.log('This action cannot be undone.');
    console.log('\nAre you sure? (y/N): ');
    
    const choice = await this.getSingleKeyInput();
    
    if (choice.toLowerCase() === 'y') {
      try {
        await hybridManager.deleteIssue(issue.id);
        console.log(`\n✅ Issue ${issue.id} deleted successfully`);
        await this.delay(1500);
        // Reload issues
        await this.loadData();
      } catch (error) {
        console.log(`\n❌ Failed to delete issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
        await this.delay(2000);
      }
    }
  }

  private async addIssueToSprint(issue: Issue): Promise<void> {
    console.clear();
    console.log(`\n🏃 Add to Sprint: ${issue.id}`);
    console.log('═'.repeat(50));
    
    try {
      const sprints = await hybridManager.getSprintSummaries();
      
      if (sprints.length === 0) {
        console.log('No sprints found. Create a sprint first.');
        console.log('Use: ppp sprint create "<name>"');
        await this.delay(2000);
        return;
      }
      
      console.log('Available Sprints:');
      sprints.forEach((sprint, index) => {
        console.log(`  ${index + 1}. ${sprint.id} - ${sprint.name} (${sprint.status})`);
      });
      
      console.log('\nSelect sprint (1-' + sprints.length + ') or ESC to cancel: ');
      const choice = await this.getSingleKeyInput();
      
      const sprintIndex = parseInt(choice) - 1;
      if (sprintIndex >= 0 && sprintIndex < sprints.length) {
        const selectedSprint = sprints[sprintIndex];
        try {
          await hybridManager.assignIssueToSprint(issue.id, selectedSprint.id);
          console.log(`\n✅ Issue assigned to sprint: ${selectedSprint.name}`);
          await this.delay(1500);
          // Reload issues
          await this.loadData();
        } catch (error) {
          console.log(`\n❌ Failed to assign issue to sprint: ${error instanceof Error ? error.message : 'Unknown error'}`);
          await this.delay(2000);
        }
      }
    } catch (error) {
      console.log(`\n❌ Error loading sprints: ${error instanceof Error ? error.message : 'Unknown error'}`);
      await this.delay(2000);
    }
  }

  private async openIssueSpec(issue: Issue): Promise<void> {
    console.log(`\n📄 Opening spec file for: ${issue.id}`);
    console.log('This would open the spec.md file in your default editor');
    console.log('For now, you can find it in the issue folder');
    await this.delay(2000);
  }

  private async getSingleKeyInput(): Promise<string> {
    return new Promise((resolve) => {
      const stdin = process.stdin;
      
      if (typeof stdin.setRawMode === 'function') {
        stdin.setRawMode(true);
      }
      
      stdin.resume();
      
      const handleKey = (data: Buffer | string) => {
        stdin.off('data', handleKey);
        if (typeof stdin.setRawMode === 'function') {
          stdin.setRawMode(false);
        }
        const key = this.parseKeyInput(data);
        resolve(key);
      };
      
      stdin.on('data', handleKey);
    });
  }

  private cleanup(): void {
    const stdin = process.stdin;
    
    if (typeof stdin.setRawMode === 'function') {
      stdin.setRawMode(false);
    }
    
    stdin.pause();
    console.clear();
    console.log('👋 Goodbye!');
  }
}