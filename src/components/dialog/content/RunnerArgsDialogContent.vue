<template>
  <div class="runner-args-dialog-content" :style="{ width: dialogWidth, minWidth: dialogWidth }">
    <!-- Command Line Preview -->
    <div class="mb-4">
      <label class="block text-sm font-medium mb-2">Command Line Arguments:</label>
      <div class="flex items-center gap-2">
        <InputText 
          v-model="commandLine"
          :readonly="!overrideMode"
          class="flex-1 font-mono text-sm command-line-input"
          :class="{ 
            'readonly-mode': !overrideMode,
            'edit-mode': overrideMode
          }"
          @keyup.enter="onEnterKey"
        />
        <Checkbox 
          v-model="overrideMode" 
          inputId="override-args"
          binary
        />
        <label for="override-args" class="text-sm">Override</label>
      </div>
    </div>

    <!-- Arguments (disabled in override mode) -->
    <div v-if="runnerArgsConfig" 
         class="arguments-section"
         :class="{ 'opacity-50 pointer-events-none': overrideMode }">
      <div class="arguments-grid" :style="gridStyle">
        <!-- Column 1 -->
        <div class="column">
          <div v-for="arg in getArgumentsForColumn(1)" :key="arg.name" class="mb-2">
            <component 
              :is="getComponentForArgument(arg.config)"
              :argument="arg.config"
              :argName="arg.name"
              v-model="argumentValues[arg.name]"
              @update:modelValue="onArgumentChange"
            />
          </div>
        </div>
        
        <!-- Column 2 (if columns > 1) -->
        <div v-if="layoutColumns > 1" class="column">
          <div v-for="arg in getArgumentsForColumn(2)" :key="arg.name" class="mb-2">
            <component 
              :is="getComponentForArgument(arg.config)"
              :argument="arg.config"
              :argName="arg.name"
              v-model="argumentValues[arg.name]"
              @update:modelValue="onArgumentChange"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div v-else-if="!runnerArgsConfig && !overrideMode" class="flex justify-center items-center h-40">
      <ProgressSpinner />
    </div>

    <!-- Action Buttons -->
    <div class="flex justify-end gap-2 mt-4 pt-4 border-t">
      <Button 
        label="Cancel" 
        severity="secondary"
        @click="onCancel"
      />
      <Button 
        :label="props.buttonText || 'Export with Arguments'" 
        @click="onConfirm"
        :disabled="!isValid"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Checkbox from 'primevue/checkbox'
import ProgressSpinner from 'primevue/progressspinner'
import { useDialogStore } from '@/stores/dialogStore'
import { useAgentStore } from '@/stores/agentStore'
import { api } from '@/scripts/api'

// Import argument input components
import CheckboxArgument from './runner-args/CheckboxArgument.vue'
import TextArgument from './runner-args/TextArgument.vue'
import NumberArgument from './runner-args/NumberArgument.vue'
import SelectArgument from './runner-args/SelectArgument.vue'
import SelectOrTextArgument from './runner-args/SelectOrTextArgument.vue'

interface RunnerArgsConfig {
  layout?: {
    columns?: number
    dialogWidth?: string
    dialogMaxHeight?: string
  }
  arguments: Record<string, ArgumentConfig>
  argument_order: string[]
}

interface ArgumentConfig {
  switch: string
  shortSwitch?: string
  type: 'checkbox' | 'text' | 'number' | 'select' | 'select_or_text'
  label: string
  description: string
  default?: any
  options?: string[]
  placeholder?: string
  column: number
  order: number
  label_on_same_line?: boolean
}

const props = defineProps<{
  onConfirm: (args: string) => void
  buttonText?: string
}>()

const dialogStore = useDialogStore()
const agentStore = useAgentStore()
const runnerArgsConfig = ref<RunnerArgsConfig | null>(null)
const argumentValues = ref<Record<string, any>>({})
const overrideMode = ref(false)
const manualCommandLine = ref('')
const commandLine = computed({
  get: () => overrideMode.value ? manualCommandLine.value : generateCommandLine(),
  set: (value) => {
    if (overrideMode.value) {
      manualCommandLine.value = value
    }
  }
})

// Layout configuration from JSON
const layoutColumns = computed(() => runnerArgsConfig.value?.layout?.columns || 1)
const dialogWidth = computed(() => runnerArgsConfig.value?.layout?.dialogWidth || '600px')
const dialogMaxHeight = computed(() => runnerArgsConfig.value?.layout?.dialogMaxHeight || '80vh')

const gridStyle = computed(() => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${layoutColumns.value}, 1fr)`,
  gap: '1rem',
  maxHeight: dialogMaxHeight.value,
  overflowY: 'auto' as const
}))

const isValid = computed(() => {
  if (overrideMode.value) {
    // In override mode, just check that something is entered
    return manualCommandLine.value.trim().length > 0
  }
  return true // All arguments are optional
})

function getArgumentsForColumn(column: number) {
  if (!runnerArgsConfig.value) return []
  
  // Get all arguments for the specified column and sort by order
  return Object.entries(runnerArgsConfig.value.arguments)
    .filter(([_, config]) => config.column === column)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([name, config]) => ({ name, config }))
}

function getComponentForArgument(arg: ArgumentConfig) {
  switch (arg.type) {
    case 'checkbox':
      return CheckboxArgument
    case 'text':
      return TextArgument
    case 'number':
      return NumberArgument
    case 'select':
      return SelectArgument
    case 'select_or_text':
      return SelectOrTextArgument
    default:
      return TextArgument
  }
}

function generateCommandLine(): string {
  if (!runnerArgsConfig.value) return ''
  
  const args: string[] = []
  
  for (const argName of runnerArgsConfig.value.argument_order) {
    const config = runnerArgsConfig.value.arguments[argName]
    const value = argumentValues.value[argName]
    
    // Special handling for logging field
    if (argName === 'logging') {
      if (value && value !== 'off') {
        args.push(`--verbose ${value}`)
      }
      continue
    }
    
    if (value === undefined || value === null || value === false || value === '') {
      continue // Skip unset arguments
    }
    
    if (config.type === 'checkbox') {
      if (value === true) {
        args.push(config.switch)
      }
    } else if (config.type === 'select_or_text') {
      if (value === 'all') {
        args.push(config.switch)
      } else if (value && value !== 'custom') {
        args.push(`${config.switch} ${value}`)
      }
    } else if (config.type === 'select') {
      // Regular select dropdown
      args.push(`${config.switch} ${value}`)
    } else {
      // text or number type
      args.push(`${config.switch} ${value}`)
    }
  }
  
  return args.join(' ')
}

function onArgumentChange() {
  // Force reactivity update when arguments change
  argumentValues.value = { ...argumentValues.value }
}

function onCancel() {
  dialogStore.closeDialog()
}

function onEnterKey() {
  // Only trigger confirm if in override mode and valid
  if (overrideMode.value && isValid.value) {
    onConfirm()
  }
}

function onConfirm() {
  const finalArgs = overrideMode.value ? manualCommandLine.value : generateCommandLine()
  
  // Save state to agentStore
  const clientId = agentStore.selectedTarget
  if (overrideMode.value) {
    // If override is checked, save the custom args and override state
    agentStore.setClientRunnerArgs(clientId, {
      override: true,
      customArgs: manualCommandLine.value,
      argumentValues: {} // Don't save argument values in override mode
    })
  } else {
    // If override is unchecked, save the argument values but not custom args
    agentStore.setClientRunnerArgs(clientId, {
      override: false,
      customArgs: '', // Don't save custom args when not in override
      argumentValues: { ...argumentValues.value }
    })
  }
  
  props.onConfirm(finalArgs)
  dialogStore.closeDialog()
}

async function loadRunnerArgsConfig() {
  try {
    // Send WebSocket message to request runner args
    api.socket?.send(JSON.stringify({
      type: 'request_runner_args'
    }))
    
    // Listen for response using API event
    const handleRunnerArgs = (event: CustomEvent) => {
      const data = event.detail
      runnerArgsConfig.value = data
          
          // Initialize default values
          const defaults: Record<string, any> = {}
          for (const [argName, config] of Object.entries(data.arguments)) {
            const argConfig = config as ArgumentConfig
            if (argConfig.default !== undefined) {
              defaults[argName] = argConfig.default
            } else if (argConfig.type === 'checkbox') {
              defaults[argName] = false
            } else if (argConfig.type === 'number') {
              defaults[argName] = null
            } else {
              defaults[argName] = ''
            }
          }
          // Load saved state if available
          const clientId = agentStore.selectedTarget
          const savedState = agentStore.getClientRunnerArgs(clientId)
          
          if (savedState) {
            overrideMode.value = savedState.override
            if (savedState.override) {
              manualCommandLine.value = savedState.customArgs
              argumentValues.value = defaults // Use defaults when in override
            } else {
              argumentValues.value = { ...defaults, ...savedState.argumentValues }
              manualCommandLine.value = '' // Clear manual command line
            }
          } else {
            argumentValues.value = defaults
          }
          
          // Remove listener after receiving response
          api.removeEventListener('runner_args', handleRunnerArgs as any)
    }
    
    api.addEventListener('runner_args', handleRunnerArgs as any)
    
    // Timeout after 5 seconds
    setTimeout(() => {
      if (!runnerArgsConfig.value) {
        api.removeEventListener('runner_args', handleRunnerArgs as any)
        console.error('Timeout loading runner args configuration')
      }
    }, 5000)
    
  } catch (error) {
    console.error('Error loading runner args configuration:', error)
  }
}

onMounted(() => {
  console.log('=== RunnerArgsDialogContent mounted ===')
  loadRunnerArgsConfig()
})

// Also log when component is created
console.log('=== RunnerArgsDialogContent component loaded ===')
console.log('Props received:', props)
</script>

<style>
/* Global styles for command line input - not scoped to ensure they apply */
.command-line-input.readonly-mode {
  background-color: #252525 !important;
  color: #c0c0c0 !important;
}

.command-line-input.edit-mode {
  background-color: white !important;
  color: #000000 !important;
}
</style>

<style scoped>
.runner-args-dialog-content {
  padding: 1rem;
}

.arguments-section {
  border: 1px solid #e0e0e0;
  border-radius: 0.5rem;
  padding: 1rem;
  position: relative;
  z-index: 1;
}

.arguments-grid {
  padding: 0.5rem;
}

.column {
  min-width: 0; /* Prevent column overflow */
}
</style>