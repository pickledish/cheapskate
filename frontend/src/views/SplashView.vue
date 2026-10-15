<script lang="ts">
import { defineComponent } from 'vue';
import AppFooter from '@/components/AppFooter.vue';
import AppButton from '@/components/AppButton.vue';
import { supabase } from '@/lib/supabase';
import landing1 from '@/assets/landing/landing1.png';
import landing2 from '@/assets/landing/landing2.png';
import landing3 from '@/assets/landing/landing3.png';

type Feature = {
  image: string;
  alt: string;
  title: string;
  body: string;
};

export default defineComponent({
  name: 'SplashView',
  components: { AppFooter, AppButton },
  data(): {
    hasSession: boolean | null;
    features: Feature[];
  } {
    return {
      hasSession: null,
      features: [
        {
          image: landing1,
          alt: 'Asset groups with allocation goals',
          title: 'Set Investment Goals',
          body: "Define custom asset classes based on how you think about your finances, and set your portfolio's target allocation percentage for each one.",
        },
        {
          image: landing2,
          alt: 'Investment accounts',
          title: 'Parse Bank Statements',
          body: 'Download statements from your bank and use AI (cloud or local) to parse their holdings. Manual updates also supported!',
        },
        {
          image: landing3,
          alt: 'Current versus target allocation',
          title: "See How You're Doing",
          body: 'Cheapskate aggregates your holdings by class, so you get a holistic view and can adjust as needed.',
        },
      ],
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
        <h1 class="text-5xl sm:text-6xl font-bold text-primary-text tracking-tight">
          <!-- prettier-ignore -->
          <span class="mr-3 sm:mr-4">🛼</span
          ><span class="relative inline-block -translate-y-0.25 pb-9 sm:pb-11"
            >Cheapskate<svg
              class="absolute left-0 bottom-0 w-full h-7 sm:h-9 -rotate-3"
              viewBox="0 0 100 12"
              preserveAspectRatio="none"
            >
              <path
                d="M3 1 Q 25 3, 50 1 Q 75 0, 93 2
               C 100 2, 101 7, 90 6 Q 60 4, 35 6
               C 8 7, 6 10, 18 9 Q 42 8, 68 10"
                fill="none"
                stroke="currentColor"
                stroke-width="1.25"
                stroke-linecap="round"
                class="text-amber-400"
              /></svg
          ></span>
        </h1>
        <p class="mt-10 sm:mt-12 text-lg sm:text-xl text-secondary-text">
          Stay on top of your investments with (optional, local) AI
        </p>
        <div
          class="mt-12 flex flex-wrap items-center justify-center gap-3"
          v-bind:class="{ invisible: hasSession === null }"
        >
          <AppButton variant="primary" v-bind:to="ctaTo">
            {{ ctaLabel }}
          </AppButton>
          <AppButton v-if="!hasSession" variant="success" to="/login?demo=1"> View demo </AppButton>
        </div>
      </div>

      <div class="mt-28 sm:mt-36 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
        <div
          v-for="feature in features"
          v-bind:key="feature.title"
          class="bg-surface border border-surface-border rounded-lg overflow-hidden flex flex-col"
        >
          <div
            class="shrink-0 border-b border-surface-border bg-linear-to-br from-blue-100 via-indigo-100 to-sky-200 dark:from-blue-900/60 dark:via-indigo-950/70 dark:to-slate-900 p-6 sm:p-8"
          >
            <div class="aspect-[4/3] flex items-center justify-center">
              <img
                v-bind:src="feature.image"
                v-bind:alt="feature.alt"
                class="box-content max-h-full max-w-full bg-[#0b0d10] p-3 sm:p-4 rounded-md ring-1 ring-black/10 dark:ring-white/15 shadow-xl shadow-black/30"
              />
            </div>
          </div>
          <div class="p-8">
            <h2 class="text-lg font-semibold text-primary-text">{{ feature.title }}</h2>
            <p class="mt-3 text-sm text-muted-text">{{ feature.body }}</p>
          </div>
        </div>
      </div>

      <section class="mt-28 sm:mt-36 max-w-3xl mx-auto text-center">
        <h2 class="text-xl font-semibold text-primary-text">Always Free and Open Source</h2>
        <p class="mt-6 text-secondary-text leading-relaxed">
          Hi, I'm
          <a href="https://www.willett.io/about/" class="text-link hover:text-link-hover underline"
            >Brandon</a
          >! I made Cheapskate because it was something I needed, not to make money, so there's no
          way to pay for it now and there never will be. Besides, it was designed such that it costs
          almost nothing to run anyway! You can look at the source
          <a
            href="https://github.com/pickledish/cheapskate"
            class="text-link hover:text-link-hover underline"
            >here</a
          >, read more about the tech underpinning Cheapskate
          <a
            href="https://www.willett.io/posts/cheapskate/"
            class="text-link hover:text-link-hover underline"
            >here</a
          >, or shoot me an email
          <a href="mailto:brandon@willett.io" class="text-link hover:text-link-hover underline"
            >here</a
          >
          if you have thoughts or questions about the site. Thanks for checking it out!
        </p>
        <p class="mt-6 text-sm text-muted-text">
          <a href="/privacy.txt" class="hover:underline">Privacy</a>
          <span class="mx-2">·</span>
          <a href="/terms.txt" class="hover:underline">Terms</a>
        </p>
      </section>
    </main>
    <AppFooter class="shrink-0" />
  </div>
</template>
