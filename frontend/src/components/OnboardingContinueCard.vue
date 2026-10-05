<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { supabase } from '@/lib/supabase';
import { CheckCircleIcon } from '@heroicons/vue/24/solid';
import { formatError } from '@/lib/util/error';

export default defineComponent({
  name: 'OnboardingContinueCard',
  components: {
    CheckCircleIcon,
  },
  props: {
    step: {
      type: String as PropType<'goals' | 'accounts' | 'assets'>,
      required: true,
      validator: (v: string) => ['goals', 'accounts', 'assets'].includes(v),
    },
    message: {
      type: String,
      required: true,
    },
    nextStepLabel: {
      type: String,
      required: true,
    },
    nextRoute: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      loading: false,
      error: null as string | null,
    };
  },
  methods: {
    async continueToNextStep() {
      this.loading = true;
      this.error = null;

      try {
        // Determine which flag to update
        const flagName = `${this.step}_completed`;

        // Update user metadata
        const { error } = await supabase.auth.updateUser({
          data: { [flagName]: true },
        });

        if (error) throw error;

        // Refresh session to get updated JWT
        await supabase.auth.refreshSession();

        // Navigate to next step
        await this.$router.push(this.nextRoute);
      } catch (err) {
        this.error = formatError(err);
        this.loading = false;
      }
    },
  },
});
</script>

<template>
  <div class="bg-success border border-success-border rounded-lg p-6">
    <div class="flex items-start gap-4">
      <CheckCircleIcon class="w-8 h-8 text-green-600 flex-shrink-0" />
      <div class="flex-1">
        <h3 class="text-lg font-medium text-success-text">Ready to continue</h3>
        <p class="mt-1 text-success-text">{{ message }}</p>

        <div v-if="error" class="mt-3 text-sm text-error-text">
          {{ error }}
        </div>

        <button
          v-bind:disabled="loading"
          class="mt-4 px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          v-on:click="continueToNextStep"
        >
          <span v-if="loading">Saving...</span>
          <span v-else>{{ nextStepLabel }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
