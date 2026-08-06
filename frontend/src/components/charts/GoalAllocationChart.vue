<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { use } from 'echarts/core';
import { PieChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import VChart from 'vue-echarts';
import { getHexForColor } from '@/lib/tagColors';
import { cssVar } from '@/lib/cssVar';

use([PieChart, TooltipComponent, CanvasRenderer]);

interface AssetClassSlice {
  name: string;
  goal: number;
  color: string;
}

export default defineComponent({
  name: 'GoalAllocationChart',
  components: { VChart },
  props: {
    assetClasses: {
      type: Array as PropType<AssetClassSlice[]>,
      required: true,
    },
  },
  computed: {
    chartOption() {
      const secondaryText = cssVar('--color-secondary-text');

      const data = this.assetClasses
        .filter((ac) => ac.goal > 0)
        .map((ac) => ({
          name: ac.name,
          value: ac.goal,
          itemStyle: { color: getHexForColor(ac.color) },
        }));

      return {
        animation: false,
        tooltip: { show: false },
        series: [
          {
            type: 'pie' as const,
            radius: ['35%', '70%'],
            data,
            label: {
              show: true,
              position: 'outside' as const,
              formatter: '{b}',
              fontSize: 13,
              color: secondaryText,
            },
            labelLine: {
              show: true,
              lineStyle: { color: secondaryText },
            },
            emphasis: {
              scale: false,
            },
            cursor: 'crosshair',
          },
        ],
      };
    },
  },
});
</script>

<template>
  <div class="w-full h-full">
    <VChart v-bind:option="chartOption" autoresize />
  </div>
</template>
