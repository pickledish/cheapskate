<script>
import BaseModal from './BaseModal.vue'
import ColorPicker from '@/components/ColorPicker.vue'
import { supabase } from '@/lib/supabase'
import { getMaxSortOrder, insertAssetClass } from '@/lib/data'

export default {
  name: 'AddAssetClassModal',
  components: { BaseModal, ColorPicker },
  emits: ['close', 'created'],
  data() {
    return {
      name: '',
      color: 'red',
      goal: 0,
      loading: false,
      error: null
    }
  },
  methods: {
    async save() {
      if (!this.name.trim()) {
        this.error = 'Please enter a name'
        return
      }

      this.loading = true
      this.error = null

      try {
        const { data: { user } } = await supabase.auth.getUser()
        const familyId = user.user_metadata.family_id

        // Get max sort_order for this family
        const maxOrder = await getMaxSortOrder(familyId)
        const nextSortOrder = maxOrder + 1

        await insertAssetClass({
          family_id: familyId,
          created_by: user.id,
          name: this.name.trim(),
          color: this.color,
          goal: this.goal / 100,
          sort_order: nextSortOrder
        })

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
  <BaseModal title="Add Asset Class" v-on:close="$emit('close')">
    <!-- Error display -->
    <div v-if="error" class="mb-4 p-3 bg-error text-error-text rounded-md text-sm">
      {{ error }}
    </div>

    <p class="text-sm text-muted-text mb-4">
      Create an asset class for categorizing your portfolio (e.g., stocks, bonds, cash, real estate).
    </p>

    <!-- Form -->
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-secondary-text mb-1">
          Name
        </label>
        <div class="flex items-center gap-2">
          <input
            v-model="name"
            type="text"
            placeholder="e.g., Stocks, Bonds, Cash"
            class="flex-1 px-3 py-2 border border-strong-border rounded-md bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <ColorPicker v-model="color" />
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-secondary-text mb-1">
          Target Allocation (%)
        </label>
        <input
          v-model.number="goal"
          type="number"
          min="0"
          max="100"
          step="1"
          placeholder="0"
          class="w-full px-3 py-2 border border-strong-border rounded-md bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p class="mt-1 text-xs text-muted-text">
          Target percentage for rebalancing. Leave at 0 to exclude from rebalancing calculations.
        </p>
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
        {{ loading ? 'Creating...' : 'Create' }}
      </button>
    </template>
  </BaseModal>
</template>
