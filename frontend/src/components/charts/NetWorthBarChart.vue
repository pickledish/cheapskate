<script>
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'

use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

export default {
  name: 'NetWorthBarChart',
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
      return {
        tooltip: {
          trigger: 'axis',
          formatter: (params) => {
            const param = params[0]
            const formatted = new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(param.value)
            return `${param.name}<br/>${formatted}`
          }
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '3%',
          containLabel: true
        },
        xAxis: {
          type: 'category',
          data: this.labels,
          axisLabel: {
            color: '#374151'
          }
        },
        yAxis: {
          type: 'value',
          axisLabel: {
            color: '#374151',
            formatter: (value) => {
              if (value >= 1000000) {
                return '$' + (value / 1000000).toFixed(1) + 'M'
              } else if (value >= 1000) {
                return '$' + (value / 1000).toFixed(0) + 'K'
              }
              return '$' + value
            }
          }
        },
        series: [{
          type: 'bar',
          data: this.values,
          itemStyle: {
            color: '#3B82F6'
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
      No net worth data to display.
    </div>
  </div>
</template>
