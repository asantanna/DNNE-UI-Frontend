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

    <!-- Export SplitButton -->
    <SplitButton
      v-tooltip.bottom="{
        value: 'Export workflow',
        showDelay: 600
      }"
      :label="getButtonLabel()"
      severity="primary"
      size="small"
      data-testid="export-button"
      :disabled="isExportDisabled"
      @click="handleAction"
      :model="exportMenuItems"
      :menuButtonDisabled="selectedTargetId === 'local'"
    />

    <!-- Custom Args Checkbox -->
    <div class="flex items-center"
      v-tooltip.bottom="{
        value: 'Use custom runner arguments',
        showDelay: 600
      }">
      <Checkbox
        v-model="useCustomArgs"
        inputId="use-custom-args"
        binary
        :disabled="selectedTargetId === 'local'"
      />
      <label for="use-custom-args" class="ml-2 text-sm cursor-pointer">
        Custom args
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
import SplitButton from 'primevue/splitbutton'
import Dropdown from 'primevue/dropdown'
import Checkbox from 'primevue/checkbox'
import { computed, ref, watch } from 'vue'
import { useCommandStore } from '@/stores/commandStore'
import DNNELogViewer from '@/components/dialog/DNNELogViewer.vue'
import RunnerArgsDialogContent from '@/components/dialog/content/RunnerArgsDialogContent.vue'
import { useDialogStore } from '@/stores/dialogStore'
import { api } from '@/scripts/api'
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
const dialogStore = useDialogStore()

// Export target management
const exportTargets = computed(() => agentStore.exportTargets)
const selectedTargetId = computed({
  get: () => agentStore.selectedTarget,
  set: (value) => agentStore.selectTarget(value)
})
const selectedExportTarget = computed(() => 
  exportTargets.value.find(t => t.id === selectedTargetId.value) || exportTargets.value[0]
)

// Custom args state
const useCustomArgs = ref(false)
const previousUseCustomArgs = ref(false)

// Export/Run mode state
type ExportMode = 'export' | 'export-and-run' | 'run-only'
const exportMode = ref<ExportMode>('export')

// Log viewer state
const showLogViewer = ref(false)

// Export menu items for SplitButton
const exportMenuItems = computed(() => {
  if (selectedTargetId.value === 'local') {
    // Local only has Export option
    return []
  } else {
    // Remote has Deploy, Deploy and Run, Run Only
    return [
      {
        label: 'Deploy',
        command: () => { exportMode.value = 'export' }
      },
      {
        label: 'Deploy and Run',
        command: () => { exportMode.value = 'export-and-run' }
      },
      {
        label: 'Run Only',
        command: () => { exportMode.value = 'run-only' }
      }
    ]
  }
})

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
const isExportDisabled = computed(() => isRunning.value)
const isStopDisabled = computed(() => !isRunning.value && !hasPendingTasks.value)

// Get button label based on mode and target
const getButtonLabel = () => {
  if (selectedTargetId.value === 'local') {
    return 'Export'
  } else {
    // Remote client selected
    switch (exportMode.value) {
      case 'export': return 'Deploy Only'
      case 'export-and-run': return 'Deploy and Run'
      case 'run-only': return 'Run Only'
      default: return 'Deploy Only'
    }
  }
}

// Watch for target changes to manage checkbox state
watch(selectedTargetId, (newTarget, oldTarget) => {
  if (newTarget === 'local') {
    // Save current state and disable
    previousUseCustomArgs.value = useCustomArgs.value
    useCustomArgs.value = false
    // Reset mode to export for local
    exportMode.value = 'export'
  } else if (oldTarget === 'local') {
    // Restore previous state when switching from local
    useCustomArgs.value = previousUseCustomArgs.value
    // Set to "Deploy and Run" mode for remote (usually desired)
    exportMode.value = 'export-and-run'
  }
  // When switching between remote clients, don't change the mode
})


// Main action handler
const handleAction = async (e: Event) => {
  switch (exportMode.value) {
    case 'export':
      if (useCustomArgs.value && selectedTargetId.value !== 'local') {
        await performExportWithArgs(false)
      } else {
        await performExport(e, false)
      }
      break
    case 'export-and-run':
      if (useCustomArgs.value) {
        await performExportWithArgs(true)
      } else {
        await performExport(e, true)
      }
      break
    case 'run-only':
      if (useCustomArgs.value) {
        await performRunWithArgs()
      } else {
        await performRun()
      }
      break
  }
}

// Simple export without args
const performExport = async (e: Event, runAfter: boolean) => {
  // console.log('=== performExport START ===')
  // console.log('Event type:', e.type)
  // console.log('Event shiftKey:', 'shiftKey' in e ? e.shiftKey : 'N/A')
  // console.log('Run after:', runAfter)
  
  // Store the selected export target and run_after_export flag
  workspaceStore.exportTarget = selectedTargetId.value
  workspaceStore.runAfterExport = runAfter
  workspaceStore.runnerArgs = '' // No args for normal export
  
  // Execute the export command
  const commandId =
    'shiftKey' in e && e.shiftKey
      ? 'Comfy.QueuePromptFront'
      : 'Comfy.QueuePrompt'
  await commandStore.execute(commandId)
}

// Export with arguments - shows dialog
const performExportWithArgs = async (runAfter: boolean) => {
  // console.log('=== performExportWithArgs START ===')
  // console.log('Run after:', runAfter)
  
  // Store the selected export target and run_after_export flag
  workspaceStore.exportTarget = selectedTargetId.value
  workspaceStore.runAfterExport = runAfter
  
  // Get button text for dialog
  const buttonText = getButtonLabel()
  
  // Show runner args dialog
  dialogStore.showDialog({
    key: 'runner-args-dialog',
    title: 'Configure Runner Arguments',
    component: RunnerArgsDialogContent,
    props: {
      buttonText,
      onConfirm: async (runnerArgs: string) => {
        // console.log('Runner args received:', runnerArgs)
        // Store the runner arguments
        workspaceStore.runnerArgs = runnerArgs
        
        // Execute the export command
        await commandStore.execute('Comfy.QueuePrompt')
      }
    }
  })
}

// Run workflow without args
const performRun = async () => {
  // console.log('=== performRun START ===')
  
  const clientId = selectedTargetId.value
  
  if (clientId === 'local') {
    // For local, just run the workflow (assume it exists)
    await runWorkflow(false)
  } else {
    // For remote, check if deployed
    const exists = await checkWorkflowExists(clientId)
    if (!exists) {
      const client = agentStore.clients.get(clientId)
      const hostname = client?.hostname || clientId
      // Show error message using toast or alert
      console.error(`Workflow not found on ${hostname}, please deploy first.`)
      alert(`Workflow not found on ${hostname}, please deploy first.`)
      return
    }
    
    await runWorkflow(false)
  }
}

// Check if workflow exists on remote
const checkWorkflowExists = async (clientId: string): Promise<boolean> => {
  // console.log('Checking if workflow exists on', clientId)
  
  // Send WebSocket message to check
  if (api.socket && api.socket.readyState === WebSocket.OPEN) {
    // Generate workflow ID from current workflow content
    const workflow = workspaceStore.workflow
    if (!workflow) return false
    
    // Calculate workflow ID (hash of content)
    const workflowJson = JSON.stringify(workflow, null, 2)
    const encoder = new TextEncoder()
    const data = encoder.encode(workflowJson)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    const workflowId = `wf_${hashHex.substring(0, 12)}`
    
    return new Promise((resolve) => {
      // Set up one-time listener for response
      const handler = (event: CustomEvent) => {
        const detail = event.detail.data || event.detail
        if (detail.client_id === clientId && 
            detail.workflow_id === workflowId) {
          api.removeEventListener('workflow_exists_response', handler as any)
          resolve(detail.exists)
        }
      }
      api.addEventListener('workflow_exists_response', handler as any)
      
      // Send check request
      if (api.socket) {
        api.socket.send(JSON.stringify({
          type: 'check_workflow_exists',
          client_id: clientId,
          workflow_id: workflowId
        }))
      }
      
      // Timeout after 5 seconds
      setTimeout(() => {
        api.removeEventListener('workflow_exists_response', handler as any)
        resolve(false)
      }, 5000)
    })
  }
  return false
}

// Run workflow with args - shows dialog
const performRunWithArgs = async () => {
  // console.log('=== performRunWithArgs START ===')
  
  const clientId = selectedTargetId.value
  
  if (clientId === 'local') {
    // For local, just run the workflow (assume it exists)
    await runWorkflow(true)
  } else {
    // For remote, check if deployed
    const exists = await checkWorkflowExists(clientId)
    if (!exists) {
      const client = agentStore.clients.get(clientId)
      const hostname = client?.hostname || clientId
      // Show error message using toast or alert
      console.error(`Workflow not found on ${hostname}, please deploy first.`)
      alert(`Workflow not found on ${hostname}, please deploy first.`)
      return
    }
    
    await runWorkflow(true)
  }
}

// Run the workflow (assumes it exists)
const runWorkflow = async (withArgs: boolean) => {
  if (withArgs) {
    const buttonText = 'Run Only'
    dialogStore.showDialog({
      key: 'runner-args-dialog',
      title: 'Configure Runner Arguments',
      component: RunnerArgsDialogContent,
      props: {
        buttonText,
        onConfirm: async (runnerArgs: string) => {
          await sendRunCommand(runnerArgs)
        }
      }
    })
  } else {
    await sendRunCommand('')
  }
}

// Send run command to server
const sendRunCommand = async (runnerArgs: string) => {
  if (api.socket && api.socket.readyState === WebSocket.OPEN) {
    // Calculate workflow ID
    const workflow = workspaceStore.workflow
    if (!workflow) return
    
    const workflowJson = JSON.stringify(workflow, null, 2)
    const encoder = new TextEncoder()
    const data = encoder.encode(workflowJson)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    const workflowId = `wf_${hashHex.substring(0, 12)}`
    
    api.socket.send(JSON.stringify({
      type: 'run_workflow',
      client_id: selectedTargetId.value,
      workflow_id: workflowId,
      runner_args: runnerArgs
    }))
  }
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
  if (!showLogViewer.value) {
    showLogViewer.value = true
  }
  // If already open, the dialog remains visible without re-initializing
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
