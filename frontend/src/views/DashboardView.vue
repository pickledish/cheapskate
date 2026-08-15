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
import { getLatestPrices, getLatestHoldings, getValueByClass } from '@/lib/derived/derived';
import { formatMonth, lastNMonths, monthEnd } from '@/lib/util/date';
import { Menu as HeadlessMenu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue';
import { ChevronDownIcon, CheckIcon } from '@heroicons/vue/20/solid';
import { assetIdToString, type AssetId } from '@/lib/data/assets';
import { accountIdToString } from '@/lib/data/accounts';
import { assetClassIdToString } from '@/lib/data/asset-classes';
import { chartColor } from '@/lib/chartPalette';
import { formatCurrency } from '@/lib/util/currency';

type GroupBy = 'none' | 'account' | 'owner' | 'asset' | 'assetClass';

const GROUP_BY_VALUES: ReadonlySet<string> = new Set([
  'none',
  'account',
  'owner',
  'asset',
  'assetClass',
]);

const LEGEND_TITLES: Record<Exclude<GroupBy, 'none'>, string> = {
  account: 'Accounts',
  owner: 'Owners',
  asset: 'Assets',
  assetClass: 'Asset Classes',
};

function parseGroupBy(value: unknown): GroupBy {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw === 'string' && GROUP_BY_VALUES.has(raw)) {
    return raw as GroupBy;
  }
  return 'none';
}

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
    groupByOptions: { value: GroupBy; label: string }[];
    isolatedSeries: string | null;
    holdingsData: HoldingUpdateWithContext[];
    pricesData: PriceUpdateWithContext[];
    accountsData: Account[];
    profilesData: Profile[];
    assetsData: AssetWithAllocations[];
    assetClassesData: AssetClass[];
    isMobile: boolean;
    mobileQuery: MediaQueryList | null;
    onMobileChange: ((event: MediaQueryListEvent) => void) | null;
  } {
    return {
      monthLabels: [],
      chartSeries: [],
      loading: true,
      groupByOptions: [
        { value: 'none', label: 'None' },
        { value: 'account', label: 'Account' },
        { value: 'owner', label: 'Owner' },
        { value: 'asset', label: 'Asset' },
        { value: 'assetClass', label: 'Asset Class' },
      ],
      isolatedSeries: null,
      // Raw data from database
      holdingsData: [],
      pricesData: [],
      accountsData: [],
      profilesData: [],
      assetsData: [],
      assetClassesData: [],
      isMobile: false,
      mobileQuery: null,
      onMobileChange: null,
    };
  },
  computed: {
    groupBy(): GroupBy {
      return parseGroupBy(this.$route.query.groupBy);
    },
    selectedGroupByLabel(): string {
      const opt = this.groupByOptions.find((o) => o.value === this.groupBy);
      return opt ? opt.label : 'None';
    },
    showLegend(): boolean {
      return this.groupBy !== 'none' && this.chartSeries.length > 1;
    },
    legendTitle(): string {
      if (this.groupBy === 'none') return 'Breakdown';
      return LEGEND_TITLES[this.groupBy];
    },
    // chartSeries order is top-of-stack → bottom-of-stack (shared with the chart).
    legendItems(): { name: string; color: string; latestValue: number }[] {
      return this.chartSeries.map((s, i) => ({
        name: s.name,
        color: chartColor(i),
        latestValue: s.data.length > 0 ? (s.data[s.data.length - 1] ?? 0) : 0,
      }));
    },
  },
  watch: {
    groupBy() {
      this.isolatedSeries = null;
      this.computeChartData();
    },
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
      const months = lastNMonths(this.isMobile ? 6 : 12);
      this.monthLabels = months.map((m) => this.formatMonth(m));

      if (this.groupBy === 'none') {
        const values = months.map((month) => {
          return this.computeNetWorthAt(monthEnd(month));
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

    formatMonth,
    formatCurrency,

    toggleIsolate(name: string) {
      this.isolatedSeries = this.isolatedSeries === name ? null : name;
    },

    async setGroupBy(value: GroupBy) {
      if (value === this.groupBy) return;
      const query = { ...this.$route.query };
      if (value === 'none') {
        delete query.groupBy;
      } else {
        query.groupBy = value;
      }
      await this.$router.replace({ path: this.$route.path, query });
    },

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
      const accountMap = new Map(this.accountsData.map((a) => [a.id, a.name]));
      const accountIds = this.accountsData.map((a) => a.id);

      return accountIds
        .map((accountId) => {
          const data = months.map((month) => {
            const end = monthEnd(month);
            const holdings = Object.values(getLatestHoldings(this.holdingsData, end)).filter(
              (h) => h.account_id === accountId,
            );
            const prices = getLatestPrices(this.pricesData, end);

            let total = 0;
            for (const h of holdings) {
              total += h.quantity * (prices.get(h.asset_id)?.price ?? 0);
            }
            return total;
          });
          return {
            name: accountMap.get(accountId) || `Account ${accountIdToString(accountId)}`,
            data,
          };
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
            const end = monthEnd(month);
            const holdings = Object.values(getLatestHoldings(this.holdingsData, end)).filter((h) =>
              ownerAccountIds.includes(h.account_id),
            );
            const prices = getLatestPrices(this.pricesData, end);

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
            const end = monthEnd(month);
            const holdings = Object.values(getLatestHoldings(this.holdingsData, end)).filter(
              (h) => h.asset_id === assetId,
            );
            const prices = getLatestPrices(this.pricesData, end);

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
      const classMap = new Map(this.assetClassesData.map((c) => [c.id, c.name]));

      const byClassPerMonth = months.map((month) => {
        const end = monthEnd(month);
        const holdings = Object.values(getLatestHoldings(this.holdingsData, end));
        const prices = getLatestPrices(this.pricesData, end);
        // bug, unclassified is totally skipped
        return getValueByClass(holdings, prices, this.assetsData).byClass;
      });

      return this.assetClassesData
        .map((assetClass) => ({
          name: classMap.get(assetClass.id) || `Class ${assetClassIdToString(assetClass.id)}`,
          data: byClassPerMonth.map((byClass) => byClass.get(assetClass.id) || 0),
        }))
        .filter((s) => s.data.some((v) => v !== 0));
    },
  },
});
</script>

<template>
  <AppLayout fill-viewport>
    <div class="flex flex-col gap-6 md:min-h-0 md:flex-1">
      <PageHeader
        title="Net Worth"
        description="Track your total net worth over time. Group by account, owner, asset, or asset class."
      >
        <template v-slot:actions>
          <HeadlessMenu as="div" class="relative shrink-0">
            <MenuButton
              class="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-secondary-text bg-surface border border-page-border rounded-md hover:bg-surface-recessed focus:outline-none"
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
                      v-on:click="setGroupBy(option.value)"
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

      <!-- Chart + legend islands -->
      <div v-else class="flex flex-col gap-6 md:min-h-0 md:flex-1 md:flex-row">
        <div
          class="min-w-0 overflow-hidden bg-surface shadow rounded-lg md:flex md:min-h-0 md:flex-1 md:flex-col"
        >
          <div class="shrink-0 bg-header px-6 py-3">
            <h3 class="text-xs font-medium text-header-text uppercase tracking-wider">
              Net Worth Over Time
            </h3>
          </div>
          <div class="p-4 md:flex md:min-h-0 md:flex-1 md:flex-col md:p-6">
            <NetWorthBarChart
              class="h-[40svh] md:h-auto md:min-h-0 md:flex-1"
              v-bind:labels="monthLabels"
              v-bind:series="chartSeries"
              v-bind:isolated-series="isolatedSeries"
            />
          </div>
        </div>

        <div
          v-if="showLegend"
          class="flex w-full shrink-0 flex-col overflow-hidden self-start bg-surface shadow rounded-lg md:max-h-full md:w-80"
        >
          <div class="bg-header px-6 py-3 shrink-0">
            <h3 class="text-xs font-medium text-header-text uppercase tracking-wider">
              {{ legendTitle }}
            </h3>
          </div>
          <div class="px-4 py-6 md:min-h-0 md:flex-1 md:overflow-y-auto">
            <button
              v-for="item in legendItems"
              v-bind:key="item.name"
              type="button"
              v-bind:class="[
                'flex w-full items-center gap-6 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-surface-recessed',
                isolatedSeries && isolatedSeries !== item.name ? 'opacity-40' : '',
              ]"
              v-on:click="toggleIsolate(item.name)"
            >
              <span class="flex min-w-0 flex-1 items-center gap-2">
                <span
                  class="h-2.5 w-2.5 shrink-0 rounded-sm"
                  v-bind:style="{ backgroundColor: item.color }"
                />
                <span class="min-w-0 truncate text-sm text-secondary-text">
                  {{ item.name }}
                </span>
              </span>
              <span class="shrink-0 text-sm tabular-nums text-primary-text">
                {{
                  formatCurrency(item.latestValue, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })
                }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
