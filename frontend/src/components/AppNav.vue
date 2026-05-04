<script>
import { supabase } from '@/lib/supabase'
import { UserCircleIcon } from '@heroicons/vue/24/solid'

export default {
  name: 'AppNav',
  components: {
    UserCircleIcon
  },
  data() {
    return {
      userEmail: null,
      goalsCompleted: false,
      accountsCompleted: false,
      assetsCompleted: false
    }
  },
  async mounted() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      this.userEmail = session.user.email
      const metadata = session.user.user_metadata || {}
      this.goalsCompleted = metadata.goals_completed ?? false
      this.accountsCompleted = metadata.accounts_completed ?? false
      this.assetsCompleted = metadata.assets_completed ?? false
    }
  },
  methods: {
    navClass(path, enabled) {
      const isActive = path === '/'
        ? this.$route.path === '/'
        : this.$route.path.startsWith(path)
      if (!enabled) {
        return 'border-transparent text-gray-300 cursor-not-allowed pointer-events-none'
      }
      return isActive
        ? 'border-blue-500 text-gray-900'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
              to="/goals"
              class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              v-bind:class="navClass('/goals', true)"
            >
              Goals
            </router-link>
            <router-link
              to="/accounts"
              class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              v-bind:class="navClass('/accounts', goalsCompleted)"
              v-bind:tabindex="goalsCompleted ? 0 : -1"
            >
              Accounts
            </router-link>
            <router-link
              to="/assets"
              class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              v-bind:class="navClass('/assets', accountsCompleted)"
              v-bind:tabindex="accountsCompleted ? 0 : -1"
            >
              Assets
            </router-link>
            <router-link
              to="/rebalancing"
              class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              v-bind:class="navClass('/rebalancing', assetsCompleted)"
              v-bind:tabindex="assetsCompleted ? 0 : -1"
            >
              Rebalancing
            </router-link>
            <router-link
              to="/"
              class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              v-bind:class="navClass('/', assetsCompleted)"
              v-bind:tabindex="assetsCompleted ? 0 : -1"
            >
              Net Worth
            </router-link>
            <router-link
              to="/history"
              class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              v-bind:class="navClass('/history', assetsCompleted)"
              v-bind:tabindex="assetsCompleted ? 0 : -1"
            >
              History
            </router-link>
          </div>
        </div>
        <div class="flex">
          <router-link
            to="/profile"
            class="inline-flex items-center gap-2 px-1 pt-1 border-b-2 text-sm font-medium"
            v-bind:class="$route.path === '/profile' ? 'border-blue-500 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
          >
            <UserCircleIcon class="w-5 h-5" />
            <span v-if="userEmail" class="hidden sm:inline">{{ userEmail }}</span>
          </router-link>
        </div>
      </div>
    </div>
  </nav>
</template>
