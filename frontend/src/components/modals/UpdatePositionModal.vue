<script>
import BaseModal from './BaseModal.vue'
import { supabase } from '@/lib/supabase'
import { upsertAssetHolding } from '@/lib/data'
import { Combobox, ComboboxInput, ComboboxButton, ComboboxOptions, ComboboxOption } from '@headlessui/vue'
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/vue/20/solid'

export default {
  name: 'UpdatePositionModal',
  components: { BaseModal, Combobox, ComboboxInput, ComboboxButton, ComboboxOptions, ComboboxOption, ChevronUpDownIcon, CheckIcon },
  props: {
    account: {
      type: Object,
      required: true
    },
    assets: {
      type: Array,
      required: true
    }
  },
  emits: ['close', 'updated'],
  data() {
    return {
      selectedAsset: null,
      assetQuery: '',
      date: '',
      quantity: '',
      loading: false,
      error: null
    }
  },
  computed: {
    filteredAssets() {
      const query = this.assetQuery.toLowerCase().trim()
      if (!query) return this.assets
      return this.assets.filter(asset =>
        (asset.ticker && asset.ticker.toLowerCase().includes(query)) ||
        (asset.name && asset.name.toLowerCase().includes(query))
      )
    }
  },
  mounted() {
    // Default to today's date
    this.date = new Date().toISOString().split('T')[0]
  },
  methods: {
    async save() {
      if (!this.selectedAsset) {
        this.error = 'Please select an asset'
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

        await upsertAssetHolding({
          asset_id: this.selectedAsset.id,
          account_id: this.account.id,
          holding_date: this.date,
          quantity: quantityNum,
          statement_id: null,  // manual update
          created_by: user.id
        })

        this.$emit('updated')
      } catch (err) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },
    displayAsset(asset) {
      if (!asset) return ''
      if (!asset.ticker) return asset.name
      return `${asset.ticker} - ${asset.name}`
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
          Asset
        </label>
        <Combobox v-model="selectedAsset" as="div" class="relative">
          <div class="relative">
            <ComboboxInput
              v-bind:display-value="displayAsset"
              v-on:change="assetQuery = $event.target.value"
              placeholder="Search assets..."
              class="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <ComboboxButton class="absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon class="w-5 h-5 text-gray-400" />
            </ComboboxButton>
          </div>
          <transition
            enter-active-class="transition duration-100 ease-out"
            enter-from-class="transform scale-95 opacity-0"
            enter-to-class="transform scale-100 opacity-100"
            leave-active-class="transition duration-75 ease-in"
            leave-from-class="transform scale-100 opacity-100"
            leave-to-class="transform scale-95 opacity-0"
          >
            <ComboboxOptions class="absolute z-10 mt-1 w-full max-h-60 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg focus:outline-none">
              <div v-if="filteredAssets.length === 0" class="px-3 py-2 text-sm text-gray-500">
                No assets found
              </div>
              <ComboboxOption
                v-for="asset in filteredAssets"
                v-bind:key="asset.id"
                v-bind:value="asset"
                v-slot="{ active, selected }"
              >
                <div
                  v-bind:class="[
                    'flex items-center justify-between px-3 py-2 text-sm cursor-pointer',
                    active ? 'bg-gray-100' : '',
                    selected ? 'text-blue-600 font-medium' : 'text-gray-700'
                  ]"
                >
                  <span>{{ asset.ticker ? `${asset.ticker} - ${asset.name}` : asset.name }}</span>
                  <CheckIcon v-if="selected" class="w-4 h-4" />
                </div>
              </ComboboxOption>
            </ComboboxOptions>
          </transition>
        </Combobox>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Effective Date
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
