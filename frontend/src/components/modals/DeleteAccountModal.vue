<script>
import BaseModal from './BaseModal.vue'
import { supabase } from '@/lib/supabase'

export default {
  name: 'DeleteAccountModal',
  components: { BaseModal },
  emits: ['close'],
  data() {
    return {
      confirmText: '',
      loading: false,
      error: null
    }
  },
  computed: {
    canDelete() {
      return this.confirmText === 'DELETE'
    }
  },
  methods: {
    async deleteAccount() {
      if (!this.canDelete) return

      this.loading = true
      this.error = null

      try {
        const { error: invokeError } = await supabase.functions.invoke('delete-account')
        if (invokeError) throw invokeError

        // Account deleted - sign out locally and redirect
        await supabase.auth.signOut()
        this.$router.push('/login')

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
  <BaseModal title="Delete Account" max-width="max-w-lg" v-on:close="$emit('close')">
    <!-- Warning -->
    <div class="bg-error border border-error-border rounded-lg p-4 mb-4">
      <p class="text-error-text font-medium">This action cannot be undone</p>
      <p class="text-error-text text-sm mt-1">
        Deleting your account will permanently remove your profile.
        If you are the only member of your family, all family data (accounts, assets, statements) will also be deleted.
      </p>
    </div>

    <!-- Error display -->
    <div v-if="error" class="mb-4 p-3 bg-error text-error-text rounded-md text-sm">
      {{ error }}
    </div>

    <!-- Confirmation input -->
    <div class="mb-4">
      <label class="block text-sm font-medium text-secondary-text mb-1">
        Type <span class="font-mono font-bold bg-surface-recessed-deep px-1 rounded">DELETE</span> to confirm
      </label>
      <input
        v-model="confirmText"
        type="text"
        class="w-full px-3 py-2 border border-surface-border-strong rounded-md bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-red-500"
        placeholder="DELETE"
      />
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
        v-on:click="deleteAccount"
        v-bind:disabled="!canDelete || loading"
        class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {{ loading ? 'Deleting...' : 'Delete My Account' }}
      </button>
    </template>
  </BaseModal>
</template>
