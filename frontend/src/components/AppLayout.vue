<script>
import AppNav from './AppNav.vue'

export default {
  name: 'AppLayout',
  components: { AppNav }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <AppNav />
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <slot />
    </main>
  </div>
</template>
