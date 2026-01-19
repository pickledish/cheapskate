<script>
import BaseModal from './BaseModal.vue'
import { supabase } from '@/lib/supabase'

export default {
  name: 'EditAccountModal',
  components: { BaseModal },
  props: {
    account: {
      type: Object,
      required: true
    }
  },
  emits: ['close', 'updated'],
  data() {
    return {
      name: '',
      loading: false,
      error: null
    }
  },
  mounted() {
    this.name = this.account.name || ''
  },
  methods: {
    async save() {
      if (!this.name.trim()) {
        this.error = 'Please enter an account name'
        return
      }

      this.loading = true
      this.error = null

      try {
        const { error } = await supabase
          .from('accounts')
          .update({
            name: this.name.trim()
          })
          .eq('id', this.account.id)

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
  <BaseModal title="Edit Account" v-on:close="$emit('close')">
    <!-- Error display -->
    <div v-if="error" class="mb-4 p-3 bg-red-50 text-red-800 rounded-md text-sm">
      {{ error }}
    </div>

    <!-- Form -->
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Account Name
        </label>
        <input
          v-model="name"
          type="text"
          placeholder="e.g., Fidelity 401k"
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
        {{ loading ? 'Saving...' : 'Save Changes' }}
      </button>
    </div>
  </BaseModal>
</template>
