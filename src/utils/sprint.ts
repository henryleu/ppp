import { fileManager } from './file-manager.js';
import { databaseManager } from './database.js';
import { fileExists } from './settings.js';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { Sprint, SprintState, SprintCreationData, SprintUpdateData, SprintSummary, generateSprintId, generateSprintName, canTransitionTo, isSprintActive } from '../types/sprint.js';
import { Issue } from '../types/issue.js';

export class SprintManager {
  
  /**
   * Create a new sprint
   */
  public async createSprint(data: SprintCreationData): Promise<Sprint> {
    await fileManager.ensurePppDirectory();
    
    // Get current sprint counter
    const counters = await databaseManager.getCounters();
    const sprintNo = counters.sprints + 1;
    
    // Generate sprint ID and name
    const sprintId = generateSprintId(sprintNo);
    const sprintName = generateSprintName(sprintNo);
    
    // Create sprint object
    const sprint: Sprint = {
      id: sprintId,
      name: sprintName,
      description: data.description,
      state: SprintState.PLANNED,
      startDate: data.startDate || new Date().toISOString(),
      issues: [],
      velocity: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Create sprint file
    await fileManager.createSprintFile(sprint);
    
    // Update sprint counter
    await databaseManager.updateCounters({ sprints: sprintNo });
    
    // Update Release.md
    await this.updateReleaseFile(sprint, 'create');
    
    return sprint;
  }
  
  /**
   * Delete a sprint and clean up all references
   */
  public async deleteSprint(sprintNo: string): Promise<boolean> {
    const sprintId = `Sprint-${sprintNo.padStart(2, '0')}`;
    
    // Read sprint to check if it exists
    const sprint = await fileManager.readSprintFile(sprintId);
    if (!sprint) {
      return false;
    }
    
    // If sprint has issues, remove sprint assignment from them
    if (sprint.issues.length > 0) {
      await this.removeSprintFromIssues(sprint.issues);
    }
    
    // Delete sprint file (moves to archive)
    await fileManager.deleteSprintFile(sprintId);
    
    // Update Release.md
    await this.updateReleaseFile(sprint, 'delete');
    
    return true;
  }
  
  /**
   * Activate a sprint (only one sprint can be active at a time)
   */
  public async activateSprint(sprintNo: string): Promise<boolean> {
    const sprintId = `Sprint-${sprintNo.padStart(2, '0')}`;
    
    // Read target sprint
    const sprint = await fileManager.readSprintFile(sprintId);
    if (!sprint) {
      return false;
    }
    
    // Check if sprint can be activated
    if (!canTransitionTo(sprint.state, SprintState.ACTIVE)) {
      throw new Error(`Cannot activate sprint. Current state: ${sprint.state}`);
    }
    
    // Deactivate any currently active sprints
    await this.deactivateAllActiveSprints();
    
    // Activate target sprint
    sprint.state = SprintState.ACTIVE;
    sprint.updatedAt = new Date().toISOString();
    
    // Update sprint file
    await fileManager.updateSprintFile(sprint);
    
    // Set all issues in this sprint to 'In Progress'
    if (sprint.issues.length > 0) {
      await this.updateIssuesStatus(sprint.issues, 'In Progress');
    }
    
    // Update Release.md
    await this.updateReleaseFile(sprint, 'activate');
    
    return true;
  }
  
  /**
   * Complete a sprint
   */
  public async completeSprint(sprintNo: string): Promise<boolean> {
    const sprintId = `Sprint-${sprintNo.padStart(2, '0')}`;
    
    const sprint = await fileManager.readSprintFile(sprintId);
    if (!sprint) {
      return false;
    }
    
    // Check if sprint can be completed
    if (!canTransitionTo(sprint.state, SprintState.COMPLETED)) {
      throw new Error(`Cannot complete sprint. Current state: ${sprint.state}`);
    }
    
    // Update sprint state
    sprint.state = SprintState.COMPLETED;
    sprint.endDate = new Date().toISOString();
    sprint.updatedAt = new Date().toISOString();
    
    // Calculate velocity (completed issues)
    if (sprint.issues.length > 0) {
      const completedCount = await this.getCompletedIssuesCount(sprint.issues);
      sprint.velocity = completedCount;
    }
    
    // Update sprint file
    await fileManager.updateSprintFile(sprint);
    
    // Update Release.md
    await this.updateReleaseFile(sprint, 'complete');
    
    return true;
  }
  
  /**
   * Get all sprints
   */
  public async getAllSprints(): Promise<SprintSummary[]> {
    await fileManager.ensurePppDirectory();
    
    const { readdir } = await import('fs/promises');
    const pppPath = fileManager.getPppPath();
    const files = await readdir(pppPath);
    
    const sprintSummaries: SprintSummary[] = [];
    
    for (const file of files) {
      if (file.startsWith('Sprint-') && file.endsWith('.md')) {
        const sprintId = file.replace('.md', '');
        const sprint = await fileManager.readSprintFile(sprintId);
        
        if (sprint) {
          sprintSummaries.push({
            id: sprint.id,
            name: sprint.name,
            state: sprint.state,
            startDate: sprint.startDate,
            endDate: sprint.endDate,
            issueCount: sprint.issues.length,
            velocity: sprint.velocity
          });
        }
      }
    }
    
    // Sort by sprint number (newest first)
    return sprintSummaries.sort((a, b) => b.id.localeCompare(a.id));
  }
  
  /**
   * Add issue to sprint
   */
  public async addIssueToSprint(issueId: string, sprintNo: string): Promise<boolean> {
    const sprintId = `Sprint-${sprintNo.padStart(2, '0')}`;
    
    const sprint = await fileManager.readSprintFile(sprintId);
    if (!sprint) {
      return false;
    }
    
    // Add issue to sprint if not already present
    if (!sprint.issues.includes(issueId)) {
      sprint.issues.push(issueId);
      sprint.updatedAt = new Date().toISOString();
      
      // Update sprint file
      await fileManager.updateSprintFile(sprint);
      
      // Update issue's sprint assignment
      await this.updateIssueSprintAssignment(issueId, sprintId);
    }
    
    return true;
  }
  
  /**
   * Remove issue from sprint
   */
  public async removeIssueFromSprint(issueId: string, sprintNo: string): Promise<boolean> {
    const sprintId = `Sprint-${sprintNo.padStart(2, '0')}`;
    
    const sprint = await fileManager.readSprintFile(sprintId);
    if (!sprint) {
      return false;
    }
    
    // Remove issue from sprint
    const index = sprint.issues.indexOf(issueId);
    if (index > -1) {
      sprint.issues.splice(index, 1);
      sprint.updatedAt = new Date().toISOString();
      
      // Update sprint file
      await fileManager.updateSprintFile(sprint);
      
      // Remove issue's sprint assignment
      await this.updateIssueSprintAssignment(issueId, undefined);
    }
    
    return true;
  }
  
  /**
   * Get active sprint
   */
  public async getActiveSprint(): Promise<Sprint | null> {
    const sprints = await this.getAllSprints();
    
    for (const sprintSummary of sprints) {
      const sprint = await fileManager.readSprintFile(sprintSummary.id);
      if (sprint && isSprintActive(sprint)) {
        return sprint;
      }
    }
    
    return null;
  }
  
  // Private helper methods
  
  private async deactivateAllActiveSprints(): Promise<void> {
    const sprints = await this.getAllSprints();
    
    for (const sprintSummary of sprints) {
      if (sprintSummary.state === SprintState.ACTIVE) {
        const sprint = await fileManager.readSprintFile(sprintSummary.id);
        if (sprint) {
          sprint.state = SprintState.COMPLETED;
          sprint.endDate = new Date().toISOString();
          sprint.updatedAt = new Date().toISOString();
          
          // Calculate velocity for completed sprint
          if (sprint.issues.length > 0) {
            const completedCount = await this.getCompletedIssuesCount(sprint.issues);
            sprint.velocity = completedCount;
          }
          
          await fileManager.updateSprintFile(sprint);
        }
      }
    }
  }
  
  private async removeSprintFromIssues(issueIds: string[]): Promise<void> {
    for (const issueId of issueIds) {
      await this.updateIssueSprintAssignment(issueId, undefined);
    }
  }
  
  private async updateIssuesStatus(issueIds: string[], status: string): Promise<void> {
    for (const issueId of issueIds) {
      const issue = await fileManager.readIssueSpec(issueId);
      if (issue) {
        issue.status = status as any;
        issue.updatedAt = new Date().toISOString();
        await fileManager.updateIssueFolder(issue);
      }
    }
  }
  
  private async updateIssueSprintAssignment(issueId: string, sprintId?: string): Promise<void> {
    const issue = await fileManager.readIssueSpec(issueId);
    if (issue) {
      issue.sprintId = sprintId;
      issue.updatedAt = new Date().toISOString();
      await fileManager.updateIssueFolder(issue);
    }
  }
  
  private async getCompletedIssuesCount(issueIds: string[]): Promise<number> {
    let completedCount = 0;
    
    for (const issueId of issueIds) {
      const issue = await fileManager.readIssueSpec(issueId);
      if (issue && issue.status === 'Done') {
        completedCount++;
      }
    }
    
    return completedCount;
  }
  
  private async updateReleaseFile(sprint: Sprint, operation: 'create' | 'delete' | 'activate' | 'complete'): Promise<void> {
    const releasePath = join(fileManager.getPppPath(), 'Release.md');
    
    let releaseContent = '';
    
    // Read existing Release.md or create new one
    if (await fileExists(releasePath)) {
      releaseContent = await readFile(releasePath, 'utf-8');
    } else {
      releaseContent = `# Release Overview\n\n## Release Goal\n\nManage product development through structured sprints.\n\n## Current Sprint\n\nNo active sprint.\n\n## Sprint List\n\n| Sprint | Status | Start Date | End Date | Issues | Velocity |\n|--------|--------|------------|----------|--------|----------|\n`;
    }
    
    // Update current sprint section
    if (operation === 'activate') {
      releaseContent = releaseContent.replace(
        /## Current Sprint\n\n.*?(?=\n\n##)/s,
        `## Current Sprint\n\n**${sprint.name}** - ${sprint.description}\n- Status: ${sprint.state}\n- Start Date: ${new Date(sprint.startDate).toLocaleDateString()}\n- Issues: ${sprint.issues.length}`
      );
    } else if (operation === 'complete') {
      releaseContent = releaseContent.replace(
        /## Current Sprint\n\n.*?(?=\n\n##)/s,
        `## Current Sprint\n\nNo active sprint.`
      );
    }
    
    // Update sprint list table
    const sprintTableRegex = /(\| Sprint \| Status \| Start Date \| End Date \| Issues \| Velocity \|\n\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|\n)([\s\S]*?)(?=\n\n|$)/;
    const match = releaseContent.match(sprintTableRegex);
    
    if (match) {
      const tableHeader = match[1];
      let tableRows = match[2] || '';
      
      if (operation === 'create') {
        const newRow = `| ${sprint.name} | ${sprint.state} | ${new Date(sprint.startDate).toLocaleDateString()} | ${sprint.endDate ? new Date(sprint.endDate).toLocaleDateString() : '-'} | ${sprint.issues.length} | ${sprint.velocity} |\n`;
        tableRows = newRow + tableRows;
      } else if (operation === 'delete') {
        // Remove the sprint row
        const lines = tableRows.split('\n');
        tableRows = lines.filter(line => !line.includes(sprint.name)).join('\n');
      } else if (operation === 'activate' || operation === 'complete') {
        // Update the existing row
        const lines = tableRows.split('\n');
        const updatedLines = lines.map(line => {
          if (line.includes(sprint.name)) {
            return `| ${sprint.name} | ${sprint.state} | ${new Date(sprint.startDate).toLocaleDateString()} | ${sprint.endDate ? new Date(sprint.endDate).toLocaleDateString() : '-'} | ${sprint.issues.length} | ${sprint.velocity} |`;
          }
          return line;
        });
        tableRows = updatedLines.join('\n');
      }
      
      releaseContent = releaseContent.replace(sprintTableRegex, `${tableHeader}${tableRows}`);
    }
    
    await writeFile(releasePath, releaseContent);
  }
}

export const sprintManager = new SprintManager();