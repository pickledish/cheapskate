<script>
import { supabase } from '@/lib/supabase'
import { UserCircleIcon } from '@heroicons/vue/24/solid'
import { Bars3Icon, XMarkIcon } from '@heroicons/vue/24/outline'
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue'

export default {
  name: 'AppNav',
  components: {
    UserCircleIcon,
    Bars3Icon,
    XMarkIcon,
    Disclosure,
    DisclosureButton,
    DisclosurePanel
  },
  data() {
    return {
      userEmail: null,
      goalsCompleted: false,
      accountsCompleted: false,
      assetsCompleted: false
    }
  },
  computed: {
    navItems() {
      return [
        { to: '/goals', label: 'Goals', enabled: true },
        { to: '/accounts', label: 'Accounts', enabled: this.goalsCompleted },
        { to: '/assets', label: 'Assets', enabled: this.accountsCompleted },
        { to: '/rebalancing', label: 'Rebalancing', enabled: this.assetsCompleted },
        { to: '/networth', label: 'Net Worth', enabled: this.assetsCompleted },
        { to: '/history', label: 'History', enabled: this.assetsCompleted }
      ]
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
      const isActive = this.$route.path.startsWith(path)
      if (!enabled) {
        return 'border-transparent text-placeholder-text cursor-not-allowed pointer-events-none'
      }
      return isActive
        ? 'border-blue-500 text-primary-text'
        : 'border-transparent text-muted-text hover:text-secondary-text hover:border-surface-border-strong'
    },
    mobileNavClass(path, enabled) {
      const isActive = this.$route.path.startsWith(path)
      if (!enabled) {
        return 'border-transparent text-placeholder-text cursor-not-allowed pointer-events-none'
      }
      return isActive
        ? 'border-blue-500 text-primary-text'
        : 'border-transparent text-muted-text hover:bg-surface-recessed hover:text-secondary-text'
    }
  }
}
</script>

<template>
  <nav class="bg-surface border-b border-surface-border">
    <!-- Remount on navigate so the mobile menu closes -->
    <Disclosure
      v-bind:key="$route.fullPath"
      as="div"
      class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      v-slot="{ open }"
    >
      <div class="flex justify-between h-16">
        <div class="flex">
          <div class="flex-shrink-0 flex items-center">
            <span class="text-xl font-semibold text-primary-text">
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
              v-for="item in navItems"
              v-bind:key="'desktop-' + item.to"
              v-bind:to="item.to"
              class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              v-bind:class="navClass(item.to, item.enabled)"
              v-bind:tabindex="item.enabled ? 0 : -1"
            >
              {{ item.label }}
            </router-link>
          </div>
        </div>
        <div class="flex">
          <DisclosureButton class="sm:hidden self-center inline-flex items-center justify-center p-2 rounded-md text-muted-text hover:text-secondary-text hover:bg-surface-recessed-deep">
            <span class="sr-only">Open main menu</span>
            <Bars3Icon v-if="!open" class="w-6 h-6" />
            <XMarkIcon v-else class="w-6 h-6" />
          </DisclosureButton>
          <router-link
            to="/profile"
            class="inline-flex items-center gap-2 px-1 pt-1 border-b-2 text-sm font-medium"
            v-bind:class="$route.path === '/profile' ? 'border-blue-500 text-primary-text' : 'border-transparent text-muted-text hover:text-secondary-text hover:border-surface-border-strong'"
          >
            <UserCircleIcon class="w-5 h-5" />
            <span v-if="userEmail" class="hidden sm:inline">{{ userEmail }}</span>
          </router-link>
        </div>
      </div>

      <!-- Mobile menu: same grid-rows slide as UploadStatementModal privacy disclosure -->
      <div
        class="sm:hidden grid transition-all duration-200 ease-out"
        v-bind:class="open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'"
      >
        <DisclosurePanel static class="overflow-hidden">
          <div class="border-t border-surface-border py-2 space-y-1">
            <router-link
              v-for="item in navItems"
              v-bind:key="'mobile-' + item.to"
              v-bind:to="item.to"
              class="block border-l-4 py-2 pl-3 pr-4 text-sm font-medium"
              v-bind:class="mobileNavClass(item.to, item.enabled)"
              v-bind:tabindex="item.enabled ? 0 : -1"
            >
              {{ item.label }}
            </router-link>
          </div>
        </DisclosurePanel>
      </div>
    </Disclosure>
  </nav>
</template>
