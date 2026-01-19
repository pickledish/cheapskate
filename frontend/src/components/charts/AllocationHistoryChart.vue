<script>
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { getHexColor } from '@/lib/tagColors'

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
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params) => {
            if (!Array.isArray(params) || params.length === 0) return ''
            let result = `<strong>${params[0].name}</strong><br/>`
            // Sort by value descending for tooltip
            const sorted = [...params].sort((a, b) => b.value - a.value)
            for (const p of sorted) {
              if (p.value > 0) {
                const pct = (p.value * 100).toFixed(1)
                result += `<span style="display:inline-block;width:10px;height:10px;background:${p.color};border-radius:2px;margin-right:6px;"></span>${p.seriesName}: ${pct}%<br/>`
              }
            }
            return result
          }
        },
        legend: {
          type: 'scroll',
          bottom: 0,
          textStyle: { color: '#374151' }
        },
        grid: {
          left: '3%',
          right: '4%',
          top: '3%',
          bottom: '15%',
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
          data: s.data,
          itemStyle: { color: getHexColor(s.name) },
          emphasis: {
            focus: 'series'
          }
        }))
      }
    },
    hasData() {
      return this.series.length > 0 && this.series.some(s => s.data.some(v => v > 0))
    }
  }
}
</script>

<template>
  <div>
    <div v-if="hasData" class="w-full" style="height: 400px;">
      <VChart :option="chartOption" autoresize />
    </div>
    <div v-else class="text-center text-gray-500 py-8">
      No allocation history to display.
    </div>
  </div>
</template>
