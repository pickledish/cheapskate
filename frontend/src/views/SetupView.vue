<script>
import { supabase } from '@/lib/supabase'
import { insertFamily, insertProfile } from '@/lib/data'

export default {
  name: 'SetupView',
  data() {
    return {
      name: '',
      mode: 'create', // 'create' or 'join'
      familyId: '',
      loading: false,
      error: null
    }
  },
  computed: {
    canSubmit() {
      if (!this.name.trim()) return false
      if (this.mode === 'join' && !this.familyId.trim()) return false
      return true
    }
  },
  async mounted() {
    // Pre-fill name from OAuth provider profile (e.g. Google sign-in)
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.user_metadata?.full_name) {
      this.name = user.user_metadata.full_name
    }
  },
  methods: {
    async submit() {
      if (!this.canSubmit) return

      this.error = null
      this.loading = true

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        let familyId

        if (this.mode === 'create') {
          // Generate UUID client-side (we can't SELECT it back due to RLS)
          familyId = crypto.randomUUID()
          await insertFamily(familyId)
        } else {
          // Validate UUID format
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          if (!uuidRegex.test(this.familyId)) {
            throw new Error('Invalid family secret format')
          }
          familyId = this.familyId
        }

        // Update user metadata with the family_id
        // If joining an existing family, skip onboarding - the family already has data set up,
        // so there's no need to walk them through goals/accounts/assets setup.
        const metadata = { family_id: familyId }
        if (this.mode === 'join') {
          metadata.goals_completed = true
          metadata.accounts_completed = true
          metadata.assets_completed = true
        }

        const { error: updateError } = await supabase.auth.updateUser({
          data: metadata
        })

        if (updateError) throw updateError

        // Refresh session to get new JWT with updated metadata
        await supabase.auth.refreshSession()

        // Create profile
        await insertProfile({
          id: user.id,
          family_id: familyId,
          name: this.name.trim()
        })

        // Redirect: new families start onboarding, joining families go to accounts
        this.$router.push(this.mode === 'create' ? '/goals' : '/accounts')
      } catch (err) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-canvas">
    <div class="max-w-md w-full p-8 bg-white rounded-lg shadow-md">
      <h1 class="text-2xl font-bold text-center mb-6 text-primary-text">
        Welcome to Cheapskate
      </h1>

      <!-- Name input -->
      <div class="mb-6">
        <label for="name" class="block text-sm font-medium text-secondary-text mb-1">
          Your name
        </label>
        <input
          id="name"
          v-model="name"
          type="text"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter your name"
        />
      </div>

      <hr class="mb-6 border-gray-200" />

      <!-- Family options -->
      <div class="space-y-3">
        <!-- Create new family -->
        <label
          class="block p-4 border rounded-lg cursor-pointer transition-colors"
          v-bind:class="mode === 'create' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'"
        >
          <div class="flex items-center">
            <input
              type="radio"
              v-model="mode"
              value="create"
              class="h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            <span class="ml-3 font-medium text-primary-text">Start a new family</span>
          </div>
        </label>

        <!-- Join existing family -->
        <label
          class="block p-4 border rounded-lg cursor-pointer transition-colors"
          v-bind:class="mode === 'join' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'"
        >
          <div class="flex items-center">
            <input
              type="radio"
              v-model="mode"
              value="join"
              class="h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            <span class="ml-3 font-medium text-primary-text">Join an existing family</span>
          </div>
          <div class="mt-3 ml-7">
            <input
              v-model="familyId"
              type="text"
              v-bind:disabled="mode !== 'join'"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm disabled:bg-gray-100 disabled:text-placeholder-text"
              placeholder="Enter family secret"
              v-on:click.stop
            />
          </div>
        </label>
      </div>

      <!-- Error display -->
      <div v-if="error" class="mt-4 p-3 rounded-md bg-red-50 text-red-800 text-sm">
        {{ error }}
      </div>

      <!-- Submit button -->
      <button
        v-on:click="submit"
        v-bind:disabled="!canSubmit || loading"
        class="mt-6 w-full py-3 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
      >
        {{ loading ? 'Setting up...' : 'Continue' }}
      </button>
    </div>
  </div>
</template>
