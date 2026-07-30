<script>
import BaseModal from './BaseModal.vue'
import { updateAsset, deleteAssetAllocationsByAsset, insertAssetAllocation } from '@/lib/data'
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/vue'
import { TrashIcon } from '@heroicons/vue/24/solid'
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/vue/20/solid'

export default {
  name: 'EditAssetModal',
  components: { BaseModal, Listbox, ListboxButton, ListboxOptions, ListboxOption, TrashIcon, ChevronUpDownIcon, CheckIcon },
  props: {
    asset: {
      type: Object,
      required: true
    },
    assetClasses: {
      type: Array,
      required: true
    }
  },
  emits: ['close', 'updated'],
  data() {
    return {
      name: '',
      ticker: '',
      allocations: [],
      loading: false,
      error: null
    }
  },
  computed: {
    totalAllocation() {
      // Only count allocations with a class selected
      return this.allocations
        .filter(a => a.asset_class_id !== null)
        .reduce((sum, a) => sum + (parseFloat(a.percentage) || 0), 0)
    },
    availableClasses() {
      // Filter out null ids when computing available classes
      const usedIds = this.allocations.map(a => a.asset_class_id).filter(id => id !== null)
      return this.assetClasses.filter(c => !usedIds.includes(c.id))
    }
  },
  mounted() {
    // Initialize form with current values
    this.name = this.asset.name || ''
    this.ticker = this.asset.ticker || ''

    // Copy allocations from prop (already converted to percentages by parent)
    this.allocations = (this.asset.allocations || []).map(a => ({ ...a }))

    // If no allocations exist, add an empty row so the UI is visible by default
    if (this.allocations.length === 0 && this.assetClasses.length > 0) {
      this.allocations.push({
        asset_class_id: null,
        percentage: 100
      })
    }
  },
  methods: {
    addAllocation() {
      if (this.availableClasses.length === 0) return
      this.allocations.push({
        asset_class_id: null,
        percentage: 0
      })
    },

    removeAllocation(index) {
      this.allocations.splice(index, 1)
    },

    getClassName(classId) {
      if (!classId) return ''
      const c = this.assetClasses.find(c => c.id === classId)
      return c ? c.name : ''
    },

    isClassUsed(classId, currentAlloc) {
      return this.allocations.some(a => a.asset_class_id === classId && a !== currentAlloc)
    },

    async save() {
      if (!this.name.trim()) {
        this.error = 'Please enter an asset name'
        return
      }

      // Filter out allocations with no class selected (empty rows)
      const validAllocations = this.allocations.filter(a => a.asset_class_id !== null)

      // Validate allocations sum to 100 if any exist
      if (validAllocations.length > 0) {
        const total = validAllocations.reduce((sum, a) => sum + (parseFloat(a.percentage) || 0), 0)
        if (total !== 100) {
          this.error = `Allocations must sum to 100% (currently ${total}%)`
          return
        }
      }

      this.loading = true
      this.error = null

      try {
        // Update asset
        await updateAsset(this.asset.id, {
          name: this.name.trim(),
          ticker: this.ticker.trim() || null
        })

        // Delete old allocations
        await deleteAssetAllocationsByAsset(this.asset.id)

        // Insert new allocations (only valid ones)
        for (const a of validAllocations) {
          await insertAssetAllocation({
            asset_id: this.asset.id,
            asset_class_id: a.asset_class_id,
            percentage: a.percentage / 100
          })
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
        <label class="block text-sm font-medium text-secondary-text mb-1">
          Name
        </label>
        <input
          v-model="name"
          type="text"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-secondary-text mb-1">
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
        <label class="block text-sm font-medium text-secondary-text mb-1">
          Asset Class Allocation
        </label>

        <div class="space-y-2">
          <div
            v-for="(alloc, index) in allocations"
            v-bind:key="index"
            class="flex items-center space-x-2"
          >
            <Listbox v-model="alloc.asset_class_id" as="div" class="relative flex-1">
              <ListboxButton
                class="relative w-full px-3 py-2 text-left text-sm border border-gray-300 rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <span v-bind:class="{ 'text-placeholder-text': !alloc.asset_class_id }">
                  {{ alloc.asset_class_id ? getClassName(alloc.asset_class_id) : 'Select class...' }}
                </span>
                <span class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <ChevronUpDownIcon class="w-4 h-4 text-placeholder-text" />
                </span>
              </ListboxButton>
              <transition
                enter-active-class="transition duration-100 ease-out"
                enter-from-class="transform scale-95 opacity-0"
                enter-to-class="transform scale-100 opacity-100"
                leave-active-class="transition duration-75 ease-in"
                leave-from-class="transform scale-100 opacity-100"
                leave-to-class="transform scale-95 opacity-0"
              >
                <ListboxOptions
                  class="absolute z-10 mt-1 w-full max-h-60 overflow-auto bg-surface border border-gray-200 rounded-md shadow-lg focus:outline-none"
                >
                  <ListboxOption
                    v-for="c in assetClasses"
                    v-bind:key="c.id"
                    v-bind:value="c.id"
                    v-bind:disabled="isClassUsed(c.id, alloc)"
                    v-slot="{ active, selected, disabled }"
                  >
                    <div
                      v-bind:class="[
                        'flex items-center justify-between px-3 py-2 text-sm',
                        disabled ? 'text-placeholder-text cursor-not-allowed' : 'cursor-pointer',
                        !disabled && active ? 'bg-recessed-deep' : '',
                        !disabled && selected ? 'text-blue-600 font-medium' : '',
                        !disabled && !selected ? 'text-secondary-text' : ''
                      ]"
                    >
                      {{ c.name }}
                      <CheckIcon v-if="selected" class="w-4 h-4" />
                    </div>
                  </ListboxOption>
                </ListboxOptions>
              </transition>
            </Listbox>
            <div class="flex items-center">
              <input
                v-model.number="alloc.percentage"
                type="number"
                min="0"
                max="100"
                class="w-20 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span class="ml-1 text-sm text-muted-text">%</span>
            </div>
            <button
              v-on:click="removeAllocation(index)"
              class="w-6 h-6 flex items-center justify-center text-placeholder-text hover:text-muted-text rounded"
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
            class="text-sm text-blue-600 hover:text-blue-800 disabled:text-placeholder-text"
          >
            + Add more
          </button>
          <span
            v-if="totalAllocation > 0"
            class="text-sm"
            v-bind:class="totalAllocation === 100 ? 'text-green-600' : 'text-orange-600'"
          >
            Total: {{ totalAllocation }}%
          </span>
        </div>
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
        {{ loading ? 'Saving...' : 'Save Changes' }}
      </button>
    </template>
  </BaseModal>
</template>
