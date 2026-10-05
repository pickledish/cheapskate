<script lang="ts">
import { defineComponent } from 'vue';
import BaseModal from './BaseModal.vue';
import { supabase } from '@/lib/supabase';
import { insertFamily, updateProfileFamily } from '@/lib/data';
import { formatError } from '@/lib/util/error';

export default defineComponent({
  name: 'ChangeFamilyModal',
  components: { BaseModal },
  emits: ['close', 'changed'],
  data(): {
    mode: 'create' | 'join';
    familyId: string;
    loading: boolean;
    error: string | null;
  } {
    return {
      mode: 'create',
      familyId: '',
      loading: false,
      error: null,
    };
  },
  computed: {
    canSubmit() {
      if (this.mode === 'create') return true;
      return this.familyId.trim().length > 0;
    },
  },
  methods: {
    async executeChange() {
      if (!this.canSubmit) return;

      this.loading = true;
      this.error = null;

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        let newFamilyId: string;

        if (this.mode === 'create') {
          // Generate UUID client-side (same pattern as SetupView)
          newFamilyId = crypto.randomUUID();
          await insertFamily(newFamilyId);
        } else {
          // Validate UUID format
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(this.familyId.trim())) {
            throw new Error('Invalid family ID format. Please enter a valid UUID.');
          }
          newFamilyId = this.familyId.trim();
        }

        // Profile first so cleanup_empty_family() can drop the old family if empty
        await updateProfileFamily(user.id, newFamilyId);

        // Now update user_metadata to match
        const { error: updateError } = await supabase.auth.updateUser({
          data: { family_id: newFamilyId },
        });
        if (updateError) throw updateError;

        // Refresh session to get new JWT with updated metadata
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) throw refreshError;

        this.$emit('changed');
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
  <BaseModal title="Change Family" max-width="max-w-lg" v-on:close="$emit('close')">
    <!-- Error display -->
    <div v-if="error" class="mb-4 p-3 bg-error text-error-text rounded-md text-sm">
      {{ error }}
    </div>

    <div class="space-y-3">
      <!-- Create new family -->
      <label
        class="block p-4 border rounded-lg cursor-pointer transition-colors"
        v-bind:class="
          mode === 'create'
            ? 'border-blue-500 bg-surface-recessed-deep'
            : 'border-surface-border hover:border-surface-border-strong'
        "
      >
        <div class="flex items-center">
          <input
            v-model="mode"
            type="radio"
            value="create"
            class="h-4 w-4 accent-blue-600"
          />
          <span class="ml-3 font-medium text-primary-text">Start a new family</span>
        </div>
        <p class="ml-7 text-sm text-muted-text mt-1">
          Create a fresh family with just you as a member.
        </p>
      </label>

      <!-- Join existing family -->
      <label
        class="block p-4 border rounded-lg cursor-pointer transition-colors"
        v-bind:class="
          mode === 'join'
            ? 'border-blue-500 bg-surface-recessed-deep'
            : 'border-surface-border hover:border-surface-border-strong'
        "
      >
        <div class="flex items-center">
          <input
            v-model="mode"
            type="radio"
            value="join"
            class="h-4 w-4 accent-blue-600"
          />
          <span class="ml-3 font-medium text-primary-text">Join an existing family</span>
        </div>
        <div class="mt-3 ml-7">
          <input
            v-model="familyId"
            type="text"
            v-bind:disabled="mode !== 'join'"
            class="w-full px-3 py-2 border border-surface-border-strong rounded-md bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm disabled:bg-surface-recessed-deep disabled:text-placeholder-text"
            placeholder="Enter family secret"
            v-on:click.stop
          />
        </div>
      </label>
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
        v-bind:disabled="!canSubmit || loading"
        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        v-on:click="executeChange"
      >
        {{ loading ? 'Processing...' : 'Change Family' }}
      </button>
    </template>
  </BaseModal>
</template>
