<script>
import BaseModal from './BaseModal.vue'
import { supabase } from '@/lib/supabase'
import { insertUpdate, insertPriceUpdate } from '@/lib/data'

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
      if (isNaN(priceNum)) {
        this.error = 'Please enter a valid price'
        return
      }

      this.loading = true
      this.error = null

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        const update = await insertUpdate({
          family_id: user.user_metadata.family_id,
          account_id: null,
          update_type: 'manual_price',
          effective_date: this.date,
          created_by: user.id
        })

        await insertPriceUpdate({
          update_id: update.id,
          asset_id: this.asset.id,
          price: priceNum
        })

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
    <div v-if="error" class="mb-4 p-3 bg-error text-error-text rounded-md text-sm">
      {{ error }}
    </div>

    <p class="text-sm text-muted-text mb-4">
      Update the price for <strong>{{ asset.name }}</strong>.
    </p>

    <!-- Form -->
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-secondary-text mb-1">
          Date
        </label>
        <input
          v-model="date"
          type="date"
          class="w-full px-3 py-2 border border-surface-border-strong rounded-md bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-secondary-text mb-1">
          Price per Share/Unit
        </label>
        <input
          v-model="price"
          type="text"
          inputmode="decimal"
          placeholder="e.g., 250.00"
          class="w-full px-3 py-2 border border-surface-border-strong rounded-md bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>

    <template #secondary>
      <button
        v-on:click="$emit('close')"
        class="px-4 py-2 text-secondary-text hover:text-primary-text"
      >
        Cancel
      </button>
    </template>
    <template #primary>
      <button
        v-on:click="save"
        v-bind:disabled="loading"
        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {{ loading ? 'Saving...' : 'Update Price' }}
      </button>
    </template>
  </BaseModal>
</template>
