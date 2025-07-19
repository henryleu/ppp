export enum SprintState {
  PLANNED = 'planned',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived'
}

export interface Sprint {
  id: string;
  name: string;
  description: string;
  state: SprintState;
  startDate: string;
  endDate?: string;
  issues: string[]; // Issue IDs
  velocity: number;
  createdAt: string;
  updatedAt: string;
}

export interface SprintCreationData {
  description: string;
  startDate?: string;
}

export interface SprintUpdateData {
  description?: string;
  state?: SprintState;
  startDate?: string;
  endDate?: string;
}

export interface SprintSummary {
  id: string;
  name: string;
  state: SprintState;
  startDate: string;
  endDate?: string;
  issueCount: number;
  velocity: number;
}

// Sprint state transitions
export function canTransitionTo(currentState: SprintState, newState: SprintState): boolean {
  const validTransitions: Record<SprintState, SprintState[]> = {
    [SprintState.PLANNED]: [SprintState.ACTIVE],
    [SprintState.ACTIVE]: [SprintState.COMPLETED],
    [SprintState.COMPLETED]: [SprintState.ARCHIVED],
    [SprintState.ARCHIVED]: [] // No transitions from archived
  };
  
  return validTransitions[currentState].includes(newState);
}

export function isSprintActive(sprint: Sprint): boolean {
  return sprint.state === SprintState.ACTIVE;
}

export function isSprintEditable(sprint: Sprint): boolean {
  return sprint.state === SprintState.PLANNED || sprint.state === SprintState.ACTIVE;
}

export function generateSprintId(counter: number): string {
  return `Sprint-${counter.toString().padStart(2, '0')}`;
}

export function generateSprintName(counter: number): string {
  return `Sprint ${counter.toString().padStart(2, '0')}`;
}