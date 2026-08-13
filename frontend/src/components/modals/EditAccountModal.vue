<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import BaseModal from './BaseModal.vue';
import InstitutionIcon from '@/components/InstitutionIcon.vue';
import { updateAccount, type Account } from '@/lib/data';

export default defineComponent({
  name: 'EditAccountModal',
  components: { BaseModal, InstitutionIcon },
  props: {
    account: {
      type: Object as PropType<Account>,
      required: true,
    },
  },
  emits: ['close', 'updated'],
  data() {
    return {
      name: '',
      last4: '',
      institution: '',
      loading: false,
      error: null as string | null,
    };
  },
  mounted() {
    this.name = this.account.name || '';
    this.last4 = this.account.last4 || '';
    this.institution = this.account.institution || '';
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
        await updateAccount(this.account.id, {
          name: this.name.trim(),
          last4: this.last4.trim() || null,
          institution: this.institution.trim() || null,
        });
        this.$emit('updated');
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err);
      } finally {
        this.loading = false;
      }
    },
  },
});
</script>

<template>
  <BaseModal title="Edit Account" v-on:close="$emit('close')">
    <!-- Error display -->
    <div v-if="error" class="mb-4 p-3 bg-error text-error-text rounded-md text-sm">
      {{ error }}
    </div>

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
        <label class="block text-sm font-medium text-secondary-text mb-1"> Institution </label>
        <div class="relative">
          <input
            v-model="institution"
            type="text"
            placeholder="e.g., Vanguard"
            class="w-full px-3 py-2 pr-10 border border-surface-border-strong rounded-md bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <InstitutionIcon v-bind:name="institution" />
          </span>
        </div>
        <p class="mt-1 text-xs text-muted-text">Optional. Bank, brokerage, or other custodian.</p>
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
        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        v-on:click="save"
      >
        {{ loading ? 'Saving...' : 'Save Changes' }}
      </button>
    </template>
  </BaseModal>
</template>
