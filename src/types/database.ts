// Database schema for YAML-based metadata storage
// Content (descriptions, comments, detailed info) stays in markdown files

export interface DatabaseMetadata {
  version: string;
  created: string;
  updated: string;
  counters: CounterData;
}

export interface CounterData {
  features: {
    level1: number;
    level2: Record<string, number>;
    level3: Record<string, number>;
  };
  tasks: Record<string, number>;
  bugs: Record<string, number>;
  sprints: number;
}

// Core metadata only - content stays in markdown files
export interface IssueMetadata {
  id: string;
  name: string;
  keywords: string;
  type: 'feature' | 'epic' | 'story' | 'task' | 'bug';
  status: 'new' | 'in_progress' | 'done' | 'blocked' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
  assignee?: string;
  reporter?: string;
  labels: string[];
  parent_id?: string;
  sprint_id?: string;
  created_at: string;
  updated_at: string;
  children: string[]; // Child issue IDs
  // folder_path removed - computed dynamically using parent hierarchy
}

export interface SprintMetadata {
  id: string;
  name: string;
  description: string; // Keep basic description in metadata
  state: 'planned' | 'active' | 'completed' | 'archived';
  start_date: string;
  end_date?: string;
  velocity: number;
  created_at: string;
  updated_at: string;
  issues: string[]; // Issue IDs assigned to this sprint
}

export interface ReleaseMetadata {
  name: string;
  description: string;
  start_date: string;
  end_date?: string;
  current_sprint?: string;
  sprints: string[]; // Sprint IDs in this release
}

export interface FeatureBillEntry {
  id: string;
  name: string;
  status: string;
  assignee?: string;
  layer: 1 | 2 | 3;
  parent_id?: string;
  children: string[];
}

// Main database structure
export interface PPPDatabase {
  metadata: DatabaseMetadata;
  project: {
    name: string;
    description: string;
  };
  issues: Record<string, IssueMetadata>; // Key: issue ID
  sprints: Record<string, SprintMetadata>; // Key: sprint ID
  release: ReleaseMetadata;
  feature_bill: Record<string, FeatureBillEntry>; // Key: feature ID
}

// Helper types for operations
export interface IssueFilter {
  parent_id?: string;
  type?: string;
  status?: string;
  assignee?: string;
  sprint_id?: string;
  labels?: string[];
}

export interface IssueUpdate {
  name?: string;
  keywords?: string;
  status?: string;
  priority?: string;
  assignee?: string;
  reporter?: string;
  labels?: string[];
  sprint_id?: string;
  parent_id?: string;
  // folder_path removed - computed dynamically using parent hierarchy
}

export interface SprintUpdate {
  name?: string;
  description?: string;
  state?: string;
  start_date?: string;
  end_date?: string;
  velocity?: number;
}

// Database operation results
export interface DatabaseOperationResult {
  success: boolean;
  error?: string;
  data?: any;
}

// Migration helpers
export interface MigrationData {
  issues: IssueMetadata[];
  sprints: SprintMetadata[];
  release: ReleaseMetadata;
  counters: CounterData;
}

export const DEFAULT_DATABASE: PPPDatabase = {
  metadata: {
    version: "1.0.0",
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    counters: {
      features: {
        level1: 0,
        level2: {},
        level3: {}
      },
      tasks: {},
      bugs: {},
      sprints: 0
    }
  },
  project: {
    name: "My PPP Project",
    description: "A project managed with Product Prompt Planner"
  },
  issues: {},
  sprints: {},
  release: {
    name: "Release 1.0",
    description: "Initial release",
    start_date: new Date().toISOString().split('T')[0],
    sprints: []
  },
  feature_bill: {}
};

// Validation helpers
export function isValidIssueType(type: string): type is IssueMetadata['type'] {
  return ['feature', 'epic', 'story', 'task', 'bug'].includes(type);
}

export function isValidIssueStatus(status: string): status is IssueMetadata['status'] {
  return ['new', 'in_progress', 'done', 'blocked', 'cancelled'].includes(status);
}

export function isValidIssuePriority(priority: string): priority is IssueMetadata['priority'] {
  return ['high', 'medium', 'low'].includes(priority);
}

export function isValidSprintState(state: string): state is SprintMetadata['state'] {
  return ['planned', 'active', 'completed', 'archived'].includes(state);
}