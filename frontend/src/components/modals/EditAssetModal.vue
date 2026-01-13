<script>
import BaseModal from './BaseModal.vue'
import { supabase } from '@/lib/supabase'
import { TrashIcon } from '@heroicons/vue/24/solid'

export default {
  name: 'EditAssetModal',
  components: { BaseModal, TrashIcon },
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
      assetClasses: [],
      allocations: [],
      loading: false,
      error: null
    }
  },
  computed: {
    totalAllocation() {
      return this.allocations.reduce((sum, a) => sum + (parseFloat(a.percentage) || 0), 0)
    },
    availableClasses() {
      const usedIds = this.allocations.map(a => a.asset_class_id)
      return this.assetClasses.filter(c => !usedIds.includes(c.id))
    }
  },
  async mounted() {
    // Initialize form with current values
    this.name = this.asset.name || ''
    this.ticker = this.asset.ticker || ''

    // Load asset classes
    const { data: classes } = await supabase
      .from('asset_classes')
      .select('id, name')
      .order('name')
    this.assetClasses = classes || []

    // Load existing allocations
    const { data: allocs } = await supabase
      .from('asset_allocations')
      .select('asset_class_id, percentage')
      .eq('asset_id', this.asset.id)
    this.allocations = (allocs || []).map(a => ({
      asset_class_id: a.asset_class_id,
      percentage: Math.round(a.percentage * 100)
    }))
  },
  methods: {
    addAllocation() {
      if (this.availableClasses.length === 0) return
      this.allocations.push({
        asset_class_id: this.availableClasses[0].id,
        percentage: 0
      })
    },

    removeAllocation(index) {
      this.allocations.splice(index, 1)
    },

    getClassName(classId) {
      const c = this.assetClasses.find(c => c.id === classId)
      return c ? c.name : ''
    },

    async save() {
      if (!this.name.trim()) {
        this.error = 'Please enter an asset name'
        return
      }

      // Validate allocations sum to 100 if any exist
      if (this.allocations.length > 0 && this.totalAllocation !== 100) {
        this.error = `Allocations must sum to 100% (currently ${this.totalAllocation}%)`
        return
      }

      this.loading = true
      this.error = null

      try {
        // Update asset
        const { error } = await supabase.from('assets').update({
          name: this.name.trim(),
          ticker: this.ticker.trim() || null
        }).eq('id', this.asset.id)

        if (error) throw error

        // Delete old allocations
        await supabase
          .from('asset_allocations')
          .delete()
          .eq('asset_id', this.asset.id)

        // Insert new allocations
        if (this.allocations.length > 0) {
          const { error: allocError } = await supabase
            .from('asset_allocations')
            .insert(this.allocations.map(a => ({
              asset_id: this.asset.id,
              asset_class_id: a.asset_class_id,
              percentage: a.percentage / 100
            })))

          if (allocError) throw allocError
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

      <!-- Asset Class Allocations -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Asset Class Allocation
        </label>

        <div v-if="allocations.length === 0" class="text-sm text-gray-500 mb-2">
          No allocations defined.
        </div>

        <div class="space-y-2">
          <div
            v-for="(alloc, index) in allocations"
            v-bind:key="index"
            class="flex items-center space-x-2"
          >
            <select
              v-model="alloc.asset_class_id"
              class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option
                v-for="c in assetClasses"
                v-bind:key="c.id"
                v-bind:value="c.id"
                v-bind:disabled="allocations.some(a => a.asset_class_id === c.id && a !== alloc)"
              >
                {{ c.name }}
              </option>
            </select>
            <div class="flex items-center">
              <input
                v-model.number="alloc.percentage"
                type="number"
                min="0"
                max="100"
                class="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span class="ml-1 text-gray-500">%</span>
            </div>
            <button
              v-on:click="removeAllocation(index)"
              class="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded"
              title="Remove allocation"
            >
              <TrashIcon class="w-4 h-4" />
            </button>
          </div>
        </div>

        <div class="mt-2 flex items-center justify-between">
          <button
            v-on:click="addAllocation"
            v-bind:disabled="availableClasses.length === 0"
            class="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
          >
            + Add allocation
          </button>
          <span
            v-if="allocations.length > 0"
            class="text-sm"
            v-bind:class="totalAllocation === 100 ? 'text-green-600' : 'text-orange-600'"
          >
            Total: {{ totalAllocation }}%
          </span>
        </div>
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
