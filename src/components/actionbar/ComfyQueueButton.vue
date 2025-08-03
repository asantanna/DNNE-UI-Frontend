<template>
  <div class="queue-button-group flex">
    <SplitButton
      v-tooltip.bottom="{
        value: 'Export workflow',
        showDelay: 600
      }"
      class="comfyui-queue-button"
      :label="exportButtonLabel"
      severity="primary"
      size="small"
      :model="exportTargetMenuItems"
      data-testid="queue-button"
      @click="queuePrompt"
    >
      <template #icon>
        <i-lucide:upload v-if="selectedExportTarget.type === 'remote'" />
        <i-lucide:save v-else />
      </template>
    </SplitButton>
    <BatchCountEdit />
    <ButtonGroup class="execution-actions flex flex-nowrap">
      <Button
        v-tooltip.bottom="{
          value: $t('menu.interrupt'),
          showDelay: 600
        }"
        icon="pi pi-times"
        :severity="executingPrompt ? 'danger' : 'secondary'"
        :disabled="!executingPrompt"
        text
        :aria-label="$t('menu.interrupt')"
        @click="() => commandStore.execute('Comfy.Interrupt')"
      />
      <Button
        v-tooltip.bottom="{
          value: $t('sideToolbar.queueTab.clearPendingTasks'),
          showDelay: 600
        }"
        icon="pi pi-stop"
        :severity="hasPendingTasks ? 'danger' : 'secondary'"
        :disabled="!hasPendingTasks"
        text
        :aria-label="$t('sideToolbar.queueTab.clearPendingTasks')"
        @click="
          () => {
            if (queueCountStore.count.value > 1) {
              commandStore.execute('Comfy.ClearPendingTasks')
            }
            queueMode = 'disabled'
          }
        "
      />
    </ButtonGroup>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import ButtonGroup from 'primevue/buttongroup'
import SplitButton from 'primevue/splitbutton'
import { computed } from 'vue'

import { useCommandStore } from '@/stores/commandStore'
import {
  useQueuePendingTaskCountStore,
  useQueueSettingsStore
} from '@/stores/queueStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useAgentStore } from '@/stores/agentStore'

import BatchCountEdit from './BatchCountEdit.vue'

const workspaceStore = useWorkspaceStore()
const queueCountStore = storeToRefs(useQueuePendingTaskCountStore())
const { mode: queueMode } = storeToRefs(useQueueSettingsStore())
const agentStore = useAgentStore()

// const { t } = useI18n() // Removed - not needed with new export dropdown

// Export target management
const exportTargets = computed(() => agentStore.exportTargets)
const selectedExportTarget = computed(() => 
  exportTargets.value.find(t => t.id === agentStore.selectedTarget) || exportTargets.value[0]
)

const exportButtonLabel = computed(() => {
  if (selectedExportTarget.value.type === 'local') {
    return 'Export'
  }
  return `Export to ${selectedExportTarget.value.display}`
})

const exportTargetMenuItems = computed(() => 
  exportTargets.value.map(target => ({
    key: target.id,
    label: target.display,
    icon: target.icon,
    command: () => {
      agentStore.selectTarget(target.id)
    }
  }))
)

const executingPrompt = computed(() => !!queueCountStore.count.value)
const hasPendingTasks = computed(
  () => queueCountStore.count.value > 1 || queueMode.value !== 'disabled'
)

const commandStore = useCommandStore()
const queuePrompt = async (e: Event) => {
  // Store the selected export target in workspace for the command to use
  workspaceStore.exportTarget = agentStore.selectedTarget
  
  const commandId =
    'shiftKey' in e && e.shiftKey
      ? 'Comfy.QueuePromptFront'
      : 'Comfy.QueuePrompt'
  await commandStore.execute(commandId)
}
</script>

<style scoped>
.comfyui-queue-button :deep(.p-splitbutton-dropdown) {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
</style>
