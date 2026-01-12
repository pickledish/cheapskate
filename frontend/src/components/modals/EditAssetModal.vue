<script>
import BaseModal from './BaseModal.vue'
import { supabase } from '@/lib/supabase'

export default {
  name: 'EditAssetModal',
  components: { BaseModal },
  props: {
    asset: {
      type: Object,
      required: true
    }
  },
  emits: ['close', 'updated'],
  data() {
    return {
      name: '',
      ticker: '',
      isLiquid: true,
      allocation: '',
      loading: false,
      error: null
    }
  },
  mounted() {
    // Initialize form with current values
    this.name = this.asset.name || ''
    this.ticker = this.asset.ticker || ''
    this.isLiquid = this.asset.is_liquid
    // Convert allocation object to JSON string for editing
    this.allocation = Object.keys(this.asset.allocation || {}).length > 0
      ? JSON.stringify(this.asset.allocation, null, 2)
      : ''
  },
  methods: {
    async save() {
      if (!this.name.trim()) {
        this.error = 'Please enter an asset name'
        return
      }

      // Parse allocation JSON if provided
      let allocationObj = {}
      if (this.allocation.trim()) {
        try {
          allocationObj = JSON.parse(this.allocation)
        } catch (e) {
          this.error = 'Invalid allocation JSON. Example: {"stock": 0.6, "bond": 0.4}'
          return
        }
      }

      this.loading = true
      this.error = null

      try {
        const { error } = await supabase.from('user_securities').update({
          name: this.name.trim(),
          ticker: this.ticker.trim() || null,
          is_liquid: this.isLiquid,
          allocation: allocationObj
        }).eq('id', this.asset.id)

        if (error) throw error

        this.$emit('updated')
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
  <BaseModal title="Edit Asset" v-on:close="$emit('close')">
    <!-- Error display -->
    <div v-if="error" class="mb-4 p-3 bg-red-50 text-red-800 rounded-md text-sm">
      {{ error }}
    </div>

    <!-- Form -->
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Name
        </label>
        <input
          v-model="name"
          type="text"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Ticker (optional)
        </label>
        <input
          v-model="ticker"
          type="text"
          placeholder="e.g., VTI, VTSAX"
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
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Allocation (JSON, optional)
        </label>
        <textarea
          v-model="allocation"
          rows="3"
          placeholder='e.g., {"stock": 0.6, "bond": 0.4}'
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
        ></textarea>
        <p class="mt-1 text-xs text-gray-500">
          Asset class breakdown for portfolio analysis. Leave blank if unknown.
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
        {{ loading ? 'Saving...' : 'Save Changes' }}
      </button>
    </div>
  </BaseModal>
</template>
