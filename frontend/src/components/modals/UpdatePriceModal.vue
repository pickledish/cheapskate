<script>
import BaseModal from './BaseModal.vue'
import { supabase } from '@/lib/supabase'

export default {
  name: 'UpdatePriceModal',
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
      date: '',
      price: '',
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
      if (!this.date) {
        this.error = 'Please select a date'
        return
      }

      const priceNum = parseFloat(this.price)
      if (isNaN(priceNum) || priceNum < 0) {
        this.error = 'Please enter a valid price'
        return
      }

      this.loading = true
      this.error = null

      try {
        const { error } = await supabase.from('asset_prices').upsert({
          asset_id: this.asset.id,
          price_date: this.date,
          price: priceNum,
          statement_id: null  // manual update
        }, {
          onConflict: 'asset_id,price_date'
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
  <BaseModal title="Update Price" v-on:close="$emit('close')">
    <!-- Error display -->
    <div v-if="error" class="mb-4 p-3 bg-red-50 text-red-800 rounded-md text-sm">
      {{ error }}
    </div>

    <p class="text-sm text-gray-600 mb-4">
      Update the price for <strong>{{ asset.name }}</strong>.
    </p>

    <!-- Form -->
    <div class="space-y-4">
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
          Price per Share/Unit
        </label>
        <input
          v-model="price"
          type="number"
          step="0.01"
          min="0"
          placeholder="e.g., 250.00"
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
        {{ loading ? 'Saving...' : 'Update Price' }}
      </button>
    </div>
  </BaseModal>
</template>
