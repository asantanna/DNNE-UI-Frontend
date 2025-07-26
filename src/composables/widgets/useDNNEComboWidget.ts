import type { LGraphNode } from '@comfyorg/litegraph'
import type { IComboWidget } from '@comfyorg/litegraph/dist/types/widgets'
import { ref } from 'vue'

import MultiSelectWidget from '@/components/graph/widgets/MultiSelectWidget.vue'
import { transformInputSpecV2ToV1 } from '@/schemas/nodeDef/migration'
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
  type ComfyWidgetConstructorV2,
  addValueControlWidgets
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
      // Check if this is a task selection widget that needs to update other nodes
      if (inputSpec.name === 'task' && value !== 'none') {
        try {
          // Call the new API endpoint to get environment configuration
          const url = `/dnne/env_config/${value}`
          const response = await api.fetchApi(url)
          if (response.ok) {
            const config = await response.json()
            // Update all 3 nodes with the new configuration
            updateNodesWithConfig(node, config)
          } else {
            const errorText = await response.text()
            console.error(`[DNNE] Failed to fetch config for task ${value}: ${response.status} ${response.statusText}`, errorText)
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

  if (inputSpec.control_after_generate) {
    widget.linkedWidgets = addValueControlWidgets(
      node,
      widget,
      undefined,
      undefined,
      transformInputSpecV2ToV1(inputSpec)
    )
  }

  return widget
}

// Helper function to update all 3 nodes with new configuration
function updateNodesWithConfig(_triggerNode: LGraphNode, config: any) {
  const graph = app.graph
  if (!graph) {
    console.error('[DNNE] No graph available!')
    return
  }
  
  // Find all nodes in the graph
  const nodes = graph._nodes
  
  for (const node of nodes) {
    // Update IsaacGymEnvs node
    if (node.type === 'IsaacGymEnvs' && config.isaac_gym_env) {
      updateNodeWidgets(node, config.isaac_gym_env)
    }
    // Update PPOConfig node  
    else if (node.type === 'PPOConfig' && config.ppo_config) {
      updateNodeWidgets(node, config.ppo_config)
    }
    // Update PPOAgent node
    else if (node.type === 'PPOAgent' && config.ppo_agent) {
      updateNodeWidgets(node, config.ppo_agent)
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

  if (inputSpec.control_after_generate) {
    widget.linkedWidgets = addValueControlWidgets(
      node,
      widget,
      undefined,
      undefined,
      transformInputSpecV2ToV1(inputSpec)
    )
  }

  return widget
}