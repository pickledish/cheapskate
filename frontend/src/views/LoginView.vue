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
          this.$router.push('/')
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
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="max-w-md w-full p-8 bg-white rounded-lg shadow-md">
      <h1 class="text-2xl font-bold text-center mb-6 text-gray-900">
        {{ isSignup ? 'Create Account' : 'Sign In' }}
      </h1>

      <form v-on:submit.prevent="submit" class="space-y-4">
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            minlength="6"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

      <p class="mt-4 text-center text-sm text-gray-600">
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
