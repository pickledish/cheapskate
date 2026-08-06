<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { TAG_COLORS, COLOR_NAMES, type TagColorName } from '@/lib/tagColors';

export default defineComponent({
  name: 'ColorPicker',
  props: {
    modelValue: {
      type: String as PropType<TagColorName>,
      default: 'red',
    },
  },
  emits: ['update:modelValue'],
  data() {
    return {
      open: false,
      colors: COLOR_NAMES,
      tagColors: TAG_COLORS,
      onClickOutside: null as ((e: MouseEvent) => void) | null,
    };
  },
  computed: {
    currentHex() {
      return TAG_COLORS[this.modelValue].hex;
    },
  },
  mounted() {
    this.onClickOutside = (e: MouseEvent) => {
      const picker = this.$refs.picker as HTMLElement | undefined;
      if (picker && e.target instanceof Node && !picker.contains(e.target)) {
        this.open = false;
      }
    };
    document.addEventListener('click', this.onClickOutside);
  },
  beforeUnmount() {
    if (this.onClickOutside) {
      document.removeEventListener('click', this.onClickOutside);
    }
  },
  methods: {
    select(color: TagColorName) {
      this.$emit('update:modelValue', color);
      this.open = false;
    },
  },
});
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
