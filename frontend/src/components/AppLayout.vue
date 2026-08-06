<script lang="ts">
import { defineComponent } from 'vue';
import AppNav from './AppNav.vue';
import AppFooter from './AppFooter.vue';

export default defineComponent({
  name: 'AppLayout',
  components: { AppNav, AppFooter },
});
</script>

<template>
  <div class="min-h-screen bg-page flex flex-col">
    <AppNav />
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
      <slot />
    </main>
    <AppFooter />
  </div>
</template>
