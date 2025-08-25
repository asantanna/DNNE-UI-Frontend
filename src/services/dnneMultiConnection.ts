/**
 * DNNE Multi-Connection Support
 * 
 * Extends LiteGraph to support multiple connections per input slot.
 * All inputs accept multiple connections by default unless marked with single_conn_only.
 */

import { LGraphNode, LiteGraph } from '@comfyorg/litegraph'
import type { LLink, LinkId } from '@comfyorg/litegraph'
import { app } from '@/scripts/app'

// Track if shift key is currently pressed for drag operations
let shiftKeyPressed = false

/**
 * Initializes multiple connection support by overriding LiteGraph methods
 */
export function initializeMultiConnectionSupport() {
  // console.log('[DNNE] Initializing multi-connection support')
  // console.log('[DNNE] LGraphNode.prototype.connectSlots exists:', !!LGraphNode.prototype.connectSlots)
  
  // FIRST: Override connectSlots to prevent automatic disconnection for multi-connection inputs
  // This must happen BEFORE we capture originalConnect, so originalConnect uses our modified connectSlots
  LGraphNode.prototype.connectSlots = function(
    output: any,
    inputNode: LGraphNode,
    input: any,
    afterRerouteId?: any
  ): LLink | null {
    // console.log('[DNNE] connectSlots override called!', {
    //   output,
    //   input,
    //   hasExistingLink: input?.link != null
    // })
    
    const { graph } = this
    if (!graph) {
      console.error('[DNNE] No graph available')
      return null
    }
    
    const outputIndex = this.outputs.indexOf(output)
    if (outputIndex === -1) {
      console.warn('connectSlots: output not found')
      return null
    }
    
    const inputIndex = inputNode.inputs.indexOf(input)
    if (inputIndex === -1) {
      console.warn('connectSlots: input not found')
      return null
    }
    
    if (!LiteGraph.isValidConnection(output.type, input.type)) {
      this.setDirtyCanvas(false, true)
      return null
    }
    
    if (inputNode.onConnectInput?.(inputIndex, output.type, output, this, outputIndex) === false) {
      return null
    }
    
    if (this.onConnectOutput?.(outputIndex, input.type, input, inputNode, inputIndex) === false) {
      return null
    }
    
    // MODIFIED: Check if we should disconnect existing connections
    const existingLink = inputNode.inputs[inputIndex]?.link
    if (existingLink != null) {
      // console.log('[DNNE] Input has existing connection. single_conn_only:', input.single_conn_only)
      // Only disconnect if the input is marked as single_conn_only
      // For multi-connection inputs, we keep existing connections
      if (input.single_conn_only === true) {
        // console.log('[DNNE] Disconnecting existing connection (single_conn_only = true)')
        graph.beforeChange()
        inputNode.disconnectInput(inputIndex, true)
      } else {
        // console.log('[DNNE] Preserving existing connection(s) for multi-connection input')
        // Initialize links array if needed and preserve the existing link
        if (!inputNode.inputs[inputIndex].links) {
          inputNode.inputs[inputIndex].links = []
        }
        // Add existing link to array if not already there
        if (!inputNode.inputs[inputIndex].links.includes(existingLink)) {
          inputNode.inputs[inputIndex].links.push(existingLink)
          // console.log('[DNNE] Preserved existing link in array:', existingLink)
        }
      }
    } else {
      // console.log('[DNNE] No existing connection on input')
    }
    
    // Create the new link (LLink constructor is available on LiteGraph)
    const LLink = (LiteGraph as any).LLink
    const link = new LLink(
      ++graph.state.lastLinkId,
      input.type || output.type,
      this.id,
      outputIndex,
      inputNode.id,
      inputIndex,
      afterRerouteId
    )
    
    // Add link to graph
    graph._links.set(link.id, link)
    
    // Update output links array
    output.links ??= []
    output.links.push(link.id)
    
    // Update input link(s)
    if (!input.single_conn_only) {
      // For multi-connection inputs, add to the links array
      if (!inputNode.inputs[inputIndex].links) {
        inputNode.inputs[inputIndex].links = []
      }
      inputNode.inputs[inputIndex].links.push(link.id)
      // console.log('[DNNE] Added new link to multi-connection array. Total:', inputNode.inputs[inputIndex].links.length)
    }
    // Update the single link field for compatibility
    // Now that rendering supports links array, we can just set it to the new link
    inputNode.inputs[inputIndex].link = link.id
    
    // Handle reroutes if they exist
    if (LLink?.getReroutes) {
      const reroutes = LLink.getReroutes(graph, link)
      for (const reroute of reroutes) {
        reroute.linkIds.add(link.id)
        if (reroute.floating) delete reroute.floating
        reroute._dragging = undefined
      }
      
      const lastReroute = reroutes.at(-1)
      if (lastReroute) {
        for (const linkId of lastReroute.floatingLinkIds || []) {
          const link2 = graph.floatingLinks?.get(linkId)
          if (link2 && link2.parentId === lastReroute.id) {
            graph.removeFloatingLink?.(link2)
          }
        }
      }
    }
    
    // Update graph version and trigger callbacks
    graph._version++
    
    // Use numeric constants for NodeSlotType (OUTPUT = 1, INPUT = 2)
    this.onConnectionsChange?.(1, outputIndex, true, link, output)
    inputNode.onConnectionsChange?.(2, inputIndex, true, link, input)
    
    this.setDirtyCanvas(false, true)
    graph.afterChange()
    graph.connectionChange(this)
    
    return link
  }
  
  // NOW store original methods (AFTER overriding connectSlots)
  const originalConnect = LGraphNode.prototype.connect
  const originalDisconnectInput = LGraphNode.prototype.disconnectInput
  
  // Track shift key state globally
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Shift') {
      shiftKeyPressed = true
    }
  })
  
  document.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') {
      shiftKeyPressed = false
    }
  })
  
  // Also track from mouse events (more reliable during drag)
  document.addEventListener('pointermove', (e) => {
    shiftKeyPressed = e.shiftKey
  })
  
  document.addEventListener('pointerdown', (e) => {
    shiftKeyPressed = e.shiftKey
  })
  
  // We need to wait for canvas to be available, so we'll override when it's ready
  // This is done in the app initialization after canvas is created
  const setupLinkConnectorOverride = () => {
    if (!app.canvas?.linkConnector) {
      // Try again later
      setTimeout(setupLinkConnectorOverride, 100)
      return
    }
    
    const linkConnector = app.canvas.linkConnector
    const originalMoveInputLink = linkConnector.moveInputLink
    
    linkConnector.moveInputLink = function(network: any, input: any) {
      // Only allow moving (which disconnects) if shift is pressed
      if (!shiftKeyPressed) {
        // console.log('[DNNE] Preventing input disconnection - shift key not pressed')
        // Instead of moving, we should start a new connection
        // Return without doing anything - this prevents the disconnection
        return
      }
      // Allow normal behavior when shift is pressed
      // console.log('[DNNE] Allowing input disconnection - shift key pressed')
      return originalMoveInputLink.call(this, network, input)
    }
    
    // console.log('[DNNE] LinkConnector override installed')
  }
  
  // Start trying to setup the override
  setupLinkConnectorOverride()
  
  // Override configure to restore links arrays
  const originalConfigure = LGraphNode.prototype.configure
  LGraphNode.prototype.configure = function(info: any) {
    // Call original configure first
    originalConfigure.call(this, info)
    
    // Restore links arrays for multi-connection inputs
    if (info.inputs) {
      for (let i = 0; i < info.inputs.length; i++) {
        const inputInfo = info.inputs[i]
        const input = this.inputs[i]
        
        if (input && inputInfo.links && Array.isArray(inputInfo.links)) {
          // Restore the links array from serialized data
          input.links = [...inputInfo.links]
          // console.log(`[DNNE] Restored links array for input ${i}:`, input.links)
          
          // Ensure link field has a value for compatibility
          if (input.links.length > 0 && !input.link) {
            input.link = input.links[0]
          }
        }
      }
    }
  }
  
  // Override serialize to save links arrays
  const originalSerialize = LGraphNode.prototype.serialize
  LGraphNode.prototype.serialize = function() {
    const data = originalSerialize.call(this)
    
    // Save links arrays for multi-connection inputs
    if (this.inputs && data.inputs) {
      for (let i = 0; i < this.inputs.length; i++) {
        const input = this.inputs[i]
        if (input && input.links && input.links.length > 0) {
          // Ensure the serialized input has the links array
          if (data.inputs[i] && !data.inputs[i].links) {
            data.inputs[i].links = [...input.links]
            // console.log(`[DNNE] Serialized links array for input ${i}:`, input.links)
          }
        }
      }
    }
    
    return data
  }
  
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