<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import BaseModal from './BaseModal.vue';
import { supabase } from '@/lib/supabase';
import { insertUpdate, insertPriceUpdate, type Asset } from '@/lib/data';

export default defineComponent({
  name: 'UpdatePriceModal',
  components: { BaseModal },
  props: {
    asset: {
      type: Object as PropType<Asset>,
      required: true,
    },
  },
  emits: ['close', 'updated'],
  data() {
    return {
      effectiveDate: '',
      price: '',
      loading: false,
      error: null as string | null,
    };
  },
  mounted() {
    // Default to today's date
    this.effectiveDate = new Date().toISOString().split('T')[0]!;
  },
  methods: {
    async save() {
      if (!this.effectiveDate) {
        this.error = 'Please select a date';
        return;
      }

      const priceNum = parseFloat(this.price);
      if (isNaN(priceNum)) {
        this.error = 'Please enter a valid price';
        return;
      }

      this.loading = true;
      this.error = null;

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const update = await insertUpdate({
          family_id: user.user_metadata.family_id,
          account_id: null,
          update_type: 'manual_price',
          effective_date: this.effectiveDate,
          created_by: user.id,
        });

        await insertPriceUpdate({
          update_id: update.id,
          asset_id: this.asset.id,
          price: priceNum,
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
  <BaseModal title="Update Price" v-on:close="$emit('close')">
    <!-- Error display -->
    <div v-if="error" class="mb-4 p-3 bg-error text-error-text rounded-md text-sm">
      {{ error }}
    </div>

    <!-- prettier-ignore -->
    <p class="text-sm text-muted-text mb-4">
      Update the price for <strong>{{ asset.name }}</strong>.
    </p>

    <!-- Form -->
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-secondary-text mb-1"> As Of </label>
        <input
          v-model="effectiveDate"
          type="date"
          class="w-full px-3 py-2 border border-surface-border-strong rounded-md bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-secondary-text mb-1">
          Price per Share/Unit
        </label>
        <input
          v-model="price"
          type="text"
          inputmode="decimal"
          placeholder="e.g., 250.00"
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
        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        v-on:click="save"
      >
        {{ loading ? 'Saving...' : 'Update Price' }}
      </button>
    </template>
  </BaseModal>
</template>
