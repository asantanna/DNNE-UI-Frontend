<template>
  <div class="flex items-center">
    <Checkbox 
      :modelValue="modelValue"
      @update:modelValue="$emit('update:modelValue', $event)"
      :inputId="`arg-${argName}`"
      binary
    />
    <label :for="`arg-${argName}`" 
           class="ml-2 text-sm"
           v-tooltip="argument.description">
      {{ argument.label }}
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