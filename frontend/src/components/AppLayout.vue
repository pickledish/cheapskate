<script lang="ts">
import { defineComponent } from 'vue';
import AppNav from './AppNav.vue';
import AppFooter from './AppFooter.vue';

export default defineComponent({
  name: 'AppLayout',
  components: { AppNav, AppFooter },
  props: {
    /** Lock the shell to the viewport from `md` up (page scroll still allowed on mobile). */
    fillViewport: {
      type: Boolean,
      default: false,
    },
  },
});
</script>

<template>
  <div
    v-bind:class="[
      'bg-page flex flex-col',
      fillViewport ? 'min-h-dvh md:h-dvh md:overflow-hidden' : 'min-h-screen',
    ]"
  >
    <AppNav class="shrink-0" />
    <main
      v-bind:class="[
        'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full',
        fillViewport ? 'md:flex md:min-h-0 md:flex-col md:overflow-hidden' : '',
      ]"
    >
      <slot />
    </main>
    <AppFooter class="shrink-0" />
  </div>
</template>
