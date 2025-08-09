/**
 * Object ID Normalization Utility
 * 
 * Provides centralized functions for normalizing Object IDs to ensure consistent
 * uppercase format throughout the system, following CLI.md Common Rules.
 */

/**
 * Normalize any Object ID to uppercase format
 * 
 * Examples:
 * - f01 → F01
 * - t010101 → T010101
 * - b020304 → B020304  
 * - s01 → S01
 * 
 * @param id - Object ID to normalize (can be null/undefined)
 * @returns Normalized uppercase Object ID, or undefined if input is falsy
 */
export function normalizeObjectId(id: string | null | undefined): string | undefined {
  if (!id) {
    return undefined;
  }
  return id.toUpperCase();
}

/**
 * Normalize multiple Object IDs to uppercase format
 * 
 * @param ids - Array of Object IDs to normalize
 * @returns Array of normalized uppercase Object IDs
 */
export function normalizeObjectIds(ids: (string | null | undefined)[]): (string | undefined)[] {
  return ids.map(id => normalizeObjectId(id));
}

/**
 * Check if an Object ID is already in correct uppercase format
 * 
 * @param id - Object ID to check
 * @returns true if ID is already uppercase, false otherwise
 */
export function isNormalizedObjectId(id: string): boolean {
  return id === id.toUpperCase();
}