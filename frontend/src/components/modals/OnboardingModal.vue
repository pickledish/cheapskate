<script lang="ts">
import { defineComponent } from 'vue';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/util/body-scroll-lock';

export default defineComponent({
  name: 'OnboardingModal',
  props: {
    title: {
      type: String,
      required: true,
    },
    stepNumber: {
      type: Number,
      required: true,
    },
    totalSteps: {
      type: Number,
      default: 3,
    },
    maxWidth: {
      type: String,
      default: 'max-w-lg',
    },
  },
  emits: ['close'],
  mounted() {
    lockBodyScroll();
  },
  beforeUnmount() {
    unlockBodyScroll();
  },
  methods: {
    onBackdropClick(event: MouseEvent) {
      if (event.target === event.currentTarget) {
        this.$emit('close');
      }
    },
  },
});
</script>

<template>
  <div class="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/50 backdrop-blur-sm">
    <div class="flex min-h-full items-center justify-center" v-on:click="onBackdropClick">
      <div v-bind:class="['bg-surface rounded-lg shadow-xl w-full mx-4 my-4', maxWidth]">
        <!-- Header with step indicator -->
        <div class="px-6 py-4 border-b border-surface-border">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-muted-text uppercase tracking-wide mb-1">
                Step {{ stepNumber }} of {{ totalSteps }}
              </p>
              <h2 class="text-lg font-semibold text-primary-text">
                {{ title }}
              </h2>
            </div>
            <button
              class="text-placeholder-text hover:text-muted-text text-2xl leading-none"
              v-on:click="$emit('close')"
            >
              &times;
            </button>
          </div>
          <!-- Progress bar -->
          <div class="mt-3 h-1 bg-surface-recessed-deep rounded-full">
            <div
              class="h-full bg-blue-600 rounded-full transition-all"
              v-bind:style="{ width: `${(stepNumber / totalSteps) * 100}%` }"
            ></div>
          </div>
        </div>

        <!-- Body -->
        <div class="px-6 py-4">
          <slot></slot>
        </div>
      </div>
    </div>
  </div>
</template>
