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
      
      <!-- Per-client status with workflow info -->
      <span v-for="client in clientStatuses" :key="client.id" 
            :class="['client-status', { 'active': client.workflowCount > 0 }]"
            v-tooltip="{
              value: client.tooltip,
              showDelay: 300
            }">
        ({{ client.display }})
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAgentStore } from '@/stores/agentStore'

const agentStore = useAgentStore()

const clientStatuses = computed(() => {
  return agentStore.clientList.map(client => {
    const workflowDetails = agentStore.getClientWorkflows(client.id)
    const workflowCount = workflowDetails.length
    
    // Build display text
    let display = `${client.hostname}: ${workflowCount}`
    
    if (workflowCount === 1) {
      // Show single workflow name
      const wfName = workflowDetails[0].name
      display = `${client.hostname}: 1 - ${wfName}`
    } else if (workflowCount > 1 && workflowCount <= 3) {
      // Show workflow names if they fit (truncate if needed)
      const names = workflowDetails.map(w => {
        // Truncate long names
        return w.name.length > 15 ? w.name.substring(0, 12) + '..' : w.name
      }).join(', ')
      
      // Only show names if total length is reasonable
      if (names.length <= 40) {
        display = `${client.hostname}: ${workflowCount} - ${names}`
      } else {
        display = `${client.hostname}: ${workflowCount} - Multiple`
      }
    } else if (workflowCount >= 4) {
      // Too many to show
      display = `${client.hostname}: ${workflowCount} - Multiple`
    }
    
    // Build tooltip with details
    let tooltip = ''
    if (workflowCount === 0) {
      tooltip = `${client.hostname}: No active workflows`
    } else {
      tooltip = workflowDetails.map(wf => {
        const runTime = calculateRunTime(wf.start_time)
        return `${wf.name}, run_time: ${runTime}`
      }).join('\n')
    }
    
    return {
      id: client.id,
      display,
      workflowCount,
      tooltip
    }
  })
})

// Helper function to calculate run time
function calculateRunTime(startTime: string): string {
  if (!startTime) return '0s'
  
  const start = new Date(startTime).getTime()
  const now = Date.now()
  const seconds = Math.floor((now - start) / 1000)
  
  if (seconds < 60) {
    return `${seconds}s`
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}m ${secs}s`
  } else {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }
}

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

.client-status {
  color: var(--p-text-muted-color); /* Gray for idle */
  margin-left: 0.5rem;
}

.client-status.active {
  color: var(--p-text-color); /* White/normal for active */
  font-weight: 500;
}
</style>