<script>
import BaseModal from './BaseModal.vue'
import { supabase } from '@/lib/supabase'
import { getTagColor } from '@/lib/tagColors'
import { XMarkIcon } from '@heroicons/vue/24/solid'

export default {
  name: 'EditAccountModal',
  components: { BaseModal, XMarkIcon },
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
      tags: [],
      newTagKey: '',
      newTagValue: '',
      loading: false,
      error: null
    }
  },
  mounted() {
    this.name = this.account.name || ''

    // Convert tags object to array
    const tagsObj = this.account.tags || {}
    this.tags = Object.entries(tagsObj).map(([key, value]) => ({ key, value }))
  },
  methods: {
    addTag() {
      const key = this.newTagKey.trim().toLowerCase()
      const value = this.newTagValue.trim()

      if (!key || !value) return

      // Don't add duplicate keys
      if (this.tags.some(t => t.key === key)) {
        this.error = `Tag "${key}" already exists`
        return
      }

      this.tags.push({ key, value })
      this.newTagKey = ''
      this.newTagValue = ''
      this.error = null
    },

    removeTag(index) {
      this.tags.splice(index, 1)
    },

    getTagColor(key) {
      return getTagColor(key)
    },

    async save() {
      if (!this.name.trim()) {
        this.error = 'Please enter an account name'
        return
      }

      this.loading = true
      this.error = null

      try {
        // Convert tags array to object
        const tagsObject = {}
        for (const tag of this.tags) {
          tagsObject[tag.key] = tag.value
        }

        const { error } = await supabase
          .from('accounts')
          .update({
            name: this.name.trim(),
            tags: tagsObject
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

      <!-- Tags section -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Tags
        </label>

        <!-- Existing tags -->
        <div v-if="tags.length > 0" class="flex flex-wrap gap-1 mb-2">
          <span
            v-for="(tag, index) in tags"
            v-bind:key="tag.key"
            class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded"
            v-bind:class="[getTagColor(tag.key).bg, getTagColor(tag.key).text]"
          >
            {{ tag.key }}: {{ tag.value }}
            <button
              v-on:click="removeTag(index)"
              class="hover:opacity-70"
              type="button"
            >
              <XMarkIcon class="w-3 h-3" />
            </button>
          </span>
        </div>

        <!-- Add tag inputs -->
        <div class="grid grid-cols-[1fr_1fr_auto] gap-2">
          <input
            v-model="newTagKey"
            type="text"
            placeholder="key"
            class="min-w-0 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <input
            v-model="newTagValue"
            type="text"
            placeholder="value"
            v-on:keyup.enter="addTag"
            class="min-w-0 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <button
            v-on:click="addTag"
            type="button"
            class="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm whitespace-nowrap"
          >
            Add
          </button>
        </div>
        <p class="text-xs text-gray-500 mt-1">
          e.g., type: retirement, owner: brandon, pretax: yes
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
        {{ loading ? 'Saving...' : 'Save Changes' }}
      </button>
    </div>
  </BaseModal>
</template>
