import type { IContextMenuValue } from '@comfyorg/litegraph'
import { LGraphNode, LiteGraph } from '@comfyorg/litegraph'
import { app } from '../../scripts/app'
import { useToastStore } from '../../stores/toastStore'

// Node that provides connection labels for cleaner graphs

interface LabelMetadata {
  nodeId: number
  slotName: string
  slotType: string
  direction: 'input' | 'output'
  anchorNodeId?: number
}

interface LabelNode extends LGraphNode {
  labelName?: string
  labelDirection?: 'input' | 'output'
}

// Label dictionary is now stored per-workflow in app.graph.extra.labelDictionary
// This prevents collisions between multiple open workflows

class LabelNode extends LGraphNode {
  static override category: string | undefined
  labelName?: string
  labelDirection?: 'input' | 'output'
  dictionaryKey?: string  // Key used to store/remove from labelDictionary
  
  constructor(title?: string) {
    super(title || 'Label')
    if (!this.properties) {
      this.properties = {}
    }
    
    // Labels only have an input to receive the connection
    // No output - this is just a visual endpoint
    this.addInput("", "*")
    
    // This node is purely frontend and does not impact the resulting prompt
    this.isVirtualNode = true
  }
  
  // Override to hide input/output slot circles
  override drawSlots(_ctx: CanvasRenderingContext2D): void {
    // Do nothing - this prevents drawing the slot circles
    // The connections will still work, just won't show the circles
  }
  
  // Prevent disconnecting the input (for output-type labels)
  override disconnectInput(_slot: number): boolean {
    // Don't allow disconnecting - labels should be deleted instead
    return false
  }
  
  // Prevent disconnecting the output (for input-type labels)
  override disconnectOutput(_slot: number): boolean {
    // Don't allow disconnecting - labels should be deleted instead
    return false
  }
  
  // Override to prevent creating connections from this node
  override onMouseDown(_e: any, _localPos: any, _graphCanvas: any): boolean {
    // Don't call super to prevent default connection dragging behavior
    // This prevents users from dragging new connections from the label
    return false // Return false to indicate we handled the event
  }
  
  // Prevent this node from being a connection source
  override getOutputInfo(_slot: number): any {
    return null // No outputs available
  }
  
  // Override to prevent slot interaction
  override getSlotInPosition(_x: number, _y: number): any {
    // Return null to prevent slot selection/interaction
    // This prevents dragging connections from the input slot
    return null
  }
  
  // Prevent multiple connections to the input (for output-type labels)
  override onConnectInput(
    inputIndex: number,
    _outputType: any,
    _outputSlot: any,
    _outputNode: any,
    _outputIndex: number
  ): boolean {
    // Input-type labels shouldn't have inputs at all
    if (this.labelDirection === 'input') {
      console.log('[LabelNode] Input-type label rejecting input connection')
      return false
    }
    
    // Output-type labels can have one input
    if (this.inputs[inputIndex].link !== null) {
      console.log('[LabelNode] Rejecting connection - label already has input')
      return false // Reject the connection
    }
    return true // Allow first connection
  }
  
  // Prevent connections from output (for input-type labels) 
  override onConnectOutput(
    outputIndex: number,
    _inputType: any,
    _inputSlot: any,
    _inputNode: any,
    _inputIndex: number
  ): boolean {
    // Output-type labels shouldn't have outputs at all
    if (this.labelDirection === 'output') {
      console.log('[LabelNode] Output-type label rejecting output connection')
      return false
    }
    
    // Input-type labels can have connections from their output
    // But only allow one connection
    if (this.outputs[outputIndex].links && this.outputs[outputIndex].links.length > 0) {
      console.log('[LabelNode] Rejecting connection - label output already connected')
      return false
    }
    return true
  }
  
  // Store original connection info to restore if disconnected
  originalConnection?: { nodeId: number; slotIndex: number }
  
  // Detect and restore disconnections
  override onConnectionsChange(
    type: number,
    slotIndex: number,
    isConnected: boolean,
    link: any
  ): void {
    // Handle both input and output connections based on label direction
    const isInputConnection = (type === 1) // LiteGraph.INPUT
    const isOutputConnection = (type === 2) // LiteGraph.OUTPUT
    
    if ((this.labelDirection === 'output' && isInputConnection && slotIndex === 0) ||
        (this.labelDirection === 'input' && isOutputConnection && slotIndex === 0)) {
      if (isConnected && link) {
        // Store the connection info when connected
        if (this.labelDirection === 'output') {
          // For output labels, store the source that connects TO this label
          this.originalConnection = {
            nodeId: link.origin_id,
            slotIndex: link.origin_slot
          }
        } else {
          // For input labels, store the target that this label connects TO
          this.originalConnection = {
            nodeId: link.target_id,
            slotIndex: link.target_slot
          }
        }
        console.log('[LabelNode] Stored connection info:', this.originalConnection, 'direction:', this.labelDirection)
      } else if (!isConnected && this.originalConnection) {
        // Connection was removed, restore it immediately
        console.log('[LabelNode] Restoring connection to prevent disconnection')
        
        if (this.labelDirection === 'output') {
          // Restore connection TO this label
          const sourceNode = app.graph.getNodeById(this.originalConnection.nodeId)
          if (sourceNode) {
            setTimeout(() => {
              sourceNode.connect(this.originalConnection!.slotIndex, this, 0)
            }, 0)
          }
        } else {
          // Restore connection FROM this label
          const targetNode = app.graph.getNodeById(this.originalConnection.nodeId)
          if (targetNode) {
            setTimeout(() => {
              this.connect(0, targetNode, this.originalConnection!.slotIndex)
            }, 0)
          }
        }
      }
    }
  }
  
  override computeSize(): [number, number] {
    if (!this.labelName) return [100, 30]
    
    const ctx = app.canvas.ctx
    ctx.font = `${LiteGraph.NODE_TEXT_SIZE}px Arial`
    const textWidth = ctx.measureText(this.labelName).width
    
    return [
      Math.max(100, textWidth + 20), // Padding of 10 on each side
      30
    ]
  }
  
  // Custom drawing for label appearance
  override onDrawForeground(ctx: CanvasRenderingContext2D): void {
    if (!this.labelName) return
    
    // Different colors for input vs output labels
    const bgColor = this.labelDirection === 'output' 
      ? 'rgba(130, 200, 130, 0.9)'  // Green for outputs
      : 'rgba(130, 130, 200, 0.9)'  // Blue for inputs
    
    const textColor = '#ffffff'
    const borderColor = this.labelDirection === 'output'
      ? 'rgba(100, 170, 100, 1)'
      : 'rgba(100, 100, 170, 1)'
    
    // Draw rounded rectangle background
    // The onDrawForeground context is relative to the node's position
    // We need to draw the rectangle covering the entire node area
    const padding = 3
    const radius = 10
    const x = padding
    const y = padding  
    const width = this.size[0] - padding * 2
    const height = this.size[1] - padding * 2
    
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + width - radius, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
    ctx.lineTo(x + width, y + height - radius)
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    ctx.lineTo(x + radius, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.closePath()
    
    ctx.fillStyle = bgColor
    ctx.fill()
    ctx.strokeStyle = borderColor
    ctx.lineWidth = 2
    ctx.stroke()
    
    // Draw label text centered in the node
    ctx.fillStyle = textColor
    ctx.font = `${LiteGraph.NODE_TEXT_SIZE}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // Center text in the middle of the node
    ctx.fillText(this.labelName, this.size[0] / 2, this.size[1] / 2)
  }
  
  override getExtraMenuOptions(_: any, options: IContextMenuValue[]): IContextMenuValue[] {
    options.unshift({
      content: 'Delete Label',
      callback: () => {
        this.removeLabelFromDictionary()
        app.graph.remove(this)
      }
    })
    return []
  }
  
  removeLabelFromDictionary(): void {
    if (!this.dictionaryKey) return
    const labelDict = (app.graph?.extra as any)?.labelDictionary as Record<string, LabelMetadata> | undefined
    if (!labelDict) return
    console.log('[LabelNode] Removing from dictionary:', this.dictionaryKey, 'direction:', this.labelDirection)
    delete labelDict[this.dictionaryKey]
  }
  
  override onRemoved(): void {
    this.removeLabelFromDictionary()
    super.onRemoved?.()
  }
}

app.registerExtension({
  name: 'Comfy.LabelNode',
  
  async setup() {
    console.log('[LabelNode] Extension setup starting... VERSION 3.1 - FIXED')
    
    // Initialize label dictionary in graph.extra if not exists
    if (!app.graph.extra) app.graph.extra = {} as any
    if (!(app.graph.extra as any).labelDictionary) {
      (app.graph.extra as any).labelDictionary = {} as Record<string, LabelMetadata>
    }
    
    // Hook into graph changes to detect link removal
    const originalRemoveLink = app.graph.removeLink
    app.graph.removeLink = function(linkId: number) {
      // Check if this link is connected to a label node
      const link = app.graph.links[linkId]
      if (link) {
        // Check if target node is a label
        const targetNode = app.graph.getNodeById(link.target_id) as LabelNode
        if (targetNode && targetNode.type === 'Label') {
          // Remove the label node when its link is removed
          console.log('[LabelNode] Removing label node', targetNode.id, 'because its link was deleted')
          // Clean up dictionary entry using dictionaryKey
          const labelDict = (app.graph.extra as any)?.labelDictionary as Record<string, LabelMetadata> | undefined
          if (targetNode.dictionaryKey && labelDict?.[targetNode.dictionaryKey]) {
            console.log('[LabelNode] Removing from dictionary:', targetNode.dictionaryKey)
            delete labelDict[targetNode.dictionaryKey]
          }
          app.graph.remove(targetNode)
          return // The link will be removed as part of removing the node
        }
      }
      
      // Call original removeLink for non-label links
      return originalRemoveLink.call(this, linkId)
    }
    
    // Hook into node removal to clean up orphaned labels
    const originalRemoveNode = app.graph.remove
    app.graph.remove = function(node: LGraphNode) {
      // Check if this node has any labels connected to it
      if (node.outputs) {
        for (const output of node.outputs) {
          if (output.links) {
            for (const linkId of output.links) {
              const link = app.graph.links[linkId]
              if (link) {
                const targetNode = app.graph.getNodeById(link.target_id) as LabelNode
                if (targetNode && targetNode.type === 'Label') {
                  // Also remove the label when source node is deleted
                  console.log('[LabelNode] Removing orphaned label', targetNode.id)
                  // Clean up dictionary entry using dictionaryKey
                  const labelDict = (app.graph.extra as any)?.labelDictionary as Record<string, LabelMetadata> | undefined
                  if (targetNode.dictionaryKey && labelDict?.[targetNode.dictionaryKey]) {
                    console.log('[LabelNode] Removing from dictionary:', targetNode.dictionaryKey)
                    delete labelDict[targetNode.dictionaryKey]
                  }
                  originalRemoveNode.call(this, targetNode)
                }
              }
            }
          }
        }
      }
      
      // Call original remove
      return originalRemoveNode.call(this, node)
    }
    
    // Function to create a label from an output
    function createLabelFromOutput(node: LGraphNode, slotIndex: number, event?: MouseEvent): void {
      const slot = node.outputs[slotIndex]
      if (!slot) return
      
      // Generate label name
      const nodeType = node.constructor.type || node.type || 'node'
      const labelName = `${nodeType}(${node.id}).${slot.name}`
      
      // Initialize label dictionary in graph.extra if needed
      if (!app.graph.extra) app.graph.extra = {} as any
      if (!(app.graph.extra as any).labelDictionary) {
        (app.graph.extra as any).labelDictionary = {} as Record<string, LabelMetadata>
      }
      
      const labelDict = (app.graph.extra as any).labelDictionary as Record<string, LabelMetadata>
      
      // Check for duplicates
      if (labelDict[labelName]) {
        const toastStore = useToastStore()
        toastStore.add({
          severity: 'error',
          summary: 'Duplicate Label',
          detail: 'A label already exists!',
          life: 3000
        })
        return
      }
      
      // Create label node - acts like a reroute
      const labelNode = LiteGraph.createNode('Label') as LabelNode
      if (!labelNode) return
      
      labelNode.labelName = labelName
      labelNode.labelDirection = 'output'
      labelNode.dictionaryKey = labelName  // For output labels, key is the label name
      
      // Position it where the mouse was released
      // The event position should be in the options passed to the context menu
      const canvas = app.canvas as any
      const pos = event ? canvas.convertEventToCanvasOffset(event) : null
      labelNode.pos = pos || [
        node.pos[0] + node.size[0] + 100,
        node.pos[1] + (slotIndex * 20)
      ]
      
      app.graph.add(labelNode)
      
      // Connect the output to the label node's input
      // This creates the visual wire connection
      node.connect(slotIndex, labelNode, 0)
      
      // Store in dictionary
      labelDict[labelName] = {
        nodeId: Number(node.id),
        slotName: slot.name,
        slotType: String(slot.type || '*'),
        direction: 'output',
        anchorNodeId: Number(labelNode.id)
      }
      
      // Update node size to fit label
      labelNode.setSize(labelNode.computeSize())
    }
    
    // Function to get compatible labels for an input
    function getCompatibleLabels(node: LGraphNode, slotIndex: number): Array<{name: string, metadata: LabelMetadata}> {
      const slot = node.inputs[slotIndex]
      if (!slot) return []
      
      const compatibleLabels: Array<{name: string, metadata: LabelMetadata}> = []
      
      const labelDict = ((app.graph.extra as any)?.labelDictionary || {}) as Record<string, LabelMetadata>
      for (const [labelName, metadata] of Object.entries(labelDict)) {
        const typedMetadata = metadata as LabelMetadata
        // Only show output labels (we connect inputs to output labels)
        if (typedMetadata.direction !== 'output') continue
        
        // Check type compatibility
        const inputType = slot.type || '*'
        const outputType = typedMetadata.slotType || '*'
        
        if (LiteGraph.isValidConnection(outputType, inputType)) {
          compatibleLabels.push({ name: labelName, metadata: typedMetadata })
        }
      }
      
      return compatibleLabels
    }
    
    // Function to connect an input to a label
    function connectToLabel(node: LGraphNode, slotIndex: number, label: {name: string, metadata: LabelMetadata}, event?: MouseEvent): void {
      // Create a label node for the INPUT side
      // This label has OUTPUT only (no input) to connect to the node's input
      const inputLabelNode = LiteGraph.createNode('Label') as LabelNode
      if (!inputLabelNode) return
      
      inputLabelNode.labelName = label.name
      inputLabelNode.labelDirection = 'input'
      
      // Create a unique dictionary key for input labels
      const dictionaryKey = `${label.name}_input_${node.id}_${slotIndex}`
      inputLabelNode.dictionaryKey = dictionaryKey
      
      // IMPORTANT: Input-side labels have OUTPUT only, no input!
      // We need to reconfigure the node
      inputLabelNode.removeInput(0) // Remove the default input
      inputLabelNode.addOutput("", "*") // Add an output instead
      
      // Calculate the label size first so we know its width
      inputLabelNode.setSize(inputLabelNode.computeSize())
      
      // Position it where the mouse was released (like output labels do)
      const canvas = app.canvas as any
      const pos = event ? canvas.convertEventToCanvasOffset(event) : null
      
      if (pos) {
        // Use mouse position but shift left by label width
        const labelWidth = inputLabelNode.size[0]
        inputLabelNode.pos = [
          pos[0] - labelWidth,
          pos[1]
        ]
      } else {
        // Fallback positioning
        const labelWidth = inputLabelNode.size[0]
        inputLabelNode.pos = [
          node.pos[0] - 150 - labelWidth,
          node.pos[1] + (slotIndex * 20)
        ]
      }
      
      app.graph.add(inputLabelNode)
      
      // Connect the label's OUTPUT to the node's INPUT
      // This is the only connection - NO connection between actual nodes!
      inputLabelNode.connect(0, node, slotIndex)
      
      // Add input label to dictionary for export system
      const inputSlot = node.inputs[slotIndex]
      if (inputSlot) {
        // Initialize label dictionary in graph.extra if needed
        if (!app.graph.extra) app.graph.extra = {} as any
        if (!(app.graph.extra as any).labelDictionary) {
          (app.graph.extra as any).labelDictionary = {} as Record<string, LabelMetadata>
        }
        
        const labelDict = (app.graph.extra as any).labelDictionary as Record<string, LabelMetadata>
        labelDict[dictionaryKey] = {
          nodeId: Number(node.id),
          slotName: inputSlot.name || `input_${slotIndex}`,
          slotType: String(inputSlot.type || '*'),
          direction: 'input',
          connectedToLabel: label.name  // Reference to the output label
        } as any
      }
      
      console.log('[LabelNode] Created input-side label:', {
        labelName: label.name,
        dictionaryKey: dictionaryKey,
        labelId: inputLabelNode.id,
        targetNodeId: node.id,
        targetSlot: slotIndex,
        hasOutput: inputLabelNode.outputs.length > 0,
        hasInput: inputLabelNode.inputs.length > 0
      })
    }
    
    // Track hook installation
    let hookInstallCount = 0
    let checkInterval: any = null
    
    // Function to install our ContextMenu hook
    const installContextMenuHook = () => {
      hookInstallCount++
      const installTime = Date.now()
      console.log(`[LabelNode] Installing ContextMenu hook (attempt #${hookInstallCount} at ${installTime})`)
      
      // Store the original ContextMenu
      const OrigContextMenu = LiteGraph.ContextMenu
      console.log('[LabelNode] Original ContextMenu stored:', !!OrigContextMenu)
      
      // Create our wrapper with debug info
      const wrapper = function(values: any, options: any) {
        console.log('[LabelNode-Hook] ContextMenu wrapper called!', {
          valuesLength: values?.length,
          firstValue: values?.[0],
          timestamp: Date.now(),
          options: options
        })
        
        // Check if connection info is in the options
        console.log('[LabelNode-Hook] Options detail:', {
          hasOptions: !!options,
          optionsKeys: options ? Object.keys(options) : [],
          event: options?.event ? 'MouseEvent' : 'none',
          parentMenu: !!options?.parentMenu,
          node: options?.node?.id,
          extra: options?.extra,
          link: options?.link,
          optionsFull: options
        })
        
        // Check if this is a menu for a released connection
        if (values && Array.isArray(values)) {
          // Look for "Add Reroute" which indicates this is a link release menu
          let rerouteIndex = -1
          
          for (let i = 0; i < values.length; i++) {
            const item = values[i]
            if (item && (item.content === 'Add Reroute' || item === 'Add Reroute')) {
              rerouteIndex = i
              console.log('[LabelNode-Hook] Found Add Reroute at index:', i)
              break
            }
          }
          
          // If this is a link release menu
          if (rerouteIndex >= 0) {
            // The connection info is in options.extra for released links!
            const slotInfo = options?.extra
            
            // The node might be stored as a private property or differently
            // Try different ways to get the node
            let node = null
            let slotIndex = null
            
            if (slotInfo) {
              // NodeOutputSlot and NodeInputSlot have a node property
              // It might be private, but we can try to access it
              node = slotInfo.node
              
              // If direct access doesn't work, try other methods
              if (!node) {
                // Try accessing private field
                try {
                  // Some objects expose private fields via getters
                  const descriptor = Object.getOwnPropertyDescriptor(slotInfo, 'node')
                  if (descriptor && descriptor.value) {
                    node = descriptor.value
                  }
                } catch (e) {
                  // Ignore errors
                }
              }
              
              // If still no node, try looking through all properties
              if (!node) {
                const allKeys = Object.getOwnPropertyNames(slotInfo)
                for (const key of allKeys) {
                  if (key.includes('node')) {
                    try {
                      const val = slotInfo[key]
                      if (val && typeof val === 'object' && val.id !== undefined) {
                        node = val
                        console.log('[LabelNode-Hook] Found node via property:', key)
                        break
                      }
                    } catch (e) {
                      // Ignore errors accessing properties
                    }
                  }
                }
              }
              
              // Try different possible property names for slot index
              slotIndex = slotInfo.slot_index ?? slotInfo.slotIndex ?? slotInfo.index ?? null
              
              console.log('[LabelNode-Hook] Initial slot index check:', {
                slotIndex,
                hasNode: !!node,
                nodeId: node?.id,
                isOutput: slotInfo?.constructor?.name === 'NodeOutputSlot',
                isInput: slotInfo?.constructor?.name === 'NodeInputSlot'
              })
              
              // If still null, try to find it from the node's outputs or inputs
              if (slotIndex === null && node) {
                // Check outputs first
                if (node.outputs) {
                  for (let i = 0; i < node.outputs.length; i++) {
                    if (node.outputs[i] === slotInfo) {
                      slotIndex = i
                      console.log('[LabelNode-Hook] Found slot index by matching output object:', i)
                      break
                    }
                    // Also check by name as fallback
                    if (node.outputs[i].name === slotInfo.name) {
                      slotIndex = i
                      console.log('[LabelNode-Hook] Found slot index by output name match:', i)
                      break
                    }
                  }
                }
                
                // Check inputs if still not found
                if (slotIndex === null && node.inputs) {
                  console.log('[LabelNode-Hook] Checking inputs for slot match:', {
                    slotInfoName: slotInfo.name,
                    slotInfoType: slotInfo.type,
                    nodeInputs: node.inputs.map((inp: any, idx: number) => ({
                      idx,
                      name: inp.name,
                      type: inp.type,
                      matches: inp === slotInfo,
                      nameMatches: inp.name === slotInfo.name
                    }))
                  })
                  
                  for (let i = 0; i < node.inputs.length; i++) {
                    if (node.inputs[i] === slotInfo) {
                      slotIndex = i
                      console.log('[LabelNode-Hook] Found slot index by matching input object:', i)
                      break
                    }
                    // Also check by name as fallback
                    if (node.inputs[i].name === slotInfo.name) {
                      slotIndex = i
                      console.log('[LabelNode-Hook] Found slot index by input name match:', i)
                      break
                    }
                  }
                }
              }
            }
            
            const hasConnection = !!node
            
            // Debug: Show what's actually in options when we have 4 keys
            if (options && Object.keys(options).length === 4) {
              console.log('[LabelNode-Hook] Options with 4 keys - full object:', options)
              if (slotInfo) {
                console.log('[LabelNode-Hook] SlotInfo properties:', Object.keys(slotInfo))
                console.log('[LabelNode-Hook] SlotInfo node access attempts:', {
                  direct: slotInfo.node,
                  hash: slotInfo['#node'],
                  found: !!node,
                  nodeId: node?.id
                })
              }
            }
            
            console.log('[LabelNode-Hook] Connection info from options.extra:', {
              hasConnection,
              hasExtra: !!options?.extra,
              extraType: options?.extra ? options.extra.constructor.name : 'none',
              nodeId: node?.id,
              slotIndex: slotIndex,
              slotName: slotInfo?.name,
              slotType: slotInfo?.type,
              isOutput: slotInfo?.constructor?.name === 'NodeOutputSlot'
            })
            
            if (hasConnection && slotInfo) {
              // FAIL FAST - Never guess slot indices!
              if (slotIndex === null || slotIndex === undefined) {
                console.error('[LabelNode-Hook] ERROR: Could not determine slot index!', {
                  node: node?.id,
                  slotInfo,
                  nodeInputs: node?.inputs,
                  nodeOutputs: node?.outputs
                })
                // Don't add any menu items if we can't determine the slot
                return new OrigContextMenu(values, options)
              }
              
              const slot = slotIndex
              console.log('[LabelNode-Hook] Using slot index:', slot)
              // Check if it's an output slot (NodeOutputSlot) or input slot
              const isOutput = slotInfo.constructor.name === 'NodeOutputSlot'
              
              if (isOutput) {
                // Creating label from output
                values.splice(rerouteIndex + 1, 0, {
                  content: 'Create Label',
                  callback: () => {
                    console.log('[LabelNode-Hook] Create Label clicked!')
                    console.log('[LabelNode-Hook] Creating label for:', {
                      nodeId: node.id,
                      slot,
                      isOutput,
                      slotName: node.outputs[slot]?.name
                    })
                    createLabelFromOutput(node, slot, options?.event)
                  }
                })
              } else {
                // Connecting to existing label from input
                console.log('[LabelNode-Hook] Checking for input slot labels:', {
                  nodeId: node?.id,
                  slot,
                  inputSlot: node?.inputs?.[slot],
                  slotType: node?.inputs?.[slot]?.type
                })
                
                const compatibleLabels = getCompatibleLabels(node, slot)
                console.log('[LabelNode-Hook] Compatible labels found:', compatibleLabels.length, compatibleLabels)
                
                if (compatibleLabels.length > 0) {
                  // Add submenu for connecting to labels
                  const submenuItems = compatibleLabels.map(label => ({
                    content: label.name,
                    callback: () => {
                      connectToLabel(node, slot, label, options?.event)
                    }
                  }))
                  
                  values.splice(rerouteIndex + 1, 0, {
                    content: 'Connect to Label ▸',
                    has_submenu: true,
                    submenu: {
                      options: submenuItems
                    }
                  })
                } else {
                  // Show why no labels were found for debugging
                  console.log('[LabelNode-Hook] No compatible labels. Current labels:', (app.graph.extra as any)?.labelDictionary)
                }
              }
            } else {
              // Add placeholder for testing when no connection
              values.splice(rerouteIndex + 1, 0, {
                content: 'Create Label (No Connection)',
                callback: () => {
                  console.log('[LabelNode-Hook] No connection info available')
                }
              })
            }
          }
        }
        
        // Call original constructor
        return new OrigContextMenu(values, options)
      } as any
      
      // Mark our wrapper for identification
      wrapper._isLabelNodeHook = true
      wrapper._installTime = installTime
      
      // Install the wrapper
      LiteGraph.ContextMenu = wrapper
      
      // Copy over static properties from original ContextMenu
      for (const prop in OrigContextMenu) {
        ;(LiteGraph.ContextMenu as any)[prop] = (OrigContextMenu as any)[prop]
      }
      
      console.log('[LabelNode] ContextMenu hook installed successfully')
    }
    
    // Function to check if our hook is still installed
    const checkHookStatus = () => {
      const currentHook = LiteGraph.ContextMenu as any
      if (!currentHook._isLabelNodeHook) {
        console.warn('[LabelNode] Hook was replaced! Reinstalling...')
        installContextMenuHook()
      } else {
        console.log('[LabelNode] Hook still active (installed at:', currentHook._installTime, ')')
      }
    }
    
    // Initial installation with delay
    setTimeout(() => {
      console.log('[LabelNode] About to install hook (version: 2024-11-22-v2)')
      installContextMenuHook()
      
      // Set up periodic checks to ensure hook stays installed
      checkInterval = setInterval(checkHookStatus, 1000)
      
      // Stop checking after 10 seconds
      setTimeout(() => {
        if (checkInterval) {
          clearInterval(checkInterval)
          console.log('[LabelNode] Stopped periodic hook checks')
        }
      }, 10000)
    }, 200)
    
    console.log('[LabelNode] Extension setup complete')
  },
  
  registerCustomNodes() {
    // Register the label node type
    LiteGraph.registerNodeType(
      'Label',
      Object.assign(LabelNode, {
        title_mode: LiteGraph.NO_TITLE,
        title: 'Label',
        collapsable: false
      })
    )
    
    LabelNode.category = 'utils'
  }
  
  // Serialization hooks removed - label dictionary is now automatically
  // serialized/deserialized as part of app.graph.extra
})

// Export for TypeScript
export { LabelNode }