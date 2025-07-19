import { Issue, IssueType, IssueStatus, IssuePriority, IssueCreationData, IssueUpdateData, getParentId, isFeature } from '../types/issue.js';
import { generateIssueId } from './id-generator.js';
import { generateIssueNameKeywords } from './llm.js';
import { fileManager } from './file-manager.js';
import { sprintManager } from './sprint.js';

export class IssueManager {
  /**
   * Validate parent-child relationships (strict validation per user decision)
   */
  public async validateParent(type: IssueType, parentId?: string): Promise<void> {
    if (!parentId) {
      // Only features can exist without parents
      if (!isFeature(type)) {
        throw new Error(`${type} must have a parent. Only features can be created without parents.`);
      }
      return;
    }
    
    // Check if parent exists
    const parentIssue = await fileManager.readIssueSpec(parentId);
    if (!parentIssue) {
      throw new Error(`Parent issue ${parentId} does not exist. Create the parent first.`);
    }
    
    // Validate hierarchy rules
    await this.validateHierarchy(type, parentIssue);
  }
  
  private async validateHierarchy(childType: IssueType, parent: Issue): Promise<void> {
    const parentPrefix = parent.id[0];
    
    if (childType === IssueType.FEATURE) {
      // Features can only be children of other features
      if (parentPrefix !== 'F') {
        throw new Error(`Features can only be children of other features, not ${parent.type}`);
      }
      
      // Check nesting level (max 3 levels: F01, F0102, F010203)
      const parentLevel = this.getFeatureLevel(parent.id);
      if (parentLevel >= 3) {
        throw new Error(`Maximum feature nesting level (3) exceeded. Cannot create child of ${parent.id}`);
      }
    } else if (childType === IssueType.EPIC || childType === IssueType.STORY || childType === IssueType.TASK) {
      // Tasks can be children of features or other tasks
      if (parentPrefix !== 'F' && parentPrefix !== 'T') {
        throw new Error(`Tasks can only be children of features or other tasks, not ${parent.type}`);
      }
    } else if (childType === IssueType.BUG) {
      // Bugs can be children of features or tasks
      if (parentPrefix !== 'F' && parentPrefix !== 'T') {
        throw new Error(`Bugs can only be children of features or tasks, not ${parent.type}`);
      }
    }
  }
  
  private getFeatureLevel(id: string): number {
    const digits = id.slice(1);
    return Math.floor(digits.length / 2);
  }
  
  /**
   * Create a new issue with validation
   */
  public async createIssue(data: IssueCreationData): Promise<Issue> {
    // Validate parent relationship
    await this.validateParent(data.type, data.parentId);
    
    // Generate issue ID
    const id = await generateIssueId(data.type, data.parentId);
    
    // Generate keywords from name
    let keywords: string;
    try {
      keywords = await generateIssueNameKeywords(data.name);
    } catch (error) {
      console.warn('LLM keyword generation failed, using fallback:', error);
      keywords = this.generateFallbackKeywords(data.name);
    }
    
    // Create issue object
    const now = new Date().toISOString();
    const issue: Issue = {
      id,
      type: data.type,
      name: data.name,
      keywords,
      description: data.description || '',
      status: IssueStatus.NEW,
      priority: data.priority || IssuePriority.MEDIUM,
      assignee: data.assignee,
      reporter: data.reporter,
      labels: data.labels || [],
      parentId: data.parentId,
      sprintId: undefined,
      createdAt: now,
      updatedAt: now,
      folderPath: '', // Will be set by file manager
      comments: []
    };
    
    // Create folder and spec file
    const folderPath = await fileManager.createIssueFolder(issue);
    issue.folderPath = folderPath;
    
    // Update parent's issue list if needed
    if (data.parentId) {
      await this.updateParentIssueList(data.parentId, id, 'add');
    }
    
    return issue;
  }
  
  /**
   * Update an existing issue
   */
  public async updateIssue(issueId: string, data: IssueUpdateData): Promise<Issue> {
    // Load existing issue
    const existingIssue = await fileManager.readIssueSpec(issueId);
    if (!existingIssue) {
      throw new Error(`Issue ${issueId} not found`);
    }
    
    let keywords = existingIssue.keywords;
    
    // If name is being updated, regenerate keywords
    if (data.name && data.name !== existingIssue.name) {
      try {
        keywords = await generateIssueNameKeywords(data.name);
      } catch (error) {
        console.warn('LLM keyword generation failed, using fallback:', error);
        keywords = this.generateFallbackKeywords(data.name);
      }
    }
    
    // Update issue object
    const updatedIssue: Issue = {
      ...existingIssue,
      name: data.name || existingIssue.name,
      description: data.description !== undefined ? data.description : existingIssue.description,
      status: data.status || existingIssue.status,
      priority: data.priority || existingIssue.priority,
      assignee: data.assignee !== undefined ? data.assignee : existingIssue.assignee,
      labels: data.labels || existingIssue.labels,
      sprintId: data.sprintId !== undefined ? data.sprintId : existingIssue.sprintId,
      keywords,
      updatedAt: new Date().toISOString()
    };
    
    // Update folder and spec file
    const oldKeywords = existingIssue.keywords !== keywords ? existingIssue.keywords : undefined;
    const folderPath = await fileManager.updateIssueFolder(updatedIssue, oldKeywords);
    updatedIssue.folderPath = folderPath;
    
    return updatedIssue;
  }
  
  /**
   * Delete an issue
   */
  public async deleteIssue(issueId: string): Promise<void> {
    // Load existing issue
    const existingIssue = await fileManager.readIssueSpec(issueId);
    if (!existingIssue) {
      throw new Error(`Issue ${issueId} not found`);
    }
    
    // Check for child issues
    const childIssues = await this.findChildIssues(issueId);
    if (childIssues.length > 0) {
      throw new Error(`Cannot delete issue ${issueId} because it has child issues: ${childIssues.join(', ')}`);
    }
    
    // Remove from parent's issue list
    if (existingIssue.parentId) {
      await this.updateParentIssueList(existingIssue.parentId, issueId, 'remove');
    }
    
    // Move folder to archive
    await fileManager.deleteIssueFolder(issueId);
  }
  
  /**
   * List issues with optional filtering
   */
  public async listIssues(options: {
    parentId?: string;
    type?: IssueType;
    status?: IssueStatus;
    assignee?: string;
    sprintId?: string;
  } = {}): Promise<Issue[]> {
    const issues: Issue[] = [];
    
    // Scan the .ppp directory recursively for all issues
    await this.scanForIssues(issues, fileManager.getPppPath());
    
    // Filter issues based on options
    return issues.filter(issue => {
      if (options.parentId && issue.parentId !== options.parentId) return false;
      if (options.type && issue.type !== options.type) return false;
      if (options.status && issue.status !== options.status) return false;
      if (options.assignee && issue.assignee !== options.assignee) return false;
      if (options.sprintId && issue.sprintId !== options.sprintId) return false;
      return true;
    });
  }
  
  private async scanForIssues(issues: Issue[], dirPath: string): Promise<void> {
    const { readdir, stat } = await import('fs/promises');
    const { join } = await import('path');
    
    try {
      const items = await readdir(dirPath);
      
      for (const item of items) {
        const itemPath = join(dirPath, item);
        const itemStat = await stat(itemPath);
        
        if (itemStat.isDirectory()) {
          // Check if this is an issue folder (has format: ID-keywords)
          const issueIdMatch = item.match(/^([FTBM]\d{2,})-/);
          if (issueIdMatch) {
            const issueId = issueIdMatch[1];
            const issue = await fileManager.readIssueSpec(issueId);
            if (issue) {
              issues.push(issue);
            }
          }
          
          // Recursively scan subdirectories
          await this.scanForIssues(issues, itemPath);
        }
      }
    } catch (error) {
      console.warn(`Failed to scan directory ${dirPath}:`, error);
    }
  }
  
  /**
   * Assign issue to sprint
   */
  public async assignToSprint(issueId: string, sprintIdentifier: string): Promise<void> {
    // Convert sprint number to sprint ID format if needed
    const sprintId = sprintIdentifier.startsWith('Sprint-') 
      ? sprintIdentifier 
      : `Sprint-${sprintIdentifier.padStart(2, '0')}`;
    
    // Check if sprint exists
    const sprint = await fileManager.readSprintFile(sprintId);
    if (!sprint) {
      throw new Error(`Sprint ${sprintIdentifier} not found`);
    }
    
    // Check if issue exists
    const issue = await fileManager.readIssueSpec(issueId);
    if (!issue) {
      throw new Error(`Issue ${issueId} not found`);
    }
    
    // Remove issue from current sprint if it has one
    if (issue.sprintId) {
      await this.removeFromSprint(issueId);
    }
    
    // Update issue with sprint assignment
    const updateData: IssueUpdateData = { sprintId };
    await this.updateIssue(issueId, updateData);
    
    // Add issue to sprint's issue list
    const sprintNo = sprintId.replace('Sprint-', '');
    await sprintManager.addIssueToSprint(issueId, sprintNo);
  }
  
  /**
   * Remove issue from sprint
   */
  public async removeFromSprint(issueId: string): Promise<void> {
    // Check if issue exists and has a sprint assignment
    const issue = await fileManager.readIssueSpec(issueId);
    if (!issue) {
      throw new Error(`Issue ${issueId} not found`);
    }
    
    if (!issue.sprintId) {
      // Issue is not assigned to any sprint, nothing to do
      return;
    }
    
    // Remove issue from sprint's issue list
    const sprintNo = issue.sprintId.replace('Sprint-', '');
    await sprintManager.removeIssueFromSprint(issueId, sprintNo);
    
    // Update issue to remove sprint assignment
    const updateData: IssueUpdateData = { sprintId: undefined };
    await this.updateIssue(issueId, updateData);
  }
  
  private generateFallbackKeywords(name: string): string {
    const commonWords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 'in', 'is', 'it',
      'its', 'of', 'on', 'that', 'the', 'to', 'was', 'will', 'with', 'create', 'add', 'implement',
      'make', 'build', 'develop', 'setup', 'set', 'up', 'new', 'fix', 'update', 'modify', 'change'
    ]);
    
    const words = name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.has(word))
      .slice(0, 4);
    
    return words.join('_');
  }
  
  private async updateParentIssueList(parentId: string, childId: string, action: 'add' | 'remove'): Promise<void> {
    // This would update the parent's spec.md file to include/remove the child in its issue list
    // For now, this is a placeholder
    console.log(`${action} child ${childId} to parent ${parentId}`);
  }
  
  private async findChildIssues(parentId: string): Promise<string[]> {
    // This would scan for child issues
    // For now, return empty array
    return [];
  }
}

export const issueManager = new IssueManager();