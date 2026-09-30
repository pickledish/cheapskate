<script lang="ts">
import { defineComponent } from 'vue';
import AppLayout from '@/components/AppLayout.vue';
import PageHeader from '@/components/PageHeader.vue';
import HistoryEventCard from '@/components/HistoryEventCard.vue';
import {
  listUpdatesWithDetails,
  listAccounts,
  listAssets,
  listProfiles,
  deleteUpdate,
  updateAccount,
  type UpdateWithDetails,
  type UpdateHistoryQuery,
  type PriceUpdate,
} from '@/lib/data';
import dayjs from 'dayjs';
import { formatCurrency, formatNumber } from '@/lib/util/currency';
import { formatMonth } from '@/lib/util/date';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/vue/24/outline';
import { assetIdToString, type AssetId } from '@/lib/data/assets';
import type { AccountId } from '@/lib/data/accounts';
import { formatError } from '@/lib/util/error';

function queryScalar(value: unknown): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' ? raw : undefined;
}

function currentMonthKey(): string {
  return dayjs().format('YYYY-MM');
}

function parseMonthParam(value: unknown): string | undefined {
  const raw = queryScalar(value);
  if (raw === undefined || !/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) return undefined;
  return raw;
}

function parseIdParam(value: unknown): number | undefined {
  const raw = queryScalar(value);
  if (raw === undefined || !/^\d+$/.test(raw)) return undefined;
  const id = Number(raw);
  if (!Number.isSafeInteger(id)) return undefined;
  return id;
}

export default defineComponent({
  name: 'HistoryView',
  components: {
    AppLayout,
    PageHeader,
    HistoryEventCard,
    ChevronLeftIcon,
    ChevronRightIcon,
  },
  data(): {
    events: UpdateWithDetails[];
    accountNames: Map<AccountId, string>;
    assetLabels: Map<AssetId, string>;
    profileNames: Record<string, string>;
    loading: boolean;
    error: string | null;
  } {
    return {
      events: [],
      accountNames: new Map(),
      assetLabels: new Map(),
      profileNames: {},
      loading: true,
      error: null,
    };
  },
  computed: {
    selectedMonthKey(): string {
      return parseMonthParam(this.$route.query.month) ?? currentMonthKey();
    },
    historyQuery(): UpdateHistoryQuery {
      const accountId = parseIdParam(this.$route.query.account);
      const assetId = parseIdParam(this.$route.query.asset);
      // One filter at a time. Both ids, or neither, keeps the month view.
      if (accountId !== undefined && assetId === undefined) {
        return { scope: 'account', accountId: accountId as unknown as AccountId };
      }
      if (assetId !== undefined && accountId === undefined) {
        return { scope: 'asset', assetId: assetId as unknown as AssetId };
      }
      const selected = dayjs(this.selectedMonthKey + '-01');
      return { scope: 'month', year: selected.year(), month: selected.month() + 1 };
    },
    isAllTime(): boolean {
      return this.historyQuery.scope !== 'month';
    },
    monthLabel(): string {
      return this.isAllTime ? 'All Time' : formatMonth(this.selectedMonthKey);
    },
    titleSuffix(): string | null {
      if (this.loading) return null;
      const query = this.historyQuery;
      if (query.scope === 'account') return this.accountNames.get(query.accountId) ?? null;
      if (query.scope === 'asset') return this.assetLabels.get(query.assetId) ?? null;
      return null;
    },
  },
  watch: {
    '$route.fullPath': {
      immediate: true,
      async handler() {
        await this.loadData();
      },
    },
  },
  methods: {
    async prevMonth() {
      if (this.isAllTime) return;
      await this.setMonth(
        dayjs(this.selectedMonthKey + '-01')
          .subtract(1, 'month')
          .format('YYYY-MM'),
      );
    },
    async nextMonth() {
      if (this.isAllTime) return;
      await this.setMonth(
        dayjs(this.selectedMonthKey + '-01')
          .add(1, 'month')
          .format('YYYY-MM'),
      );
    },
    async setMonth(monthKey: string) {
      const query = { ...this.$route.query };
      if (monthKey === currentMonthKey()) {
        delete query.month;
      } else {
        query.month = monthKey;
      }
      await this.$router.replace({ path: this.$route.path, query });
    },
    async loadData() {
      this.loading = true;
      this.error = null;

      try {
        const [updates, accounts, assets, profiles] = await Promise.all([
          listUpdatesWithDetails(this.historyQuery),
          listAccounts(),
          listAssets(),
          listProfiles(),
        ]);

        this.accountNames = new Map(accounts.map((a) => [a.id, a.name]));
        this.assetLabels = new Map(assets.map((a) => [a.id, a.ticker || a.name || 'Unknown']));
        this.profileNames = Object.fromEntries(profiles.map((p) => [p.id, p.name]));
        this.events = updates;
      } catch (err) {
        this.error = formatError(err);
      } finally {
        this.loading = false;
      }
    },

    accountName(event: UpdateWithDetails): string | null {
      if (event.account_id == null) return null;
      return this.accountNames.get(event.account_id) || 'Unknown';
    },

    creatorName(event: UpdateWithDetails): string | null {
      return this.profileNames[event.created_by] ?? null;
    },

    assetLabel(assetId: AssetId): string {
      return this.assetLabels.get(assetId) || 'Unknown';
    },

    formatEffectiveDate(dateStr: string) {
      return dayjs(dateStr).format('MMM D YYYY');
    },

    formatCurrency,
    formatNumber,
    assetIdToString,

    getPriceForAsset(event: UpdateWithDetails, assetId: AssetId): number | null {
      const priceUpdate = event.prices.find((p) => p.asset_id === assetId);
      return priceUpdate ? priceUpdate.price : null;
    },

    pricesWithoutHoldings(event: UpdateWithDetails): PriceUpdate[] {
      return event.prices.filter((p) => !event.holdings.some((h) => h.asset_id === p.asset_id));
    },

    async undoClose(event: UpdateWithDetails) {
      if (
        !confirm(
          `Undo close of "${this.accountName(event)}"? This will restore the account and undo the zeroed-out holdings.`,
        )
      )
        return;
      if (event.account_id == null) {
        this.error = 'Cannot undo close: missing account';
        return;
      }
      try {
        await deleteUpdate(event.id);
        await updateAccount(event.account_id, { is_archived: false });
        await this.loadData();
      } catch (err) {
        this.error = formatError(err);
      }
    },

    async undoIncludeInPortfolio(event: UpdateWithDetails) {
      if (
        !confirm(
          `Undo include of "${this.accountName(event)}" in portfolio? The account will be excluded from portfolio allocation again.`,
        )
      )
        return;
      if (event.account_id == null) {
        this.error = 'Cannot undo include: missing account';
        return;
      }
      try {
        await deleteUpdate(event.id);
        await updateAccount(event.account_id, { in_portfolio: false });
        await this.loadData();
      } catch (err) {
        this.error = formatError(err);
      }
    },

    async doDeleteUpdate(updateId: number) {
      if (!confirm('Undo this update?')) return;
      try {
        await deleteUpdate(updateId);
        await this.loadData();
      } catch (err) {
        this.error = formatError(err);
      }
    },

    async onUndo(event: UpdateWithDetails) {
      if (event.update_type === 'mark_as_closed') {
        await this.undoClose(event);
      } else if (event.update_type === 'include_in_portfolio') {
        await this.undoIncludeInPortfolio(event);
      } else {
        await this.doDeleteUpdate(event.id);
      }
    },
  },
});
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <PageHeader
        title="Update History"
        v-bind:title-suffix="titleSuffix"
        description="View all price and position updates, from statement uploads and manual entries. Undo mistakes."
      >
        <template v-slot:actions>
          <div
            class="inline-flex items-center text-sm font-medium bg-surface border border-page-border rounded-md shrink-0"
            v-bind:class="
              isAllTime ? 'text-placeholder-text cursor-not-allowed' : 'text-secondary-text'
            "
          >
            <button
              class="px-2 py-1.5 hover:bg-surface-recessed rounded-l-md border-r border-page-border disabled:pointer-events-none"
              v-bind:disabled="isAllTime"
              v-on:click="prevMonth"
            >
              <ChevronLeftIcon class="h-4 w-4" />
            </button>
            <span class="px-3 py-1.5 w-22 sm:w-24 text-center">{{ monthLabel }}</span>
            <button
              class="px-2 py-1.5 hover:bg-surface-recessed rounded-r-md border-l border-page-border disabled:pointer-events-none"
              v-bind:disabled="isAllTime"
              v-on:click="nextMonth"
            >
              <ChevronRightIcon class="h-4 w-4" />
            </button>
          </div>
        </template>
      </PageHeader>

      <div v-if="loading" class="text-muted-text">Loading...</div>
      <div v-if="error" class="p-4 bg-error text-error-text rounded-md">{{ error }}</div>

      <div v-if="!loading && events.length === 0" class="text-muted-text text-center py-8">
        No update history yet.
      </div>

      <div v-if="!loading && events.length > 0" class="space-y-4">
        <HistoryEventCard
          v-for="event in events"
          v-bind:key="event.id"
          v-bind:type="event.update_type"
          v-bind:account-name="accountName(event)"
          v-bind:created-at="event.created_at"
          v-bind:creator-name="creatorName(event)"
          v-on:undo="onUndo(event)"
        >
          <div class="text-sm text-secondary-text">
            <p class="font-medium mb-2">As of {{ formatEffectiveDate(event.effective_date) }}:</p>
            <ul class="list-disc list-inside space-y-0.5 text-muted-text ml-2">
              <template v-if="event.update_type === 'statement'">
                <!-- prettier-ignore -->
                <li v-for="holding in event.holdings" v-bind:key="assetIdToString(holding.asset_id)">
                  {{ assetLabel(holding.asset_id) }} is now {{ formatNumber(holding.quantity) }} shares<template v-if="getPriceForAsset(event, holding.asset_id)"> at {{ formatCurrency(getPriceForAsset(event, holding.asset_id)) }}<span class="hidden sm:inline"> per share</span></template>
                </li>
                <li
                  v-for="price in pricesWithoutHoldings(event)"
                  v-bind:key="'price-' + price.asset_id"
                >
                  {{ assetLabel(price.asset_id) }} is now {{ formatCurrency(price.price)
                  }}<span class="hidden sm:inline"> per share</span>
                </li>
              </template>
              <template v-else-if="event.update_type === 'mark_as_closed'">
                <li>All holdings set to zero</li>
              </template>
              <template v-else-if="event.update_type === 'manual_price'">
                <li v-for="price in event.prices" v-bind:key="assetIdToString(price.asset_id)">
                  {{ assetLabel(price.asset_id) }} is now {{ formatCurrency(price.price)
                  }}<span class="hidden sm:inline"> per share</span>
                </li>
              </template>
              <template v-else-if="event.update_type === 'manual_holdings'">
                <li
                  v-for="holding in event.holdings"
                  v-bind:key="assetIdToString(holding.asset_id)"
                >
                  {{ assetLabel(holding.asset_id) }} is now
                  {{ formatNumber(holding.quantity) }} shares
                </li>
              </template>
              <template v-else-if="event.update_type === 'include_in_portfolio'">
                <li>Included in portfolio allocation</li>
              </template>
            </ul>
          </div>
        </HistoryEventCard>
      </div>
    </div>
  </AppLayout>
</template>
