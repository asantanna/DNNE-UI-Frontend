<template>
  <Dialog
    v-model:visible="visible"
    :modal="false"
    :dismissable="true"
    :closable="true"
    :draggable="true"
    :resizable="true"
    class="log-viewer-dialog"
    :style="{ width: '800px', height: '600px' }"
  >
    <template #header>
      <div class="flex items-center justify-between w-full">
        <span class="font-semibold">Workflow Logs</span>
        <div class="flex items-center gap-2 ml-4">
          <label class="text-sm">Target:</label>
          <Dropdown
            v-model="selectedTargetId"
            :options="targetOptions"
            optionLabel="display"
            optionValue="id"
            class="log-target-dropdown"
            placeholder="Select target"
            @change="onTargetChange"
          />
          <Button
            icon="pi pi-refresh"
            severity="secondary"
            text
            rounded
            v-tooltip="'Refresh logs'"
            @click="fetchLogs"
          />
        </div>
      </div>
    </template>

    <div class="log-viewer-content">
      <div v-if="loading" class="flex items-center justify-center h-full">
        <ProgressSpinner />
      </div>
      <div v-else-if="error" class="error-message p-4">
        <i class="pi pi-exclamation-triangle mr-2"></i>
        {{ error }}
      </div>
      <pre v-else class="log-text">{{ logContent || 'No logs available' }}</pre>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import { useAgentStore } from '@/stores/agentStore'

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
const selectedTargetId = ref<string>(props.initialTarget || 'local')
const logContent = ref<string>('')
const loading = ref(false)
const error = ref<string | null>(null)

// Compute target options from agent store
const targetOptions = computed(() => {
  const options = [
    { id: 'local', display: 'Local', icon: '📍' }
  ]
  
  // Add connected clients
  agentStore.clientList.forEach(client => {
    options.push({
      id: client.id,
      display: client.hostname,
      icon: '🖥️'
    })
  })
  
  return options
})

// Fetch logs for the selected target
const fetchLogs = async () => {
  loading.value = true
  error.value = null
  
  try {
    const response = await fetch(`/api/logs/${selectedTargetId.value}`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch logs: ${response.statusText}`)
    }
    
    const data = await response.json()
    logContent.value = data.logs || ''
  } catch (err) {
    console.error('Error fetching logs:', err)
    error.value = err instanceof Error ? err.message : 'Failed to fetch logs'
    logContent.value = ''
  } finally {
    loading.value = false
  }
}

// Handle target change
const onTargetChange = () => {
  fetchLogs()
}

// Set initial target when dialog opens
watch(visible, (newVal) => {
  if (newVal && props.initialTarget) {
    selectedTargetId.value = props.initialTarget
    fetchLogs()
  }
})

// Fetch logs on mount if dialog is visible
onMounted(() => {
  if (visible.value) {
    fetchLogs()
  }
})
</script>

<style scoped>
.log-viewer-dialog :deep(.p-dialog-content) {
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
}

.dark-theme .log-text {
  background: var(--p-surface-900);
}

.log-target-dropdown {
  min-width: 150px;
}

.error-message {
  color: var(--p-error-color);
  text-align: center;
  padding: 2rem;
}
</style>