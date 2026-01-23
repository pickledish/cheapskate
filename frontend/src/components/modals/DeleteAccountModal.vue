<script>
import BaseModal from './BaseModal.vue'

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

      // TODO: Implement account deletion logic
      // 1. Delete profile from profiles table
      // 2. Sign out user
      // 3. Redirect to login
      // Note: Full auth user deletion requires server-side function

      this.error = 'Account deletion is not yet implemented. Coming soon!'
    }
  }
}
</script>

<template>
  <BaseModal title="Delete Account" max-width="max-w-lg" v-on:close="$emit('close')">
    <!-- Warning -->
    <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
      <p class="text-red-800 font-medium">This action cannot be undone</p>
      <p class="text-red-700 text-sm mt-1">
        Deleting your account will permanently remove your profile.
        If you are the only member of your family, all family data (accounts, assets, statements) will also be deleted.
      </p>
    </div>

    <!-- Error display -->
    <div v-if="error" class="mb-4 p-3 bg-red-50 text-red-800 rounded-md text-sm">
      {{ error }}
    </div>

    <!-- Confirmation input -->
    <div class="mb-4">
      <label class="block text-sm font-medium text-gray-700 mb-1">
        Type <span class="font-mono font-bold bg-gray-100 px-1 rounded">DELETE</span> to confirm
      </label>
      <input
        v-model="confirmText"
        type="text"
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
        placeholder="DELETE"
      />
    </div>

    <!-- Actions -->
    <div class="flex justify-end gap-2">
      <button
        v-on:click="$emit('close')"
        class="px-4 py-2 text-gray-700 hover:text-gray-900"
      >
        Cancel
      </button>
      <button
        v-on:click="deleteAccount"
        v-bind:disabled="!canDelete || loading"
        class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {{ loading ? 'Deleting...' : 'Delete My Account' }}
      </button>
    </div>
  </BaseModal>
</template>
