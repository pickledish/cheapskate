<script lang="ts">
import { defineComponent } from 'vue';
import AppLayout from '@/components/AppLayout.vue';
import PageHeader from '@/components/PageHeader.vue';
import AllocationHistoryChart from '@/components/charts/AllocationHistoryChart.vue';
import AllocationComparisonGrid from '@/components/charts/AllocationComparisonGrid.vue';
import {
  listHoldingUpdatesWithContext,
  listPriceUpdatesWithContext,
  listAccounts,
  listAssetClasses,
  listAssetAllocations,
  listUpdates,
  type HoldingUpdateWithContext,
  type PriceUpdateWithContext,
  type Account,
  type AssetClass,
  type AssetAllocation,
  type Update,
} from '@/lib/data';
import {
  getLatestPrices,
  getLatestHoldings,
  getValueByClass,
  getInPortfolioAccountIds,
} from '@/lib/derived/derived';
import { formatMonth, lastNMonths, monthEnd } from '@/lib/util/date';
import type { AssetClassId } from '@/lib/data/asset-classes';
import { formatError } from '@/lib/util/error';

export default defineComponent({
  name: 'PortfolioView',
  components: { AppLayout, PageHeader, AllocationHistoryChart, AllocationComparisonGrid },
  data(): {
    loading: boolean;
    error: string | null;
    monthLabels: string[];
    chartSeries: { name: string; color: string; data: number[] }[];
    comparisonAllocations: { name: string; color: string; current: number; goal: number }[];
    currentTotalValue: number;
    holdingsData: HoldingUpdateWithContext[];
    pricesData: PriceUpdateWithContext[];
    accountsData: Account[];
    includeEvents: Update[];
    assetClassesData: AssetClass[];
    allocationsData: AssetAllocation[];
    isMobile: boolean;
    mobileQuery: MediaQueryList | null;
    onMobileChange: ((event: MediaQueryListEvent) => void) | null;
  } {
    return {
      loading: true,
      error: null,
      monthLabels: [],
      chartSeries: [],
      comparisonAllocations: [],
      currentTotalValue: 0,
      holdingsData: [],
      pricesData: [],
      accountsData: [],
      includeEvents: [],
      assetClassesData: [],
      allocationsData: [],
      isMobile: false,
      mobileQuery: null,
      onMobileChange: null,
    };
  },
  async mounted() {
    this.mobileQuery = window.matchMedia('(max-width: 639px)');
    this.isMobile = this.mobileQuery.matches;
    this.onMobileChange = (event: MediaQueryListEvent) => {
      this.isMobile = event.matches;
      if (!this.loading) this.computeChartData();
    };
    this.mobileQuery.addEventListener('change', this.onMobileChange);
    await this.loadData();
  },
  beforeUnmount() {
    if (this.mobileQuery && this.onMobileChange) {
      this.mobileQuery.removeEventListener('change', this.onMobileChange);
    }
  },
  methods: {
    async loadData() {
      this.loading = true;
      this.error = null;

      try {
        const [holdings, prices, accounts, assetClasses, allocations, updates] = await Promise.all([
          listHoldingUpdatesWithContext('asc'),
          listPriceUpdatesWithContext('asc'),
          listAccounts(),
          listAssetClasses(),
          listAssetAllocations(),
          listUpdates(),
        ]);

        this.holdingsData = holdings;
        this.pricesData = prices;
        this.accountsData = accounts;
        this.assetClassesData = assetClasses;
        this.allocationsData = allocations;
        this.includeEvents = updates.filter((u) => u.update_type === 'include_in_portfolio');

        this.computeChartData();
      } catch (err) {
        this.error = formatError(err);
      } finally {
        this.loading = false;
      }
    },

    computeChartData() {
      const allMonths = lastNMonths(this.isMobile ? 6 : 12);

      // First pass: find which months have data, and compute value-by-class once each
      const monthsWithData: {
        month: string;
        totalValue: number;
        byClass: Map<AssetClassId, number>;
        unclassified: number;
      }[] = [];
      for (const month of allMonths) {
        const end = monthEnd(month);
        const inPortfolioAccountIds = getInPortfolioAccountIds(
          this.accountsData,
          this.includeEvents,
          end,
        );
        const holdings = Object.values(getLatestHoldings(this.holdingsData, end)).filter((h) =>
          inPortfolioAccountIds.has(h.account_id),
        );
        const prices = getLatestPrices(this.pricesData, end);
        let totalValue = 0;
        for (const h of holdings) {
          totalValue += h.quantity * (prices.get(h.asset_id)?.price ?? 0);
        }
        if (totalValue <= 0) continue;

        const { byClass, unclassified } = getValueByClass(holdings, prices, this.allocationsData);
        monthsWithData.push({ month, totalValue, byClass, unclassified });
      }

      this.monthLabels = monthsWithData.map((m) => this.formatMonth(m.month));

      // Compute values by class for each month (only months with data)
      const seriesData = this.assetClassesData.map((assetClass) => {
        const data = monthsWithData.map(({ totalValue, byClass }) => ({
          classValue: byClass.get(assetClass.id) || 0,
          totalValue,
        }));
        return {
          name: assetClass.name,
          color: assetClass.color,
          goal: assetClass.goal || 0,
          data,
        };
      });

      // Normalize: convert to percentages of total for each month
      // Exclude asset classes with no goal and no portfolio holdings
      const normalizedSeries = seriesData
        .map((s) => ({
          name: s.name,
          color: s.color,
          goal: s.goal,
          data: s.data.map((d) => (d.totalValue > 0 ? d.classValue / d.totalValue : 0)),
        }))
        .filter((s) => s.goal > 0 || s.data.some((v) => v > 0));

      const unclassifiedData = monthsWithData.map(({ totalValue, unclassified }) =>
        totalValue > 0 ? unclassified / totalValue : 0,
      );

      // Add unclassified series if any month has unclassified value
      if (unclassifiedData.some((v) => v > 0.001)) {
        normalizedSeries.push({
          name: 'Unclassified',
          color: 'gray',
          goal: 0,
          data: unclassifiedData,
        });
      }

      this.chartSeries = normalizedSeries;

      // Compute current vs goal comparison for the grid
      // Use the most recent holdings (today) for current allocation
      const today = new Date().toISOString().split('T')[0]!;
      const inPortfolioAccountIds = getInPortfolioAccountIds(
        this.accountsData,
        this.includeEvents,
        today,
      );
      const currentHoldings = Object.values(getLatestHoldings(this.holdingsData, today)).filter(
        (h) => inPortfolioAccountIds.has(h.account_id),
      );
      const currentPrices = getLatestPrices(this.pricesData, today);

      let currentTotal = 0;
      for (const h of currentHoldings) {
        currentTotal += h.quantity * (currentPrices.get(h.asset_id)?.price ?? 0);
      }
      const { byClass: currentValueByClass } = getValueByClass(
        currentHoldings,
        currentPrices,
        this.allocationsData,
      );

      // Store total value for the comparison grid
      this.currentTotalValue = currentTotal;

      // Build comparison data for all asset classes (respecting sort_order)
      // Exclude asset classes with no goal and no portfolio holdings
      this.comparisonAllocations = this.assetClassesData
        .map((ac) => ({
          name: ac.name,
          color: ac.color,
          current: currentTotal > 0 ? (currentValueByClass.get(ac.id) || 0) / currentTotal : 0,
          goal: ac.goal || 0,
        }))
        .filter((ac) => ac.goal > 0 || ac.current > 0);
    },

    formatMonth,
  },
});
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <PageHeader
        title="Portfolio"
        description='Compare "current" and "goal" allocations to each asset class. Visualize portfolio composition over time.'
      />

      <div v-if="error" class="p-4 bg-error text-error-text rounded-md">
        {{ error }}
      </div>

      <div v-if="loading" class="text-muted-text">Loading...</div>

      <template v-if="!loading && !error">
        <!-- Current vs Goal comparison grid -->
        <div class="bg-surface shadow rounded-lg overflow-hidden">
          <div class="bg-header px-6 py-3">
            <h3 class="text-xs font-medium text-header-text uppercase tracking-wider">
              Current vs Target Allocation
            </h3>
          </div>
          <div class="p-4 sm:p-6">
            <AllocationComparisonGrid
              v-if="
                comparisonAllocations.length > 0 && comparisonAllocations.some((a) => a.current > 0)
              "
              v-bind:allocations="comparisonAllocations"
              v-bind:total-value="currentTotalValue"
            />
            <div v-else class="text-center text-muted-text py-7">
              No allocation history to display.
            </div>
          </div>
        </div>

        <!-- Allocation history chart -->
        <div class="bg-surface shadow rounded-lg overflow-hidden">
          <div class="bg-header px-6 py-3">
            <h3 class="text-xs font-medium text-header-text uppercase tracking-wider">
              Allocation Over Time
            </h3>
          </div>
          <div class="p-6">
            <AllocationHistoryChart v-bind:labels="monthLabels" v-bind:series="chartSeries" />
          </div>
        </div>
      </template>
    </div>
  </AppLayout>
</template>
