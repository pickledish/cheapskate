<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { use } from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import VChart from 'vue-echarts';
import { getHexForColor } from '@/lib/tagColors';
import { cssVar } from '@/lib/cssVar';

use([BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

interface AllocationSeries {
  name: string;
  color: string;
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
  name: 'AllocationHistoryChart',
  components: { VChart },
  props: {
    // Array of month labels (e.g., ['Jan 2024', 'Feb 2024', ...])
    labels: {
      type: Array as PropType<string[]>,
      required: true,
    },
    // Array of series: [{ name: 'US Stocks', data: [0.4, 0.38, ...] }, ...]
    // Each data value is a percentage (0-1)
    series: {
      type: Array as PropType<AllocationSeries[]>,
      required: true,
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
    axisLabels() {
      if (!this.isMobile) return this.labels;
      // "Jan 2024" → "Jan 24" to free horizontal space for the bars
      return this.labels.map((label) => label.replace(/\s+(\d{2})(\d{2})$/, ' $2'));
    },
    chartOption() {
      const secondaryText = cssVar('--color-secondary-text');
      return {
        animation: false,
        tooltip: this.isMobile
          ? { show: false }
          : {
              trigger: 'item' as const,
              transitionDuration: 0,
              formatter: (p: TooltipParam) => {
                if (!p.name || p.value == null || typeof p.value !== 'number') return '';
                // Use the full label in tooltips even when the axis shows a short form
                const fullLabel = this.labels[p.dataIndex ?? -1] || p.name;
                const pct = (p.value * 100).toFixed(1);
                return `<strong>${fullLabel}</strong><br/><span style="display:inline-block;width:10px;height:10px;background:${p.color};border-radius:2px;margin-right:6px;"></span>${p.seriesName}: ${pct}%`;
              },
            },
        legend: { show: false },
        grid: {
          left: this.isMobile ? 0 : '3%',
          right: this.isMobile ? '1%' : '3%',
          top: '3%',
          bottom: '3%',
          containLabel: true,
        },
        xAxis: {
          type: 'value' as const,
          max: 1,
          interval: this.isMobile ? 0.5 : 0.25,
          axisLabel: {
            color: secondaryText,
            // Keep "100%" inside the canvas without extra right padding
            alignMaxLabel: 'right' as const,
            formatter: (value: number) => `${(value * 100).toFixed(0)}%`,
          },
        },
        yAxis: {
          type: 'category' as const,
          data: this.axisLabels,
          axisLabel: { color: secondaryText },
          axisPointer: {
            show: !this.isMobile,
            type: 'shadow' as const,
          },
        },
        series: this.series.map((s) => ({
          name: s.name,
          type: 'bar' as const,
          stack: 'total',
          barWidth: 16,
          data: s.data,
          itemStyle: { color: getHexForColor(s.color) },
          silent: this.isMobile,
          emphasis: this.isMobile ? { disabled: true } : { focus: 'series' as const },
          cursor: this.isMobile ? 'default' : 'crosshair',
        })),
      };
    },
    hasData() {
      return this.series.length > 0 && this.series.some((s) => s.data.some((v) => v > 0));
    },
    chartHeight() {
      // 60px base padding (for axis labels) + 24px per row
      const rowHeight = 24;
      const basePadding = 60;
      return Math.max(basePadding + this.labels.length * rowHeight, 100);
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
  <div>
    <div v-if="hasData" class="w-full" v-bind:style="{ height: chartHeight + 'px' }">
      <VChart
        v-bind:class="isMobile ? 'pointer-events-none' : ''"
        v-bind:option="chartOption"
        autoresize
      />
    </div>
    <div v-else class="text-center text-muted-text py-8">No allocation history to display.</div>
  </div>
</template>
