<script>
import BaseModal from './BaseModal.vue';
import { supabase } from '@/lib/supabase';
import { insertAccount } from '@/lib/data';

export default {
  name: 'AddAccountModal',
  components: { BaseModal },
  emits: ['close', 'created'],
  data() {
    return {
      name: '',
      last4: '',
      rebalancing: true,
      loading: false,
      error: null,
    };
  },
  methods: {
    async save() {
      if (!this.name.trim()) {
        this.error = 'Please enter an account name';
        return;
      }

      this.loading = true;
      this.error = null;

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        await insertAccount({
          family_id: user.user_metadata.family_id,
          created_by: user.id,
          name: this.name.trim(),
          rebalancing: this.rebalancing,
          last4: this.last4.trim() || null,
        });

        this.$emit('created');
      } catch (err) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<template>
  <BaseModal title="Add Investment Account" v-on:close="$emit('close')">
    <!-- Error display -->
    <div v-if="error" class="mb-4 p-3 bg-error text-error-text rounded-md text-sm">
      {{ error }}
    </div>

    <p class="text-sm text-muted-text mb-4">
      Add a brokerage account, 401(k), IRA, HSA, or other investment account.
    </p>

    <!-- Form -->
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-secondary-text mb-1"> Account Name </label>
        <input
          v-model="name"
          type="text"
          placeholder="e.g., Fidelity 401k"
          class="w-full px-3 py-2 border border-surface-border-strong rounded-md bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-secondary-text mb-1">
          Account Last 4 Digits
        </label>
        <input
          v-model="last4"
          type="text"
          maxlength="4"
          placeholder="e.g., 1234"
          class="w-24 px-3 py-2 border border-surface-border-strong rounded-md bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p class="mt-1 text-xs text-muted-text">
          Used to auto-match uploaded statements to this account.
        </p>
      </div>

      <div>
        <label class="flex items-center space-x-2">
          <input
            v-model="rebalancing"
            type="checkbox"
            class="rounded border-surface-border-strong"
          />
          <span class="text-sm text-secondary-text"> Include in rebalancing </span>
        </label>
        <p class="mt-1 text-xs text-muted-text">
          Uncheck for accounts you don't want included in the portfolio rebalancing dashboard (this
          is for illiquid assets, like home equity).
        </p>
      </div>
    </div>

    <template v-slot:secondary>
      <button
        v-on:click="$emit('close')"
        class="px-4 py-2 text-secondary-text hover:text-primary-text"
      >
        Cancel
      </button>
    </template>
    <template v-slot:primary>
      <button
        v-on:click="save"
        v-bind:disabled="loading"
        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {{ loading ? 'Creating...' : 'Create Account' }}
      </button>
    </template>
  </BaseModal>
</template>
