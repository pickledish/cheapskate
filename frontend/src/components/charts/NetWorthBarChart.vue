<script>
import { use } from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import VChart from 'vue-echarts';
import { cssVar } from '@/lib/cssVar';
import { formatCurrency } from '@/lib/format';

use([BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
  '#F97316',
  '#6366F1',
  '#14B8A6',
  '#A855F7',
  '#22C55E',
  '#E11D48',
  '#0EA5E9',
];

export default {
  name: 'NetWorthBarChart',
  components: { VChart },
  props: {
    labels: {
      type: Array,
      required: true,
    },
    series: {
      type: Array,
      required: true,
    },
  },
  data() {
    return {
      selectedSingle: null, // null = show all, string = show only this series
    };
  },
  computed: {
    isStacked() {
      return this.series.length > 1;
    },
    chartOption() {
      const secondaryText = cssVar('--color-secondary-text');
      const fmt = (value) =>
        formatCurrency(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

      return {
        animation: false,
        tooltip: {
          trigger: 'item',
          transitionDuration: 0,
          formatter: (p) => {
            if (!p.name || p.value == null) return '';
            return `<strong>${p.name}</strong><br/><span style="display:inline-block;width:10px;height:10px;background:${p.color};border-radius:2px;margin-right:6px;"></span>${p.seriesName}: ${fmt(p.value)}`;
          },
        },
        legend: this.isStacked
          ? {
              type: 'scroll',
              bottom: 0,
              textStyle: { color: secondaryText },
            }
          : { show: false },
        grid: {
          left: '3%',
          right: '4%',
          top: '3%',
          bottom: this.isStacked ? '15%' : '3%',
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          data: this.labels,
          axisLabel: { color: secondaryText },
          axisPointer: {
            show: true,
            type: 'shadow',
          },
        },
        yAxis: {
          type: 'value',
          axisLabel: {
            color: secondaryText,
            formatter: (value) => {
              if (value >= 1000000) {
                return '$' + (value / 1000000).toFixed(1) + 'M';
              } else if (value >= 1000) {
                return '$' + (value / 1000).toFixed(0) + 'K';
              }
              return '$' + value;
            },
          },
        },
        series: this.series.map((s, i) => ({
          name: s.name,
          type: 'bar',
          stack: this.isStacked ? 'total' : undefined,
          data: s.data,
          itemStyle: { color: COLORS[i % COLORS.length] },
          emphasis: { focus: 'series' },
          cursor: 'crosshair',
        })),
      };
    },
    hasData() {
      return this.series.length > 0 && this.series.some((s) => s.data.some((v) => v !== 0));
    },
  },
  methods: {
    onLegendSelectChanged(params) {
      const chart = this.$refs.chart;
      if (!chart) return;

      const clickedName = params.name;
      const allNames = this.series.map((s) => s.name);

      if (this.selectedSingle === clickedName) {
        // Clicking the same one again - show all
        this.selectedSingle = null;
        allNames.forEach((name) => {
          chart.dispatchAction({ type: 'legendSelect', name });
        });
      } else {
        // Show only the clicked one
        this.selectedSingle = clickedName;
        allNames.forEach((name) => {
          if (name === clickedName) {
            chart.dispatchAction({ type: 'legendSelect', name });
          } else {
            chart.dispatchAction({ type: 'legendUnSelect', name });
          }
        });
      }
    },
  },
};
</script>

<template>
  <div>
    <div v-if="hasData" class="w-full" style="height: 500px">
      <VChart
        ref="chart"
        v-bind:option="chartOption"
        autoresize
        v-on:legendselectchanged="onLegendSelectChanged"
      />
    </div>
    <div v-else class="text-center text-muted-text py-8">No net worth data to display.</div>
  </div>
</template>
