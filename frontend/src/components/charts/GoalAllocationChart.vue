<script>
import { use } from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { getHexForColor } from '@/lib/tagColors'

use([PieChart, TooltipComponent, CanvasRenderer])

export default {
  name: 'GoalAllocationChart',
  components: { VChart },
  props: {
    assetClasses: {
      type: Array,
      required: true
    }
  },
  computed: {
    chartOption() {
      const data = this.assetClasses
        .filter(ac => ac.goal > 0)
        .map(ac => ({
          name: ac.name,
          value: ac.goal,
          itemStyle: { color: getHexForColor(ac.color) }
        }))

      return {
        animation: false,
        tooltip: { show: false },
        series: [{
          type: 'pie',
          radius: ['35%', '70%'],
          data,
          label: {
            show: true,
            position: 'outside',
            formatter: '{b}',
            fontSize: 13
          },
          labelLine: {
            show: true
          },
          emphasis: {
            scale: false
          },
          cursor: 'crosshair'
        }]
      }
    }
  }
}
</script>

<template>
  <div class="w-full h-full">
    <VChart :option="chartOption" autoresize />
  </div>
</template>
