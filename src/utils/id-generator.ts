import { IssueType, getIdPrefix, generateChildIdDigits } from '../types/issue.js';
import { databaseManager } from './database.js';

// Re-export CounterData from database types for backward compatibility
export type { CounterData } from '../types/database.js';

/**
 * Load counters from database
 */
async function loadCounters() {
  return await databaseManager.getCounters();
}

/**
 * Save counters to database
 */
async function saveCounters(counters: any) {
  await databaseManager.updateCounters(counters);
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
  const newSprintNo = counters.sprints + 1;
  
  const sprintId = `Sprint-${newSprintNo.toString().padStart(2, '0')}`;
  
  await saveCounters({ sprints: newSprintNo });
  return sprintId;
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