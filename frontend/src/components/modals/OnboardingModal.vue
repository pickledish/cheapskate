<script>
export default {
  name: 'OnboardingModal',
  props: {
    title: {
      type: String,
      required: true
    },
    stepNumber: {
      type: Number,
      required: true
    },
    totalSteps: {
      type: Number,
      default: 3
    },
    maxWidth: {
      type: String,
      default: 'max-w-lg'
    }
  },
  emits: ['close'],
  methods: {
    onBackdropClick(event) {
      if (event.target === event.currentTarget) {
        this.$emit('close')
      }
    }
  }
}
</script>

<template>
  <div
    class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
    v-on:click="onBackdropClick"
  >
    <div v-bind:class="['bg-surface rounded-lg shadow-xl w-full mx-4', maxWidth]">
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
            v-on:click="$emit('close')"
            class="text-placeholder-text hover:text-muted-text text-2xl leading-none"
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
</template>
