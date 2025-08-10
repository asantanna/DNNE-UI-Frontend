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
    <Dropdown
      :id="`arg-${argName}`"
      v-model="selectedValue"
      :options="dropdownOptions"
      optionLabel="label"
      optionValue="value"
      :placeholder="argument.placeholder || 'Select...'"
      :class="{ 'flex-1': labelOnSameLine, 'w-full': !labelOnSameLine }"
      appendTo="self"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Dropdown from 'primevue/dropdown'

const props = defineProps<{
  argument: any
  argName: string
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// Local value that syncs with modelValue, initialize properly
const selectedValue = ref(props.modelValue || props.argument.default || 'off')

// Watch for changes and emit
watch(selectedValue, (newValue) => {
  emit('update:modelValue', newValue)
}, { immediate: true })

// Watch for external modelValue changes
watch(() => props.modelValue, (newValue) => {
  if (newValue !== undefined) {
    selectedValue.value = newValue
  }
})

// Default label_on_same_line to true if not specified
const labelOnSameLine = computed(() => props.argument.label_on_same_line !== false)

// Convert options to dropdown format
const dropdownOptions = computed(() => {
  return (props.argument.options || []).map((opt: string) => ({
    label: opt === 'off' ? 'Off' : opt,
    value: opt
  }))
})
</script>