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
    // Array of month labels (e.g., ['Jan 24', 'Feb 24', ...])
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
  computed: {
    chartOption() {
      return {
        animation: false,
        tooltip: {
          trigger: 'item',
          formatter: (p) => {
            const pct = (p.value * 100).toFixed(1)
            return `<strong>${p.name}</strong><br/><span style="display:inline-block;width:10px;height:10px;background:${p.color};border-radius:2px;margin-right:6px;"></span>${p.seriesName}: ${pct}%`
          }
        },
        legend: { show: false },
        grid: {
          left: '3%',
          right: '3%',
          top: '3%',
          bottom: '3%',
          containLabel: true
        },
        xAxis: {
          type: 'value',
          max: 1,
          axisLabel: {
            color: '#374151',
            formatter: (value) => `${(value * 100).toFixed(0)}%`
          }
        },
        yAxis: {
          type: 'category',
          data: this.labels,
          axisLabel: { color: '#374151' }
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
  }
}
</script>

<template>
  <div>
    <div v-if="hasData" class="w-full" :style="{ height: chartHeight + 'px' }">
      <VChart :option="chartOption" autoresize />
    </div>
    <div v-else class="text-center text-gray-500 py-8">
      No allocation history to display.
    </div>
  </div>
</template>
