<script>
import { getHexForColor } from '@/lib/tagColors'

const BAR_MAX_HEIGHT = 60 // pixels

export default {
  name: 'AllocationComparisonGrid',
  props: {
    // Array of { name, current, goal } where current/goal are percentages (0-1)
    allocations: {
      type: Array,
      required: true
    },
    // Total portfolio value (for computing dollar amounts)
    totalValue: {
      type: Number,
      required: true
    }
  },
  methods: {
    getColor(colorName) {
      return getHexForColor(colorName)
    },
    formatCurrency(value) {
      const rounded = Math.round(value / 1000)
      return rounded === 0 ? '$0' : `$${rounded}k`
    },
    currentDollars(alloc) {
      return alloc.current * this.totalValue
    },
    goalDollars(alloc) {
      return alloc.goal * this.totalValue
    },
    // Scale bar height in pixels relative to the max of current/goal
    barHeightPx(value, maxValue) {
      if (maxValue === 0) return '0px'
      const pct = value / maxValue
      const height = Math.round(pct * BAR_MAX_HEIGHT)
      return `${Math.max(height, value > 0 ? 4 : 0)}px`
    }
  }
}
</script>

<template>
  <div class="flex justify-between gap-4">
    <div
      v-for="alloc in allocations"
      :key="alloc.name"
      class="bg-gray-50 rounded-lg p-3 flex flex-col flex-1 min-w-0"
    >
      <!-- Asset class name -->
      <div class="text-sm font-medium text-gray-700 mb-2 truncate text-center" :title="alloc.name">
        {{ alloc.name }}
      </div>

      <!-- Mini bar chart -->
      <div class="flex items-end justify-center gap-2" :style="{ height: '60px' }">
        <!-- Current bar -->
        <div
          class="w-8 rounded-t transition-all"
          :style="{
            height: barHeightPx(currentDollars(alloc), Math.max(currentDollars(alloc), goalDollars(alloc))),
            backgroundColor: getColor(alloc.color)
          }"
        ></div>

        <!-- Goal bar -->
        <div
          class="w-8 rounded-t transition-all"
          :style="{
            height: barHeightPx(goalDollars(alloc), Math.max(currentDollars(alloc), goalDollars(alloc))),
            backgroundColor: getColor(alloc.color),
            opacity: 0.4
          }"
        ></div>
      </div>

      <!-- Labels -->
      <div class="flex justify-center gap-2 mt-2">
        <div class="text-center">
          <div class="text-xs font-medium text-gray-700">{{ formatCurrency(currentDollars(alloc)) }}</div>
          <div class="text-xs text-gray-400">Current</div>
        </div>
        <div class="text-center">
          <div class="text-xs font-medium text-gray-700">{{ formatCurrency(goalDollars(alloc)) }}</div>
          <div class="text-xs text-gray-400">Target</div>
        </div>
      </div>
    </div>
  </div>
</template>
