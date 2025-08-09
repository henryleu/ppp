import { mkdir, writeFile, readFile, rename, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { fileExists } from './settings.js';
import { Issue, IssueType, IssueStatus, IssuePriority } from '../types/issue.js';
import { Sprint, SprintStatus } from '../types/sprint.js';
import { databaseManager } from './database.js';

export interface FileManagerOptions {
  projectRoot?: string;
}

interface SpecSections {
  title: string;
  customPreIssueDetails: string;
  issueDetails: string;
  description: string;
  customSections: Map<string, string>;
  comments: string;
  children: string;
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

      currentId = metadata.parent_id || ''; // Move up to parent, use empty string if undefined
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
    const specContent = await this.generateIssueSpecContent(issue);
    await writeFile(specPath, specContent);

    return folderPath;
  }

  public async updateIssueFolder(issue: Issue, oldKeywords?: string): Promise<string> {
    await this.ensurePppDirectory();

    console.debug(`[DEBUG] updateIssueFolder: ${issue.id} (${issue.name}) - keywords: ${issue.keywords}`);

    // Always find the existing folder first using issue ID
    const currentFolderPath = await this.getIssueFolderPath(issue.id);
    console.debug(`[DEBUG] Current folder path: ${currentFolderPath}`);

    let newFolderPath: string;
    try {
      newFolderPath = await this.generateIssueFolderPath(issue);
      console.debug(`[DEBUG] Generated new folder path: ${newFolderPath}`);
    } catch (error) {
      console.warn(`[WARNING] Failed to generate folder path for ${issue.id}:`, error);
      // If we have an existing folder, use it as fallback
      if (currentFolderPath) {
        newFolderPath = currentFolderPath;
        console.warn(`[WARNING] Using existing folder as fallback: ${currentFolderPath}`);
      } else {
        // Create a fallback path only if no existing folder
        const folderName = this.generateFolderName(issue.id, issue.keywords);
        newFolderPath = join(this.getPppPath(), folderName);
        console.warn(`[WARNING] Creating fallback folder: ${newFolderPath}`);
      }
    }

    let actualFolderPath = newFolderPath;

    // Always try to rename existing folder when we have the current path
    if (currentFolderPath && await fileExists(currentFolderPath)) {
      // We have an existing folder - rename it if path is different
      if (currentFolderPath !== newFolderPath) {
        console.debug(`[DEBUG] Attempting to rename: ${currentFolderPath} → ${newFolderPath}`);
        try {
          await rename(currentFolderPath, newFolderPath);
          console.debug(`[DEBUG] Folder renamed successfully`);
        } catch (error) {
          console.error(`[ERROR] Failed to rename folder ${currentFolderPath} to ${newFolderPath}:`, error);
          // Use current path if rename fails
          actualFolderPath = currentFolderPath;
          console.warn(`[WARNING] Keeping original folder: ${currentFolderPath}`);
        }
      } else {
        console.debug(`[DEBUG] Folder path unchanged: ${currentFolderPath}`);
      }
      actualFolderPath = newFolderPath;
    } else if (!(await fileExists(newFolderPath))) {
      // No existing folder and new path doesn't exist, create it
      console.debug(`[DEBUG] Creating new folder: ${newFolderPath}`);
      await mkdir(newFolderPath, { recursive: true });
      actualFolderPath = newFolderPath;
    }

    // Ensure the folder exists (in case it was renamed to an existing path)
    if (!(await fileExists(actualFolderPath))) {
      await mkdir(actualFolderPath, { recursive: true });
    }

    // Update spec.md file preserving existing content
    const specPath = join(actualFolderPath, 'spec.md');
    let specContent: string;
    
    // Try to read existing content to preserve custom sections
    try {
      const existingContent = await readFile(specPath, 'utf-8');
      specContent = await this.generatePreservedIssueSpecContent(issue, existingContent);
    } catch (error) {
      // File doesn't exist or can't be read, use standard generation
      console.debug(`[DEBUG] Could not read existing spec.md, using standard generation: ${error}`);
      specContent = await this.generateIssueSpecContent(issue);
    }
    
    await writeFile(specPath, specContent);

    return actualFolderPath;
  }

  /**
   * Update issue folder with children data from database
   * This method gets both issue and children data from database to ensure consistency
   */
  public async updateIssueFolderWithChildren(issue: Issue, childrenIds: string[], oldKeywords?: string): Promise<string> {
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
      if (currentFolderPath !== newFolderPath) {
        // Only rename if paths differ and new path doesn't exist
        if (!(await fileExists(newFolderPath))) {
          await rename(currentFolderPath, newFolderPath);
          actualFolderPath = newFolderPath;
        } else {
          // Use existing folder if new path already exists
          actualFolderPath = currentFolderPath;
        }
      } else {
        // Paths are same, use current path
        actualFolderPath = currentFolderPath;
      }
    } else if (!(await fileExists(newFolderPath))) {
      // No existing folder and new path doesn't exist, create it
      await mkdir(newFolderPath, { recursive: true });
      actualFolderPath = newFolderPath;
    }

    // Ensure the folder exists (in case it was renamed to an existing path)
    if (!(await fileExists(actualFolderPath))) {
      await mkdir(actualFolderPath, { recursive: true });
    }

    // Update spec.md file with children data preserving existing content
    const specPath = join(actualFolderPath, 'spec.md');
    let specContent: string;
    
    // Try to read existing content to preserve custom sections
    try {
      const existingContent = await readFile(specPath, 'utf-8');
      specContent = await this.generatePreservedIssueSpecContent(issue, existingContent, childrenIds);
    } catch (error) {
      // File doesn't exist or can't be read, use standard generation
      console.debug(`[DEBUG] Could not read existing spec.md, using standard generation: ${error}`);
      specContent = await this.generateIssueSpecContent(issue, childrenIds);
    }
    
    await writeFile(specPath, specContent);

    return actualFolderPath;
  }

  public async deleteIssueFolder(issueId: string): Promise<void> {
    await this.ensurePppDirectory();
    await this.ensureArchiveDirectory();

    const folderPath = await this.getIssueFolderPath(issueId);
    if (!folderPath) {
      console.warn(`[WARNING] Issue folder for ${issueId} not found, may have been deleted already`);
      return;
    }

    if (!(await fileExists(folderPath))) {
      console.warn(`[WARNING] Issue folder ${folderPath} does not exist, may have been deleted already`);
      return;
    }

    const archivePath = this.getArchivePath();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archivedName = `${issueId}-archived-${timestamp}`;
    const archivedPath = join(archivePath, archivedName);

    try {
      await rename(folderPath, archivedPath);
      console.log(`[OK] Issue folder moved to archive: ${archivedPath}`);
    } catch (error) {
      console.error(`[ERROR] Failed to move issue folder to archive: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  public async deleteIssueFolderByPath(issueId: string, folderPath: string | null): Promise<void> {
    await this.ensurePppDirectory();
    await this.ensureArchiveDirectory();

    if (!folderPath) {
      console.warn(`[WARNING] Issue folder for ${issueId} not found, may have been deleted already`);
      return;
    }

    if (!(await fileExists(folderPath))) {
      console.warn(`[WARNING] Issue folder ${folderPath} does not exist, may have been deleted already`);
      return;
    }

    const archivePath = this.getArchivePath();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archivedName = `${issueId}-archived-${timestamp}`;
    const archivedPath = join(archivePath, archivedName);

    try {
      await rename(folderPath, archivedPath);
      console.log(`[OK] Issue folder moved to archive: ${archivedPath}`);
    } catch (error) {
      console.error(`[ERROR] Failed to move issue folder to archive: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  public async createSprintFolder(sprint: Sprint): Promise<string> {
    await this.ensurePppDirectory();

    // Create sprint folder
    const sprintFolderPath = join(this.getPppPath(), sprint.id);
    await mkdir(sprintFolderPath, { recursive: true });

    // Create spec.md file in sprint folder
    const specFilePath = join(sprintFolderPath, 'spec.md');
    const content = await this.generateSprintContent(sprint);
    await writeFile(specFilePath, content);

    return sprintFolderPath;
  }

  public async updateSprintSpec(sprint: Sprint): Promise<string> {
    await this.ensurePppDirectory();

    // Update spec.md file in sprint folder
    const specFilePath = join(this.getPppPath(), sprint.id, 'spec.md');
    const content = await this.generateSprintContent(sprint);
    await writeFile(specFilePath, content);

    return specFilePath;
  }

  public async deleteSprintFolder(sprintId: string): Promise<void> {
    await this.ensurePppDirectory();

    const sprintFolderPath = join(this.getPppPath(), sprintId);
    if (await fileExists(sprintFolderPath)) {
      await this.ensureArchiveDirectory();
      const archivePath = this.getArchivePath();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archivedName = `${sprintId}-archived-${timestamp}`;
      const archivedPath = join(archivePath, archivedName);

      await rename(sprintFolderPath, archivedPath);
    }
  }

  /**
   * Generate symlink folder name using full object ID and keywords from existing folder
   * Example: F0102 + "F02-user_mgmt" -> "F0102-user_mgmt"
   */
  private generateSymlinkFolderName(issueId: string, issueFolderPath: string): string {
    // Extract the immediate folder name
    const folderName = issueFolderPath.split('/').pop();
    if (!folderName) {
      return `${issueId}-folder`;
    }

    // Extract keywords from existing folder name (everything after the first dash)
    const dashIndex = folderName.indexOf('-');
    if (dashIndex === -1) {
      // No keywords found, use issue ID only
      return `${issueId}-folder`;
    }

    const keywords = folderName.substring(dashIndex + 1);
    return `${issueId}-${keywords}`;
  }

  public async createIssueSymlink(sprintId: string, issueId: string): Promise<void> {
    // Check if symlink already exists using ID-based detection
    const existingSymlink = await this.findSymlinkByIssueId(sprintId, issueId);
    if (existingSymlink) {
      // Symlink already exists, no need to create
      return;
    }

    const sprintFolderPath = join(this.getPppPath(), sprintId);
    const issueFolderPath = await this.getIssueFolderPath(issueId);

    if (!issueFolderPath) {
      console.warn(`Issue folder for ${issueId} not found, cannot create symlink`);
      return;
    }

    // Generate symlink folder name using full object ID
    const symlinkFolderName = this.generateSymlinkFolderName(issueId, issueFolderPath);
    const symlinkPath = join(sprintFolderPath, symlinkFolderName);

    try {
      // Create symbolic link to the issue folder
      const { symlink } = await import('fs/promises');
      await symlink(issueFolderPath, symlinkPath, 'dir');
    } catch (error) {
      console.warn(`Failed to create symlink for issue ${issueId}:`, error);
    }
  }

  public async removeIssueSymlink(sprintId: string, issueId: string): Promise<void> {
    // Find existing symlink using ID-based detection
    const existingSymlink = await this.findSymlinkByIssueId(sprintId, issueId);
    if (!existingSymlink) {
      // Symlink doesn't exist, nothing to remove
      return;
    }

    try {
      const { unlink } = await import('fs/promises');
      await unlink(existingSymlink);
    } catch (error) {
      console.warn(`Failed to remove symlink for issue ${issueId}:`, error);
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

  public async readSprintSpec(sprintId: string): Promise<Sprint | null> {
    try {
      const specFilePath = join(this.getPppPath(), sprintId, 'spec.md');

      if (!(await fileExists(specFilePath))) {
        return null;
      }

      const content = await readFile(specFilePath, 'utf-8');
      return this.parseSprintContent(content);
    } catch (error) {
      console.warn(`Failed to read sprint spec for ${sprintId}:`, error);
      return null;
    }
  }

  private async generateIssueSpecContent(issue: Issue, childrenIds?: string[]): Promise<string> {
    const commentsSection = issue.comments.length > 0
      ? `\n\n## Comments\n\n${issue.comments.map(comment =>
          `### ${comment.author} - ${new Date(comment.createdAt).toLocaleDateString()}\n${comment.content}`
        ).join('\n\n')}`
      : '';

    const childrenSection = childrenIds && childrenIds.length >= 0
      ? `\n\n## Children\n\n${await this.generateChildrenLinksSection(childrenIds)}`
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
${commentsSection}
${childrenSection}
`;
  }

  /**
   * Generate spec content preserving existing custom content
   * Only updates title and Issue Details while preserving everything else
   */
  private async generatePreservedIssueSpecContent(issue: Issue, existingContent: string, childrenIds?: string[]): Promise<string> {
    // Parse existing content into sections
    const sections = this.parseSpecContent(existingContent);
    
    // Update title
    sections.title = issue.name;
    
    // Update Issue Details section
    sections.issueDetails = `- **ID**: ${issue.id}
- **Type**: ${issue.type}
- **Status**: ${issue.status}
- **Priority**: ${issue.priority}
- **Assignee**: ${issue.assignee || 'Unassigned'}
- **Reporter**: ${issue.reporter || 'Unknown'}
- **Labels**: ${issue.labels.join(', ') || 'None'}
- **Parent**: ${issue.parentId || 'None'}
- **Sprint**: ${issue.sprintId || 'None'}
- **Created**: ${new Date(issue.createdAt).toLocaleDateString()}
- **Updated**: ${new Date(issue.updatedAt).toLocaleDateString()}`;

    // Update Children section if provided
    if (childrenIds && childrenIds.length >= 0) {
      sections.children = await this.generateChildrenLinksSection(childrenIds);
    }

    // Reconstruct the content preserving custom sections
    return this.reconstructSpecContent(sections);
  }

  /**
   * Parse spec.md content into sections
   */
  private parseSpecContent(content: string): SpecSections {
    const lines = content.split('\n');
    const sections: SpecSections = {
      title: '',
      customPreIssueDetails: '',
      issueDetails: '',
      description: '',
      customSections: new Map(),
      comments: '',
      children: ''
    };

    let currentSection: string | null = null;
    let currentContent: string[] = [];
    let foundIssueDetails = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('# ')) {
        // Title line
        sections.title = line.substring(2);
        continue;
      }

      if (line.startsWith('## ')) {
        // Save previous section
        if (currentSection) {
          this.saveSection(sections, currentSection, currentContent.join('\n').trim(), foundIssueDetails);
        }

        // Start new section
        currentSection = line.substring(3);
        currentContent = [];
        
        if (currentSection === 'Issue Details') {
          foundIssueDetails = true;
        }
        continue;
      }

      // If we haven't found Issue Details yet and we have content, it's custom pre-Issue Details content
      if (!foundIssueDetails && !currentSection && line.trim()) {
        sections.customPreIssueDetails += (sections.customPreIssueDetails ? '\n' : '') + line;
        continue;
      }

      // Collect content for current section
      if (currentSection) {
        currentContent.push(line);
      }
    }

    // Save final section
    if (currentSection) {
      this.saveSection(sections, currentSection, currentContent.join('\n').trim(), foundIssueDetails);
    }

    return sections;
  }

  /**
   * Save parsed section content
   */
  private saveSection(sections: SpecSections, sectionName: string, content: string, foundIssueDetails: boolean): void {
    switch (sectionName) {
      case 'Issue Details':
        sections.issueDetails = content;
        break;
      case 'Description':
        sections.description = content;
        break;
      case 'Comments':
        sections.comments = content;
        break;
      case 'Children':
        sections.children = content;
        break;
      default:
        // Custom section
        sections.customSections.set(sectionName, content);
        break;
    }
  }

  /**
   * Reconstruct spec content from sections
   */
  private reconstructSpecContent(sections: SpecSections): string {
    let content = `# ${sections.title}`;

    // Add custom pre-Issue Details content if it exists
    if (sections.customPreIssueDetails.trim()) {
      content += '\n\n' + sections.customPreIssueDetails;
    }

    // Always add Issue Details
    content += '\n\n## Issue Details\n\n' + sections.issueDetails;

    // Add Description if it exists
    if (sections.description) {
      content += '\n\n## Description\n\n' + sections.description;
    }

    // Add custom sections in the order they appeared
    for (const [sectionName, sectionContent] of sections.customSections) {
      if (sectionContent.trim()) {
        content += `\n\n## ${sectionName}\n\n${sectionContent}`;
      }
    }

    // Add Comments if they exist
    if (sections.comments) {
      content += '\n\n## Comments\n\n' + sections.comments;
    }

    // Add Children if they exist
    if (sections.children) {
      content += '\n\n## Children\n\n' + sections.children;
    }

    return content + '\n';
  }

  /**
   * Generate markdown links for issues in sprint spec.md
   * Creates clickable links using symlink folder names that point to spec.md files
   */
  private async generateIssueLinksSection(issueIds: string[]): Promise<string> {
    const linkPromises = issueIds.map(async (issueId) => {
      const issueFolderPath = await this.getIssueFolderPath(issueId);
      if (!issueFolderPath) {
        return `- [ ] ${issueId} (not found)`;
      }
      
      const symlinkFolderName = this.generateSymlinkFolderName(issueId, issueFolderPath);
      return `- [ ] [${symlinkFolderName}](${symlinkFolderName}/spec.md)`;
    });
    
    const issueLinks = await Promise.all(linkPromises);
    return issueLinks.join('\n');
  }

  /**
   * Generate markdown links for child issues in issue spec.md
   * Creates clickable links that point directly to child issue folders
   */
  private async generateChildrenLinksSection(childrenIds: string[]): Promise<string> {
    if (childrenIds.length === 0) {
      return '*No child issues found.*';
    }

    const linkPromises = childrenIds.map(async (childId) => {
      const childFolderPath = await this.getIssueFolderPath(childId);
      if (!childFolderPath) {
        return `- [${childId}](${childId}/spec.md) *(not found)*`;
      }
      
      const folderName = childFolderPath.split('/').pop();
      if (!folderName) {
        return `- [${childId}](${childId}/spec.md) *(folder error)*`;
      }
      
      return `- [${folderName}](${folderName}/spec.md)`;
    });
    
    const childLinks = await Promise.all(linkPromises);
    return childLinks.join('\n');
  }

  private async generateSprintContent(sprint: Sprint): Promise<string> {
    const issuesSection = sprint.issues.length > 0
      ? `\n\n## Issues\n\n${await this.generateIssueLinksSection(sprint.issues)}`
      : '\n\n## Issues\n\nNo issues assigned to this sprint.';

    return `# ${sprint.name}

## Sprint Details

- **ID**: ${sprint.id}
- **State**: ${sprint.status}
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
    // Parse sprint content from spec.md file
    const lines = content.split('\n');
    const sprint: Partial<Sprint> = {
      issues: []
    };

    // Extract title from first line
    const titleMatch = content.match(/^# (.+)$/m);
    if (titleMatch) {
      sprint.name = titleMatch[1];
    }

    // Extract description section
    const descriptionMatch = content.match(/## Description\n\n(.*?)(?=\n\n## |$)/s);
    if (descriptionMatch) {
      sprint.description = descriptionMatch[1].trim();
    }

    // Extract issues section
    const issuesMatch = content.match(/## Issues\n\n(.*?)$/s);
    if (issuesMatch) {
      const issuesSection = issuesMatch[1];
      const issueLines = issuesSection.split('\n').filter(line => line.startsWith('- [ ]') || line.startsWith('- [x]'));
      sprint.issues = issueLines.map(line => line.replace(/^- \[[ x]\] /, '').trim()).filter(id => id && id !== 'No issues assigned to this sprint.');
    }

    for (const line of lines) {
      if (line.startsWith('- **ID**:')) {
        sprint.id = line.split(':')[1].trim();
      } else if (line.startsWith('- **State**:')) {
        sprint.status = line.split(':')[1].trim() as SprintStatus;
      } else if (line.startsWith('- **Start Date**:')) {
        const dateStr = line.split(':')[1].trim();
        sprint.startDate = new Date(dateStr).toISOString();
      } else if (line.startsWith('- **End Date**:')) {
        const dateStr = line.split(':')[1].trim();
        if (dateStr !== 'Not set') {
          sprint.endDate = new Date(dateStr).toISOString();
        }
      } else if (line.startsWith('- **Velocity**:')) {
        sprint.velocity = parseInt(line.split(':')[1].trim());
      } else if (line.startsWith('- **Created**:')) {
        const dateStr = line.split(':')[1].trim();
        sprint.createdAt = new Date(dateStr).toISOString();
      } else if (line.startsWith('- **Updated**:')) {
        const dateStr = line.split(':')[1].trim();
        sprint.updatedAt = new Date(dateStr).toISOString();
      }
    }

    // Set default values for required fields if not found
    sprint.name = sprint.name || 'Unknown Sprint';
    sprint.description = sprint.description || '';
    sprint.id = sprint.id || 'Unknown';
    sprint.status = sprint.status || SprintStatus.PLANNED;
    sprint.startDate = sprint.startDate || new Date().toISOString();
    sprint.velocity = sprint.velocity || 0;
    sprint.createdAt = sprint.createdAt || new Date().toISOString();
    sprint.updatedAt = sprint.updatedAt || new Date().toISOString();
    sprint.issues = sprint.issues || [];

    return sprint as Sprint;
  }

  /**
   * Find symlink by issue ID using ID-based detection
   * Scans sprint folder for symlinks and checks their targets to match against issue ID
   */
  public async findSymlinkByIssueId(sprintId: string, issueId: string): Promise<string | null> {
    try {
      const sprintFolderPath = join(this.getPppPath(), sprintId);
      if (!(await fileExists(sprintFolderPath))) {
        return null;
      }

      const entries = await readdir(sprintFolderPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isSymbolicLink()) {
          const symlinkPath = join(sprintFolderPath, entry.name);
          try {
            // Read the symlink target
            const { readlink } = await import('fs/promises');
            const targetPath = await readlink(symlinkPath);
            
            // Get issue folder path to compare
            const expectedIssueFolderPath = await this.getIssueFolderPath(issueId);
            if (expectedIssueFolderPath) {
              // Compare absolute paths
              const { resolve } = await import('path');
              const resolvedTarget = resolve(sprintFolderPath, targetPath);
              const resolvedExpected = resolve(expectedIssueFolderPath);
              
              if (resolvedTarget === resolvedExpected) {
                return symlinkPath;
              }
            }
          } catch (error) {
            // Skip invalid symlinks
            continue;
          }
        }
      }
      
      return null;
    } catch (error) {
      console.warn(`Failed to find symlink for issue ${issueId} in sprint ${sprintId}:`, error);
      return null;
    }
  }
}

export const fileManager = new FileManager();
