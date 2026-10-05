<script lang="ts">
import { defineComponent } from 'vue';
import BaseModal from './BaseModal.vue';
import AppButton from '@/components/AppButton.vue';
import { supabase } from '@/lib/supabase';
import { formatError } from '@/lib/util/error';

export default defineComponent({
  name: 'DeleteAccountModal',
  components: { BaseModal, AppButton },
  emits: ['close'],
  data() {
    return {
      confirmText: '',
      loading: false,
      error: null as string | null,
    };
  },
  computed: {
    canDelete() {
      return this.confirmText === 'DELETE';
    },
  },
  methods: {
    async deleteAccount() {
      if (!this.canDelete) return;

      this.loading = true;
      this.error = null;

      try {
        const { error: invokeError } = await supabase.functions.invoke('delete-account');
        if (invokeError) throw invokeError;

        // Account deleted - sign out locally and redirect
        await supabase.auth.signOut();
        await this.$router.push('/login');
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
  <BaseModal title="Delete Account" max-width="max-w-lg" v-on:close="$emit('close')">
    <!-- Warning -->
    <div class="bg-error border border-error-border rounded-lg p-4 mb-4">
      <p class="text-error-text font-medium">This action cannot be undone</p>
      <p class="text-error-text text-sm mt-1">
        Deleting your account will permanently remove your profile. If you are the only member of
        your family, all family data (accounts, assets, statements) will also be deleted.
      </p>
    </div>

    <!-- Error display -->
    <div v-if="error" class="mb-4 p-3 bg-error text-error-text rounded-md text-sm">
      {{ error }}
    </div>

    <!-- Confirmation input -->
    <div class="mb-4">
      <label class="block text-sm font-medium text-secondary-text mb-1">
        Type
        <span class="font-mono font-bold bg-surface-recessed-deep px-1 rounded">DELETE</span> to
        confirm
      </label>
      <input
        v-model="confirmText"
        type="text"
        class="w-full px-3 py-2 border border-surface-border-strong rounded-md bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-red-500"
        placeholder="DELETE"
      />
    </div>

    <template v-slot:secondary>
      <AppButton variant="ghost" v-on:click="$emit('close')">Cancel</AppButton>
    </template>
    <template v-slot:primary>
      <AppButton
        variant="danger"
        v-bind:disabled="!canDelete || loading"
        v-on:click="deleteAccount"
      >
        {{ loading ? 'Deleting...' : 'Delete My Account' }}
      </AppButton>
    </template>
  </BaseModal>
</template>
