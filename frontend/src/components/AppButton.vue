<script lang="ts">
import { defineComponent, type PropType } from 'vue';

const VARIANTS = ['primary', 'secondary', 'ghost', 'danger', 'success'] as const;
type Variant = (typeof VARIANTS)[number];

export default defineComponent({
  name: 'AppButton',
  inheritAttrs: false,
  props: {
    variant: {
      type: String as PropType<Variant>,
      required: true,
      validator: (value: string) => (VARIANTS as readonly string[]).includes(value),
    },
    type: {
      type: String as PropType<'button' | 'submit' | 'reset'>,
      default: 'button',
    },
    to: {
      type: String as PropType<string | null>,
      default: null,
    },
  },
  computed: {
    classes(): string {
      const base = [
        'inline-flex items-center justify-center gap-2 px-4 py-1.5',
        'border rounded-md text-sm font-medium transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        'disabled:opacity-50 disabled:cursor-not-allowed',
      ].join(' ');
      const variant: Record<Variant, string> = {
        primary: 'border-blue-600 bg-blue-600 text-white hover:border-blue-700 hover:bg-blue-700',
        secondary:
          'border-surface-border-strong bg-surface text-secondary-text hover:bg-surface-recessed',
        ghost: 'border-transparent text-secondary-text hover:text-primary-text',
        danger: 'border-red-600 bg-red-600 text-white hover:border-red-700 hover:bg-red-700',
        success:
          'border-green-600 bg-green-600 text-white hover:border-green-700 hover:bg-green-700',
      };
      return `${base} ${variant[this.variant]}`;
    },
  },
});
</script>

<template>
  <router-link v-if="to" v-bind="$attrs" v-bind:to="to" v-bind:class="classes">
    <slot />
  </router-link>
  <button v-else v-bind="$attrs" v-bind:type="type" v-bind:class="classes">
    <slot />
  </button>
</template>
