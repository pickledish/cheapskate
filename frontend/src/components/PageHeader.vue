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
  <div class="flex items-center justify-between gap-3">
    <div class="min-w-0">
      <h2 class="text-2xl font-bold text-gray-900">{{ title }}</h2>
      <p v-if="description" class="mt-1 text-sm text-gray-600 hidden sm:block">
        {{ description }}
      </p>
    </div>
    <slot name="actions" />
  </div>
</template>
