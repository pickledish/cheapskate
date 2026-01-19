<script>
import { TAG_COLORS, COLOR_NAMES } from '@/lib/tagColors'

export default {
  name: 'ColorPicker',
  props: {
    modelValue: {
      type: String,
      default: 'red'
    }
  },
  emits: ['update:modelValue'],
  data() {
    return {
      open: false,
      colors: COLOR_NAMES,
      tagColors: TAG_COLORS
    }
  },
  computed: {
    currentHex() {
      return TAG_COLORS[this.modelValue]?.hex ?? TAG_COLORS.red.hex
    }
  },
  methods: {
    select(color) {
      this.$emit('update:modelValue', color)
      this.open = false
    },
    handleClickOutside(e) {
      if (this.$refs.picker && !this.$refs.picker.contains(e.target)) {
        this.open = false
      }
    }
  },
  mounted() {
    document.addEventListener('click', this.handleClickOutside)
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleClickOutside)
  }
}
</script>

<template>
  <div ref="picker" class="relative flex items-center">
    <!-- Current color square -->
    <button
      type="button"
      @click.stop="open = !open"
      class="w-6 h-6 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
      :style="{ backgroundColor: currentHex }"
      :title="'Color: ' + modelValue"
    />

    <!-- Dropdown grid -->
    <div
      v-if="open"
      class="absolute z-10 top-full mt-1 p-2 bg-white rounded-md shadow-lg border border-gray-200 w-48"
    >
      <div class="grid grid-cols-6 gap-1.5">
        <button
          v-for="color in colors"
          :key="color"
          type="button"
          @click="select(color)"
          class="w-6 h-6 rounded-sm border hover:scale-110 transition-transform"
          :class="color === modelValue ? 'border-gray-800 ring-1 ring-gray-800' : 'border-gray-300'"
          :style="{ backgroundColor: tagColors[color].hex }"
          :title="color"
        />
      </div>
    </div>
  </div>
</template>
