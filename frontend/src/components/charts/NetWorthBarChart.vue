<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { use } from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import VChart from 'vue-echarts';
import { cssVar } from '@/lib/cssVar';
import { chartColor, NET_WORTH_CHART_HEIGHT_PX } from '@/lib/chartPalette';
import { formatCurrency } from '@/lib/util/currency';

use([BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

interface NetWorthSeries {
  name: string;
  data: number[];
}

// Local stub instead of echarts CallbackDataParams — we only read a few fields.
interface TooltipParam {
  name?: string;
  value?: unknown;
  color?: string;
  seriesName?: string;
}

export default defineComponent({
  name: 'NetWorthBarChart',
  components: { VChart },
  props: {
    labels: {
      type: Array as PropType<string[]>,
      required: true,
    },
    /**
     * Top-of-stack → bottom-of-stack (same order as the legend).
     * Reversed for ECharts, which stacks the first series at the bottom.
     */
    series: {
      type: Array as PropType<NetWorthSeries[]>,
      required: true,
    },
    /** When set, only this series is visible; null shows all. */
    isolatedSeries: {
      type: String as PropType<string | null>,
      default: null,
    },
  },
  computed: {
    isStacked() {
      return this.series.length > 1;
    },
    legendSelected(): Record<string, boolean> {
      const isolated = this.isolatedSeries;
      return Object.fromEntries(
        this.series.map((s) => [s.name, isolated === null || isolated === s.name]),
      );
    },
    chartOption() {
      const secondaryText = cssVar('--color-secondary-text');
      const fmt = (value: number) =>
        formatCurrency(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

      return {
        animation: false,
        tooltip: {
          trigger: 'item' as const,
          transitionDuration: 0,
          formatter: (p: TooltipParam) => {
            if (!p.name || p.value == null || typeof p.value !== 'number') return '';
            return `<strong>${p.name}</strong><br/><span style="display:inline-block;width:10px;height:10px;background:${p.color};border-radius:2px;margin-right:6px;"></span>${p.seriesName}: ${fmt(p.value)}`;
          },
        },
        // Hidden legend still drives series visibility via `selected`.
        legend: {
          show: false,
          selected: this.legendSelected,
        },
        grid: {
          left: '3%',
          right: '4%',
          top: '3%',
          bottom: '3%',
          containLabel: true,
        },
        xAxis: {
          type: 'category' as const,
          data: this.labels,
          axisLabel: { color: secondaryText },
          axisPointer: {
            show: true,
            type: 'shadow' as const,
          },
        },
        yAxis: {
          type: 'value' as const,
          axisLabel: {
            color: secondaryText,
            formatter: (value: number) => {
              if (value >= 1000000) {
                return '$' + (value / 1000000).toFixed(1) + 'M';
              } else if (value >= 1000) {
                return '$' + (value / 1000).toFixed(0) + 'K';
              }
              return '$' + value;
            },
          },
        },
        // Reverse so series[0] (legend top) renders at the top of the stack.
        series: [...this.series].reverse().map((s) => {
          const colorIndex = this.series.findIndex((entry) => entry.name === s.name);
          return {
            name: s.name,
            type: 'bar' as const,
            stack: this.isStacked ? 'total' : undefined,
            data: s.data,
            itemStyle: { color: chartColor(colorIndex) },
            emphasis: { focus: 'series' as const },
            cursor: 'crosshair',
          };
        }),
      };
    },
    hasData() {
      return this.series.length > 0 && this.series.some((s) => s.data.some((v) => v !== 0));
    },
    chartHeightPx() {
      return NET_WORTH_CHART_HEIGHT_PX;
    },
  },
});
</script>

<template>
  <div>
    <div v-if="hasData" class="w-full" v-bind:style="{ height: chartHeightPx + 'px' }">
      <VChart ref="chart" v-bind:option="chartOption" autoresize />
    </div>
    <div v-else class="text-center text-muted-text py-8">No net worth data to display.</div>
  </div>
</template>
