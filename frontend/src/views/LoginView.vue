<script lang="ts">
import { defineComponent } from 'vue';
import { supabase } from '@/lib/supabase';
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/lib/data';
import { formatError } from '@/lib/util/error';
import AppButton from '@/components/AppButton.vue';

export default defineComponent({
  name: 'LoginView',
  components: { AppButton },
  data() {
    return {
      email: '',
      password: '',
      isSignup: false,
      loading: false,
      error: null as string | null,
    };
  },
  computed: {
    buttonText(): string {
      if (this.loading) return 'Loading...';
      return this.isSignup ? 'Sign Up' : 'Log In';
    },
  },
  created() {
    if (this.$route.query.demo !== '1') return;
    this.email = DEMO_EMAIL;
    this.password = DEMO_PASSWORD;
  },
  methods: {
    async signInWithGoogle() {
      this.error = null;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + window.location.pathname,
        },
      });
      if (error) this.error = formatError(error);
    },
    async submit() {
      this.error = null;
      this.loading = true;

      try {
        if (this.isSignup) {
          const { error } = await supabase.auth.signUp({
            email: this.email,
            password: this.password,
          });
          if (error) throw error;
          this.error = 'Check your email for a confirmation link!';
        } else {
          const { error } = await supabase.auth.signInWithPassword({
            email: this.email,
            password: this.password,
          });
          if (error) throw error;
          await this.$router.push('/accounts');
        }
      } catch (err) {
        this.error = formatError(err);
      } finally {
        this.loading = false;
      }
    },
    toggleMode() {
      this.isSignup = !this.isSignup;
      this.error = null;
    },
  },
});
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-page px-4">
    <div class="max-w-md w-full p-8 bg-surface rounded-lg shadow-md">
      <router-link
        to="/"
        class="mx-auto mb-8 flex w-fit justify-center text-4xl font-bold leading-none tracking-tight text-primary-text rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <!-- prettier-ignore -->
        <span class="mr-2.5">🛼</span
        ><span class="relative inline-block -translate-y-0.25 pb-6"
          >Cheapskate<svg
            class="absolute left-0 bottom-0 w-full h-5 -rotate-3"
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
      </router-link>

      <h1 class="text-2xl font-bold text-center mb-6 text-primary-text">
        {{ isSignup ? 'Create Account' : 'Sign In' }}
      </h1>

      <AppButton variant="secondary" class="w-full" v-on:click="signInWithGoogle">
        <svg class="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Continue with Google
      </AppButton>

      <div class="relative my-4">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-surface-border-strong"></div>
        </div>
        <div class="relative flex justify-center text-sm">
          <span class="px-2 bg-surface text-muted-text">or</span>
        </div>
      </div>

      <form class="space-y-4" v-on:submit.prevent="submit">
        <div>
          <label for="email" class="block text-sm font-medium text-secondary-text mb-1">
            Email
          </label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            class="w-full px-3 py-2 border border-surface-border-strong rounded-md bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-secondary-text mb-1">
            Password
          </label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            minlength="6"
            class="w-full px-3 py-2 border border-surface-border-strong rounded-md bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter your password"
          />
        </div>

        <div
          v-if="error"
          class="p-3 rounded-md"
          v-bind:class="
            isSignup && !error.includes('error')
              ? 'bg-success text-success-text'
              : 'bg-error text-error-text'
          "
        >
          {{ error }}
        </div>

        <AppButton variant="primary" type="submit" class="w-full" v-bind:disabled="loading">
          {{ buttonText }}
        </AppButton>
      </form>

      <p class="mt-4 text-center text-sm text-muted-text">
        {{ isSignup ? 'Already have an account?' : "Don't have an account?" }}
        <button class="ml-1 text-link hover:text-link-hover font-medium" v-on:click="toggleMode">
          {{ isSignup ? 'Sign In' : 'Sign Up' }}
        </button>
      </p>

      <p class="mt-3 text-center text-xs text-muted-text">
        Please read the
        <a href="/terms.txt" class="text-link hover:text-link-hover underline">Terms</a>
        and
        <a href="/privacy.txt" class="text-link hover:text-link-hover underline">Privacy Policy</a>,
        they are short!
      </p>
    </div>
  </div>
</template>
