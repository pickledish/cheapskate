<script>
import BaseModal from './BaseModal.vue'
import { supabase } from '@/lib/supabase'
import { insertUpdate, insertHoldingUpdate, updateAccount } from '@/lib/data'

export default {
  name: 'CloseAccountModal',
  components: { BaseModal },
  props: {
    account: {
      type: Object,
      required: true
    },
    holdings: {
      type: Array,
      default: () => []
    }
  },
  emits: ['close', 'closed'],
  data() {
    return {
      effectiveDate: '',
      loading: false,
      error: null
    }
  },
  mounted() {
    this.effectiveDate = new Date().toISOString().split('T')[0]
  },
  methods: {
    async save() {
      if (!this.effectiveDate) {
        this.error = 'Please select an effective date'
        return
      }

      this.loading = true
      this.error = null

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        if (this.holdings.length > 0) {
          const update = await insertUpdate({
            family_id: user.user_metadata.family_id,
            account_id: this.account.id,
            update_type: 'mark_as_closed',
            effective_date: this.effectiveDate,
            created_by: user.id
          })

          for (const h of this.holdings) {
            await insertHoldingUpdate({
              update_id: update.id,
              asset_id: h.asset_id,
              quantity: 0
            })
          }
        }

        await updateAccount(this.account.id, { archived_at: this.effectiveDate })
        this.$emit('closed')
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
  <BaseModal title="Mark Account as Closed" v-on:close="$emit('close')">
    <div v-if="error" class="mb-4 p-3 bg-red-50 text-red-800 rounded-md text-sm">
      {{ error }}
    </div>

    <p class="text-sm text-gray-600 mb-4">
      Mark <strong>{{ account.name }}</strong> as closed? All holdings will be set to zero
      and the account will be hidden from the accounts list. Historical data is preserved.
    </p>

    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Effective Date
        </label>
        <input
          v-model="effectiveDate"
          type="date"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>

    <template #secondary>
      <button
        v-on:click="$emit('close')"
        class="px-4 py-2 text-gray-700 hover:text-gray-900"
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
        {{ loading ? 'Closing...' : 'Mark as Closed' }}
      </button>
    </template>
  </BaseModal>
</template>
