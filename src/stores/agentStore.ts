import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface AgentClient {
  id: string
  hostname: string
  platform: string
  connected_at: string
}

export enum AgentConnectionStatus {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Error = 'error'
}

export const useAgentStore = defineStore('agent', () => {
  // State
  const clients = ref<Map<string, AgentClient>>(new Map())
  const connectionStatus = ref<AgentConnectionStatus>(AgentConnectionStatus.Disconnected)
  const activeWorkflows = ref<Map<string, { clientId: string; status: string }>>(new Map())
  const selectedTarget = ref<string>('local')
  
  // Mock data for development
  const MOCK_CLIENTS: AgentClient[] = [
    {
      id: 'client_mock_wsl',
      hostname: 'wsl-machine',
      platform: 'Linux',
      connected_at: new Date().toISOString()
    },
    {
      id: 'client_mock_ubuntu',
      hostname: 'ubuntu-box',
      platform: 'Linux',
      connected_at: new Date().toISOString()
    }
  ]
  
  // Initialize with mock data for testing
  // TODO: Remove this when backend integration is complete
  connectionStatus.value = AgentConnectionStatus.Connected
  MOCK_CLIENTS.forEach(client => {
    clients.value.set(client.id, client)
  })
  
  // Getters
  const isConnected = computed(() => connectionStatus.value === AgentConnectionStatus.Connected)
  
  const clientCount = computed(() => clients.value.size)
  
  const clientList = computed(() => Array.from(clients.value.values()))
  
  const exportTargets = computed(() => {
    const targets = [
      { id: 'local', type: 'local', display: 'Local', icon: '📍' }
    ]
    
    clientList.value.forEach(client => {
      targets.push({
        id: client.id,
        type: 'remote',
        display: client.hostname,
        icon: '🖥️'
      })
    })
    
    return targets
  })
  
  const activeWorkflowCount = computed(() => {
    return Array.from(activeWorkflows.value.values()).filter(
      wf => wf.status === 'running'
    ).length
  })
  
  const connectionStatusIcon = computed(() => {
    switch (connectionStatus.value) {
      case AgentConnectionStatus.Connected:
        return clientCount.value > 0 ? '🟢' : '🟡'
      case AgentConnectionStatus.Connecting:
        return '🟡'
      case AgentConnectionStatus.Error:
      case AgentConnectionStatus.Disconnected:
        return '🔴'
      default:
        return '⚫'
    }
  })
  
  const connectionStatusText = computed(() => {
    switch (connectionStatus.value) {
      case AgentConnectionStatus.Connected:
        return 'Connected'
      case AgentConnectionStatus.Connecting:
        return 'Connecting...'
      case AgentConnectionStatus.Error:
        return 'Connection Error'
      case AgentConnectionStatus.Disconnected:
        return 'Disconnected'
      default:
        return 'Unknown'
    }
  })
  
  // Actions
  function updateClients(newClients: AgentClient[]) {
    clients.value.clear()
    newClients.forEach(client => {
      clients.value.set(client.id, client)
    })
  }
  
  function addClient(client: AgentClient) {
    clients.value.set(client.id, client)
  }
  
  function removeClient(clientId: string) {
    clients.value.delete(clientId)
    // If the removed client was selected, switch to local
    if (selectedTarget.value === clientId) {
      selectedTarget.value = 'local'
    }
  }
  
  function setConnectionStatus(status: AgentConnectionStatus) {
    connectionStatus.value = status
  }
  
  function selectTarget(targetId: string) {
    selectedTarget.value = targetId
  }
  
  function updateWorkflowStatus(workflowId: string, clientId: string, status: string) {
    if (status === 'completed' || status === 'failed' || status === 'stopped') {
      activeWorkflows.value.delete(workflowId)
    } else {
      activeWorkflows.value.set(workflowId, { clientId, status })
    }
  }
  
  // WebSocket message handlers (to be connected later)
  function handleAgentMessage(message: any) {
    switch (message.type) {
      case 'server_state':
        // Initial state from agent server
        const connectedClients = Object.entries(message.clients || {})
          .filter(([_, info]: [string, any]) => info.connected)
          .map(([id, info]: [string, any]) => ({
            id,
            hostname: info.hostname,
            platform: info.platform,
            connected_at: info.connected_at
          }))
        updateClients(connectedClients)
        
        // Update workflows
        Object.entries(message.workflows || {}).forEach(([wfId, wf]: [string, any]) => {
          updateWorkflowStatus(wfId, wf.client_id, wf.status)
        })
        break
        
      case 'client_connected':
        addClient({
          id: message.client_id,
          hostname: message.info.hostname,
          platform: message.info.platform,
          connected_at: message.info.connected_at
        })
        break
        
      case 'client_disconnected':
        removeClient(message.client_id)
        break
        
      case 'workflow_status':
        updateWorkflowStatus(
          message.workflow_id,
          message.client_id || '',
          message.status
        )
        break
    }
  }
  
  return {
    // State
    clients,
    connectionStatus,
    activeWorkflows,
    selectedTarget,
    
    // Getters
    isConnected,
    clientCount,
    clientList,
    exportTargets,
    activeWorkflowCount,
    connectionStatusIcon,
    connectionStatusText,
    
    // Actions
    updateClients,
    addClient,
    removeClient,
    setConnectionStatus,
    selectTarget,
    updateWorkflowStatus,
    handleAgentMessage
  }
})