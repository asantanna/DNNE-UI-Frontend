/**
 * DNNE-specific type validation that supports wildcard patterns.
 * Replaces LiteGraph's default isValidConnection.
 * 
 * Supports:
 * - Exact matches: TENSOR matches TENSOR
 * - Pure wildcards: * matches anything
 * - DNNE wildcards: *TENSOR matches BATCH_IMAGE_TENSOR, LAYER_TENSOR, etc.
 * - Multiple types: "*TENSOR,*DICT" matches any tensor OR any dict
 */

/**
 * Check if a single type connection is valid (no comma-separated types)
 */
function checkSingleTypeConnection(type_a: string, type_b: string): boolean {
  // Pure wildcards
  if (type_a === "*" || type_b === "*") return true;
  
  // DNNE wildcard patterns
  if (type_a.startsWith("*")) {
    const baseType = type_a.substring(1);
    // Check if b matches the base type exactly or ends with it (case-insensitive)
    const bLower = type_b.toLowerCase();
    const baseTypeLower = baseType.toLowerCase();
    return bLower === baseTypeLower || bLower.endsWith(baseTypeLower);
  }
  if (type_b.startsWith("*")) {
    const baseType = type_b.substring(1);
    // Check if a matches the base type exactly or ends with it (case-insensitive)
    const aLower = type_a.toLowerCase();
    const baseTypeLower = baseType.toLowerCase();
    return aLower === baseTypeLower || aLower.endsWith(baseTypeLower);
  }
  
  // Exact match
  return type_a === type_b;
}

/**
 * DNNE type validation function that supports wildcards and multiple types.
 * This function replaces LiteGraph.isValidConnection.
 * 
 * @param type_a - Output type (what the source provides)
 * @param type_b - Input type (what the target accepts)
 * @returns true if the connection is valid
 */
export function dnneIsValidConnection(type_a: string | number | null | undefined, type_b: string | number | null | undefined): boolean {
  // Handle empty, null, undefined, or pure wildcard
  if (!type_a || type_a === "*" || !type_b || type_b === "*") return true;
  
  // Handle numeric 0 as wildcard (LiteGraph legacy)
  if (type_a === 0 || type_b === 0) return true;
  
  // Convert to strings and lowercase for consistency
  type_a = String(type_a).toLowerCase().trim();
  type_b = String(type_b).toLowerCase().trim();
  
  // Handle empty strings after conversion
  if (!type_a || !type_b) return true;
  
  // Special case for EVENT->ACTION (LiteGraph legacy)
  // @ts-ignore - LiteGraph global constants
  if (typeof LiteGraph !== 'undefined' && type_a === String(LiteGraph.EVENT).toLowerCase() && type_b === String(LiteGraph.ACTION).toLowerCase()) {
    return true;
  }
  
  // If no commas, check single type
  if (!type_a.includes(",") && !type_b.includes(",")) {
    return checkSingleTypeConnection(type_a, type_b);
  }
  
  // Handle comma-separated types (unions)
  const types_a = type_a.split(",").map(t => t.trim()).filter(t => t);
  const types_b = type_b.split(",").map(t => t.trim()).filter(t => t);
  
  // Check if any combination is valid
  for (const a of types_a) {
    for (const b of types_b) {
      if (checkSingleTypeConnection(a, b)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Install the DNNE type validation system.
 * This should be called during app initialization.
 */
export function installDNNETypeValidation(): void {
  // @ts-ignore - LiteGraph is a global
  if (typeof LiteGraph !== 'undefined') {
    console.log('[DNNE] Installing DNNE type validation with wildcard support');
    // @ts-ignore
    LiteGraph.isValidConnection = dnneIsValidConnection;
  } else {
    console.error('[DNNE] LiteGraph not found, cannot install type validation');
  }
}