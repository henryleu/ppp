import { mkdir, writeFile, readFile, rename, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { fileExists } from './settings.js';
import { Issue, IssueType, IssueStatus, IssuePriority } from '../types/issue.js';
import { Sprint } from '../types/sprint.js';
import { databaseManager } from './database.js';

export interface FileManagerOptions {
  projectRoot?: string;
}

export class FileManager {
  private projectRoot: string;
  
  constructor(options: FileManagerOptions = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
  }
  
  public getPppPath(): string {
    return join(this.projectRoot, '.ppp');
  }
  
  private getArchivePath(): string {
    return join(this.getPppPath(), '_archived');
  }
  
  public async ensurePppDirectory(): Promise<void> {
    const pppPath = this.getPppPath();
    
    if (!(await fileExists(pppPath))) {
      throw new Error('PPP project not initialized. Run "ppp init" first.');
    }
  }
  
  public async ensureArchiveDirectory(): Promise<void> {
    const archivePath = this.getArchivePath();
    await mkdir(archivePath, { recursive: true });
  }
  
  public extractLevelFolderName(id: string, level: number): string {
    // Extract the level-specific folder name from issue ID
    // Level 1: F01 → F01, F0102 → F01, F010203 → F01  
    // Level 2: F0102 → F02, F010203 → F02
    // Level 3: F010203 → F03
    
    const prefix = id.charAt(0); // 'F', 'T', or 'B'
    const digits = id.substring(1); // Remove prefix
    
    if (level === 1) {
      // Level 1: First 2 digits (01 from F01, F0102, F010203)
      return `${prefix}${digits.substring(0, 2)}`;
    } else if (level === 2) {
      // Level 2: Digits 3-4 (02 from F0102, F010203)
      return `${prefix}${digits.substring(2, 4)}`;
    } else if (level === 3) {
      // Level 3: Digits 5-6 (03 from F010203)
      return `${prefix}${digits.substring(4, 6)}`;
    }
    
    return id; // Fallback
  }

  public getIssueLevel(id: string): number {
    // Determine the level based on ID length
    const digits = id.substring(1); // Remove prefix
    const digitCount = digits.length;
    
    if (digitCount === 2) return 1; // F01
    if (digitCount === 4) return 2; // F0103
    if (digitCount === 6) return 3; // F010203
    
    return 1; // Default to level 1
  }

  public generateFolderName(id: string, keywords: string): string {
    const level = this.getIssueLevel(id);
    const levelName = this.extractLevelFolderName(id, level);
    return `${levelName}-${keywords}`;
  }
  
  public async generateIssueFolderPath(issue: Issue): Promise<string> {
    const level = this.getIssueLevel(issue.id);
    
    if (issue.parentId) {
      // Child issue - nest under parent folder
      const folderName = this.generateFolderName(issue.id, issue.keywords);
      const parentFolderPath = await this.getIssueFolderPath(issue.parentId);
      if (!parentFolderPath) {
        throw new Error(`Parent folder not found for issue ${issue.parentId}`);
      }
      return join(parentFolderPath, folderName);
    } else {
      // Top-level issue - build hierarchical path based on ID structure
      const pathParts: string[] = [];
      
      // For features, build the nested path by finding parent folders
      for (let i = 1; i <= level; i++) {
        const levelName = this.extractLevelFolderName(issue.id, i);
        
        if (i === level) {
          // Final level: use actual keywords
          pathParts.push(`${levelName}-${issue.keywords}`);
        } else {
          // Parent levels: find existing parent folder or use placeholder
          const parentId = this.extractLevelFolderName(issue.id, i);
          const existingParentPath = await this.getIssueFolderPath(parentId);
          
          if (existingParentPath) {
            // Use the actual parent folder name from existing structure
            const folderName = existingParentPath.split('/').pop() || `${levelName}-folder`;
            pathParts.push(folderName);
          } else {
            // Fallback to generic naming - this should be rare
            pathParts.push(`${levelName}-folder`);
          }
        }
      }
      
      return join(this.getPppPath(), ...pathParts);
    }
  }
  
  /**
   * Find issue folder using hierarchical traversal based on parent relationships
   * This approach is robust against manual folder renames since it uses stable issue IDs
   */
  public async getIssueFolderPath(issueId: string): Promise<string | null> {
    try {
      // Build parent hierarchy chain from database
      const parentChain = await this.buildParentChain(issueId);
      if (parentChain.length === 0) {
        return null; // Issue not found in database
      }
      
      // Start from .ppp directory and traverse the hierarchy
      let currentPath = this.getPppPath();
      
      for (const chainIssueId of parentChain) {
        const level = this.getIssueLevel(chainIssueId);
        const levelName = this.extractLevelFolderName(chainIssueId, level);
        
        // Look for folder starting with issue ID prefix in current directory
        const folderName = await this.findFolderByPrefix(currentPath, levelName);
        if (!folderName) {
          return null; // Folder not found at this level
        }
        
        currentPath = join(currentPath, folderName);
      }
      
      // Verify the final folder exists
      if (await fileExists(currentPath)) {
        return currentPath;
      }
      
      return null;
    } catch (error) {
      console.warn(`Failed to get folder path for issue ${issueId}:`, error);
      return null;
    }
  }
  
  /**
   * Build the parent hierarchy chain from database using parent relationships
   * Returns array from root to target issue (e.g., [F01, F02, T03] for T010203)
   */
  private async buildParentChain(issueId: string): Promise<string[]> {
    const chain: string[] = [];
    let currentId = issueId;
    
    // Traverse up the parent chain
    while (currentId) {
      const metadata = await databaseManager.getIssue(currentId);
      if (!metadata) {
        break; // Issue not found
      }
      
      // Extract level-specific ID for this issue
      const level = this.getIssueLevel(currentId);
      const levelId = this.extractLevelFolderName(currentId, level);
      chain.unshift(levelId); // Add to beginning to build root-to-target chain
      
      currentId = metadata.parent_id; // Move up to parent
    }
    
    return chain;
  }
  
  /**
   * Find folder in directory that starts with the given prefix
   * Returns the actual folder name, not the full path
   */
  private async findFolderByPrefix(dirPath: string, prefix: string): Promise<string | null> {
    try {
      const items = await readdir(dirPath);
      
      for (const item of items) {
        const itemPath = join(dirPath, item);
        const itemStat = await stat(itemPath);
        
        if (itemStat.isDirectory()) {
          // Case-insensitive prefix matching
          if (item.toUpperCase().startsWith(`${prefix.toUpperCase()}-`)) {
            return item;
          }
        }
      }
      
      return null;
    } catch (error) {
      console.warn(`Failed to scan directory ${dirPath}:`, error);
      return null;
    }
  }
  
  public async createIssueFolder(issue: Issue): Promise<string> {
    await this.ensurePppDirectory();
    
    const folderPath = await this.generateIssueFolderPath(issue);
    await mkdir(folderPath, { recursive: true });
    
    // Create spec.md file
    const specPath = join(folderPath, 'spec.md');
    const specContent = this.generateIssueSpecContent(issue);
    await writeFile(specPath, specContent);
    
    return folderPath;
  }
  
  public async updateIssueFolder(issue: Issue, oldKeywords?: string): Promise<string> {
    await this.ensurePppDirectory();
    
    // Always find the existing folder first using issue ID
    const currentFolderPath = await this.getIssueFolderPath(issue.id);
    
    let newFolderPath: string;
    try {
      newFolderPath = await this.generateIssueFolderPath(issue);
    } catch (error) {
      console.warn(`Failed to generate folder path for ${issue.id}:`, error);
      // If we have an existing folder, use it as fallback
      if (currentFolderPath) {
        newFolderPath = currentFolderPath;
      } else {
        // Create a fallback path only if no existing folder
        const folderName = this.generateFolderName(issue.id, issue.keywords);
        newFolderPath = join(this.getPppPath(), folderName);
      }
    }
    
    let actualFolderPath = newFolderPath;
    
    // Always try to rename existing folder when we have the current path
    if (currentFolderPath && await fileExists(currentFolderPath)) {
      // We have an existing folder - rename it if path is different
      if (currentFolderPath !== newFolderPath) {
        await rename(currentFolderPath, newFolderPath);
      }
      actualFolderPath = newFolderPath;
    } else if (!(await fileExists(newFolderPath))) {
      // No existing folder and new path doesn't exist, create it
      await mkdir(newFolderPath, { recursive: true });
      actualFolderPath = newFolderPath;
    }
    
    // Ensure the folder exists (in case it was renamed to an existing path)
    if (!(await fileExists(actualFolderPath))) {
      await mkdir(actualFolderPath, { recursive: true });
    }
    
    // Update spec.md file
    const specPath = join(actualFolderPath, 'spec.md');
    const specContent = this.generateIssueSpecContent(issue);
    await writeFile(specPath, specContent);
    
    return actualFolderPath;
  }
  
  public async deleteIssueFolder(issueId: string): Promise<void> {
    await this.ensurePppDirectory();
    await this.ensureArchiveDirectory();
    
    const folderPath = await this.getIssueFolderPath(issueId);
    if (folderPath && await fileExists(folderPath)) {
      const archivePath = this.getArchivePath();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archivedName = `${issueId}-archived-${timestamp}`;
      const archivedPath = join(archivePath, archivedName);
      
      await rename(folderPath, archivedPath);
    }
  }
  
  public async createSprintFile(sprint: Sprint): Promise<string> {
    await this.ensurePppDirectory();
    
    const filePath = join(this.getPppPath(), `${sprint.id}.md`);
    const content = this.generateSprintContent(sprint);
    await writeFile(filePath, content);
    
    return filePath;
  }
  
  public async updateSprintFile(sprint: Sprint): Promise<string> {
    await this.ensurePppDirectory();
    
    const filePath = join(this.getPppPath(), `${sprint.id}.md`);
    const content = this.generateSprintContent(sprint);
    await writeFile(filePath, content);
    
    return filePath;
  }
  
  public async deleteSprintFile(sprintId: string): Promise<void> {
    await this.ensurePppDirectory();
    
    const filePath = join(this.getPppPath(), `${sprintId}.md`);
    if (await fileExists(filePath)) {
      await this.ensureArchiveDirectory();
      const archivePath = this.getArchivePath();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archivedName = `${sprintId}-archived-${timestamp}.md`;
      const archivedPath = join(archivePath, archivedName);
      
      await rename(filePath, archivedPath);
    }
  }
  
  public async readIssueSpec(issueId: string): Promise<Issue | null> {
    try {
      const folderPath = await this.getIssueFolderPath(issueId);
      if (!folderPath) {
        return null;
      }
      
      const specPath = join(folderPath, 'spec.md');
      
      if (!(await fileExists(specPath))) {
        return null;
      }
      
      const content = await readFile(specPath, 'utf-8');
      return this.parseIssueSpecContent(content);
    } catch (error) {
      console.warn(`Failed to read issue spec for ${issueId}:`, error);
      return null;
    }
  }
  
  public async readSprintFile(sprintId: string): Promise<Sprint | null> {
    try {
      const filePath = join(this.getPppPath(), `${sprintId}.md`);
      
      if (!(await fileExists(filePath))) {
        return null;
      }
      
      const content = await readFile(filePath, 'utf-8');
      return this.parseSprintContent(content);
    } catch (error) {
      console.warn(`Failed to read sprint file for ${sprintId}:`, error);
      return null;
    }
  }
  
  private generateIssueSpecContent(issue: Issue): string {
    const commentsSection = issue.comments.length > 0 
      ? `\n\n## Comments\n\n${issue.comments.map(comment => 
          `### ${comment.author} - ${new Date(comment.createdAt).toLocaleDateString()}\n${comment.content}`
        ).join('\n\n')}`
      : '';
    
    return `# ${issue.name}

## Issue Details

- **ID**: ${issue.id}
- **Type**: ${issue.type}
- **Status**: ${issue.status}
- **Priority**: ${issue.priority}
- **Assignee**: ${issue.assignee || 'Unassigned'}
- **Reporter**: ${issue.reporter || 'Unknown'}
- **Labels**: ${issue.labels.join(', ') || 'None'}
- **Parent**: ${issue.parentId || 'None'}
- **Sprint**: ${issue.sprintId || 'None'}
- **Created**: ${new Date(issue.createdAt).toLocaleDateString()}
- **Updated**: ${new Date(issue.updatedAt).toLocaleDateString()}

## Description

${issue.description || 'No description provided.'}

## Keywords

${issue.keywords}
${commentsSection}
`;
  }
  
  private generateSprintContent(sprint: Sprint): string {
    const issuesSection = sprint.issues.length > 0
      ? `\n\n## Issues\n\n${sprint.issues.map(issueId => `- [ ] ${issueId}`).join('\n')}`
      : '\n\n## Issues\n\nNo issues assigned to this sprint.';
    
    return `# ${sprint.name}

## Sprint Details

- **ID**: ${sprint.id}
- **State**: ${sprint.state}
- **Start Date**: ${new Date(sprint.startDate).toLocaleDateString()}
- **End Date**: ${sprint.endDate ? new Date(sprint.endDate).toLocaleDateString() : 'Not set'}
- **Velocity**: ${sprint.velocity}
- **Created**: ${new Date(sprint.createdAt).toLocaleDateString()}
- **Updated**: ${new Date(sprint.updatedAt).toLocaleDateString()}

## Description

${sprint.description}
${issuesSection}
`;
  }
  
  private parseIssueSpecContent(content: string): Issue {
    // This is a simplified parser - in a real implementation, you'd use a proper markdown parser
    // For now, we'll extract basic information using regex
    const lines = content.split('\n');
    const issue: Partial<Issue> = {
      comments: []
    };
    
    // Extract title from first line
    const titleMatch = content.match(/^# (.+)$/m);
    if (titleMatch) {
      issue.name = titleMatch[1];
    }
    
    // Extract description section
    const descriptionMatch = content.match(/## Description\n\n(.*?)(?=\n\n## |$)/s);
    if (descriptionMatch) {
      issue.description = descriptionMatch[1].trim();
    }
    
    // Extract keywords section
    const keywordsMatch = content.match(/## Keywords\n\n(.*?)(?=\n\n## |$)/s);
    if (keywordsMatch) {
      issue.keywords = keywordsMatch[1].trim();
    }
    
    for (const line of lines) {
      if (line.startsWith('- **ID**:')) {
        issue.id = line.split(':')[1].trim();
      } else if (line.startsWith('- **Type**:')) {
        issue.type = line.split(':')[1].trim() as IssueType;
      } else if (line.startsWith('- **Status**:')) {
        issue.status = line.split(':')[1].trim() as IssueStatus;
      } else if (line.startsWith('- **Priority**:')) {
        issue.priority = line.split(':')[1].trim() as IssuePriority;
      } else if (line.startsWith('- **Assignee**:')) {
        const assignee = line.split(':')[1].trim();
        issue.assignee = assignee === 'Unassigned' ? undefined : assignee;
      } else if (line.startsWith('- **Reporter**:')) {
        const reporter = line.split(':')[1].trim();
        issue.reporter = reporter === 'Unknown' ? undefined : reporter;
      } else if (line.startsWith('- **Labels**:')) {
        const labels = line.split(':')[1].trim();
        issue.labels = labels === 'None' ? [] : labels.split(',').map(l => l.trim());
      } else if (line.startsWith('- **Parent**:')) {
        const parent = line.split(':')[1].trim();
        issue.parentId = parent === 'None' ? undefined : parent;
      } else if (line.startsWith('- **Sprint**:')) {
        const sprint = line.split(':')[1].trim();
        issue.sprintId = sprint === 'None' ? undefined : sprint;
      } else if (line.startsWith('- **Created**:')) {
        const created = line.split(':')[1].trim();
        issue.createdAt = new Date(created).toISOString();
      } else if (line.startsWith('- **Updated**:')) {
        const updated = line.split(':')[1].trim();
        issue.updatedAt = new Date(updated).toISOString();
      }
    }
    
    return issue as Issue;
  }
  
  private parseSprintContent(content: string): Sprint {
    // Similar to parseIssueSpecContent, this is simplified
    const lines = content.split('\n');
    const sprint: Partial<Sprint> = {
      issues: []
    };
    
    for (const line of lines) {
      if (line.startsWith('- **ID**:')) {
        sprint.id = line.split(':')[1].trim();
      }
      // ... parse other fields
    }
    
    return sprint as Sprint;
  }
}

export const fileManager = new FileManager();