import { LGraphCanvas, type LGraphNode } from '@comfyorg/litegraph'
import { app } from '../../scripts/app'
import type { LabelNode } from './labelNode'

/**
 * DNNE Label Rats Nest Extension
 * 
 * Displays straight lines connecting all labels in a network when one is selected.
 * This helps visualize label connections similar to electronics CAD "rats nest" view.
 */
class LabelRatsNestManager {
  private selectedLabelNetwork: LabelNode[] = []
  private lastSelectedNodeId: number | null = null
  private isEnabled = true
  private labelNetworkCache = new Map<string, LabelNode[]>()
  private animationFrameId: number | null = null

  setupHooks() {
    // Hook into canvas drawing after the main draw but before overlays
    const originalDrawFrontCanvas = LGraphCanvas.prototype.drawFrontCanvas
    LGraphCanvas.prototype.drawFrontCanvas = function(this: LGraphCanvas) {
      // Call original drawing first
      originalDrawFrontCanvas.call(this)
      
      // Then draw our rats nest on top
      const manager = (window as any).dnneRatsNestManager
      if (manager && manager.isEnabled) {
        manager.drawRatsNest(this)
      }
    }

    // Monitor selection changes
    const originalProcessNodeSelected = LGraphCanvas.prototype.processNodeSelected
    LGraphCanvas.prototype.processNodeSelected = function(this: LGraphCanvas, node: LGraphNode, e: any) {
      // Call original handler
      const result = originalProcessNodeSelected.call(this, node, e)
      
      // Update our rats nest
      const manager = (window as any).dnneRatsNestManager
      if (manager) {
        manager.onSelectionChange()
      }
      
      return result
    }

    // Also monitor when nodes are deselected
    const originalDeselectNode = LGraphCanvas.prototype.deselectNode
    LGraphCanvas.prototype.deselectNode = function(this: LGraphCanvas, node: LGraphNode) {
      // Call original handler
      originalDeselectNode.call(this, node)
      
      // Update our rats nest
      const manager = (window as any).dnneRatsNestManager
      if (manager) {
        manager.onSelectionChange()
      }
    }

    // Monitor clicks on empty canvas (deselect all)
    const originalProcessMouseDown = LGraphCanvas.prototype.processMouseDown
    LGraphCanvas.prototype.processMouseDown = function(this: LGraphCanvas, e: PointerEvent) {
      const result = originalProcessMouseDown.call(this, e)
      
      // If clicked on empty space, clear rats nest
      if (!this.selected_nodes || Object.keys(this.selected_nodes).length === 0) {
        const manager = (window as any).dnneRatsNestManager
        if (manager) {
          manager.clearNetwork()
        }
      }
      
      return result
    }
  }

  /**
   * Called when selection changes to update the label network
   */
  onSelectionChange() {
    const canvas = app.canvas
    if (!canvas) {
      return
    }

    // Get selected nodes
    const selectedNodes = Object.values(canvas.selected_nodes || {})
    
    // Check if a Label node is selected
    let selectedLabel: LabelNode | null = null
    for (const node of selectedNodes) {
      if (node.type === 'Label') {
        selectedLabel = node as LabelNode
        break
      }
    }

    if (selectedLabel && Number(selectedLabel.id) !== this.lastSelectedNodeId) {
      this.lastSelectedNodeId = Number(selectedLabel.id)
      this.buildLabelNetwork(selectedLabel)
    } else if (!selectedLabel) {
      this.clearNetwork()
    }
  }

  /**
   * Build the network of all labels with the same name
   */
  private buildLabelNetwork(selectedLabel: LabelNode) {
    if (!selectedLabel.properties?.labelName) {
      this.clearNetwork()
      return
    }

    const labelName = selectedLabel.properties.labelName
    
    // Check cache first
    if (this.labelNetworkCache.has(labelName)) {
      this.selectedLabelNetwork = this.labelNetworkCache.get(labelName)!
    } else {
      // Build network and cache it
      const allNodes = app.graph._nodes as LabelNode[]
      
      // Find all Label nodes with the same name
      this.selectedLabelNetwork = allNodes.filter(node => 
        node.type === 'Label' && 
        node.properties?.labelName === labelName
      )
      
      // Cache the result
      this.labelNetworkCache.set(labelName, this.selectedLabelNetwork)
    }

    // Start animation for pulsing effect
    this.startAnimation()
  }
  
  /**
   * Clear the cache when nodes change
   */
  invalidateCache() {
    this.labelNetworkCache.clear()
  }

  /**
   * Clear the current network
   */
  clearNetwork() {
    if (this.selectedLabelNetwork.length > 0) {
      this.selectedLabelNetwork = []
      this.lastSelectedNodeId = null
      this.stopAnimation()
      app.canvas?.setDirty(true, false)
    }
  }
  
  /**
   * Start animation loop for pulsing effect
   */
  private startAnimation() {
    this.stopAnimation()
    
    const animate = () => {
      if (this.selectedLabelNetwork.length > 0 && this.isEnabled) {
        app.canvas?.setDirty(true, false)
        this.animationFrameId = requestAnimationFrame(animate)
      }
    }
    
    this.animationFrameId = requestAnimationFrame(animate)
  }
  
  /**
   * Stop animation loop
   */
  private stopAnimation() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  /**
   * Draw the rats nest lines on the canvas
   */
  drawRatsNest(canvas: LGraphCanvas) {
    if (this.selectedLabelNetwork.length < 2) {
      return  // Need at least 2 labels to draw connections
    }

    const ctx = canvas.ctx
    if (!ctx) {
      return
    }

    // Find output and input labels
    const outputLabel = this.selectedLabelNetwork.find(n => 
      n.properties?.labelDirection === 'output'
    )
    const inputLabels = this.selectedLabelNetwork.filter(n => 
      n.properties?.labelDirection === 'input'
    )

    if (!outputLabel || inputLabels.length === 0) return

    // Save context state
    ctx.save()
    
    // Use LiteGraph's built-in transformation method
    canvas.ds.toCanvasContext(ctx)

    // Set line style - thin, semi-transparent cyan line for better visibility
    // Using cyan/electric blue to differentiate from normal connections
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)' // Cyan, 50% opacity
    ctx.lineWidth = 1 / canvas.ds.scale  // Keep line thin regardless of zoom
    ctx.setLineDash([]) // Solid line
    
    // Add subtle shadow for better visibility
    ctx.shadowColor = 'rgba(0, 255, 255, 0.3)'
    ctx.shadowBlur = 3 / canvas.ds.scale  // Scale shadow with zoom

    // Calculate output label center in world coordinates
    const outputCenter = {
      x: outputLabel.pos[0] + (outputLabel.size[0] / 2),
      y: outputLabel.pos[1] + (outputLabel.size[1] / 2)
    }

    // Draw lines to each input label
    for (const inputLabel of inputLabels) {
      const inputCenter = {
        x: inputLabel.pos[0] + (inputLabel.size[0] / 2),
        y: inputLabel.pos[1] + (inputLabel.size[1] / 2)
      }

      // Draw straight line in world coordinates
      ctx.beginPath()
      ctx.moveTo(outputCenter.x, outputCenter.y)
      ctx.lineTo(inputCenter.x, inputCenter.y)
      ctx.stroke()
    }
    
    // Reset shadow for label highlights
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0

    // Highlight the labels themselves with a subtle glow
    if (this.selectedLabelNetwork.length > 0) {
      // Draw a pulsing glow effect using gradient
      const glowIntensity = 0.6 + Math.sin(Date.now() * 0.002) * 0.2 // Subtle pulse
      ctx.strokeStyle = `rgba(0, 255, 255, ${glowIntensity})`
      ctx.lineWidth = 2 / canvas.ds.scale  // Keep line width consistent
      ctx.setLineDash([5 / canvas.ds.scale, 3 / canvas.ds.scale]) // Scale dashes with zoom

      for (const label of this.selectedLabelNetwork) {
        // Draw a highlight rectangle around each label in world coordinates
        const padding = 3 / canvas.ds.scale  // Scale padding with zoom
        ctx.strokeRect(
          label.pos[0] - padding,
          label.pos[1] - padding,
          label.size[0] + padding * 2,
          label.size[1] + padding * 2
        )
      }
    }

    // Restore context state
    ctx.restore()
  }

  /**
   * Toggle the rats nest feature on/off
   */
  toggle(enabled?: boolean) {
    this.isEnabled = enabled !== undefined ? enabled : !this.isEnabled
    if (!this.isEnabled) {
      this.clearNetwork()
      this.stopAnimation()
    } else {
      // Re-check selection when enabled
      this.onSelectionChange()
    }
  }
}

// Register the extension
app.registerExtension({
  name: 'DNNE.LabelRatsNest',
  
  async setup() {
    // Create and store the manager globally so hooks can access it
    const manager = new LabelRatsNestManager()
    ;(window as any).dnneRatsNestManager = manager
    
    // Setup the LiteGraph hooks immediately
    manager.setupHooks()
    
    // Also monitor selection changes using the canvas callback when it's ready
    const checkInterval = setInterval(() => {
      if (app.canvas) {
        // Hook into the existing onSelectionChange callback chain for extra reliability
        const originalOnSelectionChange = app.canvas.onSelectionChange
        app.canvas.onSelectionChange = function(selected: any) {
          // Call original if it exists
          if (originalOnSelectionChange) {
            originalOnSelectionChange.call(this, selected)
          }
          // Call our manager
          manager.onSelectionChange()
        }
        
        clearInterval(checkInterval)
      }
    }, 100)
    
    // Stop trying after 5 seconds
    setTimeout(() => clearInterval(checkInterval), 5000)
  },
  
  // Invalidate cache when nodes are added or removed
  async nodeCreated() {
    const manager = (window as any).dnneRatsNestManager
    if (manager) {
      manager.invalidateCache()
    }
  },
  
  async beforeRegisterNodeDef() {
    const manager = (window as any).dnneRatsNestManager
    if (manager) {
      manager.invalidateCache()
    }
  }
})

export { LabelRatsNestManager }