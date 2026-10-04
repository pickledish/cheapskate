<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import BaseModal from './BaseModal.vue';
import ColorPicker from '@/components/ColorPicker.vue';
import { updateAssetClass, type AssetClass } from '@/lib/data';
import type { TagColorName } from '@/lib/tagColors';
import { formatGoal } from '@/lib/util/currency';
import { formatError } from '@/lib/util/error';

export default defineComponent({
  name: 'EditAssetClassModal',
  components: { BaseModal, ColorPicker },
  props: {
    assetClass: {
      type: Object as PropType<AssetClass>,
      required: true,
    },
  },
  emits: ['close', 'updated'],
  data(): {
    name: string;
    color: TagColorName;
    goal: number;
    loading: boolean;
    error: string | null;
  } {
    return {
      name: '',
      color: 'red',
      goal: 0,
      loading: false,
      error: null,
    };
  },
  mounted() {
    this.name = this.assetClass.name;
    this.color = this.assetClass.color as TagColorName;
    this.goal = formatGoal(this.assetClass.goal);
  },
  methods: {
    async save() {
      if (!this.name.trim()) {
        this.error = 'Please enter a name';
        return;
      }

      this.loading = true;
      this.error = null;

      try {
        await updateAssetClass(this.assetClass.id, {
          name: this.name.trim(),
          color: this.color,
          goal: this.goal / 100,
        });

        this.$emit('updated');
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
  <BaseModal title="Edit Asset Class" v-on:close="$emit('close')">
    <!-- Error display -->
    <div v-if="error" class="mb-4 p-3 bg-error text-error-text rounded-md text-sm">
      {{ error }}
    </div>

    <!-- Form -->
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-secondary-text mb-1"> Name </label>
        <div class="flex items-center gap-2">
          <input
            v-model="name"
            type="text"
            class="flex-1 px-3 py-2 border border-surface-border-strong rounded-md bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <ColorPicker v-model="color" />
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-secondary-text mb-1">
          Target Allocation (%)
        </label>
        <input
          v-model.number="goal"
          type="number"
          min="0"
          max="100"
          step="1"
          placeholder="0"
          class="w-full px-3 py-2 border border-surface-border-strong rounded-md bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p class="mt-1 text-xs text-muted-text">
          Target percentage of your portfolio. Leave at 0 to exclude from portfolio calculations.
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
