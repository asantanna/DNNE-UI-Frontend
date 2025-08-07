<template>
  <div class="queue-button-group flex items-center gap-2">
    <!-- Target Selection -->
    <div class="flex items-center gap-1">
      <label class="text-sm font-medium">Client:</label>
      <Dropdown
        v-model="selectedTargetId"
        :options="exportTargets"
        optionLabel="display"
        optionValue="id"
        id="client-dropdown"
        class="target-dropdown"
        :placeholder="'Select target'"
        size="small"
      >
        <template #option="slotProps">
          <div class="flex items-center gap-2">
            <span v-if="slotProps.option.icon">{{ slotProps.option.icon }}</span>
            <span>{{ slotProps.option.display }}</span>
          </div>
        </template>
        <template #value="slotProps">
          <div v-if="slotProps.value" class="flex items-center gap-2">
            <span v-if="selectedExportTarget.icon">{{ selectedExportTarget.icon }}</span>
            <span>{{ selectedExportTarget.display }}</span>
          </div>
        </template>
      </Dropdown>
    </div>

    <!-- Export Button -->
    <Button
      v-tooltip.bottom="{
        value: 'Export workflow',
        showDelay: 600
      }"
      label="Export"
      severity="primary"
      size="small"
      data-testid="export-button"
      :disabled="isExportDisabled"
      @click="queuePrompt"
    >
      <template #icon>
        <i-lucide:upload v-if="selectedExportTarget.type === 'remote'" />
        <i-lucide:save v-else />
      </template>
    </Button>

    <!-- Run After Export Checkbox -->
    <div class="flex items-center"
      v-tooltip.bottom="{
        value: 'Run workflow after export',
        showDelay: 600
      }">
      <Checkbox
        v-model="runAfterExport"
        inputId="run-after-export"
        binary
        :disabled="isRunAfterExportDisabled"
      />
      <label for="run-after-export" class="ml-2 text-sm cursor-pointer">
        Run after export
      </label>
    </div>

    <!-- Stop Button -->
    <Button
      v-tooltip.bottom="{
        value: 'Stop a running workflow',
        showDelay: 600
      }"
      label="Stop"
      :severity="isRunning || hasPendingTasks ? 'danger' : 'secondary'"
      :disabled="isStopDisabled"
      size="small"
      @click="handleStop"
    />

    <!-- Show Logs Button -->
    <Button
      v-tooltip.bottom="{
        value: 'Open workflow log viewer',
        showDelay: 600
      }"
      label="Show Logs"
      severity="secondary"
      size="small"
      :disabled="!hasLogs"
      @click="showCurrentLogs"
    />
  </div>

  <!-- DNNE Log Viewer Dialog -->
  <DNNELogViewer
    :visible="showLogViewer"
    @update:visible="showLogViewer = $event"
  />
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'
import Checkbox from 'primevue/checkbox'
import { computed, ref, watch } from 'vue'
import { useCommandStore } from '@/stores/commandStore'
import DNNELogViewer from '@/components/dialog/DNNELogViewer.vue'
import {
  useQueuePendingTaskCountStore,
  useQueueSettingsStore
} from '@/stores/queueStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useAgentStore } from '@/stores/agentStore'
const workspaceStore = useWorkspaceStore()
const queueCountStore = storeToRefs(useQueuePendingTaskCountStore())
const { mode: queueMode } = storeToRefs(useQueueSettingsStore())
const agentStore = useAgentStore()
const commandStore = useCommandStore()

// Export target management
const exportTargets = computed(() => agentStore.exportTargets)
const selectedTargetId = computed({
  get: () => agentStore.selectedTarget,
  set: (value) => agentStore.selectTarget(value)
})
const selectedExportTarget = computed(() => 
  exportTargets.value.find(t => t.id === selectedTargetId.value) || exportTargets.value[0]
)

// Run after export state
const runAfterExport = ref(false)
const previousRunAfterExport = ref(true)  // Default true for first remote selection

// Log viewer state
const showLogViewer = ref(false)

// Workflow state
const isRunning = computed(() => {
  // Check if there's an active workflow for the selected target
  const activeWorkflows = Array.from(agentStore.activeWorkflows.values())
  return activeWorkflows.some(wf => 
    wf.clientId === selectedTargetId.value && wf.status === 'running'
  )
})

const hasPendingTasks = computed(
  () => queueCountStore.count.value > 1 || queueMode.value !== 'disabled'
)

const hasLogs = computed(() => {
  // For now, enable logs button if there are any workflows
  // In future, check if logs are actually available
  return agentStore.activeWorkflowCount > 0 || selectedTargetId.value !== 'local'
})

// Computed properties for disabled states
const isRunAfterExportDisabled = computed(() => selectedTargetId.value === 'local')
const isExportDisabled = computed(() => isRunning.value)
const isStopDisabled = computed(() => !isRunning.value && !hasPendingTasks.value)

// Watch for target changes to manage checkbox state
watch(selectedTargetId, (newTarget, oldTarget) => {
  if (newTarget === 'local') {
    // Save current state and disable
    previousRunAfterExport.value = runAfterExport.value
    runAfterExport.value = false
  } else if (oldTarget === 'local') {
    // Restore previous state when switching from local
    runAfterExport.value = previousRunAfterExport.value
  }
})


// Actions
const queuePrompt = async (e: Event) => {
  // Store the selected export target and run_after_export flag
  workspaceStore.exportTarget = selectedTargetId.value
  workspaceStore.runAfterExport = runAfterExport.value
  
  const commandId =
    'shiftKey' in e && e.shiftKey
      ? 'Comfy.QueuePromptFront'
      : 'Comfy.QueuePrompt'
  await commandStore.execute(commandId)
}

const handleStop = () => {
  if (isRunning.value) {
    // Stop the running workflow
    commandStore.execute('Comfy.Interrupt')
  } else if (hasPendingTasks.value) {
    // Clear pending tasks
    if (queueCountStore.count.value > 1) {
      commandStore.execute('Comfy.ClearPendingTasks')
    }
    queueMode.value = 'disabled'
  }
}

const showCurrentLogs = () => {
  // Show logs for the currently selected target
  showLogViewer.value = true
}
</script>

<style scoped>
.queue-button-group {
  align-items: center;
  flex-wrap: nowrap;
}

.target-dropdown {
  min-width: 150px;
}

.target-dropdown :deep(.p-dropdown) {
  height: 32px;
}

/* Ensure consistent button heights */
:deep(.p-button-sm) {
  height: 32px;
}

:deep(.p-checkbox) {
  width: 18px;
  height: 18px;
}
</style>
