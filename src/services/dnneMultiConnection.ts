/**
 * DNNE Multi-Connection Support
 * 
 * Extends LiteGraph to support multiple connections per input slot.
 * All inputs accept multiple connections by default unless marked with single_conn_only.
 */

import { LGraphNode } from '@comfyorg/litegraph'
import type { LLink, LinkId } from '@comfyorg/litegraph'
import { app } from '@/scripts/app'

/**
 * Initializes multiple connection support by overriding LiteGraph methods
 */
export function initializeMultiConnectionSupport() {
  console.log('[DNNE] Initializing multi-connection support')
  
  // Store original methods
  const originalConnect = LGraphNode.prototype.connect
  const originalDisconnectInput = LGraphNode.prototype.disconnectInput
  
  /**
   * Override connect method to handle multiple connections
   */
  LGraphNode.prototype.connect = function(
    slot: number | string,
    targetNode: LGraphNode,
    targetSlot: number | string,
    afterRerouteId?: any
  ): LLink | null {
    // Get the actual slot indices
    const outputIndex = typeof slot === 'string' 
      ? this.findOutputSlot(slot)
      : slot
    const inputIndex = typeof targetSlot === 'string'
      ? targetNode.findInputSlot(targetSlot)
      : targetSlot
      
    if (outputIndex === -1 || inputIndex === -1) {
      console.warn('[DNNE] Invalid slot indices for connection')
      return null
    }
    
    const targetInput = targetNode.inputs[inputIndex]
    if (!targetInput) {
      console.warn('[DNNE] Target input slot not found')
      return null
    }
    
    // Check if this input only accepts single connections
    if (targetInput.single_conn_only) {
      // If there's already a connection, disconnect it first
      if (targetInput.link !== null && targetInput.link !== undefined) {
        targetNode.disconnectInput(inputIndex)
      }
      // Use original connect method for single connection
      return originalConnect.call(this, slot, targetNode, targetSlot, afterRerouteId)
    }
    
    // Initialize links array if needed
    if (!targetInput.links) {
      targetInput.links = []
    }
    
    // Use original connect to create the link
    const newLink = originalConnect.call(this, slot, targetNode, targetSlot, afterRerouteId)
    
    if (newLink) {
      // For multi-connection inputs, add to links array
      // The original connect already set targetInput.link, but we need to manage the array
      if (!targetInput.single_conn_only) {
        // Add the new link ID to the links array if not already present
        const linkId = newLink.id
        if (!targetInput.links.includes(linkId)) {
          targetInput.links.push(linkId)
        }
        
        // For compatibility, keep the last connection in the link field
        targetInput.link = linkId
      }
    }
    
    return newLink
  }
  
  /**
   * Override disconnectInput to handle multiple connections
   */
  LGraphNode.prototype.disconnectInput = function(slot: number | string): boolean {
    const inputIndex = typeof slot === 'string'
      ? this.findInputSlot(slot)
      : slot
      
    if (inputIndex === -1) {
      return false
    }
    
    const input = this.inputs[inputIndex]
    if (!input) {
      return false
    }
    
    // Handle multi-connection inputs
    if (!input.single_conn_only && input.links && input.links.length > 0) {
      // When dragging off a connection, remove the last one
      const lastLinkId = input.links[input.links.length - 1]
      
      // Find and remove the link from the graph
      const link = app.graph.links[lastLinkId]
      if (link) {
        // Disconnect the specific link
        const sourceNode = app.graph.getNodeById(link.origin_id)
        if (sourceNode) {
          // Remove from source node's output links
          const output = sourceNode.outputs[link.origin_slot]
          if (output && output.links) {
            const linkIndex = output.links.indexOf(lastLinkId)
            if (linkIndex !== -1) {
              output.links.splice(linkIndex, 1)
            }
          }
        }
        
        // Remove from graph
        delete app.graph.links[lastLinkId]
        
        // Remove from our links array
        input.links.pop()
        
        // Update the link field for compatibility
        input.link = input.links.length > 0 ? input.links[input.links.length - 1] : null
        
        // Mark graph as changed
        if (app.graph) {
          app.graph.setDirtyCanvas(true, true)
        }
        
        return true
      }
    }
    
    // For single connection inputs or when links array is empty, use original method
    return originalDisconnectInput.call(this, slot)
  }
  
  /**
   * Helper function to get all input connections
   */
  LGraphNode.prototype.getInputLinks = function(slot: number | string): LinkId[] {
    const inputIndex = typeof slot === 'string'
      ? this.findInputSlot(slot)
      : slot
      
    if (inputIndex === -1) {
      return []
    }
    
    const input = this.inputs[inputIndex]
    if (!input) {
      return []
    }
    
    // Return links array if it exists, otherwise check single link
    if (input.links && input.links.length > 0) {
      return [...input.links]
    } else if (input.link !== null && input.link !== undefined) {
      return [input.link]
    }
    
    return []
  }
}

// Extend LGraphNode interface
declare module '@comfyorg/litegraph' {
  interface LGraphNode {
    getInputLinks(slot: number | string): LinkId[]
  }
}