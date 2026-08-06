<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { getHexForColor } from '@/lib/tagColors';

const BAR_MAX_HEIGHT = 60; // pixels

interface AllocationComparison {
  name: string;
  color: string;
  current: number;
  goal: number;
}

export default defineComponent({
  name: 'AllocationComparisonGrid',
  props: {
    // Array of { name, current, goal } where current/goal are percentages (0-1)
    allocations: {
      type: Array as PropType<AllocationComparison[]>,
      required: true,
    },
    // Total portfolio value (for computing dollar amounts)
    totalValue: {
      type: Number,
      required: true,
    },
  },
  computed: {
    globalMax() {
      let max = 0;
      for (const alloc of this.allocations) {
        max = Math.max(max, alloc.current * this.totalValue, alloc.goal * this.totalValue);
      }
      return max;
    },
  },
  methods: {
    getColor(colorName: string) {
      return getHexForColor(colorName);
    },
    formatCurrency(value: number) {
      const rounded = Math.round(value / 1000);
      return rounded === 0 ? '$0' : `$${rounded}k`;
    },
    currentDollars(alloc: AllocationComparison) {
      return alloc.current * this.totalValue;
    },
    goalDollars(alloc: AllocationComparison) {
      return alloc.goal * this.totalValue;
    },
    // Scale bar height in pixels relative to the max of current/goal
    barHeightPx(value: number, maxValue: number) {
      if (maxValue === 0) return '0px';
      const pct = value / maxValue;
      const height = Math.round(pct * BAR_MAX_HEIGHT);
      return `${Math.max(height, value > 0 ? 4 : 0)}px`;
    },
  },
});
</script>

<template>
  <div class="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] justify-items-center gap-4">
    <div
      v-for="alloc in allocations"
      v-bind:key="alloc.name"
      class="bg-surface-recessed rounded-lg p-3 flex flex-col w-full max-w-[160px] min-w-0"
    >
      <!-- Asset class name -->
      <div
        class="text-sm font-medium text-secondary-text mb-2 truncate text-center"
        v-bind:title="alloc.name"
      >
        {{ alloc.name }}
      </div>

      <!-- Mini bar chart -->
      <div class="flex items-end justify-center gap-2" v-bind:style="{ height: '60px' }">
        <!-- Current bar -->
        <div
          class="w-8 rounded-t transition-all"
          v-bind:style="{
            height: barHeightPx(currentDollars(alloc), globalMax),
            backgroundColor: getColor(alloc.color),
          }"
        ></div>

        <!-- Goal bar -->
        <div
          class="w-8 rounded-t transition-all"
          v-bind:style="{
            height: barHeightPx(goalDollars(alloc), globalMax),
            backgroundColor: getColor(alloc.color),
            opacity: 0.4,
          }"
        ></div>
      </div>

      <!-- Labels -->
      <div class="flex justify-center gap-2 mt-2">
        <div class="text-center">
          <div class="text-xs font-medium text-secondary-text">
            {{ formatCurrency(currentDollars(alloc)) }}
          </div>
          <div class="text-xs text-placeholder-text">Current</div>
        </div>
        <div class="text-center">
          <div class="text-xs font-medium text-secondary-text">
            {{ formatCurrency(goalDollars(alloc)) }}
          </div>
          <div class="text-xs text-placeholder-text">Target</div>
        </div>
      </div>
    </div>
  </div>
</template>
