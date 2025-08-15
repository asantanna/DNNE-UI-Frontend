/**
 * DNNE Color Constants
 * Central location for all link and node colors used throughout the UI
 * 
 * Color intensity guidelines:
 * - Most colors are dimmed to 50% of original brightness for comfortable viewing
 * - Light green is at 66% brightness to be slightly more prominent
 * - CONFIG colors use a special toned-down green
 */

/**
 * Dims a hex color by a given factor
 * @param hexColor - The hex color to dim (e.g., '#FF0000')
 * @param factor - The dimming factor (0.5 = 50% brightness, 0.66 = 66% brightness)
 * @returns The dimmed hex color
 */
export function dim(hexColor: string, factor: number = 0.5): string {
  // Remove the # if present
  const hex = hexColor.replace('#', '')
  
  // Parse the hex color
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  
  // Apply the dimming factor
  const dimmedR = Math.round(r * factor)
  const dimmedG = Math.round(g * factor)
  const dimmedB = Math.round(b * factor)
  
  // Convert back to hex
  const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase()
  
  return `#${toHex(dimmedR)}${toHex(dimmedG)}${toHex(dimmedB)}`
}

// Original bright colors for reference (before dimming)
export const ORIGINAL_COLORS = {
  RED: '#FF6E6E',           // Original bright red
  YELLOW: '#FFD600',        // Original bright yellow
  BROWN: '#8D7561',         // Original bright brown
  LIGHT_GREEN: '#81C784',   // Original bright light green
  GREEN: '#6EE9BD',         // Original bright config green (unused now)
  CYAN: '#64B5F6',          // Original bright cyan (unused now)
  BLUE: '#556677',          // Utility node color (BalancingConfig bgcolor)
  PURPLE: '#B39DDB',        // Original bright purple
} as const

export const DNNE_COLORS = {
  // Primary data flow - slightly brighter than others (2/3 brightness)
  DATA_COLOR: dim(ORIGINAL_COLORS.LIGHT_GREEN, 0.66),
  // Object types (1/2 brightness)
  OBJ_COLOR: dim(ORIGINAL_COLORS.PURPLE, 0.5),
  // Statistics and dictionaries (1/2 brightness)  
  STATS_COLOR: dim(ORIGINAL_COLORS.YELLOW, 0.3),
  // Training and numeric types
  TRAINING_COLOR: ORIGINAL_COLORS.BLUE,
  // Control flow (1/2 brightness)
  CONTROL_COLOR: dim(ORIGINAL_COLORS.RED, 0.4),
  // Schema and metadata (1/2 brightness)
  SCHEMA_COLOR: dim(ORIGINAL_COLORS.BROWN, 0.5),
  // Configuration - dimmed version of utility node color (BalancingConfig)
  CONFIG_COLOR: dim(ORIGINAL_COLORS.PURPLE, 0.5),
  
  // Special types
  GRAY: '#808080',         // ANY type and pure wildcards
  BLACK: '#000000',        // Failed matches/unknown types
} as const

/**
 * Substitutes color placeholders in a palette with actual DNNE color values
 * @param palette - The palette object with placeholders like {DATA_COLOR}
 * @returns The palette with actual hex color values
 */
export function substitutePaletteColors(palette: any): any {
  // Deep clone the palette to avoid mutating the original
  const result = JSON.parse(JSON.stringify(palette))
  
  // Define the color substitutions
  const substitutions: Record<string, string> = {
    '{DATA_COLOR}': DNNE_COLORS.DATA_COLOR,
    '{OBJ_COLOR}': DNNE_COLORS.OBJ_COLOR,
    '{STATS_COLOR}': DNNE_COLORS.STATS_COLOR,
    '{TRAINING_COLOR}': DNNE_COLORS.TRAINING_COLOR,
    '{CONTROL_COLOR}': DNNE_COLORS.CONTROL_COLOR,
    '{SCHEMA_COLOR}': DNNE_COLORS.SCHEMA_COLOR,
    '{CONFIG_COLOR}': DNNE_COLORS.CONFIG_COLOR,
    '{GRAY}': DNNE_COLORS.GRAY,
    '{BLACK}': DNNE_COLORS.BLACK,
  }
  
  // Recursively substitute colors in the palette
  function substituteInObject(obj: any): any {
    if (typeof obj === 'string') {
      // Replace placeholders with actual colors
      for (const [placeholder, color] of Object.entries(substitutions)) {
        if (obj === placeholder) {
          return color
        }
      }
      return obj
    } else if (Array.isArray(obj)) {
      return obj.map(substituteInObject)
    } else if (obj !== null && typeof obj === 'object') {
      const newObj: any = {}
      for (const [key, value] of Object.entries(obj)) {
        newObj[key] = substituteInObject(value)
      }
      return newObj
    }
    return obj
  }
  
  return substituteInObject(result)
}

// Type suffixes to color mappings
export const SUFFIX_COLOR_MAP = {
  // Data flow types
  'TENSOR': DNNE_COLORS.DATA_COLOR,
  
  // Configuration types
  'CONFIG_PYDICT': DNNE_COLORS.CONFIG_COLOR,
  
  // Control flow types
  'TRIGGER': DNNE_COLORS.CONTROL_COLOR,
  
  // Statistics/summary types
  'STATS_PYDICT': DNNE_COLORS.STATS_COLOR,
  'SUMMARY_PYDICT': DNNE_COLORS.STATS_COLOR,
  
  // Schema/structure definitions
  'SCHEMA_PYDICT': DNNE_COLORS.SCHEMA_COLOR,
  'METADATA_PYDICT': DNNE_COLORS.CONFIG_COLOR,  // Metadata uses CONFIG color
  
  // Object types
  'MODEL_OBJ': DNNE_COLORS.OBJ_COLOR,
  'AGENT_OBJ': DNNE_COLORS.OBJ_COLOR,
  'PYDICT': DNNE_COLORS.OBJ_COLOR,

  // Data source types
  'DATASET_OBJ': DNNE_COLORS.DATA_COLOR,
  'DATALOADER_OBJ': DNNE_COLORS.DATA_COLOR,
  
  // Training/numeric types
  'LOSS_TENSOR': DNNE_COLORS.TRAINING_COLOR,
  'OPTIMIZER_OBJ': DNNE_COLORS.TRAINING_COLOR,
  'FLOAT': DNNE_COLORS.TRAINING_COLOR,
  
  // Additional types
  'INT': DNNE_COLORS.STATS_COLOR,
  'STRING': DNNE_COLORS.DATA_COLOR,
  'BOOLEAN': DNNE_COLORS.CONFIG_COLOR,
} as const

// TYPE_COLOR_MAP has been removed - dark.json now serves as the single source of truth
// for type-to-color mappings, with colors dynamically substituted from DNNE_COLORS