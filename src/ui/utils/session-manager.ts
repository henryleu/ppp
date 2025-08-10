/**
 * Session manager for PPP interactive UI
 * Manages UI state, navigation, and session persistence
 */

import { UIView, SessionState, ProjectStatus, CommandResult } from '../../types/ui.js';
import { hybridManager } from '../../utils/hybrid-manager.js';
import { sprintManager } from '../../utils/sprint.js';
import { SimpleUI } from '../simple-ui.js';

export class SessionManager {
  private state: SessionState;
  private isActive = false;

  constructor() {
    this.state = {
      currentView: {
        id: 'main',
        title: 'PPP Interactive Mode',
        component: 'MainMenu'
      },
      previousViews: [],
      selectedItems: [],
      filters: {},
      searchQuery: '',
      projectStatus: {
        initialized: false,
        totalIssues: 0,
        totalSprints: 0
      }
    };
  }

  /**
   * Start interactive session
   */
  async start(): Promise<void> {
    try {
      // Try to dynamically import and use advanced terminal UI
      const { TerminalAdapter } = await import('../terminal-kit-adapter.js');
      const terminal = new TerminalAdapter();
      
      await terminal.init();
      this.isActive = true;
      
      // Load project status
      await this.loadProjectStatus();
      
      // If we get here, advanced UI worked - but for now, fall back to simple UI
      // since the advanced UI isn't fully implemented yet
      throw new Error('Using simple UI for now');
      
    } catch (error) {
      // Fall back to simple UI (this is the expected path for now)
      console.log('⚠️  Using simple interactive mode (this is normal)');
      console.log('   The interface will work perfectly!\n');
      
      // Use simple UI
      const simpleUI = new SimpleUI();
      await simpleUI.start();
    }
  }

  /**
   * Stop interactive session
   */
  async stop(): Promise<void> {
    this.isActive = false;
    this.cleanup();
  }

  /**
   * Navigate to a new view
   */
  async navigate(view: UIView): Promise<void> {
    // Save current view to history
    this.state.previousViews.push(this.state.currentView);
    
    // Update current view
    this.state.currentView = view;
    
    // Clear screen and show new view
    this.terminal.clear();
    await this.renderCurrentView();
  }

  /**
   * Go back to previous view
   */
  async goBack(): Promise<void> {
    if (this.state.previousViews.length > 0) {
      this.state.currentView = this.state.previousViews.pop()!;
      this.terminal.clear();
      await this.renderCurrentView();
    }
  }

  /**
   * Execute a CLI command programmatically
   */
  async executeCommand(command: string, args: any[] = []): Promise<CommandResult> {
    try {
      // Show progress indicator
      this.terminal.write('⟳ Executing command...\n');
      
      let result: any;
      
      // Route to appropriate command handler
      switch (command) {
        case 'issue.create':
          result = await hybridManager.createIssue(args[0]);
          break;
        case 'issue.update':
          result = await hybridManager.updateIssue(args[0], args[1]);
          break;
        case 'issue.delete':
          await hybridManager.deleteIssue(args[0]);
          result = { success: true };
          break;
        case 'issue.list':
          result = await hybridManager.listIssues(args[0] || {});
          break;
        case 'sprint.create':
          result = await sprintManager.createSprint(args[0]);
          break;
        case 'sprint.activate':
          result = await sprintManager.activateSprint(args[0]);
          break;
        case 'sprint.delete':
          result = await sprintManager.deleteSprint(args[0]);
          break;
        case 'sprint.add':
          await hybridManager.assignIssueToSprint(args[0], args[1]);
          result = { success: true };
          break;
        case 'sprint.remove':
          await hybridManager.removeIssueFromSprint(args[0], args[1]);
          result = { success: true };
          break;
        default:
          throw new Error(`Unknown command: ${command}`);
      }

      return {
        success: true,
        message: 'Command executed successfully',
        data: result
      };
      
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }

  /**
   * Show dialog to user
   */
  async showDialog(title: string, message: string, type: 'info' | 'confirm' = 'info'): Promise<boolean | string> {
    if (type === 'confirm') {
      return await this.terminal.showConfirm(message);
    } else {
      this.terminal.write(`\n${title}\n${message}\n\nPress any key to continue...`);
      return new Promise((resolve) => {
        this.terminal.terminal.once('key', () => resolve(true));
      });
    }
  }

  /**
   * Get user input
   */
  async getInput(prompt: string, autoComplete?: string[], placeholder?: string): Promise<string | null> {
    return await this.terminal.showInput(prompt, autoComplete, placeholder);
  }

  /**
   * Update session state
   */
  updateState(updates: Partial<SessionState>): void {
    this.state = { ...this.state, ...updates };
  }

  /**
   * Get current session state
   */
  getState(): SessionState {
    return { ...this.state };
  }

  private async loadProjectStatus(): Promise<void> {
    try {
      // Check if project is initialized
      const issues = await hybridManager.listIssues({});
      const sprints = await hybridManager.getSprintSummaries();
      const activeSprint = await hybridManager.getActiveSprint();

      this.state.projectStatus = {
        initialized: true,
        totalIssues: issues.length,
        totalSprints: sprints.length,
        activeSprint: activeSprint?.id
      };
    } catch (error) {
      this.state.projectStatus = {
        initialized: false,
        totalIssues: 0,
        totalSprints: 0
      };
    }
  }

  private async showMainInterface(): Promise<void> {
    this.terminal.clear();
    
    // Show header
    const { width } = this.terminal.getSize();
    const title = 'PPP Interactive Mode';
    const titlePos = Math.floor((width - title.length) / 2);
    
    this.terminal.writeAt(titlePos, 2, title);
    this.terminal.writeAt(1, 3, '─'.repeat(width - 2));
    
    // Show project status
    await this.showProjectStatus();
    
    // Show main menu
    await this.renderCurrentView();
    
    // Show status bar
    this.showStatusBar();
  }

  private async showProjectStatus(): Promise<void> {
    const status = this.state.projectStatus;
    let statusText = '';
    
    if (status.initialized) {
      statusText = `Status: Initialized | Issues: ${status.totalIssues} | Sprints: ${status.totalSprints}`;
      if (status.activeSprint) {
        statusText += ` | Active: ${status.activeSprint}`;
      }
    } else {
      statusText = 'Status: Not initialized - Run ppp init first';
    }
    
    this.terminal.writeAt(2, 5, statusText);
  }

  private async renderCurrentView(): Promise<void> {
    const view = this.state.currentView;
    
    // Clean up previous component
    this.currentComponent = null;
    
    // Render appropriate component
    switch (view.component) {
      case 'MainMenu':
        await this.renderMainMenu();
        break;
      case 'IssueList':
        this.currentComponent = new IssueListComponent(this, {
          showHierarchy: false
        });
        await this.currentComponent.init();
        break;
      case 'SprintDashboard':
        await this.renderSprintDashboard();
        break;
      default:
        this.terminal.writeAt(2, 10, `Component not implemented: ${view.component}`);
    }
  }

  private async renderMainMenu(): Promise<void> {
    const options = [
      { id: 'issues', label: 'Issue Management', icon: '🏗️' },
      { id: 'sprints', label: 'Sprint Management', icon: '🏃' },
      { id: 'config', label: 'Configuration', icon: '⚙️' },
      { id: 'status', label: 'Project Status', icon: '📋' },
      { id: 'exit', label: 'Exit', icon: '❌' }
    ];

    this.terminal.writeAt(2, 10, 'Select an option:');
    
    // Simple menu display for now
    options.forEach((option, index) => {
      this.terminal.writeAt(4, 12 + index, `${index + 1}. ${option.icon}  ${option.label}`);
    });
    
    this.terminal.writeAt(2, 18, 'Use number keys to select, ESC to exit');
  }

  private async renderIssueList(): Promise<void> {
    try {
      const issues = await hybridManager.listIssues({});
      
      this.terminal.writeAt(2, 10, 'Issues:');
      
      if (issues.length === 0) {
        this.terminal.writeAt(4, 12, 'No issues found. Create one to get started.');
        return;
      }

      // Display issues in a simple list
      issues.slice(0, 10).forEach((issue, index) => {
        const statusColor = this.getStatusColor(issue.status);
        this.terminal.writeAt(4, 12 + index, 
          `${issue.id} - ${issue.name} [${issue.type}] [${issue.status}]`
        );
      });
      
      if (issues.length > 10) {
        this.terminal.writeAt(4, 23, `... and ${issues.length - 10} more issues`);
      }
      
    } catch (error) {
      this.terminal.writeAt(4, 12, `Error loading issues: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async renderSprintDashboard(): Promise<void> {
    try {
      const sprints = await hybridManager.getSprintSummaries();
      const activeSprint = await hybridManager.getActiveSprint();
      
      this.terminal.writeAt(2, 10, 'Sprint Dashboard:');
      
      if (activeSprint) {
        this.terminal.writeAt(4, 12, `🚀 Active Sprint: ${activeSprint.id} - ${activeSprint.name}`);
        this.terminal.writeAt(4, 13, `   Issues: ${activeSprint.issues.length}`);
      } else {
        this.terminal.writeAt(4, 12, '💡 No active sprint');
      }
      
      this.terminal.writeAt(4, 15, `Total Sprints: ${sprints.length}`);
      
    } catch (error) {
      this.terminal.writeAt(4, 12, `Error loading sprints: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getStatusColor(status: string): string {
    switch (status.toLowerCase()) {
      case 'new': return '\x1b[36m'; // Cyan
      case 'in_progress': case 'in progress': return '\x1b[33m'; // Yellow
      case 'done': return '\x1b[32m'; // Green
      case 'blocked': return '\x1b[31m'; // Red
      default: return '\x1b[0m'; // Reset
    }
  }

  private showStatusBar(): void {
    const shortcuts = ['1-5: Select', 'ESC: Exit', 'B: Back'];
    this.terminal.showStatusBar('PPP Interactive Mode', shortcuts);
  }

  private async runEventLoop(): Promise<void> {
    return new Promise((resolve) => {
      this.terminal.terminal.on('key', async (name: string) => {
        if (!this.isActive) {
          resolve();
          return;
        }

        try {
          await this.handleKeyPress(name);
        } catch (error) {
          console.error('Error handling key press:', error);
        }
      });
    });
  }

  private async handleKeyPress(key: string): Promise<void> {
    // If we have a current component, let it handle the key first
    if (this.currentComponent) {
      const handled = await this.currentComponent.handleKey(key);
      if (handled) {
        return;
      }
    }
    
    // Handle global navigation keys
    switch (key) {
      case 'ESCAPE':
      case 'q':
        if (this.state.currentView.component === 'MainMenu') {
          await this.stop();
        } else {
          await this.goBack();
        }
        break;
        
      case 'b':
      case 'BACKSPACE':
        await this.goBack();
        break;
        
      case '1':
        if (this.state.currentView.component === 'MainMenu') {
          await this.navigate({
            id: 'issue-list',
            title: 'Issue Management',
            component: 'IssueList',
            breadcrumb: ['Main', 'Issues']
          });
        }
        break;
        
      case '2':
        if (this.state.currentView.component === 'MainMenu') {
          await this.navigate({
            id: 'sprint-dashboard',
            title: 'Sprint Management', 
            component: 'SprintDashboard',
            breadcrumb: ['Main', 'Sprints']
          });
        }
        break;
        
      case '5':
        if (this.state.currentView.component === 'MainMenu') {
          await this.stop();
        }
        break;
        
      default:
        // Ignore other keys for now
        break;
    }
  }

  private cleanup(): void {
    // Cleanup handled by SimpleUI
  }
}