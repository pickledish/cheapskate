<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import BaseModal from './BaseModal.vue';
import { supabase } from '@/lib/supabase';
import { insertUpdate, updateAccount, type Account } from '@/lib/data';
import { formatError } from '@/lib/util/error';

export default defineComponent({
  name: 'IncludeInPortfolioModal',
  components: { BaseModal },
  props: {
    account: {
      type: Object as PropType<Account>,
      required: true,
    },
  },
  emits: ['close', 'included'],
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

        await insertUpdate({
          family_id: user.user_metadata.family_id,
          account_id: this.account.id,
          update_type: 'include_in_portfolio',
          effective_date: this.effectiveDate,
          created_by: user.id,
        });

        await updateAccount(this.account.id, { in_portfolio: true });
        this.$emit('included');
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
  <BaseModal title="Include in Portfolio" v-on:close="$emit('close')">
    <div v-if="error" class="mb-4 p-3 bg-error text-error-text rounded-md text-sm">
      {{ error }}
    </div>

    <p class="text-sm text-muted-text mb-4">
      Include <strong>{{ account.name }}</strong> in portfolio allocation as of this date? It will
      still count toward net worth either way.
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
        {{ loading ? 'Saving...' : 'Include in Portfolio' }}
      </button>
    </template>
  </BaseModal>
</template>
