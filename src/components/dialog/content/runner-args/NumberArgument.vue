<template>
  <div class="mb-3">
    <label :for="`arg-${argName}`" class="block mb-1">
      <span class="font-medium text-sm">{{ argument.label }}</span>
      <span class="text-xs text-gray-600 ml-2">{{ argument.description }}</span>
    </label>
    <InputNumber
      :id="`arg-${argName}`"
      :modelValue="modelValue"
      @update:modelValue="$emit('update:modelValue', $event)"
      :placeholder="argument.placeholder || ''"
      class="w-full"
      :useGrouping="false"
    />
  </div>
</template>

<script setup lang="ts">
import InputNumber from 'primevue/inputnumber'

defineProps<{
  argument: any
  argName: string
  modelValue: number | null
}>()

defineEmits<{
  'update:modelValue': [value: number | null]
}>()
</script>