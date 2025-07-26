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
  console.log(`[DNNE] Creating DNNE combo widget for ${inputSpec.name} on node ${node.type}`)
  const defaultValue = getDefaultValue(inputSpec)
  const comboOptions = inputSpec.options ?? []
  console.log(`[DNNE] Widget options:`, comboOptions)
  
  // Create the combo widget with a callback that handles onChange
  const widget = node.addWidget(
    'combo',
    inputSpec.name,
    defaultValue,
    async (value) => {
      console.log(`[DNNE] ✅ Combo callback fired! Widget: ${inputSpec.name}, Value: ${value}, Node: ${node.type}`)
      
      // Check if this is a task selection widget that needs to update other nodes
      if (inputSpec.name === 'task' && value !== 'none') {
        console.log(`[DNNE] This is a task widget, fetching config for: ${value}`)
        try {
          // Call the new API endpoint to get environment configuration
          const url = `/dnne/env_config/${value}`
          console.log(`[DNNE] Fetching from: ${url}`)
          const response = await api.fetchApi(url)
          console.log(`[DNNE] Response status: ${response.status}`)
          if (response.ok) {
            const config = await response.json()
            console.log('[DNNE] Received environment config:', config)
            
            // Update all 3 nodes with the new configuration
            updateNodesWithConfig(node, config)
          } else {
            const errorText = await response.text()
            console.error(`[DNNE] Failed to fetch config for task ${value}: ${response.status} ${response.statusText}`, errorText)
          }
        } catch (error) {
          console.error('[DNNE] Error fetching environment config:', error)
        }
      } else {
        console.log(`[DNNE] Not a task widget or value is 'none', skipping config fetch`)
      }
    },
    {
      values: comboOptions
    }
  ) as IComboWidget
  
  console.log(`[DNNE] Widget created successfully`)

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
function updateNodesWithConfig(triggerNode: LGraphNode, config: any) {
  console.log('[DNNE] updateNodesWithConfig called with config:', config)
  const graph = app.graph
  if (!graph) {
    console.error('[DNNE] No graph available!')
    return
  }
  
  // Find all nodes in the graph
  const nodes = graph._nodes
  console.log(`[DNNE] Found ${nodes.length} nodes in graph`)
  
  let nodesUpdated = 0
  for (const node of nodes) {
    console.log(`[DNNE] Checking node: ${node.type} (id: ${node.id})`)
    
    // Update IsaacGymEnvs node
    if (node.type === 'IsaacGymEnvs' && config.isaac_gym_env) {
      console.log('[DNNE] Updating IsaacGymEnvs node widgets')
      updateNodeWidgets(node, config.isaac_gym_env)
      nodesUpdated++
    }
    // Update PPOConfig node  
    else if (node.type === 'PPOConfig' && config.ppo_config) {
      console.log('[DNNE] Updating PPOConfig node widgets')
      updateNodeWidgets(node, config.ppo_config)
      nodesUpdated++
    }
    // Update PPOAgent node
    else if (node.type === 'PPOAgent' && config.ppo_agent) {
      console.log('[DNNE] Updating PPOAgent node widgets')
      updateNodeWidgets(node, config.ppo_agent)
      nodesUpdated++
    }
  }
  
  console.log(`[DNNE] Updated ${nodesUpdated} nodes`)
  
  // Mark the graph as modified
  app.graph.setDirtyCanvas(true, true)
}

// Helper function to update widget values
function updateNodeWidgets(node: LGraphNode, widgetValues: Record<string, any>) {
  if (!node.widgets) return
  
  for (const widget of node.widgets) {
    // Skip if this widget doesn't have a corresponding value in the config
    if (!(widget.name in widgetValues)) continue
    
    const newValue = widgetValues[widget.name]
    
    // Update the widget value
    widget.value = newValue
    
    // Call the widget's callback if it exists (but avoid infinite loops)
    if (widget.callback && widget.name !== 'task') {
      widget.callback(newValue)
    }
    
    console.log(`[DNNE] Updated ${node.type}.${widget.name} = ${newValue}`)
  }
}

export const useDNNEComboWidget = () => {
  const widgetConstructor: ComfyWidgetConstructorV2 = (
    node: LGraphNode,
    inputSpec: InputSpec
  ) => {
    console.log(`[DNNE] useDNNEComboWidget called for node ${node.type}, widget ${inputSpec.name}`)
    
    if (!isComboInputSpec(inputSpec)) {
      throw new Error(`Invalid input data: ${inputSpec}`)
    }
    
    // Use DNNE combo widget for task selection, regular combo for others
    const isDNNETaskWidget = inputSpec.name === 'task' && node.type === 'IsaacGymEnvs'
    console.log(`[DNNE] Is DNNE task widget? ${isDNNETaskWidget} (name=${inputSpec.name}, type=${node.type})`)
    
    const result = inputSpec.multi_select
      ? addMultiSelectWidget(node, inputSpec)
      : isDNNETaskWidget
        ? addDNNEComboWidget(node, inputSpec)
        : addComboWidget(node, inputSpec)
        
    console.log(`[DNNE] Widget type created: ${inputSpec.multi_select ? 'MultiSelect' : (isDNNETaskWidget ? 'DNNECombo' : 'RegularCombo')}`)
    return result
  }

  return widgetConstructor
}

// Helper to add regular combo widget (fallback)
const addComboWidget = (node: LGraphNode, inputSpec: ComboInputSpec) => {
  console.log(`[DNNE] Creating REGULAR combo widget for ${inputSpec.name} on node ${node.type}`)
  const defaultValue = getDefaultValue(inputSpec)
  const comboOptions = inputSpec.options ?? []
  const widget = node.addWidget(
    'combo',
    inputSpec.name,
    defaultValue,
    (value) => {
      console.log(`[DNNE] Regular combo callback for ${inputSpec.name}: ${value}`)
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