<template>
  <div class="runner-args-dialog-content">
    <!-- Command Line Preview -->
    <div class="command-preview-section mb-4">
      <label class="block text-sm font-medium mb-2">Command Line Arguments:</label>
      <InputText 
        v-model="commandLine"
        :readonly="!overrideMode"
        class="w-full font-mono text-sm"
        :class="{ 'bg-gray-100': !overrideMode }"
      />
      <div class="flex items-center mt-2">
        <Checkbox 
          v-model="overrideMode" 
          inputId="override-args"
          binary
        />
        <label for="override-args" class="ml-2 text-sm">
          Override Arguments (Manual Edit)
        </label>
      </div>
    </div>

    <!-- Argument Groups (hidden in override mode) -->
    <div v-if="!overrideMode && runnerArgsConfig" class="arguments-section">
      <ScrollPanel style="height: 400px">
        <div v-for="group in sortedGroups" :key="group.name" class="mb-4">
          <h3 class="text-sm font-semibold mb-2 text-gray-700">{{ group.label }}</h3>
          <div class="pl-2">
            <div v-for="argName in getArgumentsForGroup(group.name)" :key="argName" class="mb-3">
              <component 
                :is="getComponentForArgument(runnerArgsConfig.arguments[argName])"
                :argument="runnerArgsConfig.arguments[argName]"
                :argName="argName"
                v-model="argumentValues[argName]"
                @update:modelValue="onArgumentChange"
              />
            </div>
          </div>
        </div>
      </ScrollPanel>
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
        label="Export with Arguments" 
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
import ScrollPanel from 'primevue/scrollpanel'
import ProgressSpinner from 'primevue/progressspinner'
import { useDialogStore } from '@/stores/dialogStore'
import { api } from '@/scripts/api'

// Import argument input components
import CheckboxArgument from './runner-args/CheckboxArgument.vue'
import TextArgument from './runner-args/TextArgument.vue'
import NumberArgument from './runner-args/NumberArgument.vue'
import SelectOrTextArgument from './runner-args/SelectOrTextArgument.vue'

interface RunnerArgsConfig {
  arguments: Record<string, ArgumentConfig>
  argument_order: string[]
  groups: Record<string, GroupConfig>
}

interface ArgumentConfig {
  switch: string
  shortSwitch?: string
  type: 'checkbox' | 'text' | 'number' | 'select_or_text'
  label: string
  description: string
  default?: any
  options?: string[]
  placeholder?: string
  group: string
}

interface GroupConfig {
  label: string
  order: number
}

const props = defineProps<{
  onConfirm: (args: string) => void
}>()

const dialogStore = useDialogStore()
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

const sortedGroups = computed(() => {
  if (!runnerArgsConfig.value) return []
  
  return Object.entries(runnerArgsConfig.value.groups)
    .map(([name, config]) => ({ name, ...config }))
    .sort((a, b) => a.order - b.order)
})

const isValid = computed(() => {
  if (overrideMode.value) {
    // In override mode, just check that something is entered
    return manualCommandLine.value.trim().length > 0
  }
  return true // All arguments are optional
})

function getArgumentsForGroup(groupName: string): string[] {
  if (!runnerArgsConfig.value) return []
  
  // Use argument_order to maintain consistent ordering
  return runnerArgsConfig.value.argument_order.filter(argName => {
    const arg = runnerArgsConfig.value!.arguments[argName]
    return arg && arg.group === groupName
  })
}

function getComponentForArgument(arg: ArgumentConfig) {
  switch (arg.type) {
    case 'checkbox':
      return CheckboxArgument
    case 'text':
      return TextArgument
    case 'number':
      return NumberArgument
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

function onConfirm() {
  const finalArgs = overrideMode.value ? manualCommandLine.value : generateCommandLine()
  props.onConfirm(finalArgs)
  dialogStore.closeDialog()
}

async function loadRunnerArgsConfig() {
  try {
    // Send WebSocket message to request runner args
    api.socket?.send(JSON.stringify({
      type: 'request_runner_args'
    }))
    
    // Listen for response
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'runner_args') {
          runnerArgsConfig.value = data.data
          
          // Initialize default values
          const defaults: Record<string, any> = {}
          for (const [argName, config] of Object.entries(data.data.arguments)) {
            const argConfig = config as ArgumentConfig
            if (argConfig.default !== undefined) {
              defaults[argName] = argConfig.default
            } else if (argConfig.type === 'checkbox') {
              defaults[argName] = false
            } else {
              defaults[argName] = ''
            }
          }
          argumentValues.value = defaults
          
          // Remove listener after receiving response
          api.socket?.removeEventListener('message', handleMessage)
        }
      } catch (e) {
        console.error('Error parsing WebSocket message:', e)
      }
    }
    
    api.socket?.addEventListener('message', handleMessage)
    
    // Timeout after 5 seconds
    setTimeout(() => {
      if (!runnerArgsConfig.value) {
        api.socket?.removeEventListener('message', handleMessage)
        console.error('Timeout loading runner args configuration')
      }
    }, 5000)
    
  } catch (error) {
    console.error('Error loading runner args configuration:', error)
  }
}

onMounted(() => {
  loadRunnerArgsConfig()
})
</script>

<style scoped>
.runner-args-dialog-content {
  padding: 1rem;
  min-width: 600px;
  max-width: 800px;
}

.command-preview-section {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 0.5rem;
}

.arguments-section {
  border: 1px solid #e0e0e0;
  border-radius: 0.5rem;
  padding: 1rem;
}
</style>