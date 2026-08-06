<script>
import { TAG_COLORS, COLOR_NAMES } from '@/lib/tagColors';

export default {
  name: 'ColorPicker',
  props: {
    modelValue: {
      type: String,
      default: 'red',
    },
  },
  emits: ['update:modelValue'],
  data() {
    return {
      open: false,
      colors: COLOR_NAMES,
      tagColors: TAG_COLORS,
    };
  },
  computed: {
    currentHex() {
      return TAG_COLORS[this.modelValue]?.hex ?? TAG_COLORS.red.hex;
    },
  },
  mounted() {
    document.addEventListener('click', this.handleClickOutside);
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleClickOutside);
  },
  methods: {
    select(color) {
      this.$emit('update:modelValue', color);
      this.open = false;
    },
    handleClickOutside(e) {
      if (this.$refs.picker && !this.$refs.picker.contains(e.target)) {
        this.open = false;
      }
    },
  },
};
</script>

<template>
  <div ref="picker" class="relative flex items-center">
    <!-- Current color square -->
    <button
      type="button"
      class="w-6 h-6 rounded-md border border-surface-border-strong focus:outline-none focus:ring-2 focus:ring-blue-500"
      v-bind:style="{ backgroundColor: currentHex }"
      v-bind:title="'Color: ' + modelValue"
      v-on:click.stop="open = !open"
    />

    <!-- Dropdown grid -->
    <div
      v-if="open"
      class="absolute z-10 top-full mt-1 p-2 bg-surface rounded-md shadow-lg border border-surface-border w-48"
    >
      <div class="grid grid-cols-6 gap-1.5">
        <button
          v-for="color in colors"
          v-bind:key="color"
          type="button"
          class="w-6 h-6 rounded-sm border hover:scale-110 transition-transform"
          v-bind:class="
            color === modelValue
              ? 'border-transparent ring-2 ring-offset-2 ring-offset-surface ring-blue-500'
              : 'border-surface-border'
          "
          v-bind:style="{ backgroundColor: tagColors[color].hex }"
          v-bind:title="color"
          v-on:click="select(color)"
        />
      </div>
    </div>
  </div>
</template>
