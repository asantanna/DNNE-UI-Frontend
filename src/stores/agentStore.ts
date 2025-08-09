import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface AgentClient {
  id: string
  hostname: string
  platform: string
  connected_at: string
}

export interface ExportTarget {
  id: string
  type: 'local' | 'remote'
  display: string
  icon?: string
}

export enum AgentConnectionStatus {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Error = 'error'
}

interface WorkflowInfo {
  id: string
  name: string
  start_time: string
}

export const useAgentStore = defineStore('agent', () => {
  // State
  const clients = ref<Map<string, AgentClient>>(new Map())
  const connectionStatus = ref<AgentConnectionStatus>(AgentConnectionStatus.Disconnected)
  const activeWorkflows = ref<Map<string, { clientId: string; status: string }>>(new Map())
  const selectedTarget = ref<string>('local')
  const clientWorkflows = ref<Map<string, WorkflowInfo[]>>(new Map())  // Track workflows per client
  
  // Initialize connection status
  // Real data will come from backend via WebSocket and API
  
  // Fetch initial client list from API
  async function fetchClients() {
    try {
      const response = await fetch('/api/agent/clients')
      const data = await response.json()
      
      if (data.clients) {
        clients.value.clear()
        data.clients.forEach((client: any) => {
          if (client.type === 'remote') {
            clients.value.set(client.id, {
              id: client.id,
              hostname: client.hostname || client.display,
              platform: client.platform || 'Unknown',
              connected_at: client.connected_at || new Date().toISOString()
            })
          }
        })
      }
      
      // Update connection status based on API response
      if (data.connection_status === 'connected') {
        connectionStatus.value = AgentConnectionStatus.Connected
      } else if (data.connection_status === 'connecting') {
        connectionStatus.value = AgentConnectionStatus.Connecting
      } else if (data.connection_status === 'error') {
        connectionStatus.value = AgentConnectionStatus.Error
      } else {
        connectionStatus.value = AgentConnectionStatus.Disconnected
      }
    } catch (error) {
      console.error('Failed to fetch agent clients:', error)
      connectionStatus.value = AgentConnectionStatus.Error
    }
  }
  
  // Fetch clients on store initialization
  fetchClients()
  
  // Getters
  const isConnected = computed(() => connectionStatus.value === AgentConnectionStatus.Connected)
  
  const clientCount = computed(() => clients.value.size)
  
  const clientList = computed(() => Array.from(clients.value.values()))
  
  const exportTargets = computed((): ExportTarget[] => {
    const targets: ExportTarget[] = [
      { id: 'local', type: 'local', display: 'Local' }
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
  
  // Get workflows for a specific client
  function getClientWorkflows(clientId: string): WorkflowInfo[] {
    return clientWorkflows.value.get(clientId) || []
  }
  
  // WebSocket message handlers (to be connected later)
  function handleAgentMessage(message: any) {
    // Handle the consolidated client_status messages
    if (message.type === 'client_status') {
      const status = message.status
      const clientId = message.client_id
      const hostname = message.client_hostname
      
      if (status === 'connected') {
        addClient({
          id: clientId,
          hostname: hostname,
          platform: message.platform || 'Unknown',
          connected_at: message.timestamp
        })
        clientWorkflows.value.set(clientId, [])
      } else if (status === 'disconnected') {
        removeClient(clientId)
        clientWorkflows.value.delete(clientId)
        // Remove any active workflows for this client
        for (const [workflowId, wf] of activeWorkflows.value.entries()) {
          if (wf.clientId === clientId) {
            activeWorkflows.value.delete(workflowId)
          }
        }
      }
    }
    
    // Handle workflow_status messages
    else if (message.type === 'workflow_status') {
      const workflowId = message.workflow_id
      const clientId = message.client_id
      const status = message.status
      const workflowName = message.workflow_name
      
      if (status === 'running' || status === 'deployed') {
        // Update activeWorkflows map
        activeWorkflows.value.set(workflowId, {
          clientId: clientId,
          status: status
        })
        
        // Update clientWorkflows map for status bar
        if (!clientWorkflows.value.has(clientId)) {
          clientWorkflows.value.set(clientId, [])
        }
        const workflows = clientWorkflows.value.get(clientId)!
        // Add workflow if not already tracked
        if (!workflows.find(w => w.id === workflowId)) {
          workflows.push({
            id: workflowId,
            name: workflowName || 'Unknown',
            start_time: new Date().toISOString()
          })
        }
      } else if (status === 'completed' || status === 'failed' || status === 'stopped') {
        // Remove from activeWorkflows
        activeWorkflows.value.delete(workflowId)
        
        // Remove from clientWorkflows
        if (clientWorkflows.value.has(clientId)) {
          const workflows = clientWorkflows.value.get(clientId)!
          const index = workflows.findIndex(w => w.id === workflowId)
          if (index !== -1) {
            workflows.splice(index, 1)
          }
        }
      }
    }
    
    // Keep old message handling for backward compatibility
    else if (message.type === 'server_state') {
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
    }
    // Keep other legacy message types for compatibility
    else if (message.type === 'agent_update') {
      // Handle old agent_update messages for backward compatibility
      const action = message.action
      if (action === 'client_connected' && message.client) {
        addClient(message.client)
      } else if (action === 'client_disconnected') {
        removeClient(message.client_id)
      } else if (action === 'workflow_status') {
        updateWorkflowStatus(message.workflow_id, message.client_id, message.status)
      }
    }
  }
  
  return {
    // State
    clients,
    connectionStatus,
    activeWorkflows,
    selectedTarget,
    clientWorkflows,
    
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
    getClientWorkflows,
    handleAgentMessage
  }
})