<script>
import BaseModal from './BaseModal.vue'
import { supabase } from '@/lib/supabase'

export default {
  name: 'AddAccountModal',
  components: { BaseModal },
  emits: ['close', 'created'],
  data() {
    return {
      name: '',
      rebalancing: true,
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

        const { error } = await supabase.from('accounts').insert({
          family_id: user.user_metadata.family_id,
          created_by: user.id,
          name: this.name.trim(),
          rebalancing: this.rebalancing
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
  <BaseModal title="Add Investment Account" v-on:close="$emit('close')">
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
        <label class="flex items-center space-x-2">
          <input
            v-model="rebalancing"
            type="checkbox"
            class="rounded border-gray-300"
          />
          <span class="text-sm text-gray-700">
            Include in rebalancing
          </span>
        </label>
        <p class="mt-1 text-xs text-gray-500">
          Uncheck for accounts you don't want included in portfolio rebalancing calculations (e.g., illiquid assets, HSAs you're not actively managing).
        </p>
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
  </BaseModal>
</template>
