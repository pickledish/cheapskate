<script lang="ts">
import { defineComponent } from 'vue';
import AppLayout from '@/components/AppLayout.vue';
import PageHeader from '@/components/PageHeader.vue';
import NetWorthBarChart from '@/components/charts/NetWorthBarChart.vue';
import {
  listHoldingUpdatesWithContext,
  listPriceUpdatesWithContext,
  listAccounts,
  listProfiles,
  listAssetsWithAllocations,
  listAssetClasses,
  type HoldingUpdateWithContext,
  type PriceUpdateWithContext,
  type Account,
  type Profile,
  type AssetWithAllocations,
  type AssetClass,
} from '@/lib/data';
import { getLatestPrices, getLatestHoldings } from '@/lib/derived/derived';
import { formatMonth } from '@/lib/format';
import { Menu as HeadlessMenu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue';
import { ChevronDownIcon, CheckIcon } from '@heroicons/vue/20/solid';
import { assetIdToString, type AssetAllocationInfo, type AssetId } from '@/lib/data/assets';

type GroupBy = 'none' | 'account' | 'owner' | 'asset' | 'assetClass';

export default defineComponent({
  name: 'DashboardView',
  components: {
    AppLayout,
    PageHeader,
    NetWorthBarChart,
    HeadlessMenu,
    MenuButton,
    MenuItems,
    MenuItem,
    ChevronDownIcon,
    CheckIcon,
  },
  data(): {
    monthLabels: string[];
    chartSeries: { name: string; data: number[] }[];
    loading: boolean;
    groupBy: GroupBy;
    groupByOptions: { value: GroupBy; label: string }[];
    holdingsData: HoldingUpdateWithContext[];
    pricesData: PriceUpdateWithContext[];
    accountsData: Account[];
    profilesData: Profile[];
    assetsData: AssetWithAllocations[];
    assetClassesData: AssetClass[];
  } {
    return {
      monthLabels: [],
      chartSeries: [],
      loading: true,
      groupBy: 'none',
      groupByOptions: [
        { value: 'none', label: 'None' },
        { value: 'account', label: 'Account' },
        { value: 'owner', label: 'Owner' },
        { value: 'asset', label: 'Asset' },
        { value: 'assetClass', label: 'Asset Class' },
      ],
      // Raw data from database
      holdingsData: [],
      pricesData: [],
      accountsData: [],
      profilesData: [],
      assetsData: [],
      assetClassesData: [],
    };
  },
  computed: {
    selectedGroupByLabel(): string {
      const opt = this.groupByOptions.find((o) => o.value === this.groupBy);
      return opt ? opt.label : 'None';
    },
  },
  watch: {
    groupBy() {
      this.computeChartData();
    },
  },
  async mounted() {
    await this.loadData();
  },
  methods: {
    async loadData() {
      this.loading = true;

      const [holdings, prices, accounts, profiles, assetsWithAllocs, assetClasses] =
        await Promise.all([
          listHoldingUpdatesWithContext('asc'),
          listPriceUpdatesWithContext('asc'),
          listAccounts(),
          listProfiles(),
          listAssetsWithAllocations(),
          listAssetClasses(),
        ]);

      this.holdingsData = holdings;
      this.pricesData = prices;
      this.accountsData = accounts;
      this.profilesData = profiles;
      this.assetsData = assetsWithAllocs;
      this.assetClassesData = assetClasses;

      this.computeChartData();
      this.loading = false;
    },

    computeChartData() {
      const months = this.getLast12Months();
      this.monthLabels = months.map((m) => this.formatMonth(m));

      if (this.groupBy === 'none') {
        const values = months.map((month) => {
          const monthEnd = this.getMonthEnd(month);
          return this.computeNetWorthAt(monthEnd);
        });
        this.chartSeries = [{ name: 'Net Worth', data: values }];
      } else if (this.groupBy === 'account') {
        this.chartSeries = this.computeGroupedByAccount(months);
      } else if (this.groupBy === 'owner') {
        this.chartSeries = this.computeGroupedByOwner(months);
      } else if (this.groupBy === 'asset') {
        this.chartSeries = this.computeGroupedByAsset(months);
      } else if (this.groupBy === 'assetClass') {
        this.chartSeries = this.computeGroupedByAssetClass(months);
      }
    },

    getLast12Months(): string[] {
      const months: string[] = [];
      const now = new Date();
      // Start from 12 months ago, end at previous month (exclude current month)
      for (let i = 12; i >= 1; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
      return months;
    },

    getMonthEnd(monthStr: string): string {
      const [yearStr, monthPart] = monthStr.split('-');
      const year = Number(yearStr);
      const month = Number(monthPart);
      const nextMonth = new Date(year, month, 1);
      nextMonth.setDate(nextMonth.getDate() - 1);
      return nextMonth.toISOString().split('T')[0]!;
    },

    formatMonth,

    computeNetWorthAt(effectiveDate: string): number {
      const holdings = Object.values(getLatestHoldings(this.holdingsData, effectiveDate));
      const prices = getLatestPrices(this.pricesData, effectiveDate);

      const quantityByAsset: Map<AssetId, number> = new Map();
      for (const h of holdings) {
        quantityByAsset.set(h.asset_id, (quantityByAsset.get(h.asset_id) || 0) + h.quantity);
      }

      let total = 0;
      for (const assetId of quantityByAsset.keys()) {
        total += (quantityByAsset.get(assetId) || 0) * (prices.get(assetId)?.price ?? 0);
      }
      return total;
    },

    computeGroupedByAccount(months: string[]): { name: string; data: number[] }[] {
      const accountMap = Object.fromEntries(this.accountsData.map((a) => [a.id, a.name]));
      const accountIds = this.accountsData.map((a) => a.id);

      return accountIds
        .map((accountId) => {
          const data = months.map((month) => {
            const monthEnd = this.getMonthEnd(month);
            const holdings = Object.values(getLatestHoldings(this.holdingsData, monthEnd)).filter(
              (h) => h.account_id === accountId,
            );
            const prices = getLatestPrices(this.pricesData, monthEnd);

            let total = 0;
            for (const h of holdings) {
              total += h.quantity * (prices.get(h.asset_id)?.price ?? 0);
            }
            return total;
          });
          return { name: accountMap[accountId] || `Account ${accountId}`, data };
        })
        .filter((s) => s.data.some((v) => v !== 0));
    },

    computeGroupedByOwner(months: string[]): { name: string; data: number[] }[] {
      // Map profile id -> name
      const profileMap = Object.fromEntries(this.profilesData.map((p) => [p.id, p.name]));
      // Get unique owner ids
      const ownerIds = [...new Set(this.accountsData.map((a) => a.created_by))];

      return ownerIds
        .map((ownerId) => {
          // Get all account ids belonging to this owner
          const ownerAccountIds = this.accountsData
            .filter((a) => a.created_by === ownerId)
            .map((a) => a.id);

          const data = months.map((month) => {
            const monthEnd = this.getMonthEnd(month);
            const holdings = Object.values(getLatestHoldings(this.holdingsData, monthEnd)).filter(
              (h) => ownerAccountIds.includes(h.account_id),
            );
            const prices = getLatestPrices(this.pricesData, monthEnd);

            let total = 0;
            for (const h of holdings) {
              total += h.quantity * (prices.get(h.asset_id)?.price ?? 0);
            }
            return total;
          });
          return { name: profileMap[ownerId] || 'Unknown', data };
        })
        .filter((s) => s.data.some((v) => v !== 0));
    },

    computeGroupedByAsset(months: string[]): { name: string; data: number[] }[] {
      const assetMap = new Map(this.assetsData.map((a) => [a.id, a.ticker || a.name]));
      const assetIds = this.assetsData.map((a) => a.id);

      return assetIds
        .map((assetId) => {
          const data = months.map((month) => {
            const monthEnd = this.getMonthEnd(month);
            const holdings = Object.values(getLatestHoldings(this.holdingsData, monthEnd)).filter(
              (h) => h.asset_id === assetId,
            );
            const prices = getLatestPrices(this.pricesData, monthEnd);

            let total = 0;
            for (const h of holdings) {
              total += h.quantity * (prices.get(h.asset_id)?.price ?? 0);
            }
            return total;
          });
          return { name: assetMap.get(assetId) || `Asset ${assetIdToString(assetId)}`, data };
        })
        .filter((s) => s.data.some((v) => v !== 0));
    },

    computeGroupedByAssetClass(months: string[]): { name: string; data: number[] }[] {
      const classMap = Object.fromEntries(this.assetClassesData.map((c) => [c.id, c.name]));
      const classIds = this.assetClassesData.map((c) => c.id);

      const allocationsByAsset: Map<AssetId, AssetAllocationInfo[]> = new Map();
      for (const asset of this.assetsData) {
        if (asset.allocations.length > 0) {
          allocationsByAsset.set(asset.id, asset.allocations);
        }
      }

      return classIds
        .map((classId) => {
          const data = months.map((month) => {
            const monthEnd = this.getMonthEnd(month);
            const holdings = Object.values(getLatestHoldings(this.holdingsData, monthEnd));
            const prices = getLatestPrices(this.pricesData, monthEnd);

            let total = 0;
            for (const h of holdings) {
              const assetValue = h.quantity * (prices.get(h.asset_id)?.price ?? 0);
              const allocations = allocationsByAsset.get(h.asset_id) || [];
              const classAlloc = allocations.find((a) => a.asset_class_id === classId);
              if (classAlloc) {
                total += assetValue * parseFloat(String(classAlloc.percentage));
              }
            }
            return total;
          });
          return { name: classMap[classId] || `Class ${classId}`, data };
        })
        .filter((s) => s.data.some((v) => v !== 0));
    },
  },
});
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <PageHeader
        title="Net Worth"
        description="Track your total net worth over time. Group by account, owner, asset, or asset class."
      >
        <template v-slot:actions>
          <HeadlessMenu as="div" class="relative shrink-0">
            <MenuButton
              class="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-secondary-text bg-surface border border-page-border rounded-md hover:bg-surface-recessed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            >
              Group by: {{ selectedGroupByLabel }}
              <ChevronDownIcon class="w-4 h-4 text-muted-text" />
            </MenuButton>
            <transition
              enter-active-class="transition duration-100 ease-out"
              enter-from-class="transform scale-95 opacity-0"
              enter-to-class="transform scale-100 opacity-100"
              leave-active-class="transition duration-75 ease-in"
              leave-from-class="transform scale-100 opacity-100"
              leave-to-class="transform scale-95 opacity-0"
            >
              <MenuItems
                class="absolute right-0 z-10 mt-1 w-40 origin-top-right bg-surface border border-surface-border rounded-md shadow-lg focus:outline-none"
              >
                <div class="py-1">
                  <MenuItem
                    v-for="option in groupByOptions"
                    v-bind:key="option.value"
                    v-slot:default="{ active }"
                  >
                    <button
                      type="button"
                      v-bind:class="[
                        'flex items-center justify-between w-full px-3 py-2 text-sm text-left',
                        active ? 'bg-surface-recessed-deep' : '',
                        groupBy === option.value
                          ? 'text-blue-600 font-medium'
                          : 'text-secondary-text',
                      ]"
                      v-on:click="groupBy = option.value"
                    >
                      {{ option.label }}
                      <CheckIcon v-if="groupBy === option.value" class="w-4 h-4" />
                    </button>
                  </MenuItem>
                </div>
              </MenuItems>
            </transition>
          </HeadlessMenu>
        </template>
      </PageHeader>

      <!-- Loading state -->
      <div v-if="loading" class="text-muted-text">Loading...</div>

      <!-- Chart card -->
      <div v-else class="bg-surface shadow rounded-lg overflow-hidden">
        <div class="bg-header px-6 py-3">
          <h3 class="text-xs font-medium text-header-text uppercase tracking-wider">
            Net Worth Over Time
          </h3>
        </div>
        <div class="p-6">
          <NetWorthBarChart v-bind:labels="monthLabels" v-bind:series="chartSeries" />
        </div>
      </div>
    </div>
  </AppLayout>
</template>
