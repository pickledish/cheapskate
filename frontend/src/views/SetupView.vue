<script>
import { supabase } from '@/lib/supabase'

export default {
  name: 'SetupView',
  data() {
    return {
      mode: 'choose', // 'choose', 'create', 'join'
      familyId: '',
      loading: false,
      error: null
    }
  },
  methods: {
    async createFamily() {
      this.error = null
      this.loading = true

      try {
        // Generate UUID client-side (we can't SELECT it back due to RLS)
        const familyId = crypto.randomUUID()

        // Create a new family
        const { error: insertError } = await supabase
          .from('families')
          .insert({ id: familyId })

        if (insertError) throw insertError

        // Update user metadata with the new family_id
        const { error: updateError } = await supabase.auth.updateUser({
          data: { family_id: familyId }
        })

        if (updateError) throw updateError

        // Refresh session to get new JWT with updated metadata
        await supabase.auth.refreshSession()

        // Redirect to dashboard
        this.$router.push('/')
      } catch (err) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },

    async joinFamily() {
      this.error = null
      this.loading = true

      try {
        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(this.familyId)) {
          throw new Error('Invalid family ID format')
        }

        // Update user metadata with the family_id
        // (We can't verify the family exists due to RLS, but if it's wrong
        // the user will just see empty data and can try again)
        const { error: updateError } = await supabase.auth.updateUser({
          data: { family_id: this.familyId }
        })

        if (updateError) throw updateError

        // Refresh session to get new JWT with updated metadata
        await supabase.auth.refreshSession()

        // Redirect to dashboard
        this.$router.push('/')
      } catch (err) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },

    setMode(mode) {
      this.mode = mode
      this.error = null
    }
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="max-w-md w-full p-8 bg-white rounded-lg shadow-md">
      <h1 class="text-2xl font-bold text-center mb-2 text-gray-900">
        Welcome to Cheapskate
      </h1>
      <p class="text-center text-gray-600 mb-6">
        Set up your family to get started
      </p>

      <!-- Choose mode -->
      <div v-if="mode === 'choose'" class="space-y-4">
        <button
          v-on:click="setMode('create')"
          class="w-full py-3 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Create a new family
        </button>
        <button
          v-on:click="setMode('join')"
          class="w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          Join an existing family
        </button>
      </div>

      <!-- Create family -->
      <div v-else-if="mode === 'create'" class="space-y-4">
        <p class="text-gray-600">
          Create a new family to start tracking your investments. You can share your family ID with others to let them join.
        </p>

        <div v-if="error" class="p-3 rounded-md bg-red-50 text-red-800">
          {{ error }}
        </div>

        <button
          v-on:click="createFamily"
          v-bind:disabled="loading"
          class="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ loading ? 'Creating...' : 'Create Family' }}
        </button>

        <button
          v-on:click="setMode('choose')"
          class="w-full py-2 px-4 text-gray-600 hover:text-gray-800"
        >
          Back
        </button>
      </div>

      <!-- Join family -->
      <div v-else-if="mode === 'join'" class="space-y-4">
        <p class="text-gray-600">
          Enter the family ID shared with you to join an existing family.
        </p>

        <div>
          <label for="familyId" class="block text-sm font-medium text-gray-700 mb-1">
            Family ID
          </label>
          <input
            id="familyId"
            v-model="familyId"
            type="text"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </div>

        <div v-if="error" class="p-3 rounded-md bg-red-50 text-red-800">
          {{ error }}
        </div>

        <button
          v-on:click="joinFamily"
          v-bind:disabled="loading || !familyId"
          class="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ loading ? 'Joining...' : 'Join Family' }}
        </button>

        <button
          v-on:click="setMode('choose')"
          class="w-full py-2 px-4 text-gray-600 hover:text-gray-800"
        >
          Back
        </button>
      </div>
    </div>
  </div>
</template>
