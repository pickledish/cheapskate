<script>
import BaseModal from './BaseModal.vue'
import ColorPicker from '@/components/ColorPicker.vue'
import { supabase } from '@/lib/supabase'

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
        const { data: maxData } = await supabase
          .from('asset_classes')
          .select('sort_order')
          .eq('family_id', familyId)
          .order('sort_order', { ascending: false })
          .limit(1)
          .single()

        const nextSortOrder = (maxData?.sort_order ?? -1) + 1

        const { error } = await supabase.from('asset_classes').insert({
          family_id: familyId,
          created_by: user.id,
          name: this.name.trim(),
          color: this.color,
          goal: this.goal / 100,
          sort_order: nextSortOrder
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
  <BaseModal title="Add Asset Class" v-on:close="$emit('close')">
    <!-- Error display -->
    <div v-if="error" class="mb-4 p-3 bg-red-50 text-red-800 rounded-md text-sm">
      {{ error }}
    </div>

    <p class="text-sm text-gray-600 mb-4">
      Create an asset class for categorizing your portfolio (e.g., stocks, bonds, cash, real estate).
    </p>

    <!-- Form -->
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Name
        </label>
        <div class="flex items-center gap-2">
          <input
            v-model="name"
            type="text"
            placeholder="e.g., Stocks, Bonds, Cash"
            class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <ColorPicker v-model="color" />
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Target Allocation (%)
        </label>
        <input
          v-model.number="goal"
          type="number"
          min="0"
          max="100"
          step="1"
          placeholder="0"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p class="mt-1 text-xs text-gray-500">
          Target percentage for rebalancing. Leave at 0 to exclude from rebalancing calculations.
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
        {{ loading ? 'Creating...' : 'Create' }}
      </button>
    </div>
  </BaseModal>
</template>
