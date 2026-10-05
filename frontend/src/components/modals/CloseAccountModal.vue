<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import BaseModal from './BaseModal.vue';
import { supabase } from '@/lib/supabase';
import { insertUpdate, insertHoldingUpdate, updateAccount, type Account } from '@/lib/data';
import type { AssetId } from '@/lib/data/assets';
import { formatError } from '@/lib/util/error';

export default defineComponent({
  name: 'CloseAccountModal',
  components: { BaseModal },
  props: {
    account: {
      type: Object as PropType<Account>,
      required: true,
    },
    heldAssets: {
      type: Array as PropType<AssetId[]>,
      default: () => [],
    },
  },
  emits: ['close', 'closed'],
  data() {
    return {
      effectiveDate: '',
      loading: false,
      error: null as string | null,
    };
  },
  mounted() {
    this.effectiveDate = new Date().toISOString().split('T')[0]!;
  },
  methods: {
    async save() {
      if (!this.effectiveDate) {
        this.error = 'Please select a date';
        return;
      }

      this.loading = true;
      this.error = null;

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        if (this.heldAssets.length > 0) {
          const update = await insertUpdate({
            family_id: user.user_metadata.family_id,
            account_id: this.account.id,
            update_type: 'mark_as_closed',
            effective_date: this.effectiveDate,
            created_by: user.id,
          });

          for (const assetId of this.heldAssets) {
            await insertHoldingUpdate({
              update_id: update.id,
              asset_id: assetId,
              quantity: 0,
            });
          }
        }

        await updateAccount(this.account.id, { is_archived: true });
        this.$emit('closed');
      } catch (err) {
        this.error = formatError(err);
      } finally {
        this.loading = false;
      }
    },
  },
});
</script>

<template>
  <BaseModal title="Mark Account as Closed" v-on:close="$emit('close')">
    <div v-if="error" class="mb-4 p-3 bg-error text-error-text rounded-md text-sm">
      {{ error }}
    </div>

    <p class="text-sm text-muted-text mb-4">
      Mark <strong>{{ account.name }}</strong> as closed? All holdings will be set to zero and the
      account will be hidden from the accounts list. Historical data is preserved.
    </p>

    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-secondary-text mb-1"> As Of </label>
        <input
          v-model="effectiveDate"
          type="date"
          class="w-full px-3 py-2 border border-surface-border-strong rounded-md bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>

    <template v-slot:secondary>
      <button
        class="px-4 py-2 text-secondary-text hover:text-primary-text"
        v-on:click="$emit('close')"
      >
        Cancel
      </button>
    </template>
    <template v-slot:primary>
      <button
        v-bind:disabled="loading"
        class="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
        v-on:click="save"
      >
        {{ loading ? 'Closing...' : 'Mark as Closed' }}
      </button>
    </template>
  </BaseModal>
</template>
