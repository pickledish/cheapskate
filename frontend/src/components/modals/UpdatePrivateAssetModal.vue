<script>
import BaseModal from './BaseModal.vue'
import { supabase } from '@/lib/supabase'

export default {
  name: 'UpdatePrivateAssetModal',
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
      date: new Date().toISOString().split('T')[0],
      price: '',
      quantity: '',
      loading: false,
      loadingData: true,
      error: null
    }
  },
  computed: {
    modalTitle() {
      return `Update - ${this.asset.name}`
    }
  },
  async mounted() {
    await this.loadCurrentValues()
  },
  methods: {
    async loadCurrentValues() {
      this.loadingData = true
      try {
        // Load most recent price
        const { data: priceData, error: priceError } = await supabase
          .from('user_private_prices')
          .select('price, price_date')
          .eq('security_id', this.asset.id)
          .order('price_date', { ascending: false })
          .limit(1)

        if (priceError) throw priceError

        if (priceData && priceData.length > 0) {
          this.price = priceData[0].price.toString()
        }

        // Load most recent position
        const { data: positionData, error: positionError } = await supabase
          .from('user_private_positions')
          .select('quantity, position_date')
          .eq('security_id', this.asset.id)
          .order('position_date', { ascending: false })
          .limit(1)

        if (positionError) throw positionError

        if (positionData && positionData.length > 0) {
          this.quantity = positionData[0].quantity.toString()
        }

      } catch (err) {
        this.error = err.message
      } finally {
        this.loadingData = false
      }
    },

    async save() {
      // Validate - at least one field should have a value
      if (!this.price && !this.quantity) {
        this.error = 'Please enter a price or quantity'
        return
      }

      if (!this.date) {
        this.error = 'Please enter a date'
        return
      }

      // Validate price if provided
      if (this.price) {
        const priceNum = parseFloat(this.price)
        if (isNaN(priceNum) || priceNum < 0) {
          this.error = 'Please enter a valid price'
          return
        }
      }

      // Validate quantity if provided
      if (this.quantity) {
        const quantityNum = parseFloat(this.quantity)
        if (isNaN(quantityNum) || quantityNum < 0) {
          this.error = 'Please enter a valid quantity'
          return
        }
      }

      this.loading = true
      this.error = null

      try {
        // Save price if provided
        if (this.price) {
          const { error: priceError } = await supabase
            .from('user_private_prices')
            .upsert({
              security_id: this.asset.id,
              price_date: this.date,
              price: parseFloat(this.price)
            })

          if (priceError) throw priceError
        }

        // Save quantity if provided
        if (this.quantity) {
          const { error: positionError } = await supabase
            .from('user_private_positions')
            .upsert({
              security_id: this.asset.id,
              position_date: this.date,
              quantity: parseFloat(this.quantity)
            })

          if (positionError) throw positionError
        }

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
  <BaseModal v-bind:title="modalTitle" v-on:close="$emit('close')">
    <!-- Error display -->
    <div v-if="error" class="mb-4 p-3 bg-red-50 text-red-800 rounded-md text-sm">
      {{ error }}
    </div>

    <!-- Loading state -->
    <div v-if="loadingData" class="text-gray-500 text-center py-4">
      Loading current values...
    </div>

    <!-- Form -->
    <div v-else class="space-y-4">
      <p class="text-sm text-gray-600">
        Update the value and/or quantity for this asset. Fields are pre-filled with the most recent values.
      </p>

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
          Price per Unit ($)
        </label>
        <input
          v-model="price"
          type="number"
          step="0.01"
          min="0"
          placeholder="e.g., 500000"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p class="mt-1 text-xs text-gray-500">
          Leave blank to keep the previous value
        </p>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Quantity (Units/Shares)
        </label>
        <input
          v-model="quantity"
          type="number"
          step="0.0001"
          min="0"
          placeholder="e.g., 1"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p class="mt-1 text-xs text-gray-500">
          For most private assets like real estate, this is typically 1
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
        v-bind:disabled="loading || loadingData"
        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {{ loading ? 'Saving...' : 'Save' }}
      </button>
    </div>
  </BaseModal>
</template>
