<script lang="ts">
import { defineComponent } from 'vue';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/util/body-scroll-lock';

export default defineComponent({
  name: 'BaseModal',
  props: {
    title: {
      type: String,
      required: true,
    },
    maxWidth: {
      type: String,
      default: 'max-w-md',
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
      // Only close if clicking the backdrop itself, not the modal content
      if (event.target === event.currentTarget) {
        this.$emit('close');
      }
    },
  },
});
</script>

<template>
  <div class="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/50 backdrop-blur-sm">
    <div
      class="flex min-h-full items-center justify-center"
      v-on:click="onBackdropClick"
    >
      <div v-bind:class="['bg-surface rounded-lg shadow-xl w-full min-w-0 mx-4 my-4', maxWidth]">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-surface-border">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-primary-text">
              {{ title }}
            </h2>
            <button
              class="text-placeholder-text hover:text-muted-text text-2xl leading-none"
              v-on:click="$emit('close')"
            >
              &times;
            </button>
          </div>
        </div>

        <!-- Body -->
        <div class="px-6 py-4">
          <slot></slot>
        </div>

        <!-- Actions -->
        <div
          v-if="$slots.primary || $slots.secondary"
          class="px-6 pb-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
        >
          <div v-if="$slots.secondary" class="self-center sm:self-auto">
            <slot name="secondary" />
          </div>
          <div v-if="$slots.primary" class="w-full sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">
            <slot name="primary" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
