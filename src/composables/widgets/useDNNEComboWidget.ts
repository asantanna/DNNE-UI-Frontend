import type { LGraphNode } from '@comfyorg/litegraph'
import type { IComboWidget } from '@comfyorg/litegraph/dist/types/widgets'
import { ref } from 'vue'

import MultiSelectWidget from '@/components/graph/widgets/MultiSelectWidget.vue'
import {
  ComboInputSpec,
  type InputSpec,
  isComboInputSpec
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import {
  type BaseDOMWidget,
  ComponentWidgetImpl,
  addWidget
} from '@/scripts/domWidget'
import {
  type ComfyWidgetConstructorV2
} from '@/scripts/widgets'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useWorkflowStore } from '@/stores/workflowStore'

import { useRemoteWidget } from './useRemoteWidget'

const getDefaultValue = (inputSpec: ComboInputSpec) => {
  if (inputSpec.default) return inputSpec.default
  if (inputSpec.options?.length) return inputSpec.options[0]
  if (inputSpec.remote) return 'Loading...'
  return undefined
}

const addMultiSelectWidget = (node: LGraphNode, inputSpec: ComboInputSpec) => {
  const widgetValue = ref<string[]>([])
  const widget = new ComponentWidgetImpl({
    node,
    name: inputSpec.name,
    component: MultiSelectWidget,
    inputSpec,
    options: {
      getValue: () => widgetValue.value,
      setValue: (value: string[]) => {
        widgetValue.value = value
      }
    }
  })
  addWidget(node, widget as BaseDOMWidget<object | string>)
  // TODO: Add remote support to multi-select widget
  // https://github.com/Comfy-Org/ComfyUI_frontend/issues/3003
  return widget
}

const addDNNEComboWidget = (node: LGraphNode, inputSpec: ComboInputSpec) => {
  const defaultValue = getDefaultValue(inputSpec)
  const comboOptions = inputSpec.options ?? []
  
  // Create the combo widget with a callback that handles onChange
  const widget = node.addWidget(
    'combo',
    inputSpec.name,
    defaultValue,
    async (value) => {
      // Check if this is an IsaacGymEnvs widget that needs special handling
      if (node.type === 'IsaacGymEnvs' && (inputSpec.name === 'task' || inputSpec.name.startsWith('dynamic_'))) {
        try {
          // Get task value (either from this widget if it's task, or find the task widget)
          let taskValue = value
          if (inputSpec.name !== 'task') {
            const taskWidget = node.widgets?.find(w => w.name === 'task')
            taskValue = taskWidget?.value || 'none'
          }
          
          if (taskValue === 'none') {
            return
          }
          
          // Collect all widget values to send to backend
          const widgetValues: Record<string, any> = {}
          if (node.widgets) {
            for (const w of node.widgets) {
              widgetValues[w.name] = w.value
            }
          }
          
          // Determine which node types are in the graph to optimize the API call
          const nodeTypes = new Set<string>()
          const graph = app.graph
          if (graph) {
            for (const graphNode of graph._nodes) {
              if (['PPOAgent', 'PPOConfig', 'IsaacGymSim'].includes(graphNode.type)) {
                nodeTypes.add(graphNode.type)
              }
            }
          }
          
          // Call the API with widget that triggered the change and all current values
          let url = `/dnne/env_config/${taskValue}`
          const params = new URLSearchParams()
          if (nodeTypes.size === 1) {
            params.append('node_type', Array.from(nodeTypes)[0])
          }
          params.append('trigger_widget', inputSpec.name)
          params.append('widget_values', JSON.stringify(widgetValues))
          
          if (params.toString()) {
            url += `?${params.toString()}`
          }
          
          const response = await api.fetchApi(url)
          if (response.ok) {
            const data = await response.json()
            
            // Update nodes with the new configuration (use inner config object)
            updateNodesWithConfig(node, data.config)
            
            // Update dynamic widgets if provided
            if (data.widget_updates) {
              updateDynamicWidgets(node, data.widget_updates)
            }
            
            // Update schema display if provided
            if (data.schema_display) {
              updateSchemaDisplayWidget(node, data.schema_display)
            }
          } else {
            const errorText = await response.text()
            console.error(`[DNNE] Failed to fetch config for task ${taskValue}: ${response.status} ${response.statusText}`, errorText)
          }
        } catch (error) {
          console.error('[DNNE] Error fetching environment config:', error)
        }
      }
    },
    {
      values: comboOptions
    }
  ) as IComboWidget

  if (inputSpec.remote) {
    const remoteWidget = useRemoteWidget({
      remoteConfig: inputSpec.remote,
      defaultValue,
      node,
      widget
    })
    if (inputSpec.remote.refresh_button) remoteWidget.addRefreshButton()

    const origOptions = widget.options
    widget.options = new Proxy(origOptions, {
      get(target, prop) {
        // Assertion: Proxy handler passthrough
        return prop !== 'values'
          ? target[prop as keyof typeof target]
          : remoteWidget.getValue()
      }
    })
  }

  // No special handling for seed_control - it's just a regular dropdown

  return widget
}

// Helper function to find nodes connected to a node's output
function getNodesConnectedToOutput(node: LGraphNode): LGraphNode[] {
  const connectedNodes: LGraphNode[] = []
  const graph = app.graph
  
  if (!graph || !node.outputs) {
    return connectedNodes
  }
  
  for (const output of node.outputs) {
    if (output.links && output.links.length > 0) {
      for (const linkId of output.links) {
        const link = graph.links[linkId]
        if (link) {
          const targetNode = graph.getNodeById(link.target_id)
          if (targetNode) {
            connectedNodes.push(targetNode)
          }
        }
      }
    }
  }
  
  return connectedNodes
}

// Helper function to find the node connected to a specific input
function getNodeConnectedToInput(node: LGraphNode, inputName: string): LGraphNode | null {
  const graph = app.graph
  
  if (!graph || !node.inputs) {
    return null
  }
  
  // Find the input by name
  for (let i = 0; i < node.inputs.length; i++) {
    const input = node.inputs[i]
    if (input.name === inputName && input.link) {
      // Get the link connected to this input
      const link = graph.links[input.link]
      if (link) {
        // Find the source node
        const sourceNode = graph.getNodeById(link.origin_id)
        if (sourceNode) {
          return sourceNode
        }
      }
    }
  }
  
  return null
}

// Helper function to update nodes with new configuration based on connections
function updateNodesWithConfig(triggerNode: LGraphNode, config: any) {
  const graph = app.graph
  if (!graph) {
    console.error('[DNNE] No graph available!')
    return
  }
  
  // Update the trigger node itself if it's an IsaacGymEnvs node
  if (triggerNode.type === 'IsaacGymEnvs' && config.isaac_gym_env) {
    updateNodeWidgets(triggerNode, config.isaac_gym_env)
  }
  
  // Find nodes connected to the output of the trigger node
  const directlyConnected = getNodesConnectedToOutput(triggerNode)
  
  for (const node of directlyConnected) {
    // Update IsaacGymSim nodes that are directly connected
    if (node.type === 'IsaacGymSim' && config.isaac_gym_sim) {
      updateNodeWidgets(node, config.isaac_gym_sim)
    }
    // Update PPOAgent nodes that are directly connected
    else if (node.type === 'PPOAgent' && config.ppo_agent) {
      updateNodeWidgets(node, config.ppo_agent)
      
      // Now find the PPOConfig connected to this PPOAgent's input
      const ppoConfig = getNodeConnectedToInput(node, 'config')
      if (ppoConfig && ppoConfig.type === 'PPOConfig' && config.ppo_config) {
        updateNodeWidgets(ppoConfig, config.ppo_config)
      }
    }
  }
  
  // Mark the graph as modified
  app.graph.setDirtyCanvas(true, true)
  
  // CRITICAL: Call graph.change() to notify LiteGraph that the graph has changed
  // This ensures widget values are properly tracked for saving
  app.graph.change()
  
  // Force the ChangeTracker to update its state immediately
  // This prevents the modified indicator from disappearing when clicking on canvas
  const workflowStore = useWorkflowStore()
  const activeWorkflow = workflowStore.activeWorkflow
  if (activeWorkflow?.changeTracker) {
    activeWorkflow.changeTracker.checkState()
  }
}

// Helper function to update widget values
function updateNodeWidgets(node: LGraphNode, widgetValues: Record<string, any>) {
  if (!node.widgets) {
    return
  }
  
  // Now update widgets
  for (const widget of node.widgets) {
    // Skip if this widget doesn't have a corresponding value in the config
    if (!(widget.name in widgetValues)) continue
    
    const newValue = widgetValues[widget.name]
    const oldValue = widget.value
    
    // Update the widget value
    widget.value = newValue
    
    // Call the widget's callback if it exists (but avoid infinite loops)
    if (widget.callback && widget.name !== 'task') {
      widget.callback(newValue)
    }
    
    // Notify the node that this widget has changed
    if (node.onWidgetChanged) {
      node.onWidgetChanged.call(node, widget.name, newValue, oldValue, widget)
    }
  }
}

// Helper function to update dynamic widgets based on backend response
function updateDynamicWidgets(node: LGraphNode, updates: Record<string, any>) {
  if (!node.widgets) {
    return
  }
  
  // Apply updates to widgets
  for (const widget of node.widgets) {
    if (updates[widget.name]) {
      const update = updates[widget.name]
      
      // Update visibility
      if ('hidden' in update) {
        widget.hidden = update.hidden
        // Also update the widget's DOM element if it exists (DOM widgets have element property)
        const domWidget = widget as any
        if (domWidget.element) {
          domWidget.element.style.display = update.hidden ? 'none' : ''
        }
      }
      
      // Update label (store it in widget for later reference)
      if ('label' in update) {
        widget.label = update.label
        const domWidget = widget as any
        if (domWidget.element) {
          const labelElement = domWidget.element.querySelector('label')
          if (labelElement) {
            labelElement.textContent = update.label
          }
        }
      }
      
      // Update choices for combo widgets
      if ('choices' in update && widget.options) {
        widget.options.values = update.choices
        // Update the value to the default if current value is not in new choices
        if ('default' in update && (!widget.value || !update.choices.includes(widget.value))) {
          widget.value = update.default
        }
      }
      
      // Update tooltip
      if ('tooltip' in update) {
        const domWidget = widget as any
        if (domWidget.element) {
          domWidget.element.title = update.tooltip
        }
      }
    }
  }
}

// Helper function to update schema display widget
function updateSchemaDisplayWidget(node: LGraphNode, displayText: string) {
  if (!node.widgets) {
    return
  }
  
  // Find and update the schema_display widget
  const schemaWidget = node.widgets.find(w => w.name === 'schema_display')
  if (schemaWidget) {
    schemaWidget.value = displayText
    // Trigger a redraw
    app.graph.setDirtyCanvas(true, true)
  }
}

export const useDNNEComboWidget = () => {
  const widgetConstructor: ComfyWidgetConstructorV2 = (
    node: LGraphNode,
    inputSpec: InputSpec
  ) => {
    // Try multiple ways to identify the node type
    const nodeType = node.type || (node as any).comfyClass || (node.constructor as any).type || ''
    // Also check the constructor name as a fallback
    const constructorName = node.constructor?.name || ''
    
    if (!isComboInputSpec(inputSpec)) {
      throw new Error(`Invalid input data: ${inputSpec}`)
    }
    
    // Use DNNE combo widget for task selection on IsaacGymEnvs nodes
    // Check multiple ways to identify the node
    const isIsaacGymEnvsNode = nodeType === 'IsaacGymEnvs' || 
                               constructorName === 'IsaacGymEnvs' ||
                               (node.title && node.title.includes('Isaac Gym'))
    const isDNNETaskWidget = inputSpec.name === 'task' && isIsaacGymEnvsNode
    
    const result = inputSpec.multi_select
      ? addMultiSelectWidget(node, inputSpec)
      : isDNNETaskWidget
        ? addDNNEComboWidget(node, inputSpec)
        : addComboWidget(node, inputSpec)
        
    return result
  }

  return widgetConstructor
}

// Helper to add regular combo widget (fallback)
const addComboWidget = (node: LGraphNode, inputSpec: ComboInputSpec) => {
  const defaultValue = getDefaultValue(inputSpec)
  const comboOptions = inputSpec.options ?? []
  const widget = node.addWidget(
    'combo',
    inputSpec.name,
    defaultValue,
    () => {},
    {
      values: comboOptions
    }
  ) as IComboWidget

  if (inputSpec.remote) {
    const remoteWidget = useRemoteWidget({
      remoteConfig: inputSpec.remote,
      defaultValue,
      node,
      widget
    })
    if (inputSpec.remote.refresh_button) remoteWidget.addRefreshButton()

    const origOptions = widget.options
    widget.options = new Proxy(origOptions, {
      get(target, prop) {
        return prop !== 'values'
          ? target[prop as keyof typeof target]
          : remoteWidget.getValue()
      }
    })
  }

  // No special handling for seed_control - it's just a regular dropdown

  return widget
}