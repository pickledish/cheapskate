<script>
import { supabase } from '@/lib/supabase'

export default {
  name: 'UpdateSharesModal',
  props: {
    asset: {
      type: Object,
      required: true
    }
  },
  emits: ['close', 'updated'],
  data() {
    return {
      positionDate: new Date().toISOString().split('T')[0],
      quantity: '',
      positionHistory: [],
      loading: false,
      error: null
    }
  },
  async mounted() {
    await this.loadPositionHistory()
  },
  methods: {
    async loadPositionHistory() {
      try {
        const { data, error } = await supabase
          .from('user_private_positions')
          .select('*')
          .eq('security_id', this.asset.id)
          .order('position_date', { ascending: false })
          .limit(5)

        if (error) throw error
        this.positionHistory = data
      } catch (err) {
        this.error = err.message
      }
    },

    async savePosition() {
      if (!this.quantity || !this.positionDate) {
        this.error = 'Please enter both date and quantity'
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
        const { error } = await supabase
          .from('user_private_positions')
          .upsert({
            security_id: this.asset.id,
            position_date: this.positionDate,
            quantity: quantityNum
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
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900">
            Update Shares - {{ asset.name }}
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
          Enter the number of units/shares you own. For most private assets like real estate, this is typically 1.
        </p>

        <!-- Form -->
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              v-model="positionDate"
              type="date"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Quantity
            </label>
            <input
              v-model="quantity"
              type="number"
              step="0.0001"
              min="0"
              placeholder="e.g., 1"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <!-- Recent history -->
        <div v-if="positionHistory.length > 0" class="mt-4">
          <h3 class="text-sm font-medium text-gray-700 mb-2">Recent Positions</h3>
          <ul class="text-sm text-gray-600 space-y-1">
            <li v-for="entry in positionHistory" v-bind:key="entry.position_date">
              {{ entry.position_date }}: {{ parseFloat(entry.quantity).toLocaleString() }} units
            </li>
          </ul>
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
            v-on:click="savePosition"
            v-bind:disabled="loading"
            class="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
          >
            {{ loading ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
