<script>
import { supabase } from '@/lib/supabase'

export default {
  name: 'AppNav',
  data() {
    return {
      userEmail: null
    }
  },
  async mounted() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      this.userEmail = session.user.email
    }
  },
  methods: {
    async logout() {
      await supabase.auth.signOut()
      this.$router.push('/login')
    }
  }
}
</script>

<template>
  <nav class="bg-white border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
        <div class="flex">
          <div class="flex-shrink-0 flex items-center">
            <span class="text-2xl font-bold text-gray-900">Cheapskate</span>
          </div>
          <div class="hidden sm:ml-6 sm:flex sm:space-x-8">
            <router-link
              to="/accounts"
              class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              v-bind:class="$route.path === '/accounts' ? 'border-blue-500 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
            >
              Accounts
            </router-link>
            <router-link
              to="/assets"
              class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              v-bind:class="$route.path === '/assets' ? 'border-blue-500 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
            >
              Assets
            </router-link>
            <router-link
              to="/goals"
              class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              v-bind:class="$route.path === '/goals' ? 'border-blue-500 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
            >
              Goals
            </router-link>
            <router-link
              to="/composition"
              class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              v-bind:class="$route.path === '/composition' ? 'border-blue-500 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
            >
              Composition
            </router-link>
            <router-link
              to="/"
              class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              v-bind:class="$route.path === '/' ? 'border-blue-500 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
            >
              Net Worth
            </router-link>
            <router-link
              to="/history"
              class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              v-bind:class="$route.path === '/history' ? 'border-blue-500 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
            >
              History
            </router-link>
          </div>
        </div>
        <div class="flex items-center">
          <span v-if="userEmail" class="text-sm text-gray-500 mr-4">{{ userEmail }}</span>
          <button
            v-on:click="logout"
            class="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  </nav>
</template>
