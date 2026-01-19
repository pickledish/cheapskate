<script>
import BaseModal from './BaseModal.vue'
import { supabase } from '@/lib/supabase'

export default {
  name: 'UpdatePositionModal',
  components: { BaseModal },
  props: {
    account: {
      type: Object,
      required: true
    }
  },
  emits: ['close', 'updated'],
  data() {
    return {
      assetName: '',
      date: '',
      quantity: '',
      loading: false,
      error: null
    }
  },
  mounted() {
    // Default to today's date
    this.date = new Date().toISOString().split('T')[0]
  },
  methods: {
    async save() {
      if (!this.assetName.trim()) {
        this.error = 'Please enter an asset name or ticker'
        return
      }

      if (!this.date) {
        this.error = 'Please select a date'
        return
      }

      const quantityNum = parseFloat(this.quantity)
      if (isNaN(quantityNum) || quantityNum < 0) {
        this.error = 'Please enter a valid quantity'
        return
      }

      this.loading = true
      this.error = null

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        // Look up asset by ticker OR name (exact match)
        const assetNameTrimmed = this.assetName.trim()
        const { data: asset, error: lookupError } = await supabase
          .from('assets')
          .select('id')
          .or(`ticker.eq.${assetNameTrimmed},name.eq.${assetNameTrimmed}`)
          .single()

        if (lookupError || !asset) {
          throw new Error(`No asset found matching "${assetNameTrimmed}". Create it in the Assets tab first.`)
        }

        const { error } = await supabase.from('asset_holdings').upsert({
          asset_id: asset.id,
          account_id: this.account.id,
          holding_date: this.date,
          quantity: quantityNum,
          statement_id: null,  // manual update
          created_by: user.id
        }, {
          onConflict: 'asset_id,account_id,holding_date'
        })

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
  <BaseModal title="Update Shares" v-on:close="$emit('close')">
    <!-- Error display -->
    <div v-if="error" class="mb-4 p-3 bg-red-50 text-red-800 rounded-md text-sm">
      {{ error }}
    </div>

    <p class="text-sm text-gray-600 mb-4">
      Update shares for <strong>{{ account.name }}</strong>.
    </p>

    <!-- Form -->
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Asset Name or Ticker
        </label>
        <input
          v-model="assetName"
          type="text"
          placeholder="e.g., VTI or Vanguard Total Stock"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p class="mt-1 text-xs text-gray-500">
          Must match an existing asset exactly. Create new assets in the Assets tab.
        </p>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Date
        </label>
        <input
          v-model="date"
          type="date"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Quantity (Shares/Units)
        </label>
        <input
          v-model="quantity"
          type="number"
          step="0.0001"
          min="0"
          placeholder="e.g., 100.5"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
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
        {{ loading ? 'Saving...' : 'Update Shares' }}
      </button>
    </div>
  </BaseModal>
</template>
