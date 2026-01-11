<script>
import { supabase } from '@/lib/supabase'

export default {
  name: 'AddPrivateAssetModal',
  emits: ['close', 'created'],
  data() {
    return {
      name: '',
      isLiquid: false,
      loading: false,
      error: null
    }
  },
  methods: {
    async save() {
      if (!this.name.trim()) {
        this.error = 'Please enter an asset name'
        return
      }

      this.loading = true
      this.error = null

      try {
        const { data: { user } } = await supabase.auth.getUser()
        const { error } = await supabase.from('user_private_securities').insert({
          user_id: user.id,
          name: this.name.trim(),
          is_liquid: this.isLiquid,
          allocation: {}
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
            Add Private Asset
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
          Add a private asset like real estate, private equity, or startup shares.
        </p>

        <!-- Form -->
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Asset Name
            </label>
            <input
              v-model="name"
              type="text"
              placeholder="e.g., Primary Residence"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label class="flex items-center space-x-2">
              <input
                v-model="isLiquid"
                type="checkbox"
                class="rounded border-gray-300"
              />
              <span class="text-sm text-gray-700">
                Liquid asset (include in rebalancing calculations)
              </span>
            </label>
            <p class="mt-1 text-xs text-gray-500">
              Leave unchecked for illiquid assets like real estate that shouldn't be considered when rebalancing.
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
            {{ loading ? 'Creating...' : 'Create Asset' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
