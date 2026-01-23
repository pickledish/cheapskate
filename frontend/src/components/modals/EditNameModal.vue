<script>
import BaseModal from './BaseModal.vue'
import { supabase } from '@/lib/supabase'

export default {
  name: 'EditNameModal',
  components: { BaseModal },
  props: {
    currentName: {
      type: String,
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
    this.name = this.currentName || ''
  },
  methods: {
    async save() {
      if (!this.name.trim()) {
        this.error = 'Please enter your name'
        return
      }

      this.loading = true
      this.error = null

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        const { error } = await supabase
          .from('profiles')
          .update({ name: this.name.trim() })
          .eq('id', user.id)

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
  <BaseModal title="Edit Name" v-on:close="$emit('close')">
    <!-- Error display -->
    <div v-if="error" class="mb-4 p-3 bg-red-50 text-red-800 rounded-md text-sm">
      {{ error }}
    </div>

    <!-- Form -->
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Display Name
        </label>
        <input
          v-model="name"
          type="text"
          placeholder="Your name"
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
