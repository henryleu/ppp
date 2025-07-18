import { databaseManager } from './database.js';
import { fileManager } from './file-manager.js';
import { generateIssueId } from './id-generator.js';
import { generateIssueNameKeywords } from './llm.js';
import { 
  IssueMetadata, 
  SprintMetadata, 
  IssueFilter, 
  IssueUpdate, 
  SprintUpdate,
  isValidIssueType,
  isValidIssueStatus,
  isValidIssuePriority,
  isValidSprintState 
} from '../types/database.js';
import { Issue, IssueCreationData, IssueType, IssueStatus, IssuePriority } from '../types/issue.js';
import { Sprint, SprintState, SprintCreationData } from '../types/sprint.js';

/**
 * Hybrid manager that coordinates between YAML database (metadata) and markdown files (content)
 */
export class HybridManager {
  
  /**
   * Initialize database if not exists
   */
  public async initialize(projectName?: string): Promise<void> {
    if (!await databaseManager.exists()) {
      await databaseManager.initialize(projectName);
    }
  }

  /**
   * Create a new issue with both metadata and content file
   */
  public async createIssue(data: IssueCreationData): Promise<Issue> {
    // Validate parent relationship (same as before)
    await this.validateParent(data.type, data.parentId);
    
    // Generate issue ID using existing logic
    const id = await generateIssueId(data.type, data.parentId);
    
    // Generate keywords
    let keywords: string;
    try {
      keywords = await generateIssueNameKeywords(data.name);
    } catch (error) {
      console.warn('LLM keyword generation failed, using fallback:', error);
      keywords = this.generateFallbackKeywords(data.name);
    }
    
    const now = new Date().toISOString();
    
    // Create metadata for database
    const metadata: IssueMetadata = {
      id,
      name: data.name,
      keywords,
      type: data.type as IssueMetadata['type'],
      status: 'new',
      priority: data.priority === IssuePriority.HIGH ? 'high' : 
               data.priority === IssuePriority.LOW ? 'low' : 'medium',
      assignee: data.assignee,
      reporter: data.reporter,
      labels: data.labels || [],
      parent_id: data.parentId,
      sprint_id: undefined,
      created_at: now,
      updated_at: now,
      children: []
      // folder_path removed - computed dynamically using parent hierarchy
    };

    // Create full issue object for file operations
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
      folderPath: '',
      comments: []
    };
    
    // Create folder and spec.md file
    const folderPath = await fileManager.createIssueFolder(issue);
    // folder_path no longer stored in database - computed dynamically
    issue.folderPath = folderPath;
    
    // Save metadata to database
    await databaseManager.createIssue(metadata);
    
    return issue;
  }

  /**
   * Update an issue's metadata and sync with file if needed
   */
  public async updateIssue(issueId: string, updates: Partial<IssueCreationData>): Promise<Issue> {
    // Get current metadata
    const metadata = await databaseManager.getIssue(issueId);
    if (!metadata) {
      throw new Error(`Issue ${issueId} not found`);
    }

    let keywords = metadata.keywords;
    
    // If name is being updated, regenerate keywords
    if (updates.name && updates.name !== metadata.name) {
      try {
        keywords = await generateIssueNameKeywords(updates.name);
      } catch (error) {
        console.warn('LLM keyword generation failed, using fallback:', error);
        keywords = this.generateFallbackKeywords(updates.name);
      }
    }

    // Prepare database updates
    const dbUpdates: IssueUpdate = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (keywords !== metadata.keywords) dbUpdates.keywords = keywords;
    if (updates.priority) {
      dbUpdates.priority = updates.priority === IssuePriority.HIGH ? 'high' : 
                          updates.priority === IssuePriority.LOW ? 'low' : 'medium';
    }
    if (updates.assignee !== undefined) dbUpdates.assignee = updates.assignee;
    if (updates.reporter !== undefined) dbUpdates.reporter = updates.reporter;
    if (updates.labels) dbUpdates.labels = updates.labels;

    // Update metadata in database
    const updatedMetadata = await databaseManager.updateIssue(issueId, dbUpdates);

    // Create full issue object for file operations if needed
    const issue: Issue = await this.metadataToIssue(updatedMetadata);
    
    // Update file if name/keywords changed
    if (updates.name || keywords !== metadata.keywords) {
      const oldKeywords = metadata.keywords !== keywords ? metadata.keywords : undefined;
      const folderPath = await fileManager.updateIssueFolder(issue, oldKeywords);
      // folder_path no longer stored in database - computed dynamically when needed
      issue.folderPath = folderPath;
    }
    
    return issue;
  }

  /**
   * Delete an issue from both database and files
   */
  public async deleteIssue(issueId: string): Promise<void> {
    // Delete from database (handles relationships)
    await databaseManager.deleteIssue(issueId);
    
    // Move folder to archive
    await fileManager.deleteIssueFolder(issueId);
  }

  /**
   * List issues with filtering
   */
  public async listIssues(filter?: Partial<IssueCreationData & { sprintId?: string; status?: string }>): Promise<Issue[]> {
    // Convert filter to database format
    const dbFilter: IssueFilter = {};
    if (filter) {
      if (filter.parentId !== undefined) dbFilter.parent_id = filter.parentId;
      if (filter.type) dbFilter.type = filter.type;
      if ((filter as any).status) dbFilter.status = (filter as any).status;
      if (filter.assignee !== undefined) dbFilter.assignee = filter.assignee;
      if (filter.labels) dbFilter.labels = filter.labels;
      if ((filter as any).sprintId !== undefined) dbFilter.sprint_id = (filter as any).sprintId;
    }

    const metadataList = await databaseManager.getIssues(dbFilter);
    return Promise.all(metadataList.map(metadata => this.metadataToIssue(metadata)));
  }

  /**
   * List issues in hierarchical order
   */
  public async listIssuesHierarchical(rootParentId?: string, filter?: Partial<IssueCreationData & { sprintId?: string; status?: string }>): Promise<Issue[]> {
    // When rootParentId is specified, we need to show that issue + its descendants
    // The root issue itself should always be included regardless of filter
    let allIssues: Issue[];
    let rootIssue: Issue | null = null;

    if (rootParentId) {
      // Get the root issue first (without any filters)
      rootIssue = await this.getIssue(rootParentId);
      if (!rootIssue) {
        return []; // Root issue not found
      }

      // Get all issues without filtering, we'll filter descendants later
      allIssues = await this.listIssues({});
    } else {
      // No specific root, get all issues with filtering
      allIssues = await this.listIssues(filter);
    }
    
    // Build hierarchy tree with case-insensitive mapping
    const issueMap = new Map<string, Issue>();
    const childrenMap = new Map<string, Issue[]>();
    
    // Create maps for quick lookup with case-insensitive keys
    allIssues.forEach(issue => {
      issueMap.set(issue.id.toUpperCase(), issue);
      const parentKey = issue.parentId ? issue.parentId.toUpperCase() : 'root';
      if (!childrenMap.has(parentKey)) {
        childrenMap.set(parentKey, []);
      }
      childrenMap.get(parentKey)!.push(issue);
    });
    
    // Sort children by ID for consistent ordering
    childrenMap.forEach(children => {
      children.sort((a, b) => a.id.localeCompare(b.id));
    });
    
    // Helper function to check if an issue matches the filter
    const matchesFilter = (issue: Issue): boolean => {
      if (!filter) return true;
      if (filter.type && issue.type !== filter.type) return false;
      if ((filter as any).status && issue.status !== (filter as any).status) return false;
      if (filter.assignee && issue.assignee !== filter.assignee) return false;
      if ((filter as any).sprintId && issue.sprintId !== (filter as any).sprintId) return false;
      if (filter.labels && filter.labels.length > 0) {
        const hasMatchingLabel = filter.labels.some(label => 
          issue.labels.some(issueLabel => 
            issueLabel.toLowerCase().includes(label.toLowerCase())
          )
        );
        if (!hasMatchingLabel) return false;
      }
      return true;
    };
    
    // Traverse hierarchy depth-first to build ordered list
    const result: Issue[] = [];
    
    const traverse = (parentId: string | null, includeParent: boolean = false) => {
      // If includeParent is true and we have a parent issue, add it first
      if (includeParent && parentId) {
        const parentIssue = issueMap.get(parentId.toUpperCase());
        if (parentIssue) {
          result.push(parentIssue);
        }
      }

      // Get children using case-insensitive lookup
      const parentKey = parentId ? parentId.toUpperCase() : 'root';
      const children = childrenMap.get(parentKey) || [];
      
      children.forEach((child) => {
        // Apply filter to descendants (but not to root issue if specified)
        const isRootIssue = rootIssue && child.id.toUpperCase() === rootIssue.id.toUpperCase();
        const childMatchesFilter = isRootIssue || matchesFilter(child);

        // Add child issue if it matches filter
        if (childMatchesFilter) {
          result.push(child);
        }
        
        // Always traverse children to find matching descendants,
        // even if this child doesn't match the filter
        traverse(child.id, false);
      });
    };
    
    // Start traversal from the specified root or from all root issues
    if (rootParentId && rootIssue) {
      // Add the root issue first (always included regardless of filter)
      result.push(rootIssue);
      // Then add its descendants (with filtering applied)
      traverse(rootIssue.id, false);
    } else {
      // Start from all root issues (no parent)
      traverse(null, false);
    }
    
    return result;
  }

  /**
   * Get issue by ID
   */
  public async getIssue(issueId: string): Promise<Issue | null> {
    const metadata = await databaseManager.getIssue(issueId);
    if (!metadata) return null;
    
    return this.metadataToIssue(metadata);
  }

  /**
   * Assign issue to sprint
   */
  public async assignIssueToSprint(issueId: string, sprintId: string): Promise<void> {
    await databaseManager.addIssueToSprint(issueId, sprintId);
  }

  /**
   * Remove issue from sprint
   */
  public async removeIssueFromSprint(issueId: string, sprintId: string): Promise<void> {
    await databaseManager.removeIssueFromSprint(issueId, sprintId);
  }

  /**
   * Create a new sprint
   */
  public async createSprint(data: SprintCreationData): Promise<Sprint> {
    // Get current sprint counter
    const counters = await databaseManager.getCounters();
    const sprintNo = counters.sprints + 1;
    
    const sprintId = `Sprint-${sprintNo.toString().padStart(2, '0')}`;
    const sprintName = `Sprint ${sprintNo.toString().padStart(2, '0')}`;
    
    const now = new Date().toISOString();
    
    // Create metadata for database
    const metadata: SprintMetadata = {
      id: sprintId,
      name: sprintName,
      description: data.description,
      state: 'planned',
      start_date: data.startDate || now.split('T')[0],
      velocity: 0,
      created_at: now,
      updated_at: now,
      issues: []
    };

    // Save to database and update counter atomically
    await databaseManager.createSprint(metadata);
    await databaseManager.updateCounters({ sprints: sprintNo });
    
    // Create Sprint object
    const sprint: Sprint = {
      id: sprintId,
      name: sprintName,
      description: data.description,
      state: SprintState.PLANNED,
      startDate: data.startDate || now,
      issues: [],
      velocity: 0,
      createdAt: now,
      updatedAt: now
    };

    // Create markdown file
    await fileManager.createSprintFile(sprint);
    
    return sprint;
  }

  /**
   * Get all sprints
   */
  public async getSprints(): Promise<Sprint[]> {
    const metadataList = await databaseManager.getSprints();
    return metadataList.map(metadata => this.metadataToSprint(metadata));
  }

  /**
   * Get sprint by ID
   */
  public async getSprint(sprintId: string): Promise<Sprint | null> {
    const metadata = await databaseManager.getSprint(sprintId);
    if (!metadata) return null;
    
    return this.metadataToSprint(metadata);
  }

  /**
   * Add issue to sprint
   */
  public async addIssueToSprint(issueId: string, sprintNo: string): Promise<boolean> {
    const sprintId = `Sprint-${sprintNo.padStart(2, '0')}`;
    
    try {
      await databaseManager.addIssueToSprint(issueId, sprintId);
      
      // Update sprint markdown file
      const sprint = await this.getSprint(sprintId);
      if (sprint) {
        await fileManager.updateSprintFile(sprint);
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }


  /**
   * Get active sprint
   */
  public async getActiveSprint(): Promise<Sprint | null> {
    const metadata = await databaseManager.getActiveSprint();
    if (!metadata) return null;
    
    return this.metadataToSprint(metadata);
  }

  /**
   * Activate a sprint (only one can be active at a time)
   */
  public async activateSprint(sprintNo: string): Promise<boolean> {
    const sprintId = `Sprint-${sprintNo.padStart(2, '0')}`;
    
    try {
      // Get target sprint
      const targetMetadata = await databaseManager.getSprint(sprintId);
      if (!targetMetadata) return false;

      // Deactivate all currently active sprints
      const sprints = await databaseManager.getSprints();
      for (const sprint of sprints) {
        if (sprint.state === 'active') {
          await databaseManager.updateSprint(sprint.id, {
            state: 'completed',
            end_date: new Date().toISOString().split('T')[0],
            velocity: await this.calculateSprintVelocity(sprint.id)
          });
        }
      }

      // Activate target sprint
      await databaseManager.updateSprint(sprintId, { state: 'active' });
      await databaseManager.setCurrentSprint(sprintId);

      // Set all issues in this sprint to 'In Progress'
      for (const issueId of targetMetadata.issues) {
        await databaseManager.updateIssue(issueId, { status: 'in_progress' });
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Complete a sprint
   */
  public async completeSprint(sprintNo: string): Promise<boolean> {
    const sprintId = `Sprint-${sprintNo.padStart(2, '0')}`;
    
    try {
      const sprint = await databaseManager.getSprint(sprintId);
      if (!sprint) return false;

      const velocity = await this.calculateSprintVelocity(sprintId);
      
      await databaseManager.updateSprint(sprintId, {
        state: 'completed',
        end_date: new Date().toISOString().split('T')[0],
        velocity
      });

      // Clear current sprint if this is the current one
      const activeSprint = await databaseManager.getActiveSprint();
      if (activeSprint && activeSprint.id === sprintId) {
        await databaseManager.setCurrentSprint(undefined);
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Delete a sprint
   */
  public async deleteSprint(sprintNo: string): Promise<boolean> {
    const sprintId = `Sprint-${sprintNo.padStart(2, '0')}`;
    
    try {
      await databaseManager.deleteSprint(sprintId);
      await fileManager.deleteSprintFile(sprintId);
      return true;
    } catch (error) {
      return false;
    }
  }

  private async calculateSprintVelocity(sprintId: string): Promise<number> {
    const sprint = await databaseManager.getSprint(sprintId);
    if (!sprint) return 0;

    let completedCount = 0;
    for (const issueId of sprint.issues) {
      const issue = await databaseManager.getIssue(issueId);
      if (issue && issue.status === 'done') {
        completedCount++;
      }
    }

    return completedCount;
  }

  // Helper methods

  private async validateParent(type: IssueType, parentId?: string): Promise<void> {
    if (!parentId) {
      // Only features can exist without parents
      if (type !== IssueType.FEATURE) {
        throw new Error(`${type} must have a parent. Only features can be created without parents.`);
      }
      return;
    }
    
    // Check if parent exists
    const parentMetadata = await databaseManager.getIssue(parentId);
    if (!parentMetadata) {
      throw new Error(`Parent issue ${parentId} does not exist. Create the parent first.`);
    }
    
    // Validate hierarchy rules (same logic as before)
    await this.validateHierarchy(type, parentMetadata);
  }

  private async validateHierarchy(childType: IssueType, parent: IssueMetadata): Promise<void> {
    const parentPrefix = parent.id[0];
    
    if (childType === IssueType.FEATURE) {
      if (parentPrefix !== 'F') {
        throw new Error(`Features can only be children of other features, not ${parent.type}`);
      }
      
      const parentLevel = this.getFeatureLevel(parent.id);
      if (parentLevel >= 3) {
        throw new Error(`Maximum feature nesting level (3) exceeded. Cannot create child of ${parent.id}`);
      }
    } else if (childType === IssueType.STORY || childType === IssueType.TASK) {
      if (parentPrefix !== 'F' && parentPrefix !== 'T') {
        throw new Error(`Tasks can only be children of features or other tasks, not ${parent.type}`);
      }
    } else if (childType === IssueType.BUG) {
      if (parentPrefix !== 'F' && parentPrefix !== 'T') {
        throw new Error(`Bugs can only be children of features or tasks, not ${parent.type}`);
      }
    }
  }

  private getFeatureLevel(id: string): number {
    const digits = id.slice(1);
    return Math.floor(digits.length / 2);
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

  private async metadataToIssue(metadata: IssueMetadata): Promise<Issue> {
    // Read content from markdown file if needed
    let description = '';
    let comments: any[] = [];
    
    try {
      const fullIssue = await fileManager.readIssueSpec(metadata.id);
      if (fullIssue) {
        description = fullIssue.description || '';
        comments = fullIssue.comments || [];
      }
    } catch (error) {
      console.warn(`Could not read content for issue ${metadata.id}:`, error);
    }

    return {
      id: metadata.id,
      type: metadata.type as IssueType,
      name: metadata.name,
      keywords: metadata.keywords,
      description,
      status: metadata.status as IssueStatus,
      priority: metadata.priority === 'high' ? IssuePriority.HIGH :
               metadata.priority === 'low' ? IssuePriority.LOW : IssuePriority.MEDIUM,
      assignee: metadata.assignee,
      reporter: metadata.reporter,
      labels: metadata.labels,
      parentId: metadata.parent_id,
      sprintId: metadata.sprint_id,
      createdAt: metadata.created_at,
      updatedAt: metadata.updated_at,
      // folderPath computed dynamically when needed using getIssueFolderPath()
      comments
    };
  }

  private metadataToSprint(metadata: SprintMetadata): Sprint {
    return {
      id: metadata.id,
      name: metadata.name,
      description: metadata.description,
      state: metadata.state as SprintState,
      startDate: metadata.start_date,
      endDate: metadata.end_date,
      issues: metadata.issues,
      velocity: metadata.velocity,
      createdAt: metadata.created_at,
      updatedAt: metadata.updated_at
    };
  }
}

export const hybridManager = new HybridManager();