<script>
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { getHexForColor } from '@/lib/tagColors'

use([BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

export default {
  name: 'AllocationHistoryChart',
  components: { VChart },
  props: {
    // Array of month labels (e.g., ['Jan 2024', 'Feb 2024', ...])
    labels: {
      type: Array,
      required: true
    },
    // Array of series: [{ name: 'US Stocks', data: [0.4, 0.38, ...] }, ...]
    // Each data value is a percentage (0-1)
    series: {
      type: Array,
      required: true
    }
  },
  data() {
    return {
      isMobile: false,
      mobileQuery: null
    }
  },
  computed: {
    axisLabels() {
      if (!this.isMobile) return this.labels
      // "Jan 2024" → "Jan 24" to free horizontal space for the bars
      return this.labels.map((label) => label.replace(/\s+(\d{2})(\d{2})$/, " $2"))
    },
    chartOption() {
      // Matches --color-secondary-text (light: gray-700; charts don't yet follow dark)
      const secondaryText = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-gray-700')
        .trim()
      return {
        animation: false,
        tooltip: {
          trigger: 'item',
          transitionDuration: 0,
          formatter: (p) => {
            if (!p.name || p.value == null) return ''
            // Use the full label in tooltips even when the axis shows a short form
            const fullLabel = this.labels[p.dataIndex] || p.name
            const pct = (p.value * 100).toFixed(1)
            return `<strong>${fullLabel}</strong><br/><span style="display:inline-block;width:10px;height:10px;background:${p.color};border-radius:2px;margin-right:6px;"></span>${p.seriesName}: ${pct}%`
          }
        },
        legend: { show: false },
        grid: {
          left: this.isMobile ? 0 : '3%',
          right: '3%',
          top: '3%',
          bottom: '3%',
          containLabel: true
        },
        xAxis: {
          type: 'value',
          max: 1,
          interval: this.isMobile ? 0.5 : 0.2,
          axisLabel: {
            color: secondaryText,
            // Keep "100%" inside the canvas without extra right padding
            alignMaxLabel: 'right',
            formatter: (value) => `${(value * 100).toFixed(0)}%`
          }
        },
        yAxis: {
          type: 'category',
          data: this.axisLabels,
          axisLabel: { color: secondaryText },
          axisPointer: {
            show: true,
            type: 'shadow'
          }
        },
        series: this.series.map((s) => ({
          name: s.name,
          type: 'bar',
          stack: 'total',
          barWidth: 14,
          data: s.data,
          itemStyle: { color: getHexForColor(s.color) },
          emphasis: { focus: 'series' },
          cursor: 'crosshair'
        }))
      }
    },
    hasData() {
      return this.series.length > 0 && this.series.some(s => s.data.some(v => v > 0))
    },
    chartHeight() {
      // 60px base padding (for axis labels) + 32px per row
      const rowHeight = 32
      const basePadding = 60
      return Math.max(basePadding + this.labels.length * rowHeight, 100)
    }
  },
  mounted() {
    this.mobileQuery = window.matchMedia('(max-width: 639px)')
    this.isMobile = this.mobileQuery.matches
    this.mobileQuery.addEventListener('change', this.onMobileChange)
  },
  beforeUnmount() {
    this.mobileQuery?.removeEventListener('change', this.onMobileChange)
  },
  methods: {
    onMobileChange(event) {
      this.isMobile = event.matches
    }
  }
}
</script>

<template>
  <div>
    <div v-if="hasData" class="w-full" :style="{ height: chartHeight + 'px' }">
      <VChart :option="chartOption" autoresize />
    </div>
    <div v-else class="text-center text-muted-text py-8">
      No allocation history to display.
    </div>
  </div>
</template>
