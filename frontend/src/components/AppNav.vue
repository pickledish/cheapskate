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
            <span class="text-xl font-semibold text-gray-900">
              <span class="mr-2">🛼</span><span class="relative inline-block -translate-y-0.25">Cheapskate<svg class="absolute left-0 -bottom-2.5 w-full h-3 -rotate-3" viewBox="0 0 100 12" preserveAspectRatio="none">
                  <path 
                    d="M3 1 Q 25 3, 50 1 Q 75 0, 93 2
                       C 100 2, 101 7, 90 6 Q 60 4, 35 6
                       C 8 7, 6 10, 18 9 Q 42 8, 68 10"
                    fill="none" 
                    stroke="currentColor" 
                    stroke-width="1.25"
                    stroke-linecap="round"
                    class="text-amber-400"
                  />
                </svg></span>
            </span>
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
