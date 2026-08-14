<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { use } from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import VChart from 'vue-echarts';
import { cssVar } from '@/lib/cssVar';
import { chartColor } from '@/lib/chartPalette';
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
  dataIndex?: number;
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
  data() {
    return {
      isMobile: false,
      mobileQuery: null as MediaQueryList | null,
      onMobileChange: null as ((event: MediaQueryListEvent) => void) | null,
    };
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
    axisLabels() {
      if (!this.isMobile) return this.labels;
      // "Mar 2024" → "Mar 24" to keep category labels inside the canvas
      return this.labels.map((label) => label.replace(/\s+(\d{2})(\d{2})$/, ' $2'));
    },
    chartOption() {
      const secondaryText = cssVar('--color-secondary-text');
      const fmt = (value: number) =>
        formatCurrency(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

      return {
        animation: false,
        tooltip: this.isMobile
          ? { show: false }
          : {
              trigger: 'item' as const,
              transitionDuration: 0,
              formatter: (p: TooltipParam) => {
                if (!p.name || p.value == null || typeof p.value !== 'number') return '';
                const fullLabel = this.labels[p.dataIndex ?? -1] || p.name;
                return `<strong>${fullLabel}</strong><br/><span style="display:inline-block;width:10px;height:10px;background:${p.color};border-radius:2px;margin-right:6px;"></span>${p.seriesName}: ${fmt(p.value)}`;
              },
            },
        // Hidden legend still drives series visibility via `selected`.
        legend: {
          show: false,
          selected: this.legendSelected,
        },
        grid: {
          left: this.isMobile ? 0 : '3%',
          right: this.isMobile ? '1%' : '3%',
          top: '3%',
          bottom: '3%',
          containLabel: true,
        },
        xAxis: {
          type: 'category' as const,
          data: this.axisLabels,
          axisLabel: { color: secondaryText, hideOverlap: true },
          axisPointer: {
            show: !this.isMobile,
            type: 'shadow' as const,
          },
        },
        yAxis: {
          type: 'value' as const,
          axisLabel: {
            color: secondaryText,
            formatter: (value: number) => {
              const sign = value < 0 ? '-' : '';
              const abs = Math.abs(value);
              if (abs >= 1000000) {
                return sign + '$' + (abs / 1000000).toFixed(1) + 'M';
              } else if (abs >= 1000) {
                return sign + '$' + (abs / 1000).toFixed(0) + 'K';
              }
              return sign + '$' + abs;
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
            silent: this.isMobile,
            emphasis: this.isMobile ? { disabled: true } : { focus: 'series' as const },
            cursor: this.isMobile ? 'default' : 'crosshair',
          };
        }),
      };
    },
    hasData() {
      return this.series.length > 0 && this.series.some((s) => s.data.some((v) => v !== 0));
    },
  },
  mounted() {
    this.mobileQuery = window.matchMedia('(max-width: 639px)');
    this.isMobile = this.mobileQuery.matches;
    this.onMobileChange = (event: MediaQueryListEvent) => {
      this.isMobile = event.matches;
    };
    this.mobileQuery.addEventListener('change', this.onMobileChange);
  },
  beforeUnmount() {
    if (this.mobileQuery && this.onMobileChange) {
      this.mobileQuery.removeEventListener('change', this.onMobileChange);
    }
  },
});
</script>

<template>
  <div class="flex min-h-0 w-full flex-col">
    <VChart
      v-if="hasData"
      ref="chart"
      v-bind:class="['min-h-0 w-full flex-1', isMobile ? 'pointer-events-none' : '']"
      v-bind:option="chartOption"
      autoresize
    />
    <div v-else class="flex flex-1 items-center justify-center py-8 text-muted-text">
      No net worth data to display.
    </div>
  </div>
</template>
