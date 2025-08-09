<template>
  <router-view />
  <ProgressSpinner
    v-if="isLoading"
    class="absolute inset-0 flex justify-center items-center h-[unset]"
  />
  <GlobalDialog />
  <BlockUI full-screen :blocked="isLoading" />
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import BlockUI from 'primevue/blockui'
import ProgressSpinner from 'primevue/progressspinner'
import { computed, onMounted, onUnmounted } from 'vue'

import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import config from '@/config'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useAgentStore } from '@/stores/agentStore'
import { api } from '@/scripts/api'

import { electronAPI, isElectron } from './utils/envUtil'

const workspaceStore = useWorkspaceStore()
const agentStore = useAgentStore()
const isLoading = computed<boolean>(() => workspaceStore.spinner)
const handleKey = (e: KeyboardEvent) => {
  workspaceStore.shiftDown = e.shiftKey
}
useEventListener(window, 'keydown', handleKey)
useEventListener(window, 'keyup', handleKey)

const showContextMenu = (event: MouseEvent) => {
  const { target } = event
  switch (true) {
    case target instanceof HTMLTextAreaElement:
    case target instanceof HTMLInputElement && target.type === 'text':
      // TODO: Context input menu explicitly for text input
      electronAPI()?.showContextMenu({ type: 'text' })
      return
  }
}

// WebSocket event handler for client status
const handleClientStatus = (event: CustomEvent) => {
  agentStore.handleAgentMessage({ type: 'client_status', ...event.detail })
}

// WebSocket event handler for workflow status
const handleWorkflowStatus = (event: CustomEvent) => {
  agentStore.handleAgentMessage({ type: 'workflow_status', ...event.detail })
}

onMounted(() => {
  // @ts-expect-error fixme ts strict error
  window['__COMFYUI_FRONTEND_VERSION__'] = config.app_version
  console.log('ComfyUI Front-end version:', config.app_version)

  if (isElectron()) {
    document.addEventListener('contextmenu', showContextMenu)
  }
  
  // Set up WebSocket event listeners for agent messages
  api.addEventListener('client_status', handleClientStatus as any)
  api.addEventListener('workflow_status', handleWorkflowStatus as any)
})

onUnmounted(() => {
  // Clean up WebSocket event listeners
  api.removeEventListener('client_status', handleClientStatus as any)
  api.removeEventListener('workflow_status', handleWorkflowStatus as any)
})
</script>
