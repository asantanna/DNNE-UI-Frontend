<template>
  <div class="flex items-center">
    <Checkbox 
      :modelValue="modelValue"
      @update:modelValue="$emit('update:modelValue', $event)"
      :inputId="`arg-${argName}`"
      binary
    />
    <label :for="`arg-${argName}`" class="ml-2">
      <span class="font-medium">{{ argument.label }}</span>
      <span class="text-sm text-gray-600 ml-2">{{ argument.description }}</span>
    </label>
  </div>
</template>

<script setup lang="ts">
import Checkbox from 'primevue/checkbox'

defineProps<{
  argument: any
  argName: string
  modelValue: boolean
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>