export enum SprintStatus {
  PLANNED = 'planned',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived'
}

export interface Sprint {
  id: string;
  name: string;
  description: string;
  status: SprintStatus;
  startDate: string;
  endDate?: string;
  issues: string[]; // Issue IDs
  velocity: number;
  createdAt: string;
  updatedAt: string;
}

export interface SprintCreationData {
  name: string;
}

export interface SprintUpdateData {
  description?: string;
  status?: SprintStatus;
  startDate?: string;
  endDate?: string;
}

export interface SprintSummary {
  id: string;
  name: string;
  status: SprintStatus;
  startDate: string;
  endDate?: string;
  issueCount: number;
  velocity: number;
}

// Sprint state transitions
export function canTransitionTo(currentState: SprintStatus, newState: SprintStatus): boolean {
  const validTransitions: Record<SprintStatus, SprintStatus[]> = {
    [SprintStatus.PLANNED]: [SprintStatus.ACTIVE],
    [SprintStatus.ACTIVE]: [SprintStatus.COMPLETED],
    [SprintStatus.COMPLETED]: [SprintStatus.ARCHIVED],
    [SprintStatus.ARCHIVED]: [] // No transitions from archived
  };

  return validTransitions[currentState].includes(newState);
}

export function isSprintActive(sprint: Sprint): boolean {
  return sprint.status === SprintStatus.ACTIVE;
}

export function isSprintEditable(sprint: Sprint): boolean {
  return sprint.status === SprintStatus.PLANNED || sprint.status === SprintStatus.ACTIVE;
}

export function generateSprintId(counter: number): string {
  return `S${counter.toString().padStart(2, '0')}`;
}

export function generateSprintName(counter: number): string {
  return `Sprint ${counter.toString().padStart(2, '0')}`;
}
