<template>
  <Dialog
    v-model:visible="visible"
    :modal="false"
    :dismissable="true"
    :closable="true"
    :draggable="true"
    :resizable="true"
    class="dnne-log-viewer-dialog"
    :style="{ width: '900px', height: '600px' }"
  >
    <template #header>
      <div class="flex items-center justify-between w-full">
        <span class="font-semibold flex items-center gap-1">
          <span :class="['status-indicator', { 'running': isWorkflowRunning, 'disconnected': !isConnected }]"></span>
          Remote Logs
        </span>
        <div class="flex items-center gap-2 ml-4">
          <!-- Client Dropdown -->
          <label class="text-sm">Client:</label>
          <Dropdown
            v-model="selectedClientId"
            :options="remoteClients"
            optionLabel="display"
            optionValue="id"
            class="log-client-dropdown"
            placeholder="Select client"
            @change="onClientChange"
          />
          
          <!-- Log Type Dropdown -->
          <label class="text-sm ml-4">Type:</label>
          <Dropdown
            v-model="selectedLogType"
            :options="logTypes"
            optionLabel="label"
            optionValue="value"
            class="log-type-dropdown"
            placeholder="Select type"
            @change="onLogTypeChange"
          />
          
          <!-- Auto-scroll checkbox -->
          <div class="flex items-center ml-4">
            <Checkbox
              v-model="autoScroll"
              inputId="auto-scroll"
              binary
            />
            <label for="auto-scroll" class="ml-2 text-sm">Auto-scroll</label>
          </div>
        </div>
      </div>
    </template>
    
    <div class="log-container h-full">
      <pre
        ref="logPre"
        class="log-text"
        @scroll="onScroll"
      >{{ logContent }}</pre>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import Checkbox from 'primevue/checkbox'
import { useAgentStore } from '@/stores/agentStore'
import { api } from '@/scripts/api'
import type { WorkflowLogWsMessage, WorkflowStatusWsMessage } from '@/schemas/apiSchema'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const agentStore = useAgentStore()

// Reactive state
const selectedClientId = ref<string>('')
const selectedLogType = ref<string>('execution')
const logContent = ref<string>('')
const autoScroll = ref(true)
const logPre = ref<HTMLPreElement | null>(null)
const userScrolling = ref(false)
const isWorkflowRunning = ref(false)

// NEW: Buffering and sequence tracking
const pendingLogs = ref<Map<string, WorkflowLogWsMessage[]>>(new Map()) // Buffer per workflow
const historyReceived = ref<Set<string>>(new Set()) // Track which workflows received history
const lastSequences = ref<Map<string, number>>(new Map()) // Last sequence per workflow

// Telemetry content storage
const telemetryViolationsContent = ref<string>('')
const telemetryDataContent = ref<string>('')
const telemetryPollInterval = ref<number | null>(null)
// Track if we're actively listening to execution logs
const listeningToExecutionLogs = ref(true)

// Connection status - check if agent is connected
const isConnected = computed(() => agentStore.isConnected)

// Log types
const logTypes = [
  { label: 'Run Logs', value: 'execution' },
  { label: 'Telemetry Violations', value: 'telemetry_violations' },
  { label: 'Telemetry Data', value: 'telemetry_data' }
]

// Get remote clients with display property for dropdown
const remoteClients = computed(() => 
  Array.from(agentStore.clients.values())
    .filter(c => c.id !== 'local')
    .map(c => ({
      ...c,
      display: c.hostname  // Add display property for dropdown
    }))
)

// Dialog visibility
const visible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value)
})

// Initialize client selection
watch(remoteClients, (clients) => {
  if (clients.length > 0 && !selectedClientId.value) {
    selectedClientId.value = clients[0].id
  }
}, { immediate: true })

// Handle WebSocket workflow log messages
const handleWorkflowLog = (event: CustomEvent<WorkflowLogWsMessage>) => {
  const data = event.detail
  const workflowId = data.workflow_id
  const sequence = data.log.sequence
  
  // Sequence number is required - fail fast if missing
  if (sequence === undefined) {
    console.error(`[DNNELogViewer] Missing sequence number in log message for workflow ${workflowId}`)
    throw new Error(`Log message missing required sequence number for workflow ${workflowId}`)
  }
  
  // Check if we've received history for this workflow
  if (!historyReceived.value.has(workflowId)) {
    // Buffer the log until history arrives
    if (!pendingLogs.value.has(workflowId)) {
      pendingLogs.value.set(workflowId, [])
    }
    pendingLogs.value.get(workflowId)!.push(data)
  } else {
    // History received - we MUST have a last sequence
    const lastSeq = lastSequences.value.get(workflowId)
    if (lastSeq === undefined) {
      // This should never happen - fail fast!
      console.error(`[DNNELogViewer] No last sequence for workflow ${workflowId} even though history was received!`)
      throw new Error(`Missing sequence tracking for workflow ${workflowId}`)
    }
    
    if (sequence > lastSeq) {
      // New log entry - add it
      appendLogToDisplay(data)
      lastSequences.value.set(workflowId, sequence)
    }
    // else: Skip duplicate (already in history) - this is expected
  }
}

// Handle WebSocket workflow status messages
const handleWorkflowStatus = (event: CustomEvent<WorkflowStatusWsMessage>) => {
  const data = event.detail
  
  // Update running status - deployed or running means active
  if (data.status === 'deployed' || data.status === 'running') {
    isWorkflowRunning.value = true
    
    // Clear existing logs when a new workflow starts
    logContent.value = ''
    historyReceived.value.clear()
    lastSequences.value.clear()
    pendingLogs.value.clear()
    
    // Request historical logs for this workflow
    requestWorkflowLogs(data.workflow_id)
  } else if (data.status === 'completed' || data.status === 'failed' || data.status === 'stopped') {
    isWorkflowRunning.value = false
  }
}

// Handle historical log response
const handleWorkflowLogHistory = (event: CustomEvent) => {
  const { workflow_id, logs, last_sequence } = event.detail
  
  // Mark that we received history for this workflow
  historyReceived.value.add(workflow_id)
  lastSequences.value.set(workflow_id, last_sequence)
  
  // Display the historical logs (pass isActive based on current workflow state)
  displayHistoricalLogs(logs, isWorkflowRunning.value)
  
  // Apply buffered logs that are newer than history
  const buffered = pendingLogs.value.get(workflow_id) || []
  const newLogs = buffered
    .filter(log => {
      // Sequence must exist if we got this far
      if (log.log.sequence === undefined) {
        throw new Error(`Buffered log missing sequence for workflow ${workflow_id}`)
      }
      return log.log.sequence > last_sequence
    })
    .sort((a, b) => {
      // Sequences must exist if we got this far
      if (a.log.sequence === undefined || b.log.sequence === undefined) {
        throw new Error(`Buffered logs missing sequences for workflow ${workflow_id}`)
      }
      return a.log.sequence - b.log.sequence
    }) // Ensure correct order
  
  newLogs.forEach(log => appendLogToDisplay(log))
  
  // Clear buffer for this workflow
  pendingLogs.value.delete(workflow_id)
}

// Request historical logs via WebSocket
const requestWorkflowLogs = (workflowId: string) => {
  // Send request through WebSocket
  if (api.socket && api.socket.readyState === WebSocket.OPEN) {
    api.socket.send(JSON.stringify({
      type: 'request_logs',
      workflow_id: workflowId
    }))
  }
}

// Display historical logs
const displayHistoricalLogs = (logs: string, isActive: boolean = true) => {
  // Add warning header if this is a completed/stopped workflow
  if (!isActive) {
    // Extract the stopped timestamp if available
    const stoppedMatch = logs.match(/# Stopped: (.+)/)
    const stoppedTime = stoppedMatch ? stoppedMatch[1] : 'unknown time'
    
    const warningHeader = `${'='.repeat(60)}\nWARNING - Historical log - workflow ended at ${stoppedTime}\n${'='.repeat(60)}\n\n`
    
    // Add warning header before the logs
    logContent.value = warningHeader + logs
  } else {
    // Active workflow - display logs as-is
    logContent.value = logs
  }
  
  // Auto-scroll to bottom if enabled
  if (autoScroll.value && logPre.value) {
    nextTick(() => {
      if (logPre.value) {
        logPre.value.scrollTop = logPre.value.scrollHeight
      }
    })
  }
}

// Append new log to display
const appendLogToDisplay = (logMsg: WorkflowLogWsMessage) => {
  try {
    // Handle different timestamp formats
    let timestamp: string
    if (typeof logMsg.log.timestamp === 'string') {
      // ISO string format (new format from updated client)
      timestamp = new Date(logMsg.log.timestamp).toISOString()
    } else if (typeof logMsg.log.timestamp === 'number') {
      // Unix timestamp in seconds (old format)
      timestamp = new Date(logMsg.log.timestamp * 1000).toISOString()
    } else {
      // Missing timestamp - this is an error
      throw new Error(`Missing or invalid timestamp: ${logMsg.log.timestamp}`)
    }
    
    const level = logMsg.log.level.toUpperCase()
    const message = logMsg.log.message
    
    const logLine = `[${timestamp}] [${level}] ${message}\n`
    logContent.value += logLine
    
    // Auto-scroll if enabled
    if (autoScroll.value && !userScrolling.value && logPre.value) {
      nextTick(() => {
        if (logPre.value) {
          logPre.value.scrollTop = logPre.value.scrollHeight
        }
      })
    }
  } catch (error) {
    // Log error to console but still throw it (fail-fast as requested)
    console.error('[DNNELogViewer] Error processing log message:', error)
    throw error
  }
}

// Telemetry methods
const requestTelemetryLogs = (telemetryType: 'violations' | 'data') => {
  if (api.socket && api.socket.readyState === WebSocket.OPEN) {
    const clientWorkflows = agentStore.getClientWorkflows(selectedClientId.value)
    if (clientWorkflows.length > 0) {
      api.socket.send(JSON.stringify({
        type: 'request_telemetry',
        workflow_id: clientWorkflows[0].id,
        client_id: selectedClientId.value,
        telemetry_type: telemetryType
      }))
    }
  }
}

const startTelemetryPolling = (telemetryType: 'violations' | 'data') => {
  requestTelemetryLogs(telemetryType)
  telemetryPollInterval.value = window.setInterval(() => {
    if (isWorkflowRunning.value) {
      requestTelemetryLogs(telemetryType)
    }
  }, 5000)
}

const stopTelemetryPolling = () => {
  if (telemetryPollInterval.value) {
    clearInterval(telemetryPollInterval.value)
    telemetryPollInterval.value = null
  }
}

const handleTelemetryHistory = (event: CustomEvent) => {
  // Server sends data wrapped in a 'data' field
  const data = event.detail.data || event.detail
  const { telemetry_type, content } = data
  
  if (telemetry_type === 'violations') {
    telemetryViolationsContent.value = content
    if (selectedLogType.value === 'telemetry_violations') {
      logContent.value = content
    }
  } else if (telemetry_type === 'data') {
    telemetryDataContent.value = content
    if (selectedLogType.value === 'telemetry_data') {
      logContent.value = content
    }
  }
}

// Handle client change
const onClientChange = () => {
  // Clear all content
  logContent.value = ''
  telemetryViolationsContent.value = ''
  telemetryDataContent.value = ''
  historyReceived.value.clear()
  lastSequences.value.clear()
  pendingLogs.value.clear()
  
  // Stop any telemetry polling
  stopTelemetryPolling()
  
  // Trigger appropriate refresh based on current view
  onLogTypeChange()
}

// Handle log type change
const onLogTypeChange = () => {
  // Stop any existing polling
  stopTelemetryPolling()
  
  if (selectedLogType.value === 'execution') {
    // Clear current content and request fresh from server
    logContent.value = ''
    historyReceived.value.clear()
    lastSequences.value.clear()
    pendingLogs.value.clear()
    
    // Start listening to execution logs if not already
    if (!listeningToExecutionLogs.value) {
      api.addEventListener('workflow_log', handleWorkflowLog as any)
      listeningToExecutionLogs.value = true
    }
    
    // Request fresh logs from server
    const clientWorkflows = agentStore.getClientWorkflows(selectedClientId.value)
    if (clientWorkflows.length > 0) {
      clientWorkflows.forEach(wf => {
        requestWorkflowLogs(wf.id)
      })
      isWorkflowRunning.value = true
    } else {
      // Request latest historical logs
      if (api.socket && api.socket.readyState === WebSocket.OPEN) {
        api.socket.send(JSON.stringify({
          type: 'request_logs',
          workflow_id: null,
          client_id: selectedClientId.value
        }))
      }
      isWorkflowRunning.value = false
    }
  } else if (selectedLogType.value === 'telemetry_violations') {
    // Stop listening to execution logs
    if (listeningToExecutionLogs.value) {
      api.removeEventListener('workflow_log', handleWorkflowLog as any)
      listeningToExecutionLogs.value = false
    }
    
    // Show violations and start polling
    logContent.value = telemetryViolationsContent.value
    startTelemetryPolling('violations')
  } else if (selectedLogType.value === 'telemetry_data') {
    // Stop listening to execution logs
    if (listeningToExecutionLogs.value) {
      api.removeEventListener('workflow_log', handleWorkflowLog as any)
      listeningToExecutionLogs.value = false
    }
    
    // Show data and start polling
    logContent.value = telemetryDataContent.value
    startTelemetryPolling('data')
  }
}

// Handle manual scrolling
const onScroll = () => {
  if (!logPre.value) return
  
  // Check if user scrolled away from bottom
  const atBottom = Math.abs(logPre.value.scrollHeight - logPre.value.scrollTop - logPre.value.clientHeight) < 10
  
  if (!atBottom && autoScroll.value) {
    // User manually scrolled up, disable auto-scroll temporarily
    userScrolling.value = true
    autoScroll.value = false
  } else if (atBottom && !autoScroll.value) {
    // User scrolled back to bottom, re-enable auto-scroll
    userScrolling.value = false
    autoScroll.value = true
  }
}

// Watch auto-scroll checkbox changes
watch(autoScroll, (enabled) => {
  if (enabled) {
    userScrolling.value = false
    // Scroll to bottom when auto-scroll is enabled
    if (logPre.value) {
      nextTick(() => {
        if (logPre.value) {
          logPre.value.scrollTop = logPre.value.scrollHeight
        }
      })
    }
  }
})

// Setup WebSocket listeners when dialog opens
watch(visible, (isVisible) => {
  if (isVisible) {
    // Always default to Run Logs when opening
    selectedLogType.value = 'execution'
    
    // Reset state
    historyReceived.value.clear()
    lastSequences.value.clear()
    pendingLogs.value.clear()
    
    // Start listening for all events
    api.addEventListener('workflow_log', handleWorkflowLog as any)
    api.addEventListener('workflow_status', handleWorkflowStatus as any)
    api.addEventListener('workflow_log_history', handleWorkflowLogHistory as any)
    api.addEventListener('telemetry_history', handleTelemetryHistory as any)
    
    // Request logs for currently active workflows or latest historical logs
    if (selectedClientId.value) {
      const clientWorkflows = agentStore.getClientWorkflows(selectedClientId.value)
      if (clientWorkflows.length > 0) {
        // Request logs for each active workflow
        clientWorkflows.forEach(wf => {
          requestWorkflowLogs(wf.id)
        })
        isWorkflowRunning.value = true
      } else {
        // No active workflows - request latest historical logs
        if (api.socket && api.socket.readyState === WebSocket.OPEN) {
          api.socket.send(JSON.stringify({
            type: 'request_logs',
            workflow_id: null,
            client_id: selectedClientId.value
          }))
        }
        isWorkflowRunning.value = false
      }
    }
  } else {
    // Stop listening when dialog closes
    api.removeEventListener('workflow_log', handleWorkflowLog as any)
    api.removeEventListener('workflow_status', handleWorkflowStatus as any)
    api.removeEventListener('workflow_log_history', handleWorkflowLogHistory as any)
    api.removeEventListener('telemetry_history', handleTelemetryHistory as any)
    stopTelemetryPolling()
  }
})

// Cleanup on unmount
onUnmounted(() => {
  api.removeEventListener('workflow_log', handleWorkflowLog as any)
  api.removeEventListener('workflow_status', handleWorkflowStatus as any)
  api.removeEventListener('workflow_log_history', handleWorkflowLogHistory as any)
  api.removeEventListener('telemetry_history', handleTelemetryHistory as any)
  stopTelemetryPolling()
})
</script>

<style scoped>
.dnne-log-viewer-dialog :deep(.p-dialog-content) {
  padding: 0;
  height: calc(100% - 60px);
  overflow: hidden;
}

.log-container {
  height: 100%;
  overflow: hidden;
  background: #1a1a1a;
  border-radius: 4px;
  padding: 8px;
}

.log-text {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: auto;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.4;
  color: #e0e0e0;
  background: transparent;
  margin: 0;
  padding: 8px;
  white-space: pre;
}

.log-client-dropdown {
  width: 180px;
}

.log-type-dropdown {
  width: 180px;
}

.status-indicator {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: #4CAF50;
  margin-right: 4px;
}

.status-indicator.disconnected {
  background-color: #f44336;
  animation: none;
}

.status-indicator.running:not(.disconnected) {
  animation: blink 0.75s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.1;
  }
}

/* Custom scrollbar */
.log-text::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.log-text::-webkit-scrollbar-track {
  background: #2a2a2a;
  border-radius: 4px;
}

.log-text::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 4px;
}

.log-text::-webkit-scrollbar-thumb:hover {
  background: #666;
}
</style>