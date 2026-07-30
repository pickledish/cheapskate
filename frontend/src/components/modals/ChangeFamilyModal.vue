<script>
import BaseModal from './BaseModal.vue'
import { supabase } from '@/lib/supabase'

export default {
  name: 'ChangeFamilyModal',
  components: { BaseModal },
  emits: ['close', 'changed'],
  data() {
    return {
      mode: 'create', // 'create' | 'join'
      familyId: '',
      loading: false,
      error: null
    }
  },
  computed: {
    canSubmit() {
      if (this.mode === 'create') return true
      return this.familyId.trim().length > 0
    }
  },
  methods: {
    async executeChange() {
      if (!this.canSubmit) return

      this.loading = true
      this.error = null

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        let newFamilyId

        if (this.mode === 'create') {
          // Generate UUID client-side (same pattern as SetupView)
          newFamilyId = crypto.randomUUID()

          const { error: insertError } = await supabase
            .from('families')
            .insert({ id: newFamilyId })

          if (insertError) throw insertError

        } else {
          // Validate UUID format
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          if (!uuidRegex.test(this.familyId.trim())) {
            throw new Error('Invalid family ID format. Please enter a valid UUID.')
          }
          newFamilyId = this.familyId.trim()
        }

        // Update profile first (trigger cleanup_empty_family() handles deleting old family if empty)
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ family_id: newFamilyId })
          .eq('id', user.id)

        if (profileError) throw profileError

        // Now update user_metadata to match
        const { error: updateError } = await supabase.auth.updateUser({
          data: { family_id: newFamilyId }
        })
        if (updateError) throw updateError

        // Refresh session to get new JWT with updated metadata
        const { error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError) throw refreshError

        this.$emit('changed')

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
  <BaseModal title="Change Family" max-width="max-w-lg" v-on:close="$emit('close')">
    <!-- Error display -->
    <div v-if="error" class="mb-4 p-3 bg-red-50 text-red-800 rounded-md text-sm">
      {{ error }}
    </div>

    <div class="space-y-3">
      <!-- Create new family -->
      <label
        class="block p-4 border rounded-lg cursor-pointer transition-colors"
        v-bind:class="mode === 'create' ? 'border-blue-500 bg-blue-50' : 'border-subtle-border hover:border-strong-border'"
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
        <p class="ml-7 text-sm text-muted-text mt-1">
          Create a fresh family with just you as a member.
        </p>
      </label>

      <!-- Join existing family -->
      <label
        class="block p-4 border rounded-lg cursor-pointer transition-colors"
        v-bind:class="mode === 'join' ? 'border-blue-500 bg-blue-50' : 'border-subtle-border hover:border-strong-border'"
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
            class="w-full px-3 py-2 border border-strong-border rounded-md bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm disabled:bg-recessed-deep disabled:text-placeholder-text"
            placeholder="Enter family secret"
            v-on:click.stop
          />
        </div>
      </label>
    </div>

    <template #secondary>
      <button
        v-on:click="$emit('close')"
        class="px-4 py-2 text-secondary-text hover:text-primary-text"
      >
        Cancel
      </button>
    </template>
    <template #primary>
      <button
        v-on:click="executeChange"
        v-bind:disabled="!canSubmit || loading"
        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {{ loading ? 'Processing...' : 'Change Family' }}
      </button>
    </template>
  </BaseModal>
</template>
