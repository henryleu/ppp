import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { fileExists } from './settings.js';
import { IssueType, getIdPrefix, generateChildIdDigits } from '../types/issue.js';

export interface CounterData {
  // Feature counters by level
  features: {
    level1: number;         // F01, F02, F03...
    level2: Record<string, number>; // F01 -> 01, 02, 03... (for F0101, F0102, F0103...)
    level3: Record<string, number>; // F0101 -> 01, 02, 03... (for F010101, F010102...)
  };
  
  // Task counters by parent
  tasks: Record<string, number>; // F01 -> 01, 02, 03... (for T0101, T0102...)
  
  // Bug counters by parent
  bugs: Record<string, number>; // F01 -> 01, 02, 03... (for B0101, B0102...)
  
  // Sprint counter
  sprints: number; // 1, 2, 3... (for Sprint-01, Sprint-02...)
}

const DEFAULT_COUNTERS: CounterData = {
  features: {
    level1: 0,
    level2: {},
    level3: {}
  },
  tasks: {},
  bugs: {},
  sprints: 0
};

export function getCountersPath(): string {
  return join(process.cwd(), '.ppp', '.counters.json');
}

export async function loadCounters(): Promise<CounterData> {
  const countersPath = getCountersPath();
  
  try {
    if (!(await fileExists(countersPath))) {
      return { ...DEFAULT_COUNTERS };
    }
    
    const content = await readFile(countersPath, 'utf-8');
    const data = JSON.parse(content);
    
    // Merge with defaults to handle missing properties
    return {
      features: {
        level1: data.features?.level1 || 0,
        level2: data.features?.level2 || {},
        level3: data.features?.level3 || {}
      },
      tasks: data.tasks || {},
      bugs: data.bugs || {},
      sprints: data.sprints || 0
    };
  } catch (error) {
    console.warn('Failed to load counters, using defaults:', error);
    return { ...DEFAULT_COUNTERS };
  }
}

export async function saveCounters(counters: CounterData): Promise<void> {
  const countersPath = getCountersPath();
  
  try {
    await writeFile(countersPath, JSON.stringify(counters, null, 2));
  } catch (error) {
    throw new Error(`Failed to save counters: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function generateIssueId(type: IssueType, parentId?: string): Promise<string> {
  const counters = await loadCounters();
  const prefix = getIdPrefix(type);
  
  let newId: string;
  
  if (prefix === 'F') {
    // Module/Feature ID generation
    if (!parentId) {
      // Level 1 module: F01, F02, F03...
      counters.features.level1++;
      newId = `F${counters.features.level1.toString().padStart(2, '0')}`;
    } else {
      const parentDigits = parentId.slice(1);
      
      if (parentDigits.length === 2) {
        // Level 2 feature: F0101, F0102, F0103...
        const parentKey = parentId;
        if (!counters.features.level2[parentKey]) {
          counters.features.level2[parentKey] = 0;
        }
        counters.features.level2[parentKey]++;
        
        const childDigits = counters.features.level2[parentKey].toString().padStart(2, '0');
        newId = `F${parentDigits}${childDigits}`;
      } else if (parentDigits.length === 4) {
        // Level 3 feature: F010101, F010102, F010103...
        const parentKey = parentId;
        if (!counters.features.level3[parentKey]) {
          counters.features.level3[parentKey] = 0;
        }
        counters.features.level3[parentKey]++;
        
        const childDigits = counters.features.level3[parentKey].toString().padStart(2, '0');
        newId = `F${parentDigits}${childDigits}`;
      } else {
        throw new Error(`Invalid parent ID for feature: ${parentId}`);
      }
    }
  } else if (prefix === 'T') {
    // Task ID generation: T010101, T010102...
    if (!parentId) {
      throw new Error('Tasks must have a parent module/feature');
    }
    
    const parentKey = parentId;
    if (!counters.tasks[parentKey]) {
      counters.tasks[parentKey] = 0;
    }
    counters.tasks[parentKey]++;
    
    const childDigits = generateChildIdDigits(parentId, counters.tasks[parentKey]);
    newId = `T${childDigits}`;
  } else if (prefix === 'B') {
    // Bug ID generation: B010101, B010102...
    if (!parentId) {
      throw new Error('Bugs must have a parent module/feature/task');
    }
    
    const parentKey = parentId;
    if (!counters.bugs[parentKey]) {
      counters.bugs[parentKey] = 0;
    }
    counters.bugs[parentKey]++;
    
    const childDigits = generateChildIdDigits(parentId, counters.bugs[parentKey]);
    newId = `B${childDigits}`;
  } else {
    throw new Error(`Unknown issue type prefix: ${prefix}`);
  }
  
  await saveCounters(counters);
  return newId;
}

export async function generateSprintId(): Promise<string> {
  const counters = await loadCounters();
  counters.sprints++;
  
  const sprintId = `Sprint-${counters.sprints.toString().padStart(2, '0')}`;
  
  await saveCounters(counters);
  return sprintId;
}

export async function resetCounters(): Promise<void> {
  await saveCounters({ ...DEFAULT_COUNTERS });
}

export async function getNextId(type: IssueType, parentId?: string): Promise<string> {
  const counters = await loadCounters();
  const prefix = getIdPrefix(type);
  
  if (prefix === 'F') {
    if (!parentId) {
      return `F${(counters.features.level1 + 1).toString().padStart(2, '0')}`;
    } else {
      const parentDigits = parentId.slice(1);
      
      if (parentDigits.length === 2) {
        const parentKey = parentId;
        const nextCounter = (counters.features.level2[parentKey] || 0) + 1;
        return `F${parentDigits}${nextCounter.toString().padStart(2, '0')}`;
      } else if (parentDigits.length === 4) {
        const parentKey = parentId;
        const nextCounter = (counters.features.level3[parentKey] || 0) + 1;
        return `F${parentDigits}${nextCounter.toString().padStart(2, '0')}`;
      }
    }
  } else if (prefix === 'T') {
    if (!parentId) {
      throw new Error('Tasks must have a parent module/feature');
    }
    
    const parentKey = parentId;
    const nextCounter = (counters.tasks[parentKey] || 0) + 1;
    const childDigits = generateChildIdDigits(parentId, nextCounter);
    return `T${childDigits}`;
  } else if (prefix === 'B') {
    if (!parentId) {
      throw new Error('Bugs must have a parent module/feature/task');
    }
    
    const parentKey = parentId;
    const nextCounter = (counters.bugs[parentKey] || 0) + 1;
    const childDigits = generateChildIdDigits(parentId, nextCounter);
    return `B${childDigits}`;
  }
  
  throw new Error(`Cannot generate next ID for type: ${type}`);
}