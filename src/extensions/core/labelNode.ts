import type { IContextMenuValue } from '@comfyorg/litegraph'
import { LGraphNode, LiteGraph } from '@comfyorg/litegraph'
import { app } from '../../scripts/app'
import { useToastStore } from '../../stores/toastStore'

// Node that provides connection labels for cleaner graphs
// VERSION 4.0 - Dictionary-free implementation using node properties

interface LabelNode extends LGraphNode {
  // labelName and labelDirection are stored in properties for serialization
  properties: {
    labelName?: string
    labelDirection?: 'input' | 'output'
    // For output labels - source connection info
    sourceNodeId?: number
    sourceSlotIndex?: number
    sourceSlotName?: string
    sourceSlotType?: string
    // For input labels - target connection info
    targetNodeId?: number
    targetSlotIndex?: number
    targetSlotName?: string
    targetSlotType?: string
    connectedToLabel?: string  // Name of output label this connects to
    [key: string]: any
  }
}

class LabelNode extends LGraphNode {
  static override category: string | undefined
  // labelName and labelDirection are stored in this.properties for serialization
  
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
  
  // Allow disconnection - the label will be deleted automatically when its wire is removed
  // (See the removeLink hook in setup() that handles this)
  // We no longer need to prevent disconnection since orphaned labels are prevented
  // by deleting the label when its wire is deleted
  
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
    if (this.properties?.labelDirection === 'input') {
      // console.log('[LabelNode] Input-type label rejecting input connection')
      return false
    }
    
    // Output-type labels can have one input
    if (this.inputs[inputIndex].link !== null) {
      // console.log('[LabelNode] Rejecting connection - label already has input')
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
    if (this.properties?.labelDirection === 'output') {
      // console.log('[LabelNode] Output-type label rejecting output connection')
      return false
    }
    
    // Input-type labels can have connections from their output
    // But only allow one connection
    if (this.outputs[outputIndex].links && this.outputs[outputIndex].links.length > 0) {
      // console.log('[LabelNode] Rejecting connection - label output already connected')
      return false
    }
    return true
  }
  
  // No longer need to track or restore connections
  // The removeLink hook in setup() handles label deletion when wires are removed
  
  override computeSize(): [number, number] {
    if (!this.properties?.labelName) return [100, 30]
    
    const ctx = app.canvas.ctx
    ctx.font = `${LiteGraph.NODE_TEXT_SIZE}px Arial`
    const textWidth = ctx.measureText(this.properties.labelName).width
    
    return [
      Math.max(100, textWidth + 20), // Padding of 10 on each side
      30
    ]
  }
  
  // Custom drawing for label appearance
  override onDrawForeground(ctx: CanvasRenderingContext2D): void {
    if (!this.properties?.labelName) return
    
    // Different colors for input vs output labels
    const bgColor = this.properties?.labelDirection === 'output' 
      ? 'rgba(130, 200, 130, 0.9)'  // Green for outputs
      : 'rgba(130, 130, 200, 0.9)'  // Blue for inputs
    
    const textColor = '#ffffff'
    const borderColor = this.properties?.labelDirection === 'output'
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
    ctx.fillText(this.properties.labelName, this.size[0] / 2, this.size[1] / 2)
  }
  
  override getExtraMenuOptions(_: any, options: IContextMenuValue[]): IContextMenuValue[] {
    options.unshift({
      content: 'Delete Label',
      callback: () => {
        // No cleanup needed - just remove the node
        app.graph.remove(this)
      }
    })
    return []
  }
  
  override onRemoved(): void {
    // No cleanup needed - when a label is deleted, its connections are automatically removed
    // The prevention of disconnection in disconnectInput/Output ensures labels can't become orphaned
    super.onRemoved?.()
  }
}

app.registerExtension({
  name: 'Comfy.LabelNode',
  
  async setup() {
    // console.log('[LabelNode] Extension setup starting... VERSION 4.0 - DICTIONARY-FREE')
    
    // Hook into graph to handle Label node deletion when wires are deleted
    const originalRemoveLink = app.graph.removeLink?.bind(app.graph)
    if (originalRemoveLink) {
      app.graph.removeLink = function(link_id: number) {
        // Debug logging (uncomment if needed)
        // console.log('[LabelNode-Hook] removeLink called for link:', link_id)
        
        // Get the link info before removal
        const link = this.links[link_id]
        
        if (link) {
          // Check if either end is a Label node
          const targetNode = this.getNodeById(link.target_id)
          const sourceNode = this.getNodeById(link.origin_id)
          
          // If target is a Label node, delete it when the wire is deleted
          if (targetNode && targetNode.type === 'Label') {
            // console.log('[LabelNode] Deleting label node because its input wire was deleted:', targetNode.id)
            this.remove(targetNode)
            return // The label removal will handle the link
          }
          
          // If source is a Label node, delete it when the wire is deleted
          if (sourceNode && sourceNode.type === 'Label') {
            // console.log('[LabelNode] Deleting label node because its output wire was deleted:', sourceNode.id)
            this.remove(sourceNode)
            return // The label removal will handle the link
          }
        }
        
        // Normal link removal for non-Label connections
        return originalRemoveLink.call(this, link_id)
      }
    }
    
    // No automatic cleanup - let export validation handle orphaned labels
    // This makes the system more predictable and debuggable
    
    // Function to create a label from an output
    function createLabelFromOutput(node: LGraphNode, slotIndex: number, event?: MouseEvent): void {
      const slot = node.outputs[slotIndex]
      if (!slot) return
      
      // Generate label name
      const nodeType = node.constructor.type || node.type || 'node'
      const labelName = `${nodeType}(${node.id}).${slot.name}`
      
      // Check for duplicate output labels (same name, output direction)
      // This is now done by checking existing Label nodes
      const nodes = app.graph._nodes as LabelNode[]
      const existingOutputLabel = nodes.find(n => 
        n.type === 'Label' && 
        n.properties?.labelName === labelName && 
        n.properties?.labelDirection === 'output'
      )
      
      if (existingOutputLabel) {
        // console.log('[LabelNode] Duplicate output label detected:', labelName)
        const toastStore = useToastStore()
        toastStore.add({
          severity: 'error',
          summary: 'Duplicate Label',
          detail: 'An output label with this name already exists!',
          life: 3000
        })
        return
      }
      
      // Create label node - acts like a reroute
      const labelNode = LiteGraph.createNode('Label') as LabelNode
      if (!labelNode) return
      
      labelNode.properties.labelName = labelName
      labelNode.properties.labelDirection = 'output'
      // Store source connection info for dictionary-free resolution
      labelNode.properties.sourceNodeId = Number(node.id)
      labelNode.properties.sourceSlotIndex = slotIndex
      labelNode.properties.sourceSlotName = slot.name
      labelNode.properties.sourceSlotType = String(slot.type || '*')
      // No longer need dictionaryKey - all info stored in properties
      
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
      
      // Update node size to fit label
      labelNode.setSize(labelNode.computeSize())
    }
    
    // Function to get compatible labels for an input
    function getCompatibleLabels(node: LGraphNode, slotIndex: number): Array<{name: string, sourceInfo: any}> {
      const slot = node.inputs[slotIndex]
      if (!slot) return []
      
      const compatibleLabels: Array<{name: string, sourceInfo: any}> = []
      
      // Find all output labels from existing Label nodes
      const nodes = app.graph._nodes as LabelNode[]
      const outputLabels = nodes.filter(n => 
        n.type === 'Label' && 
        n.properties?.labelDirection === 'output'
      )
      
      for (const labelNode of outputLabels) {
        const labelName = labelNode.properties?.labelName
        const outputType = labelNode.properties?.sourceSlotType || '*'
        
        if (!labelName) continue
        
        // Check type compatibility
        const inputType = slot.type || '*'
        
        if (LiteGraph.isValidConnection(outputType, inputType)) {
          compatibleLabels.push({ 
            name: labelName, 
            sourceInfo: {
              nodeId: labelNode.properties.sourceNodeId,
              slotName: labelNode.properties.sourceSlotName,
              slotType: outputType
            }
          })
        }
      }
      
      return compatibleLabels
    }
    
    // Function to connect an input to a label
    function connectToLabel(node: LGraphNode, slotIndex: number, label: {name: string, sourceInfo: any}, event?: MouseEvent): void {
      // Create a label node for the INPUT side
      // This label has OUTPUT only (no input) to connect to the node's input
      const inputLabelNode = LiteGraph.createNode('Label') as LabelNode
      if (!inputLabelNode) return
      
      inputLabelNode.properties.labelName = label.name
      inputLabelNode.properties.labelDirection = 'input'
      // Store target connection info for dictionary-free resolution
      inputLabelNode.properties.targetNodeId = Number(node.id)
      inputLabelNode.properties.targetSlotIndex = slotIndex
      const targetSlot = node.inputs[slotIndex]
      inputLabelNode.properties.targetSlotName = targetSlot?.name || `input_${slotIndex}`
      inputLabelNode.properties.targetSlotType = String(targetSlot?.type || '*')
      inputLabelNode.properties.connectedToLabel = label.name
      
      // No longer need dictionaryKey - all info stored in properties
      
      // Position it first (before reconfiguring slots)
      const canvas = app.canvas as any
      const pos = event ? canvas.convertEventToCanvasOffset(event) : null
      
      // Estimate label width before adding to graph
      const ctx = app.canvas.ctx
      ctx.font = `${LiteGraph.NODE_TEXT_SIZE}px Arial`
      const textWidth = ctx.measureText(label.name).width
      const estimatedWidth = Math.max(100, textWidth + 20)
      
      if (pos) {
        // Use mouse position but shift left by label width
        inputLabelNode.pos = [
          pos[0] - estimatedWidth,
          pos[1]
        ]
      } else {
        // Fallback positioning
        inputLabelNode.pos = [
          node.pos[0] - 150 - estimatedWidth,
          node.pos[1] + (slotIndex * 20)
        ]
      }
      
      // Add to graph FIRST (before reconfiguring slots)
      app.graph.add(inputLabelNode)
      
      // IMPORTANT: Input-side labels have OUTPUT only, no input!
      // Now we can safely reconfigure the node after it's in the graph
      inputLabelNode.removeInput(0) // Remove the default input
      inputLabelNode.addOutput("", "*") // Add an output instead
      
      // Update the size after reconfiguration
      inputLabelNode.setSize(inputLabelNode.computeSize())
      
      // Connect the label's OUTPUT to the node's INPUT
      // This is the only connection - NO connection between actual nodes!
      inputLabelNode.connect(0, node, slotIndex)
      
      // console.log('[LabelNode] Created input-side label:', {
      //   labelName: label.name,
      //   labelId: inputLabelNode.id,
      //   targetNodeId: node.id,
      //   targetSlot: slotIndex,
      //   hasOutput: inputLabelNode.outputs.length > 0,
      //   hasInput: inputLabelNode.inputs.length > 0
      // })
    }
    
    // Track hook installation
    let hookInstallCount = 0
    let checkInterval: any = null
    
    // Function to install our ContextMenu hook
    const installContextMenuHook = () => {
      hookInstallCount++
      const installTime = Date.now()
      // console.log(`[LabelNode] Installing ContextMenu hook (attempt #${hookInstallCount} at ${installTime})`)
      
      // Store the original ContextMenu
      const OrigContextMenu = LiteGraph.ContextMenu
      // console.log('[LabelNode] Original ContextMenu stored:', !!OrigContextMenu)
      
      // Create our wrapper with debug info
      const wrapper = function(values: any, options: any) {
        // console.log('[LabelNode-Hook] ContextMenu wrapper called!', {
        //   valuesLength: values?.length,
        //   firstValue: values?.[0],
        //   timestamp: Date.now(),
        //   options: options
        // })
        
        // Check if connection info is in the options
        // console.log('[LabelNode-Hook] Options detail:', {
        //   hasOptions: !!options,
        //   optionsKeys: options ? Object.keys(options) : [],
        //   event: options?.event ? 'MouseEvent' : 'none',
        //   parentMenu: !!options?.parentMenu,
        //   node: options?.node?.id,
        //   extra: options?.extra,
        //   link: options?.link,
        //   optionsFull: options
        // })
        
        // Check if this is a menu for a released connection
        if (values && Array.isArray(values)) {
          // Look for "Add Reroute" which indicates this is a link release menu
          let rerouteIndex = -1
          
          for (let i = 0; i < values.length; i++) {
            const item = values[i]
            if (item && (item.content === 'Add Reroute' || item === 'Add Reroute')) {
              rerouteIndex = i
              // console.log('[LabelNode-Hook] Found Add Reroute at index:', i)
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
                        // console.log('[LabelNode-Hook] Found node via property:', key)
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
              
              // console.log('[LabelNode-Hook] Initial slot index check:', {
              //   slotIndex,
              //   hasNode: !!node,
              //   nodeId: node?.id,
              //   isOutput: slotInfo?.constructor?.name === 'NodeOutputSlot',
              //   isInput: slotInfo?.constructor?.name === 'NodeInputSlot'
              // })
              
              // If still null, try to find it from the node's outputs or inputs
              if (slotIndex === null && node) {
                // Check outputs first
                if (node.outputs) {
                  for (let i = 0; i < node.outputs.length; i++) {
                    if (node.outputs[i] === slotInfo) {
                      slotIndex = i
                      // console.log('[LabelNode-Hook] Found slot index by matching output object:', i)
                      break
                    }
                    // Also check by name as fallback
                    if (node.outputs[i].name === slotInfo.name) {
                      slotIndex = i
                      // console.log('[LabelNode-Hook] Found slot index by output name match:', i)
                      break
                    }
                  }
                }
                
                // Check inputs if still not found
                if (slotIndex === null && node.inputs) {
                  // console.log('[LabelNode-Hook] Checking inputs for slot match:', {
                  //   slotInfoName: slotInfo.name,
                  //   slotInfoType: slotInfo.type,
                  //   nodeInputs: node.inputs.map((inp: any, idx: number) => ({
                  //     idx,
                  //     name: inp.name,
                  //     type: inp.type,
                  //     matches: inp === slotInfo,
                  //     nameMatches: inp.name === slotInfo.name
                  //   }))
                  // })
                  
                  for (let i = 0; i < node.inputs.length; i++) {
                    if (node.inputs[i] === slotInfo) {
                      slotIndex = i
                      // console.log('[LabelNode-Hook] Found slot index by matching input object:', i)
                      break
                    }
                    // Also check by name as fallback
                    if (node.inputs[i].name === slotInfo.name) {
                      slotIndex = i
                      // console.log('[LabelNode-Hook] Found slot index by input name match:', i)
                      break
                    }
                  }
                }
              }
            }
            
            const hasConnection = !!node
            
            // Debug: Show what's actually in options when we have 4 keys
            if (options && Object.keys(options).length === 4) {
              // console.log('[LabelNode-Hook] Options with 4 keys - full object:', options)
              // if (slotInfo) {
              //   console.log('[LabelNode-Hook] SlotInfo properties:', Object.keys(slotInfo))
              //   console.log('[LabelNode-Hook] SlotInfo node access attempts:', {
              //     direct: slotInfo.node,
              //     hash: slotInfo['#node'],
              //     found: !!node,
              //     nodeId: node?.id
              //   })
              // }
            }
            
            // console.log('[LabelNode-Hook] Connection info from options.extra:', {
            //   hasConnection,
            //   hasExtra: !!options?.extra,
            //   extraType: options?.extra ? options.extra.constructor.name : 'none',
            //   nodeId: node?.id,
            //   slotIndex: slotIndex,
            //   slotName: slotInfo?.name,
            //   slotType: slotInfo?.type,
            //   isOutput: slotInfo?.constructor?.name === 'NodeOutputSlot'
            // })
            
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
              // console.log('[LabelNode-Hook] Using slot index:', slot)
              // Check if it's an output slot (NodeOutputSlot) or input slot
              const isOutput = slotInfo.constructor.name === 'NodeOutputSlot'
              
              if (isOutput) {
                // Creating label from output
                values.splice(rerouteIndex + 1, 0, {
                  content: 'Create Label',
                  callback: () => {
                    // console.log('[LabelNode-Hook] Create Label clicked!')
                    // console.log('[LabelNode-Hook] Creating label for:', {
                    //   nodeId: node.id,
                    //   slot,
                    //   isOutput,
                    //   slotName: node.outputs[slot]?.name
                    // })
                    createLabelFromOutput(node, slot, options?.event)
                  }
                })
              } else {
                // Connecting to existing label from input
                // console.log('[LabelNode-Hook] Checking for input slot labels:', {
                //   nodeId: node?.id,
                //   slot,
                //   inputSlot: node?.inputs?.[slot],
                //   slotType: node?.inputs?.[slot]?.type
                // })
                
                const compatibleLabels = getCompatibleLabels(node, slot)
                // console.log('[LabelNode-Hook] Compatible labels found:', compatibleLabels.length, compatibleLabels)
                
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
                  // console.log('[LabelNode-Hook] No compatible labels. Current labels:', (app.graph.extra as any)?.labelDictionary)
                }
              }
            } else {
              // Add placeholder for testing when no connection
              values.splice(rerouteIndex + 1, 0, {
                content: 'Create Label (No Connection)',
                callback: () => {
                  // console.log('[LabelNode-Hook] No connection info available')
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
      
      // console.log('[LabelNode] ContextMenu hook installed successfully')
    }
    
    // Function to check if our hook is still installed
    const checkHookStatus = () => {
      const currentHook = LiteGraph.ContextMenu as any
      if (!currentHook._isLabelNodeHook) {
        console.warn('[LabelNode] Hook was replaced! Reinstalling...')
        installContextMenuHook()
      } else {
        // console.log('[LabelNode] Hook still active (installed at:', currentHook._installTime, ')')
      }
    }
    
    // Initial installation with delay
    setTimeout(() => {
      // console.log('[LabelNode] About to install hook (version: 2024-11-22-v2)')
      installContextMenuHook()
      
      // Set up periodic checks to ensure hook stays installed
      checkInterval = setInterval(checkHookStatus, 1000)
      
      // Stop checking after 10 seconds
      setTimeout(() => {
        if (checkInterval) {
          clearInterval(checkInterval)
          // console.log('[LabelNode] Stopped periodic hook checks')
        }
      }, 10000)
    }, 200)
    
    // console.log('[LabelNode] Extension setup complete')
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