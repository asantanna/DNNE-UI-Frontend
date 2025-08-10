<template>
  <div :class="{ 
    'flex items-center gap-2': labelOnSameLine,
    'mb-3': !labelOnSameLine 
  }">
    <label :for="`arg-${argName}`" 
           :class="{ 
             'text-sm min-w-[140px]': labelOnSameLine,
             'block text-sm mb-1': !labelOnSameLine
           }"
           v-tooltip="argument.description">
      {{ argument.label }}
    </label>
    <div class="flex gap-2" :class="{ 'flex-1': labelOnSameLine, 'w-full': !labelOnSameLine }">
      <Dropdown
        :id="`arg-${argName}-select`"
        v-model="selectedOption"
        :options="dropdownOptions"
        optionLabel="label"
        optionValue="value"
        class="flex-shrink-0"
        style="width: 150px"
        appendTo="self"
      />
      <InputText
        v-if="selectedOption === 'custom'"
        :id="`arg-${argName}-text`"
        v-model="customValue"
        :placeholder="argument.placeholder || ''"
        class="flex-grow"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Dropdown from 'primevue/dropdown'
import InputText from 'primevue/inputtext'

const props = defineProps<{
  argument: any
  argName: string
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// Default label_on_same_line to true if not specified
const labelOnSameLine = computed(() => props.argument.label_on_same_line !== false)

const dropdownOptions = computed(() => {
  const options = [
    { label: 'None', value: '' },
    ...(props.argument.options || []).map((opt: string) => ({
      label: opt === 'all' ? 'All' : opt === 'custom' ? 'Custom' : opt.charAt(0).toUpperCase() + opt.slice(1),
      value: opt
    }))
  ]
  return options
})

// Initialize values properly
const initOption = () => {
  if (!props.modelValue || props.modelValue === '') {
    return ''
  }
  if (props.argument.options?.includes(props.modelValue)) {
    return props.modelValue
  }
  return 'custom'
}

const selectedOption = ref(initOption())
const customValue = ref(
  selectedOption.value === 'custom' ? props.modelValue : ''
)

// Watch for changes and emit
watch([selectedOption, customValue], () => {
  if (selectedOption.value === 'custom') {
    emit('update:modelValue', customValue.value)
  } else {
    emit('update:modelValue', selectedOption.value)
  }
})

// Watch for external modelValue changes
watch(() => props.modelValue, (newValue) => {
  if (newValue === '' || props.argument.options?.includes(newValue)) {
    selectedOption.value = newValue
  } else {
    selectedOption.value = 'custom'
    customValue.value = newValue
  }
})
</script>