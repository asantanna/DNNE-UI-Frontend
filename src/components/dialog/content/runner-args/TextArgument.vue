<template>
  <div class="mb-3">
    <label :for="`arg-${argName}`" class="block mb-1">
      <span class="font-medium text-sm">{{ argument.label }}</span>
      <span class="text-xs text-gray-600 ml-2">{{ argument.description }}</span>
    </label>
    <InputText
      :id="`arg-${argName}`"
      :modelValue="modelValue"
      @update:modelValue="$emit('update:modelValue', $event)"
      :placeholder="String(argument.placeholder || argument.default || '')"
      class="w-full"
    />
  </div>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'

defineProps<{
  argument: any
  argName: string
  modelValue: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>