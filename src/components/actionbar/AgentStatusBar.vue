<template>
  <div class="agent-status-bar flex items-center gap-4 px-4 py-1 text-sm">
    <div class="flex items-center gap-2">
      <span class="font-semibold">Agent:</span>
      <span class="flex items-center gap-1">
        <span class="text-base">{{ agentStore.connectionStatusIcon }}</span>
        <span>{{ agentStore.connectionStatusText }}</span>
      </span>
    </div>
    
    <div class="border-l pl-4 flex items-center gap-2">
      <span class="font-semibold">Clients:</span>
      <span>{{ agentStore.clientCount }}</span>
      <span v-if="agentStore.clientCount > 0" class="text-muted">
        ({{ clientNames }})
      </span>
    </div>
    
    <div v-if="agentStore.activeWorkflowCount > 0" class="border-l pl-4 flex items-center gap-2">
      <span class="font-semibold">Active Workflows:</span>
      <span>{{ agentStore.activeWorkflowCount }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAgentStore } from '@/stores/agentStore'

const agentStore = useAgentStore()

const clientNames = computed(() => {
  return agentStore.clientList
    .map(client => client.hostname)
    .join(', ')
})

</script>

<style scoped>
.agent-status-bar {
  background-color: var(--p-surface-900);
  border-top: 1px solid var(--p-surface-700);
  color: var(--p-text-color);
  font-size: 0.875rem;
  min-height: 32px;
  width: 100%;
  display: flex;
  align-items: center;
}

.text-muted {
  color: var(--p-text-muted-color);
}

.border-l {
  border-left: 1px solid var(--p-surface-300);
}
</style>