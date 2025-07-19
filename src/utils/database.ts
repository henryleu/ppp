import { readFile, writeFile, stat, unlink } from 'fs/promises';
import { join } from 'path';
import * as yaml from 'js-yaml';
import { fileExists } from './settings.js';
import { 
  PPPDatabase, 
  DEFAULT_DATABASE, 
  IssueMetadata, 
  SprintMetadata, 
  IssueFilter, 
  IssueUpdate, 
  SprintUpdate,
  DatabaseOperationResult,
  CounterData
} from '../types/database.js';

export class DatabaseManager {
  private projectRoot: string;
  private dbPath: string;
  private cache: PPPDatabase | null = null;
  private lastModified: number = 0;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.dbPath = join(projectRoot, '.ppp', 'database.yml');
  }

  /**
   * Get the database path
   */
  public getDatabasePath(): string {
    return this.dbPath;
  }

  /**
   * Check if database exists
   */
  public async exists(): Promise<boolean> {
    return await fileExists(this.dbPath);
  }

  /**
   * Initialize a new database with default structure
   */
  public async initialize(projectName?: string): Promise<void> {
    // Check for existing counters.json file and migrate if found
    await this.migrateFromLegacyCounters();
    
    const database: PPPDatabase = {
      ...DEFAULT_DATABASE,
      metadata: {
        ...DEFAULT_DATABASE.metadata,
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      },
      project: {
        name: projectName || "My PPP Project",
        description: "A project managed with Product Prompt Planner"
      }
    };

    await this.save(database);
    this.cache = database;
  }

  /**
   * Migrate from legacy .counters.json file if it exists
   */
  private async migrateFromLegacyCounters(): Promise<void> {
    const legacyCountersPath = join(this.projectRoot, '.ppp', '.counters.json');
    
    if (await fileExists(legacyCountersPath)) {
      try {
        console.log('📦 Migrating counters from .counters.json to database.yml...');
        
        const content = await readFile(legacyCountersPath, 'utf-8');
        const legacyCounters = JSON.parse(content);
        
        // If database doesn't exist yet, we'll set the counters during initialization
        // If it does exist, we'll update the counters
        if (await this.exists()) {
          const db = await this.load();
          db.metadata.counters = {
            features: {
              level1: legacyCounters.features?.level1 || 0,
              level2: legacyCounters.features?.level2 || {},
              level3: legacyCounters.features?.level3 || {}
            },
            tasks: legacyCounters.tasks || {},
            bugs: legacyCounters.bugs || {},
            sprints: legacyCounters.sprints || 0
          };
          await this.save(db);
        } else {
          // Store for use during initialization
          DEFAULT_DATABASE.metadata.counters = {
            features: {
              level1: legacyCounters.features?.level1 || 0,
              level2: legacyCounters.features?.level2 || {},
              level3: legacyCounters.features?.level3 || {}
            },
            tasks: legacyCounters.tasks || {},
            bugs: legacyCounters.bugs || {},
            sprints: legacyCounters.sprints || 0
          };
        }
        
        // Create backup of legacy file before removal
        const backupPath = `${legacyCountersPath}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
        const legacyContent = await readFile(legacyCountersPath, 'utf-8');
        await writeFile(backupPath, legacyContent);
        
        // Remove legacy file
        await unlink(legacyCountersPath);
        
        console.log('✅ Counter migration completed successfully!');
        console.log(`📁 Legacy file backed up to: ${backupPath}`);
        
      } catch (error) {
        console.warn('⚠️  Failed to migrate legacy counters:', error);
        // Don't throw - continue with default counters
      }
    }
  }

  /**
   * Load database from YAML file with caching
   */
  public async load(): Promise<PPPDatabase> {
    if (!await this.exists()) {
      throw new Error('Database not found. Run "ppp init" to initialize.');
    }

    // Check if we need to reload from disk
    const fileStat = await stat(this.dbPath);
    const fileModified = fileStat.mtime.getTime();

    if (this.cache && fileModified <= this.lastModified) {
      return this.cache;
    }

    try {
      const content = await readFile(this.dbPath, 'utf-8');
      const data = yaml.load(content) as PPPDatabase;
      
      // Validate basic structure
      if (!data.metadata || !data.issues || !data.sprints) {
        throw new Error('Invalid database structure');
      }

      this.cache = data;
      this.lastModified = fileModified;
      return data;
    } catch (error) {
      throw new Error(`Failed to load database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save database to YAML file
   */
  public async save(database: PPPDatabase): Promise<void> {
    try {
      // Update metadata
      database.metadata.updated = new Date().toISOString();
      
      // Create backup of existing database
      if (await this.exists()) {
        const backupPath = this.dbPath + '.backup';
        const existingContent = await readFile(this.dbPath, 'utf-8');
        await writeFile(backupPath, existingContent);
      }

      // Save to YAML with proper formatting
      const yamlContent = yaml.dump(database, {
        indent: 2,
        lineWidth: 120,
        noRefs: true,
        sortKeys: true
      });

      await writeFile(this.dbPath, yamlContent);
      
      // Update cache
      this.cache = database;
      this.lastModified = Date.now();
    } catch (error) {
      throw new Error(`Failed to save database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all issues with optional filtering
   */
  public async getIssues(filter?: IssueFilter): Promise<IssueMetadata[]> {
    const db = await this.load();
    let issues = Object.values(db.issues);

    if (filter) {
      if (filter.parent_id !== undefined) {
        issues = issues.filter(issue => issue.parent_id === filter.parent_id);
      }
      if (filter.type) {
        issues = issues.filter(issue => issue.type === filter.type);
      }
      if (filter.status) {
        issues = issues.filter(issue => issue.status === filter.status);
      }
      if (filter.assignee !== undefined) {
        issues = issues.filter(issue => issue.assignee === filter.assignee);
      }
      if (filter.sprint_id !== undefined) {
        issues = issues.filter(issue => issue.sprint_id === filter.sprint_id);
      }
      if (filter.labels && filter.labels.length > 0) {
        issues = issues.filter(issue => 
          filter.labels!.some(label => issue.labels.includes(label))
        );
      }
    }

    return issues;
  }

  /**
   * Get issue by ID (case-insensitive matching)
   */
  public async getIssue(id: string): Promise<IssueMetadata | null> {
    const db = await this.load();
    
    // First try direct match for performance
    if (db.issues[id]) {
      return db.issues[id];
    }
    
    // Case-insensitive search
    const lowerCaseId = id.toLowerCase();
    for (const [issueId, issue] of Object.entries(db.issues)) {
      if (issueId.toLowerCase() === lowerCaseId) {
        return issue;
      }
    }
    
    return null;
  }

  /**
   * Create new issue
   */
  public async createIssue(issue: IssueMetadata): Promise<void> {
    const db = await this.load();
    
    // Add to issues
    db.issues[issue.id] = issue;
    
    // Update parent's children list
    if (issue.parent_id && db.issues[issue.parent_id]) {
      if (!db.issues[issue.parent_id].children.includes(issue.id)) {
        db.issues[issue.parent_id].children.push(issue.id);
        db.issues[issue.parent_id].updated_at = new Date().toISOString();
      }
    }

    // Update feature bill if it's a feature
    if (issue.type === 'feature') {
      db.feature_bill[issue.id] = {
        id: issue.id,
        name: issue.name,
        status: issue.status,
        assignee: issue.assignee,
        layer: this.getFeatureLayer(issue.id),
        parent_id: issue.parent_id,
        children: issue.children
      };
    }

    await this.save(db);
  }

  /**
   * Update issue
   */
  public async updateIssue(id: string, updates: IssueUpdate): Promise<IssueMetadata> {
    const db = await this.load();
    const issue = await this.getIssue(id);
    
    if (!issue) {
      throw new Error(`Issue ${id} not found`);
    }
    
    // Find the actual key in the database (case-sensitive storage)
    const actualId = this.findActualIssueId(db, id);

    // Apply updates
    Object.assign(issue, updates, {
      updated_at: new Date().toISOString()
    });

    // Update feature bill if it's a feature
    if (issue.type === 'feature' && db.feature_bill[actualId]) {
      Object.assign(db.feature_bill[actualId], {
        name: issue.name,
        status: issue.status,
        assignee: issue.assignee
      });
    }

    await this.save(db);
    return issue;
  }

  /**
   * Delete issue
   */
  public async deleteIssue(id: string): Promise<void> {
    const db = await this.load();
    const issue = await this.getIssue(id);
    
    if (!issue) {
      throw new Error(`Issue ${id} not found`);
    }
    
    // Find the actual key in the database (case-sensitive storage)
    const actualId = this.findActualIssueId(db, id);

    // Check for children
    if (issue.children.length > 0) {
      throw new Error(`Cannot delete issue ${actualId} because it has child issues: ${issue.children.join(', ')}`);
    }

    // Remove from parent's children list
    if (issue.parent_id && db.issues[issue.parent_id]) {
      const parentChildren = db.issues[issue.parent_id].children;
      const index = parentChildren.indexOf(actualId);
      if (index > -1) {
        parentChildren.splice(index, 1);
        db.issues[issue.parent_id].updated_at = new Date().toISOString();
      }
    }

    // Remove from sprint if assigned
    if (issue.sprint_id && db.sprints[issue.sprint_id]) {
      const sprintIssues = db.sprints[issue.sprint_id].issues;
      const index = sprintIssues.indexOf(actualId);
      if (index > -1) {
        sprintIssues.splice(index, 1);
        db.sprints[issue.sprint_id].updated_at = new Date().toISOString();
      }
    }

    // Remove from feature bill
    if (db.feature_bill[actualId]) {
      delete db.feature_bill[actualId];
    }

    // Remove issue
    delete db.issues[actualId];

    await this.save(db);
  }

  /**
   * Get all sprints
   */
  public async getSprints(): Promise<SprintMetadata[]> {
    const db = await this.load();
    return Object.values(db.sprints).sort((a, b) => b.id.localeCompare(a.id));
  }

  /**
   * Get sprint by ID
   */
  public async getSprint(id: string): Promise<SprintMetadata | null> {
    const db = await this.load();
    return db.sprints[id] || null;
  }

  /**
   * Create new sprint
   */
  public async createSprint(sprint: SprintMetadata): Promise<void> {
    const db = await this.load();
    db.sprints[sprint.id] = sprint;
    
    // Add to release
    if (!db.release.sprints.includes(sprint.id)) {
      db.release.sprints.push(sprint.id);
    }

    await this.save(db);
  }

  /**
   * Update sprint
   */
  public async updateSprint(id: string, updates: SprintUpdate): Promise<SprintMetadata> {
    const db = await this.load();
    const sprint = db.sprints[id];
    
    if (!sprint) {
      throw new Error(`Sprint ${id} not found`);
    }

    Object.assign(sprint, updates, {
      updated_at: new Date().toISOString()
    });

    await this.save(db);
    return sprint;
  }

  /**
   * Delete sprint
   */
  public async deleteSprint(id: string): Promise<void> {
    const db = await this.load();
    const sprint = db.sprints[id];
    
    if (!sprint) {
      throw new Error(`Sprint ${id} not found`);
    }

    // Remove sprint assignment from all issues
    for (const issueId of sprint.issues) {
      if (db.issues[issueId]) {
        db.issues[issueId].sprint_id = undefined;
        db.issues[issueId].updated_at = new Date().toISOString();
      }
    }

    // Remove from release
    const releaseIndex = db.release.sprints.indexOf(id);
    if (releaseIndex > -1) {
      db.release.sprints.splice(releaseIndex, 1);
    }

    // Clear current sprint if this is the current one
    if (db.release.current_sprint === id) {
      db.release.current_sprint = undefined;
    }

    delete db.sprints[id];
    await this.save(db);
  }

  /**
   * Add issue to sprint
   */
  public async addIssueToSprint(issueId: string, sprintId: string): Promise<void> {
    const db = await this.load();
    const issue = await this.getIssue(issueId);
    const sprint = db.sprints[sprintId];
    
    // Find actual issue ID for database operations
    const actualIssueId = this.findActualIssueId(db, issueId);

    if (!issue) {
      throw new Error(`Issue ${issueId} not found`);
    }
    if (!sprint) {
      throw new Error(`Sprint ${sprintId} not found`);
    }

    // Remove from current sprint if assigned
    if (issue.sprint_id && db.sprints[issue.sprint_id]) {
      const currentSprint = db.sprints[issue.sprint_id];
      const index = currentSprint.issues.indexOf(actualIssueId);
      if (index > -1) {
        currentSprint.issues.splice(index, 1);
        currentSprint.updated_at = new Date().toISOString();
      }
    }

    // Add to new sprint
    issue.sprint_id = sprintId;
    issue.updated_at = new Date().toISOString();

    if (!sprint.issues.includes(actualIssueId)) {
      sprint.issues.push(actualIssueId);
      sprint.updated_at = new Date().toISOString();
    }

    await this.save(db);
  }

  /**
   * Remove issue from sprint
   */
  public async removeIssueFromSprint(issueId: string, sprintId: string): Promise<void> {
    const db = await this.load();
    const issue = await this.getIssue(issueId);
    const sprint = db.sprints[sprintId];
    
    // Find actual issue ID for database operations
    const actualIssueId = this.findActualIssueId(db, issueId);

    if (!issue) {
      throw new Error(`Issue ${issueId} not found`);
    }
    if (!sprint) {
      throw new Error(`Sprint ${sprintId} not found`);
    }

    // Remove issue from sprint
    const index = sprint.issues.indexOf(actualIssueId);
    if (index > -1) {
      sprint.issues.splice(index, 1);
      sprint.updated_at = new Date().toISOString();
    }

    // Clear sprint assignment from issue
    if (issue.sprint_id === sprintId) {
      issue.sprint_id = undefined;
      issue.updated_at = new Date().toISOString();
    }

    await this.save(db);
  }

  /**
   * Get counters
   */
  public async getCounters(): Promise<CounterData> {
    const db = await this.load();
    return db.metadata.counters;
  }

  /**
   * Update counters
   */
  public async updateCounters(updates: Partial<CounterData>): Promise<void> {
    const db = await this.load();
    Object.assign(db.metadata.counters, updates);
    await this.save(db);
  }

  /**
   * Get active sprint
   */
  public async getActiveSprint(): Promise<SprintMetadata | null> {
    const db = await this.load();
    const sprints = Object.values(db.sprints);
    return sprints.find(sprint => sprint.state === 'active') || null;
  }

  /**
   * Set current sprint in release
   */
  public async setCurrentSprint(sprintId?: string): Promise<void> {
    const db = await this.load();
    db.release.current_sprint = sprintId;
    await this.save(db);
  }

  /**
   * Find the actual case-sensitive issue ID in the database
   */
  private findActualIssueId(db: PPPDatabase, id: string): string {
    // First try direct match
    if (db.issues[id]) {
      return id;
    }
    
    // Case-insensitive search
    const lowerCaseId = id.toLowerCase();
    for (const issueId of Object.keys(db.issues)) {
      if (issueId.toLowerCase() === lowerCaseId) {
        return issueId;
      }
    }
    
    // If not found, return the original ID (will cause appropriate errors downstream)
    return id;
  }

  private getFeatureLayer(id: string): 1 | 2 | 3 {
    const digits = id.slice(1);
    return Math.floor(digits.length / 2) as 1 | 2 | 3;
  }

  /**
   * Backup current database
   */
  public async backup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${this.dbPath}.backup-${timestamp}`;
    
    if (await this.exists()) {
      const content = await readFile(this.dbPath, 'utf-8');
      await writeFile(backupPath, content);
    }
    
    return backupPath;
  }
}

export const databaseManager = new DatabaseManager();