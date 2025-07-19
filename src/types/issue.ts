export enum IssueType {
  FEATURE = 'feature',
  STORY = 'story',
  TASK = 'task',
  BUG = 'bug'
}

export enum IssueStatus {
  NEW = 'New',
  IN_PROGRESS = 'In Progress',
  DONE = 'Done',
  BLOCKED = 'Blocked',
  CANCELLED = 'Cancelled'
}

export enum IssuePriority {
  HIGH = 'High',
  MEDIUM = 'Medium',
  LOW = 'Low'
}

export interface Issue {
  id: string;
  type: IssueType;
  name: string;
  keywords: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  assignee?: string;
  reporter?: string;
  labels: string[];
  parentId?: string;
  sprintId?: string;
  createdAt: string;
  updatedAt: string;
  folderPath?: string; // Computed dynamically using parent hierarchy - not stored in database
  comments: IssueComment[];
}

export interface IssueComment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface IssueCreationData {
  type: IssueType;
  name: string;
  description?: string;
  priority?: IssuePriority;
  assignee?: string;
  reporter?: string;
  labels?: string[];
  parentId?: string;
}

export interface IssueUpdateData {
  name?: string;
  description?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  assignee?: string;
  labels?: string[];
  sprintId?: string;
}

// Type guards
export function isFeature(type: IssueType): boolean {
  return type === IssueType.FEATURE;
}

export function isTask(type: IssueType): boolean {
  return type === IssueType.STORY || type === IssueType.TASK;
}

export function isBug(type: IssueType): boolean {
  return type === IssueType.BUG;
}

// ID prefix mapping
export function getIdPrefix(type: IssueType): string {
  if (isFeature(type)) return 'F';
  if (isTask(type)) return 'T';
  if (isBug(type)) return 'B';
  throw new Error(`Unknown issue type: ${type}`);
}

// Issue hierarchy helpers
export function getIssueLevel(id: string): number {
  const prefix = id[0];
  const digits = id.slice(1);
  
  if (prefix === 'F') {
    if (digits.length === 2) return 1; // F01
    if (digits.length === 4) return 2; // F0102
    if (digits.length === 6) return 3; // F010203
  } else if (prefix === 'T' || prefix === 'B') {
    // Tasks and bugs can be at any level depending on their parent
    return Math.floor(digits.length / 2);
  }
  
  throw new Error(`Invalid issue ID format: ${id}`);
}

export function getParentId(id: string): string | null {
  const prefix = id[0];
  const digits = id.slice(1);
  
  if (prefix === 'F') {
    if (digits.length === 2) return null; // Top level
    if (digits.length === 4) return `F${digits.slice(0, 2)}`; // F0102 → F01
    if (digits.length === 6) return `F${digits.slice(0, 4)}`; // F010203 → F0102
  } else if (prefix === 'T' || prefix === 'B') {
    if (digits.length >= 2) {
      const parentDigits = digits.slice(0, -2);
      if (parentDigits.length === 0) return null;
      return `F${parentDigits}`;
    }
  }
  
  return null;
}

export function generateChildIdDigits(parentId: string, counter: number): string {
  const parentDigits = parentId.slice(1);
  const counterStr = counter.toString().padStart(2, '0');
  return parentDigits + counterStr;
}