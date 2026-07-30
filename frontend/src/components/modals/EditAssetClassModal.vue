<script>
import BaseModal from './BaseModal.vue'
import ColorPicker from '@/components/ColorPicker.vue'
import { updateAssetClass } from '@/lib/data'

export default {
  name: 'EditAssetClassModal',
  components: { BaseModal, ColorPicker },
  props: {
    assetClass: {
      type: Object,
      required: true
    }
  },
  emits: ['close', 'updated'],
  data() {
    return {
      name: '',
      color: 'red',
      goal: 0,
      loading: false,
      error: null
    }
  },
  mounted() {
    this.name = this.assetClass.name || ''
    this.color = this.assetClass.color || 'red'
    this.goal = (this.assetClass.goal || 0) * 100
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
        await updateAssetClass(this.assetClass.id, {
          name: this.name.trim(),
          color: this.color,
          goal: this.goal / 100
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
  <BaseModal title="Edit Asset Class" v-on:close="$emit('close')">
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
        <div class="flex items-center gap-2">
          <input
            v-model="name"
            type="text"
            class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        {{ loading ? 'Saving...' : 'Save Changes' }}
      </button>
    </template>
  </BaseModal>
</template>
