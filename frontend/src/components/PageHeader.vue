<script>
export default {
  name: 'PageHeader',
  props: {
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      default: null
    }
  }
}
</script>

<template>
  <div class="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-3 sm:gap-y-1">
    <h2 class="min-w-0 truncate text-2xl font-bold text-gray-900">{{ title }}</h2>
    <div class="shrink-0 sm:row-span-2 self-center">
      <slot name="actions" />
    </div>
    <p v-if="description" class="col-span-2 sm:col-span-1 text-sm text-gray-600">
      {{ description }}
    </p>
  </div>
</template>
