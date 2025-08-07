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
          <span :class="['status-indicator', { 'running': isWorkflowRunning, 'disconnected': !isConnected }]">●</span>
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
const workflowLogs = ref<Map<string, string[]>>(new Map())

// Connection status - check if agent is connected
const isConnected = computed(() => agentStore.isConnected)

// Log types
const logTypes = [
  { label: 'Execution', value: 'execution' },
  { label: 'Telemetry', value: 'telemetry' }
]

// Get remote clients
const remoteClients = computed(() => 
  Array.from(agentStore.clients.values()).filter(c => c.id !== 'local')
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
  
  // Only process logs for the selected client's workflows
  // TODO: Need to track which workflow belongs to which client
  if (!workflowLogs.value.has(data.workflow_id)) {
    workflowLogs.value.set(data.workflow_id, [])
  }
  
  const logs = workflowLogs.value.get(data.workflow_id)!
  const logMessage = `[${new Date(data.log.timestamp * 1000).toISOString()}] [${data.log.level.toUpperCase()}] ${data.log.message}`
  logs.push(logMessage)
  
  // Update displayed logs if this is for the current client
  updateDisplayedLogs()
  
  // Auto-scroll if enabled and not user scrolling
  if (autoScroll.value && !userScrolling.value && logPre.value) {
    nextTick(() => {
      if (logPre.value) {
        logPre.value.scrollTop = logPre.value.scrollHeight
      }
    })
  }
}

// Handle WebSocket workflow status messages
const handleWorkflowStatus = (event: CustomEvent<WorkflowStatusWsMessage>) => {
  const data = event.detail
  
  // Update running status
  if (data.status === 'running') {
    isWorkflowRunning.value = true
    
    // Start a new log section for this workflow
    if (!workflowLogs.value.has(data.workflow_id)) {
      workflowLogs.value.set(data.workflow_id, [
        `=== ${data.workflow_name || 'Workflow'} (${data.workflow_id}) ===`,
        `Status: ${data.status}`,
        `Started: ${new Date().toISOString()}`,
        '=' .repeat(50)
      ])
    }
  } else if (data.status === 'completed' || data.status === 'failed' || data.status === 'stopped') {
    isWorkflowRunning.value = false
    
    // Add completion message
    const logs = workflowLogs.value.get(data.workflow_id)
    if (logs) {
      logs.push('=' .repeat(50))
      logs.push(`Status: ${data.status}`)
      logs.push(`Ended: ${new Date().toISOString()}`)
    }
  }
  
  updateDisplayedLogs()
}

// Update displayed logs based on selected client and type
const updateDisplayedLogs = () => {
  // For now, show all logs since we don't have client-workflow mapping yet
  // TODO: Filter by client when we have proper client-workflow tracking
  const allLogs: string[] = []
  workflowLogs.value.forEach((logs) => {
    allLogs.push(...logs)
  })
  logContent.value = allLogs.join('\n')
}

// Handle client change
const onClientChange = () => {
  // Clear logs when switching clients
  logContent.value = ''
  workflowLogs.value.clear()
  isWorkflowRunning.value = false
}

// Handle log type change
const onLogTypeChange = () => {
  // For now, we only show execution logs via WebSocket
  // Telemetry would need separate handling
  if (selectedLogType.value === 'telemetry') {
    logContent.value = 'Telemetry logs not yet implemented for WebSocket streaming'
  } else {
    updateDisplayedLogs()
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
    // Listen for live log updates
    api.addEventListener('workflow_log', handleWorkflowLog as any)
    api.addEventListener('workflow_status', handleWorkflowStatus as any)
  } else {
    // Stop listening when dialog closes
    api.removeEventListener('workflow_log', handleWorkflowLog as any)
    api.removeEventListener('workflow_status', handleWorkflowStatus as any)
  }
})

// Cleanup on unmount
onUnmounted(() => {
  api.removeEventListener('workflow_log', handleWorkflowLog as any)
  api.removeEventListener('workflow_status', handleWorkflowStatus as any)
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
  width: 120px;
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
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
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