<script>
import { supabase } from '@/lib/supabase'

export default {
  name: 'UpdateValueModal',
  props: {
    asset: {
      type: Object,
      required: true
    }
  },
  emits: ['close', 'updated'],
  data() {
    return {
      priceDate: new Date().toISOString().split('T')[0],
      price: '',
      priceHistory: [],
      loading: false,
      error: null
    }
  },
  async mounted() {
    await this.loadPriceHistory()
  },
  methods: {
    async loadPriceHistory() {
      try {
        const { data, error } = await supabase
          .from('user_private_prices')
          .select('*')
          .eq('security_id', this.asset.id)
          .order('price_date', { ascending: false })
          .limit(5)

        if (error) throw error
        this.priceHistory = data
      } catch (err) {
        this.error = err.message
      }
    },

    async savePrice() {
      if (!this.price || !this.priceDate) {
        this.error = 'Please enter both date and price'
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
        const { error } = await supabase
          .from('user_private_prices')
          .upsert({
            security_id: this.asset.id,
            price_date: this.priceDate,
            price: priceNum
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
            Update Value - {{ asset.name }}
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
          Enter the current value (price per unit) for this asset.
        </p>

        <!-- Form -->
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              v-model="priceDate"
              type="date"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Price ($)
            </label>
            <input
              v-model="price"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g., 500000"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <!-- Recent history -->
        <div v-if="priceHistory.length > 0" class="mt-4">
          <h3 class="text-sm font-medium text-gray-700 mb-2">Recent Values</h3>
          <ul class="text-sm text-gray-600 space-y-1">
            <li v-for="entry in priceHistory" v-bind:key="entry.price_date">
              {{ entry.price_date }}: ${{ parseFloat(entry.price).toLocaleString() }}
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
            v-on:click="savePrice"
            v-bind:disabled="loading"
            class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {{ loading ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
