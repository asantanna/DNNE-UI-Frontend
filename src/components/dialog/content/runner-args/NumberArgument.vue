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
    <InputNumber
      :id="`arg-${argName}`"
      :modelValue="modelValue"
      @update:modelValue="$emit('update:modelValue', $event)"
      :placeholder="argument.placeholder || ''"
      :class="{ 'flex-1': labelOnSameLine, 'w-full': !labelOnSameLine }"
      :useGrouping="false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import InputNumber from 'primevue/inputnumber'

const props = defineProps<{
  argument: any
  argName: string
  modelValue: number | null
}>()

defineEmits<{
  'update:modelValue': [value: number | null]
}>()

// Default label_on_same_line to true if not specified
const labelOnSameLine = computed(() => props.argument.label_on_same_line !== false)
</script>