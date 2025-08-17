import type { LGraphNode } from '@comfyorg/litegraph'
import type { IComboWidget } from '@comfyorg/litegraph/dist/types/widgets'

import {
  type InputSpec
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import {
  type ComfyWidgetConstructorV2
} from '@/scripts/widgets'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

/**
 * Generic DNNE Combo Widget with WebSocket callback support
 * 
 * This widget allows backend nodes to respond to UI events through
 * WebSocket messages. It replaces node-specific hardcoding with a
 * clean, extensible protocol.
 * 
 * Widget specification in INPUT_TYPES:
 * "my_param": (["option1", "option2"], {
 *     "widgetType": "DNNE_COMBO",
 *     "widget_id": "MyNode.my_param",
 *     "listen_to": ["onChange", "onLoad"]
 * })
 */

interface WidgetCallbackMessage {
  type: 'widget_callback'
  widget_id: string
  event: string
  event_params: Record<string, any>
}

interface WidgetCallbackResponse {
  type: 'widget_callback_response'
  widget_id: string
  code_payload?: string
  chain?: boolean
}

// Track pending callbacks to match responses
const pendingCallbacks = new Map<string, (response: WidgetCallbackResponse) => void>()

// Listen for widget callback responses via API events
api.addEventListener('widget_callback_response', (event: CustomEvent) => {
  const response = event.detail as WidgetCallbackResponse
  // console.log('[DNNE Widget] Received callback response:', response.widget_id)
  const callback = pendingCallbacks.get(response.widget_id)
  if (callback) {
    callback(response)
    pendingCallbacks.delete(response.widget_id)
  }
})

/**
 * Send a widget callback message and optionally wait for response
 */
async function sendWidgetCallback(
  widgetId: string,
  event: string,
  eventParams: Record<string, any>,
  waitForResponse: boolean = true
): Promise<WidgetCallbackResponse | null> {
  const message: WidgetCallbackMessage = {
    type: 'widget_callback',
    widget_id: widgetId,
    event,
    event_params: eventParams
  }

  // console.log('[DNNE Widget] Sending callback:', widgetId, event, eventParams)

  // Send the message
  if (api.socket) {
    api.socket.send(JSON.stringify(message))
  } else {
    console.error('[DNNE Widget] No WebSocket connection available')
  }

  if (!waitForResponse) {
    return null
  }

  // Wait for response with timeout
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingCallbacks.delete(widgetId)
      resolve(null)
    }, 5000) // 5 second timeout

    pendingCallbacks.set(widgetId, (response) => {
      clearTimeout(timeout)
      resolve(response)
    })
  })
}

/**
 * Execute JavaScript code from backend response
 * This is isolated to make it easier to add security measures later
 */
function executeCodePayload(code: string, context: any) {
  try {
    // Create a function with the code and call it with the context
    // This avoids variable name conflicts and provides a clean scope
    const executor = new Function('widget', 'node', 'app', 'api', code)
    executor.call(null, context.widget, context.node, context.app, context.api)
  } catch (error) {
    console.error('Error executing widget callback code:', error)
    console.error('Code that failed:', code)
  }
}

/**
 * Create the DNNE combo widget factory
 */
export function useDnneComboWidget(): ComfyWidgetConstructorV2 {
  return (node: LGraphNode, inputSpec: InputSpec): IComboWidget => {
    // Get widget configuration from inputSpec - use any type for custom properties
    const spec = inputSpec as any
    const widgetId = spec.widget_id || `${(node.constructor as any).nodeData?.name || node.type}.${inputSpec.name}`
    const listenTo = spec.listen_to || []
    const options = (inputSpec.options || []) as (string | number)[]
    const defaultValue = String(options[0] || '')

    // Create the combo widget with proper typing
    const widget = node.addWidget(
      'combo',
      inputSpec.name,
      defaultValue,
      function(this: IComboWidget, value: string) {
        // onChange handler
        if (listenTo.includes('onChange')) {
          const oldValue = this.value
          
          // Collect all widget values from the node for backend context
          const nodeData: Record<string, any> = {}
          if (node.widgets) {
            for (const widget of node.widgets) {
              nodeData[widget.name] = widget.value
            }
          }
          
          // Send callback to backend
          sendWidgetCallback(
            widgetId,
            'onChange',
            {
              value,
              oldValue,
              node_id: node.id,
              node_data: nodeData
            }
          ).then(response => {
            // Execute response code if provided
            if (response?.code_payload) {
              executeCodePayload(response.code_payload, {
                widget: this,
                node,
                app,
                api
              })
            }
            
            // Chain to base implementation if requested
            if (response?.chain !== false) {
              // Update widget value
              this.value = value
              
              // Mark node as needing update
              if ((node as any).onWidgetChanged) {
                (node as any).onWidgetChanged(inputSpec.name, value, oldValue)
              }
            }
          })
        } else {
          // No callback, just update normally
          this.value = value
          if ((node as any).onWidgetChanged) {
            (node as any).onWidgetChanged(inputSpec.name, value, this.value)
          }
        }
      },
      {
        values: options.map(v => String(v))
      }
    ) as IComboWidget

    // Store widget reference for callback access
    widget.name = inputSpec.name
    
    // Send onLoad callback if configured
    if (listenTo.includes('onLoad')) {
      // Use setTimeout to ensure widget is fully initialized
      setTimeout(async () => {
        // Collect all widget values for backend context
        const nodeData: Record<string, any> = {}
        if (node.widgets) {
          for (const w of node.widgets) {
            nodeData[w.name] = w.value
          }
        }
        
        const response = await sendWidgetCallback(
          widgetId,
          'onLoad',
          {
            node_id: node.id,
            initial_value: widget.value,
            node_data: nodeData
          }
        )
        
        // Execute initialization code
        if (response?.code_payload) {
          executeCodePayload(response.code_payload, {
            widget,
            node,
            app,
            api
          })
        }
      }, 0)
    }
    
    // Add serialization support (cast to any to bypass type restrictions)
    (widget as any).serialize = function() {
      return this.value
    }
    
    // Type annotations
    widget.type = 'combo'
    widget.options = { values: options.map((v: string | number) => String(v)) }  // Ensure all values are strings
    
    return widget
  }
}