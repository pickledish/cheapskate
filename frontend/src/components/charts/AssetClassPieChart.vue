<script>
import { use } from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { getHexColor } from '@/lib/tagColors'

use([PieChart, LegendComponent, TooltipComponent, CanvasRenderer])

export default {
  name: 'AssetClassPieChart',
  components: { VChart },
  props: {
    labels: {
      type: Array,
      required: true
    },
    values: {
      type: Array,
      required: true
    }
  },
  computed: {
    chartOption() {
      const data = this.labels.map((label, i) => ({
        name: label,
        value: this.values[i],
        itemStyle: { color: getHexColor(label) }
      }))

      return {
        tooltip: {
          trigger: 'item',
          formatter: (params) => {
            const formatted = new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(params.value)
            return `${params.name}: ${formatted} (${params.percent}%)`
          }
        },
        series: [{
          type: 'pie',
          radius: ['0%', '60%'],
          center: ['50%', '50%'],
          data: data,
          label: {
            show: true,
            position: 'outside',
            formatter: '{b}',
            fontSize: 14,
            color: '#374151'
          },
          labelLine: {
            show: true,
            length: 30,
            length2: 50,
            smooth: true,
            lineStyle: {
              color: '#9CA3AF'
            }
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.2)'
            }
          }
        }]
      }
    },
    hasData() {
      return this.values.length > 0 && this.values.some(v => v > 0)
    }
  }
}
</script>

<template>
  <div>
    <div v-if="hasData" class="w-full" style="height: 350px;">
      <VChart :option="chartOption" autoresize />
    </div>
    <div v-else class="text-center text-gray-500 py-8">
      No allocation data to display.
    </div>
  </div>
</template>
