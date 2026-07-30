<script>
import { supabase } from '@/lib/supabase'

export default {
  name: 'LoginView',
  data() {
    return {
      email: '',
      password: '',
      isSignup: false,
      loading: false,
      error: null
    }
  },
  computed: {
    buttonText() {
      if (this.loading) return 'Loading...'
      return this.isSignup ? 'Sign Up' : 'Log In'
    }
  },
  methods: {
    async signInWithGoogle() {
      this.error = null
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + window.location.pathname
        }
      })
      if (error) this.error = error.message
    },
    async submit() {
      this.error = null
      this.loading = true

      try {
        if (this.isSignup) {
          const { error } = await supabase.auth.signUp({
            email: this.email,
            password: this.password
          })
          if (error) throw error
          this.error = 'Check your email for a confirmation link!'
        } else {
          const { error } = await supabase.auth.signInWithPassword({
            email: this.email,
            password: this.password
          })
          if (error) throw error
          this.$router.push('/accounts')
        }
      } catch (err) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },
    toggleMode() {
      this.isSignup = !this.isSignup
      this.error = null
    }
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-page">
    <div class="max-w-md w-full p-8 bg-surface rounded-lg shadow-md">
      <h1 class="text-2xl font-bold text-center mb-6 text-primary-text">
        {{ isSignup ? 'Create Account' : 'Sign In' }}
      </h1>

      <button
        v-on:click="signInWithGoogle"
        type="button"
        class="w-full py-2 px-4 bg-surface border border-strong-border rounded-md hover:bg-recessed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center gap-2 text-secondary-text font-medium"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </button>

      <div class="relative my-4">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-strong-border"></div>
        </div>
        <div class="relative flex justify-center text-sm">
          <span class="px-2 bg-surface text-muted-text">or</span>
        </div>
      </div>

      <form v-on:submit.prevent="submit" class="space-y-4">
        <div>
          <label for="email" class="block text-sm font-medium text-secondary-text mb-1">
            Email
          </label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            class="w-full px-3 py-2 border border-strong-border rounded-md bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            class="w-full px-3 py-2 border border-strong-border rounded-md bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter your password"
          />
        </div>

        <div v-if="error" class="p-3 rounded-md" v-bind:class="isSignup && !error.includes('error') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'">
          {{ error }}
        </div>

        <button
          type="submit"
          v-bind:disabled="loading"
          class="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ buttonText }}
        </button>
      </form>

      <p class="mt-4 text-center text-sm text-muted-text">
        {{ isSignup ? 'Already have an account?' : "Don't have an account?" }}
        <button
          v-on:click="toggleMode"
          class="ml-1 text-blue-600 hover:text-blue-800 font-medium"
        >
          {{ isSignup ? 'Sign In' : 'Sign Up' }}
        </button>
      </p>
    </div>
  </div>
</template>
