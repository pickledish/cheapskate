<script>
import { supabase } from '@/lib/supabase'

export default {
  name: 'AddAccountModal',
  emits: ['close', 'created'],
  data() {
    return {
      name: '',
      accountType: 'brokerage',
      accountTypes: ['retirement', 'brokerage', 'hsa', 'other'],
      loading: false,
      error: null
    }
  },
  methods: {
    async save() {
      if (!this.name.trim()) {
        this.error = 'Please enter an account name'
        return
      }

      this.loading = true
      this.error = null

      try {
        const { data: { user } } = await supabase.auth.getUser()
        const { error } = await supabase.from('user_accounts').insert({
          user_id: user.id,
          name: this.name.trim(),
          account_type: this.accountType
        })

        if (error) throw error

        this.$emit('created')
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
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900">
            Add Investment Account
          </h2>
          <button
            v-on:click="$emit('close')"
            class="text-gray-400 hover:text-gray-600"
          >
            &times;
          </button>
        </div>
      </div>

      <!-- Body -->
      <div class="px-6 py-4">
        <!-- Error display -->
        <div v-if="error" class="mb-4 p-3 bg-red-50 text-red-800 rounded-md text-sm">
          {{ error }}
        </div>

        <p class="text-sm text-gray-600 mb-4">
          Add a brokerage account, 401(k), IRA, HSA, or other investment account.
        </p>

        <!-- Form -->
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Account Name
            </label>
            <input
              v-model="name"
              type="text"
              placeholder="e.g., Fidelity 401k"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Account Type
            </label>
            <select
              v-model="accountType"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option v-for="type in accountTypes" v-bind:key="type" v-bind:value="type">
                {{ type }}
              </option>
            </select>
          </div>
        </div>

        <!-- Actions -->
        <div class="mt-6 flex justify-end space-x-2">
          <button
            v-on:click="$emit('close')"
            class="px-4 py-2 text-gray-700 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            v-on:click="save"
            v-bind:disabled="loading"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {{ loading ? 'Creating...' : 'Create Account' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
