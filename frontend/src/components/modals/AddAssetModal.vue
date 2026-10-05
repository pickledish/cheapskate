<script lang="ts">
import { defineComponent } from 'vue';
import BaseModal from './BaseModal.vue';
import AppButton from '@/components/AppButton.vue';
import { supabase } from '@/lib/supabase';
import { insertAsset } from '@/lib/data';
import { formatError } from '@/lib/util/error';

export default defineComponent({
  name: 'AddAssetModal',
  components: { BaseModal, AppButton },
  emits: ['close', 'created'],
  data() {
    return {
      name: '',
      ticker: '',
      loading: false,
      error: null as string | null,
    };
  },
  methods: {
    async save() {
      if (!this.name.trim()) {
        this.error = 'Please enter an asset name';
        return;
      }

      this.loading = true;
      this.error = null;

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        await insertAsset({
          family_id: user.user_metadata.family_id,
          created_by: user.id,
          name: this.name.trim(),
          ticker: this.ticker.trim() || null,
        });

        this.$emit('created');
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
  <BaseModal title="Add Asset" v-on:close="$emit('close')">
    <!-- Error display -->
    <div v-if="error" class="mb-4 p-3 bg-error text-error-text rounded-md text-sm">
      {{ error }}
    </div>

    <p class="text-sm text-muted-text mb-4">
      Add any asset: stocks, ETFs, funds, real estate, private equity, etc.
    </p>

    <!-- Form -->
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-secondary-text mb-1"> Name </label>
        <input
          v-model="name"
          type="text"
          placeholder="e.g., Vanguard Total Stock or Primary Residence"
          class="w-full px-3 py-2 border border-surface-border-strong rounded-md bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-secondary-text mb-1">
          Ticker (optional)
        </label>
        <input
          v-model="ticker"
          type="text"
          placeholder="e.g., VTI, VTSAX"
          class="w-full px-3 py-2 border border-surface-border-strong rounded-md bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p class="mt-1 text-xs text-muted-text">
          Leave blank for private assets without ticker symbols.
        </p>
      </div>
    </div>

    <template v-slot:secondary>
      <AppButton variant="ghost" v-on:click="$emit('close')">Cancel</AppButton>
    </template>
    <template v-slot:primary>
      <AppButton variant="primary" v-bind:disabled="loading" v-on:click="save">
        {{ loading ? 'Creating...' : 'Create Asset' }}
      </AppButton>
    </template>
  </BaseModal>
</template>
