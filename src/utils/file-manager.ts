import { mkdir, writeFile, readFile, rename, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileExists } from './settings.js';
import { Issue, IssueType, IssueStatus, IssuePriority } from '../types/issue.js';
import { Sprint } from '../types/sprint.js';

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
  
  public generateFolderName(id: string, keywords: string): string {
    // Keywords are already sanitized by sanitizeKeywords() in llm.ts
    // Just combine ID and keywords with hyphen separator
    return `${id}-${keywords}`;
  }
  
  public async generateIssueFolderPath(issue: Issue): Promise<string> {
    const folderName = this.generateFolderName(issue.id, issue.keywords);
    
    if (issue.parentId) {
      // Child issue - nest under parent
      const parentFolderPath = await this.getIssueFolderPath(issue.parentId);
      if (!parentFolderPath) {
        throw new Error(`Parent folder not found for issue ${issue.parentId}`);
      }
      return join(parentFolderPath, folderName);
    } else {
      // Top-level issue - directly under .ppp
      return join(this.getPppPath(), folderName);
    }
  }
  
  public async getIssueFolderPath(issueId: string): Promise<string | null> {
    // Scan the directory structure recursively to find the folder matching the issue ID
    const { readdir, stat } = await import('fs/promises');
    
    const scanDirectory = async (dirPath: string): Promise<string | null> => {
      try {
        const items = await readdir(dirPath);
        
        for (const item of items) {
          const itemPath = join(dirPath, item);
          const itemStat = await stat(itemPath);
          
          if (itemStat.isDirectory()) {
            // Check if this is the issue folder we're looking for (case-insensitive)
            if (item.toUpperCase().startsWith(`${issueId.toUpperCase()}-`)) {
              return itemPath;
            }
            
            // Recursively scan subdirectories
            const result = await scanDirectory(itemPath);
            if (result) return result;
          }
        }
        
        return null;
      } catch (error) {
        console.warn(`Failed to scan directory ${dirPath}:`, error);
        return null;
      }
    };
    
    return await scanDirectory(this.getPppPath());
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
    
    const newFolderPath = await this.generateIssueFolderPath(issue);
    
    if (oldKeywords) {
      // Rename folder if keywords changed
      // Find the current folder path using the issue ID
      const currentFolderPath = await this.getIssueFolderPath(issue.id);
      
      if (currentFolderPath && await fileExists(currentFolderPath)) {
        await rename(currentFolderPath, newFolderPath);
      }
    }
    
    // Update spec.md file
    const specPath = join(newFolderPath, 'spec.md');
    const specContent = this.generateIssueSpecContent(issue);
    await writeFile(specPath, specContent);
    
    return newFolderPath;
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