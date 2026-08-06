<script lang="ts">
import { defineComponent } from 'vue';
import { supabase } from '@/lib/supabase';
import { insertFamily, insertProfile } from '@/lib/data';

export default defineComponent({
  name: 'SetupView',
  data(): {
    name: string;
    mode: 'create' | 'join';
    familyId: string;
    loading: boolean;
    error: string | null;
  } {
    return {
      name: '',
      mode: 'create',
      familyId: '',
      loading: false,
      error: null,
    };
  },
  computed: {
    canSubmit(): boolean {
      if (!this.name.trim()) return false;
      if (this.mode === 'join' && !this.familyId.trim()) return false;
      return true;
    },
  },
  async mounted() {
    // Pre-fill name from OAuth provider profile (e.g. Google sign-in)
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.user_metadata?.full_name) {
      this.name = user.user_metadata.full_name;
    }
  },
  methods: {
    async submit() {
      if (!this.canSubmit) return;

      this.error = null;
      this.loading = true;

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        let familyId: string;

        if (this.mode === 'create') {
          // Generate UUID client-side (we can't SELECT it back due to RLS)
          familyId = crypto.randomUUID();
          await insertFamily(familyId);
        } else {
          // Validate UUID format
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(this.familyId)) {
            throw new Error('Invalid family secret format');
          }
          familyId = this.familyId;
        }

        // Update user metadata with the family_id
        // If joining an existing family, skip onboarding - the family already has data set up,
        // so there's no need to walk them through goals/accounts/assets setup.
        const metadata: Record<string, string | boolean> = { family_id: familyId };
        if (this.mode === 'join') {
          metadata.goals_completed = true;
          metadata.accounts_completed = true;
          metadata.assets_completed = true;
        }

        const { error: updateError } = await supabase.auth.updateUser({
          data: metadata,
        });

        if (updateError) throw updateError;

        // Refresh session to get new JWT with updated metadata
        await supabase.auth.refreshSession();

        // Create profile
        await insertProfile({
          id: user.id,
          family_id: familyId,
          name: this.name.trim(),
        });

        // Redirect: new families start onboarding, joining families go to accounts
        await this.$router.push(this.mode === 'create' ? '/goals' : '/accounts');
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
  <div class="min-h-screen flex items-center justify-center bg-page">
    <div class="max-w-md w-full p-8 bg-surface rounded-lg shadow-md">
      <h1 class="text-2xl font-bold text-center mb-6 text-primary-text">Welcome to Cheapskate</h1>

      <!-- Name input -->
      <div class="mb-6">
        <label for="name" class="block text-sm font-medium text-secondary-text mb-1">
          Your name
        </label>
        <input
          id="name"
          v-model="name"
          type="text"
          class="w-full px-3 py-2 border border-surface-border-strong rounded-md bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter your name"
        />
      </div>

      <hr class="mb-6 border-surface-border" />

      <!-- Family options -->
      <div class="space-y-3">
        <!-- Create new family -->
        <label
          class="block p-4 border rounded-lg cursor-pointer transition-colors"
          v-bind:class="
            mode === 'create'
              ? 'border-blue-500 bg-info'
              : 'border-surface-border hover:border-surface-border-strong'
          "
        >
          <div class="flex items-center">
            <input
              v-model="mode"
              type="radio"
              value="create"
              class="h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            <span class="ml-3 font-medium text-primary-text">Start a new family</span>
          </div>
        </label>

        <!-- Join existing family -->
        <label
          class="block p-4 border rounded-lg cursor-pointer transition-colors"
          v-bind:class="
            mode === 'join'
              ? 'border-blue-500 bg-info'
              : 'border-surface-border hover:border-surface-border-strong'
          "
        >
          <div class="flex items-center">
            <input
              v-model="mode"
              type="radio"
              value="join"
              class="h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            <span class="ml-3 font-medium text-primary-text">Join an existing family</span>
          </div>
          <div class="mt-3 ml-7">
            <input
              v-model="familyId"
              type="text"
              v-bind:disabled="mode !== 'join'"
              class="w-full px-3 py-2 border border-surface-border-strong rounded-md bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm disabled:bg-surface-recessed-deep disabled:text-placeholder-text"
              placeholder="Enter family secret"
              v-on:click.stop
            />
          </div>
        </label>
      </div>

      <!-- Error display -->
      <div v-if="error" class="mt-4 p-3 rounded-md bg-error text-error-text text-sm">
        {{ error }}
      </div>

      <!-- Submit button -->
      <button
        v-bind:disabled="!canSubmit || loading"
        class="mt-6 w-full py-3 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        v-on:click="submit"
      >
        {{ loading ? 'Setting up...' : 'Continue' }}
      </button>
    </div>
  </div>
</template>
