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
            :disabled="loading"
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
            :disabled="loading"
          />
          
          <!-- Auto-scroll checkbox -->
          <div class="flex items-center ml-4">
            <Checkbox
              v-model="autoScroll"
              inputId="auto-scroll"
              binary
            />
            <label for="auto-scroll" class="ml-1 text-sm">Auto-scroll</label>
          </div>
        </div>
      </div>
    </template>

    <div class="log-viewer-content">
      <div v-if="loading" class="flex items-center justify-center h-full">
        <ProgressSpinner />
      </div>
      <div v-else-if="error" class="error-message p-4 text-center">
        <i class="pi pi-exclamation-triangle mr-2"></i>
        {{ error }}
      </div>
      <div v-else-if="!selectedClientId" class="info-message p-4 text-center">
        <i class="pi pi-info-circle mr-2"></i>
        Please select a remote client to view logs
      </div>
      <div v-else-if="!logContent" class="info-message p-4 text-center">
        <i class="pi pi-info-circle mr-2"></i>
        No logs available for the selected client and type
      </div>
      <pre v-else ref="logPre" class="log-text" @scroll="onScroll">{{ logContent }}</pre>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import Checkbox from 'primevue/checkbox'
import ProgressSpinner from 'primevue/progressspinner'
import { useAgentStore } from '@/stores/agentStore'
// import { api } from '@/scripts/api' // TODO: Enable when workflow_log WebSocket support is added

const props = defineProps<{
  modelValue: boolean
  initialTarget?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const agentStore = useAgentStore()

// Dialog visibility
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// State
const selectedClientId = ref<string>('')
const selectedLogType = ref<string>('execution')
const logContent = ref<string>('')
const loading = ref(false)
const error = ref<string | null>(null)
const autoScroll = ref(false)  // Default to false, will be set based on workflow state
const logPre = ref<HTMLPreElement | null>(null)
const userScrolling = ref(false)
const isWorkflowRunning = ref(false)

// Connection status - check if agent is connected
const isConnected = computed(() => agentStore.isConnected)

// Log types
const logTypes = [
  { value: 'execution', label: 'Execution' },
  { value: 'telemetry', label: 'Telemetry' }
]

// Compute remote clients only (exclude local)
const remoteClients = computed(() => {
  return agentStore.clientList.map(client => ({
    id: client.id,
    display: client.hostname || 'Unknown'
  }))
})

// Fetch logs for the selected client and type
const fetchLogs = async () => {
  if (!selectedClientId.value) {
    logContent.value = ''
    return
  }
  
  loading.value = true
  error.value = null
  
  try {
    const response = await fetch(`/api/remote/logs/${selectedClientId.value}/${selectedLogType.value}`)
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Failed to fetch logs: ${response.statusText}`)
    }
    
    const data = await response.json()
    logContent.value = data.logs || ''
    
    // Update workflow running status
    isWorkflowRunning.value = data.is_running || false
    
    // Smart auto-scroll based on workflow state
    if (!userScrolling.value) {
      if (data.is_running) {
        // Workflow is running - enable auto-scroll and scroll to bottom
        autoScroll.value = true
        if (logPre.value) {
          await nextTick()
          logPre.value.scrollTop = logPre.value.scrollHeight
        }
      } else {
        // Workflow is not running - disable auto-scroll and scroll to top
        autoScroll.value = false
        if (logPre.value) {
          await nextTick()
          logPre.value.scrollTop = 0
        }
      }
    }
  } catch (err) {
    console.error('Error fetching logs:', err)
    error.value = err instanceof Error ? err.message : 'Failed to fetch logs'
    logContent.value = ''
    isWorkflowRunning.value = false
  } finally {
    loading.value = false
  }
}

// Handle client change
const onClientChange = () => {
  fetchLogs()
}

// Handle log type change
const onLogTypeChange = () => {
  fetchLogs()
}

// Handle manual scrolling
const onScroll = () => {
  if (!logPre.value) return
  
  // Check if user scrolled away from bottom
  const atBottom = Math.abs(logPre.value.scrollHeight - logPre.value.scrollTop - logPre.value.clientHeight) < 10
  
  if (!atBottom && autoScroll.value) {
    // User manually scrolled up, temporarily disable auto-scroll
    userScrolling.value = true
  } else if (atBottom && userScrolling.value) {
    // User scrolled back to bottom, re-enable tracking
    userScrolling.value = false
  }
}

// Handle WebSocket log updates
// TODO: Add workflow_log to API schema when WebSocket support is added
// const handleWorkflowLog = (event: CustomEvent) => {
//   // Only update if we're viewing logs for this client
//   const message = event.detail
//   if (message.client_id === selectedClientId.value) {
//     // Append new log content
//     if (message.log && message.log.message) {
//       logContent.value += `\n${message.log.message}`
//       
//       // Auto-scroll if enabled and user isn't manually scrolling
//       if (autoScroll.value && !userScrolling.value && logPre.value) {
//         nextTick(() => {
//           if (logPre.value) {
//             logPre.value.scrollTop = logPre.value.scrollHeight
//           }
//         })
//       }
//     }
//   }
// }

// Set initial client when dialog opens
watch(visible, (newVal) => {
  if (newVal) {
    // If initial target provided and it's not 'local', use it
    if (props.initialTarget && props.initialTarget !== 'local') {
      selectedClientId.value = props.initialTarget
    } else if (remoteClients.value.length > 0) {
      // Otherwise select first remote client if available
      selectedClientId.value = remoteClients.value[0].id
    }
    
    // Fetch logs if we have a client selected
    if (selectedClientId.value) {
      fetchLogs()
    }
    
    // Listen for live log updates
    // TODO: Enable when workflow_log is added to API schema
    // api.addEventListener('workflow_log', handleWorkflowLog as any)
  } else {
    // Stop listening when dialog closes
    // TODO: Enable when workflow_log is added to API schema
    // api.removeEventListener('workflow_log', handleWorkflowLog as any)
  }
})

// Cleanup on unmount
onUnmounted(() => {
  // TODO: Enable when workflow_log is added to API schema
  // api.removeEventListener('workflow_log', handleWorkflowLog as any)
})
</script>

<style scoped>
.dnne-log-viewer-dialog :deep(.p-dialog-content) {
  padding: 0;
  height: calc(100% - 4rem);
  overflow: hidden;
}

.log-viewer-content {
  height: 100%;
  overflow: auto;
  background: var(--p-surface-ground);
}

.log-text {
  margin: 0;
  padding: 1rem;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: var(--p-text-color);
  background: var(--p-surface-50);
  min-height: 100%;
  overflow-y: auto;
  max-height: 100%;
}

.dark-theme .log-text {
  background: var(--p-surface-900);
  color: var(--p-text-color);
}

.log-client-dropdown {
  min-width: 150px;
}

.log-type-dropdown {
  min-width: 120px;
}

.error-message {
  color: var(--p-error-color);
}

.info-message {
  color: var(--p-text-muted-color);
}

.dnne-log-viewer-dialog {
  /* Ensure dialog appears above other UI elements */
  z-index: 2000;
}

.status-indicator {
  color: #4ade80; /* Green - connected */
  font-size: 1.2em;
  transition: opacity 0.3s ease;
}

.status-indicator.disconnected {
  color: #ef4444; /* Red - disconnected */
  animation: none;
}

.status-indicator.running:not(.disconnected) {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
</style>