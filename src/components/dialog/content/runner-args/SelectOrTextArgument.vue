<template>
  <div class="mb-3">
    <label :for="`arg-${argName}`" class="block mb-1">
      <span class="font-medium text-sm">{{ argument.label }}</span>
      <span class="text-xs text-gray-600 ml-2">{{ argument.description }}</span>
    </label>
    <div class="flex gap-2">
      <Dropdown
        :id="`arg-${argName}-select`"
        v-model="selectedOption"
        :options="dropdownOptions"
        optionLabel="label"
        optionValue="value"
        class="flex-shrink-0"
        style="width: 150px"
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

const dropdownOptions = computed(() => {
  const options = [
    { label: 'None', value: '' },
    ...(props.argument.options || []).map((opt: string) => ({
      label: opt === 'all' ? 'All' : opt.charAt(0).toUpperCase() + opt.slice(1),
      value: opt
    }))
  ]
  return options
})

const selectedOption = ref('')
const customValue = ref('')

// Initialize from modelValue
if (props.modelValue) {
  if (props.argument.options?.includes(props.modelValue) || props.modelValue === '') {
    selectedOption.value = props.modelValue
  } else {
    selectedOption.value = 'custom'
    customValue.value = props.modelValue
  }
}

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