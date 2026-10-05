<script lang="ts">
import { defineComponent } from 'vue';
import AppFooter from '@/components/AppFooter.vue';
import AppButton from '@/components/AppButton.vue';
import { supabase } from '@/lib/supabase';
import { ChartPieIcon, DocumentChartBarIcon, ShieldCheckIcon } from '@heroicons/vue/24/outline';

export default defineComponent({
  name: 'SplashView',
  components: { AppFooter, AppButton, ChartPieIcon, DocumentChartBarIcon, ShieldCheckIcon },
  data(): {
    hasSession: boolean | null;
  } {
    return {
      hasSession: null,
    };
  },
  computed: {
    ctaLabel(): string {
      return this.hasSession ? 'Go to app' : 'Sign in';
    },
    ctaTo(): string {
      return this.hasSession ? '/accounts' : '/login';
    },
  },
  async mounted() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    this.hasSession = !!session;
  },
});
</script>

<template>
  <div class="bg-page min-h-screen flex flex-col">
    <main class="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
      <div class="text-center max-w-2xl mx-auto">
        <h1 class="text-5xl sm:text-6xl font-bold text-primary-text tracking-tight">cheapskate</h1>
        <p class="mt-8 text-lg sm:text-xl text-secondary-text">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        </p>
        <AppButton v-if="hasSession !== null" variant="primary" v-bind:to="ctaTo" class="mt-12">
          {{ ctaLabel }}
        </AppButton>
      </div>

      <div class="mt-28 sm:mt-36 grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16">
        <div class="bg-surface border border-surface-border rounded-lg p-8">
          <ChartPieIcon class="w-8 h-8 text-link" />
          <h2 class="mt-6 text-lg font-semibold text-primary-text">Lorem ipsum</h2>
          <p class="mt-3 text-sm text-muted-text">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
            incididunt ut labore et dolore magna aliqua.
          </p>
        </div>
        <div class="bg-surface border border-surface-border rounded-lg p-8">
          <DocumentChartBarIcon class="w-8 h-8 text-link" />
          <h2 class="mt-6 text-lg font-semibold text-primary-text">Dolor sit amet</h2>
          <p class="mt-3 text-sm text-muted-text">
            Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
            commodo consequat.
          </p>
        </div>
        <div class="bg-surface border border-surface-border rounded-lg p-8">
          <ShieldCheckIcon class="w-8 h-8 text-link" />
          <h2 class="mt-6 text-lg font-semibold text-primary-text">Consectetur elit</h2>
          <p class="mt-3 text-sm text-muted-text">
            Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat
            nulla pariatur.
          </p>
        </div>
      </div>

      <section class="mt-28 sm:mt-36 max-w-3xl mx-auto text-center">
        <h2 class="text-xl font-semibold text-primary-text">Excepteur sint occaecat</h2>
        <p class="mt-6 text-secondary-text leading-relaxed">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt
          ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation
          ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in
          reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur
          sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id
          est laborum.
        </p>
      </section>
    </main>
    <AppFooter class="shrink-0" />
  </div>
</template>
