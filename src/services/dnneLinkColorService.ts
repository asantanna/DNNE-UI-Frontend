/**
 * DNNE Link Color Resolution Service
 * 
 * Dynamically determines link colors based on connected node types.
 * Handles wildcards and specific types with intelligent fallback to suffix-based colors.
 */

import { LGraphCanvas, LGraphNode } from '@comfyorg/litegraph'
import { SUFFIX_COLOR_MAP, DNNE_COLORS } from '@/constants/dnneColors'

/**
 * Extracts the suffix from a type string (last element after final underscore)
 */
function extractSuffix(type: string): string {
  const parts = type.split('_')
  return parts[parts.length - 1]
}

/**
 * Checks if a type is a wildcard (starts with *)
 */
function isWildcard(type: string | null | undefined): boolean {
  return type?.startsWith('*') || type === '*'
}


/**
 * Resolves the specific type for a link based on output and input types.
 * This is called AFTER validation has determined which single types match.
 * No comma-separated types should exist at this point.
 * 
 * Resolution rules:
 * 1. If output type is specific (no wildcard): Use output type
 * 2. Else if input type is specific: Use input type
 * 3. Else if both are wildcards: Use the suffix (last component)
 * 4. Special case (*,*): Use "ANY"
 */
export function resolveSpecificLinkType(
  outputType: string | null | undefined,
  inputType: string | null | undefined
): string {

  // Handle null/undefined - shouldn't happen after validation
  if (!outputType && !inputType) {
    console.error('resolveSpecificLinkType: Both types are null/undefined, this should not happen after validation')
    return 'ANY'
  }
  
  if (!outputType) return inputType as string  // We know inputType is non-null here
  if (!inputType) return outputType
  
  // Rule 1: Output type is specific (doesn't start with *)
  if (!isWildcard(outputType[0])) {
    return outputType
  }
  
  // Rule 2: Input type is specific (doesn't start with *)
  if (!isWildcard(inputType[0])) {
    return inputType
  }
  
  // Rule 3: Both are wildcards
  // Special case: pure wildcards
  if (isWildcard(outputType) && isWildcard(inputType)) {
    return 'ANY'
  }
  
  // Extract suffix from input wildcard (could use output too, they should match)
  const withoutStar = inputType.substring(1)
  
  // If it's directly a suffix like *TENSOR
  if (SUFFIX_COLOR_MAP[withoutStar as keyof typeof SUFFIX_COLOR_MAP]) {
    return withoutStar
  }
  
  // Extract suffix after last underscore (e.g., *LAYER_TENSOR -> TENSOR)
  const suffix = extractSuffix(withoutStar)
  if (suffix) {
    return suffix
  }
  
  // Fallback - shouldn't reach here normally
  console.error(`resolveSpecificLinkType: Unexpected fallback for outputType="${outputType}", inputType="${inputType}"`)
  return withoutStar || 'ANY'
}

/**
 * Gets suffix colors for palette initialization
 */
export function getSuffixColors(): Record<string, string> {
  return { ...SUFFIX_COLOR_MAP }
}

/**
 * Builds the color mapping for LiteGraph including wildcard support
 * This creates a comprehensive color map that includes both specific types and wildcards
 */
export function buildLinkColorMap(specificColors: Record<string, string>): Record<string, string> {
  const colorMap: Record<string, string> = {}
  
  // Add all specific type colors
  Object.assign(colorMap, specificColors)
  
  // Add wildcard patterns based on suffix colors
  // These will be used when links have wildcard types
  for (const [suffix, color] of Object.entries(SUFFIX_COLOR_MAP)) {
    colorMap[`*${suffix}`] = color
    colorMap[`*_${suffix}`] = color
  }
  
  // Add wildcard versions for all specific types in the palette
  // This ensures unconnected slots with wildcards show the correct color
  for (const [type, color] of Object.entries(specificColors)) {
    colorMap[`*${type}`] = color
    // Also handle types that might appear with underscores
    if (type.includes('_')) {
      const parts = type.split('_')
      // Add pattern for last part (e.g., SCHEMA_PYDICT -> *_PYDICT)
      const lastPart = parts[parts.length - 1]
      if (!colorMap[`*_${lastPart}`]) {
        colorMap[`*_${lastPart}`] = color
      }
      // Add pattern for last two parts if compound (e.g., SCHEMA_PYDICT -> *_SCHEMA_PYDICT)
      if (parts.length >= 2) {
        const lastTwo = parts.slice(-2).join('_')
        colorMap[`*${lastTwo}`] = color
        colorMap[`*_${lastTwo}`] = color
      }
    }
  }
  
  // Add pure wildcard and ANY type
  colorMap['*'] = DNNE_COLORS.GRAY  // Gray for pure wildcards
  colorMap['ANY'] = DNNE_COLORS.GRAY  // Gray for ANY type
  
  // Set a fallback for unmatched types
  // Note: LiteGraph may not use this directly, but it documents our intent
  colorMap[''] = DNNE_COLORS.BLACK  // Black for failed matches/unknown types
  
  return colorMap
}

/**
 * Resolves the actual link type based on connected nodes
 * Since link.type is determined as input.type || output.type,
 * we need to resolve the most specific type for coloring
 */
export function resolveActualLinkType(
  link: any,
  graph: any
): string | null {
  if (!link || !graph) return null
  
  const originNode = graph.getNodeById(link.origin_id)
  const targetNode = graph.getNodeById(link.target_id)
  
  let outputType: string | null = null
  let inputType: string | null = null
  
  if (originNode?.outputs?.[link.origin_slot]) {
    outputType = originNode.outputs[link.origin_slot].type
  }
  
  if (targetNode?.inputs?.[link.target_slot]) {
    inputType = targetNode.inputs[link.target_slot].type
  }
  
  // Apply our resolution rules
  // Rule 1: Output type is specific
  if (outputType && !isWildcard(outputType)) {
    return outputType
  }
  
  // Rule 2: Input type is specific
  if (inputType && !isWildcard(inputType)) {
    return inputType
  }
  
  // Rule 3: Both are wildcards - return the stored type
  // The color map will handle suffix-based coloring
  return link.type
}

/**
 * Overrides LGraphNode's connectSlots to use resolved link types
 * This ensures links store their specific types rather than wildcards
 */
export function overrideConnectSlots() {
  // Store the original method
  const originalConnectSlots = LGraphNode.prototype.connectSlots
  
  // Override with our version
  LGraphNode.prototype.connectSlots = function(
    output: any,
    inputNode: any,
    input: any,
    afterRerouteId?: any
  ) {
    // First, let the original method create the link
    const link = originalConnectSlots.call(this, output, inputNode, input, afterRerouteId)
    
    // If link was created successfully, update its type
    if (link) {
      const outputType = output?.type
      const inputType = input?.type
      
      // Resolve the specific type for this connection
      const resolvedType = resolveSpecificLinkType(outputType, inputType)
      
      // Update the link type
      link.type = resolvedType
      
      // Debug logging
      if (outputType !== resolvedType || inputType !== resolvedType) {
        console.log(`Link type resolved: output="${outputType}", input="${inputType}" → link="${resolvedType}"`)
      }
    }
    
    return link
  }
  
  console.log('DNNE connectSlots override installed - links will use resolved types')
}

/**
 * Installs DNNE link color resolution
 * This includes overriding connectSlots and setting up the color map
 */
export function installDNNELinkColors() {
  // Override connectSlots to use resolved types
  overrideConnectSlots()
  
  // The actual color resolution happens via the enhanced color map
  console.log('DNNE link color system active - using resolved link types')
  
  // Debug: Log some of the color mappings to verify they're loaded
  if (typeof LGraphCanvas !== 'undefined' && LGraphCanvas.link_type_colors) {
    const sampleTypes = ['TENSOR', 'TRIGGER', 'BATCH_IMAGE_TENSOR', 'ANY']
    console.log('Sample color mappings:')
    for (const type of sampleTypes) {
      const color = LGraphCanvas.link_type_colors[type]
      if (color) {
        console.log(`  ${type}: ${color}`)
      }
    }
  }
}