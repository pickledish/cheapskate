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
  type PriceUpdate,
} from '@/lib/data';
import dayjs from 'dayjs';
import { formatCurrency, formatNumber } from '@/lib/format';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/vue/24/outline';

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
    accountNames: Record<number, string>;
    assetLabels: Record<number, string>;
    profileNames: Record<string, string>;
    loading: boolean;
    error: string | null;
    selectedYear: number;
    selectedMonth: number;
  } {
    const now = dayjs();
    return {
      events: [],
      accountNames: {},
      assetLabels: {},
      profileNames: {},
      loading: true,
      error: null,
      selectedYear: now.year(),
      selectedMonth: now.month() + 1,
    };
  },
  computed: {
    monthLabel(): string {
      return dayjs()
        .year(this.selectedYear)
        .month(this.selectedMonth - 1)
        .format('MMM YYYY');
    },
  },
  async mounted() {
    await this.loadData();
  },
  methods: {
    async prevMonth() {
      if (this.selectedMonth === 1) {
        this.selectedMonth = 12;
        this.selectedYear--;
      } else {
        this.selectedMonth--;
      }
      await this.loadData();
    },
    async nextMonth() {
      if (this.selectedMonth === 12) {
        this.selectedMonth = 1;
        this.selectedYear++;
      } else {
        this.selectedMonth++;
      }
      await this.loadData();
    },
    async loadData() {
      this.loading = true;
      this.error = null;

      try {
        const [updates, accounts, assets, profiles] = await Promise.all([
          listUpdatesWithDetails(this.selectedYear, this.selectedMonth),
          listAccounts(),
          listAssets(),
          listProfiles(),
        ]);

        this.accountNames = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
        this.assetLabels = Object.fromEntries(
          assets.map((a) => [a.id, a.ticker || a.name || 'Unknown']),
        );
        this.profileNames = Object.fromEntries(profiles.map((p) => [p.id, p.name]));
        this.events = updates;
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err);
      } finally {
        this.loading = false;
      }
    },

    accountName(event: UpdateWithDetails): string | null {
      if (event.account_id == null) return null;
      return this.accountNames[event.account_id] || 'Unknown';
    },

    creatorName(event: UpdateWithDetails): string | null {
      return this.profileNames[event.created_by] ?? null;
    },

    assetLabel(assetId: number): string {
      return this.assetLabels[assetId] || 'Unknown';
    },

    formatEffectiveDate(dateStr: string) {
      return dayjs(dateStr).format('MMM D YYYY');
    },

    formatCurrency,
    formatNumber,

    getPriceForAsset(event: UpdateWithDetails, assetId: number): number | null {
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
        await updateAccount(event.account_id, { archived_at: null });
        await this.loadData();
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err);
      }
    },

    async doDeleteUpdate(updateId: number) {
      if (!confirm('Undo this update?')) return;
      try {
        await deleteUpdate(updateId);
        await this.loadData();
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err);
      }
    },

    async onUndo(event: UpdateWithDetails) {
      if (event.update_type === 'mark_as_closed') {
        await this.undoClose(event);
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
        description="View all price and position updates, from statement uploads and manual entries. Undo mistakes."
      >
        <template v-slot:actions>
          <div
            class="inline-flex items-center text-sm font-medium text-secondary-text bg-surface border border-page-border rounded-md shrink-0"
          >
            <button
              class="px-2 py-1.5 hover:bg-surface-recessed rounded-l-md border-r border-page-border"
              v-on:click="prevMonth"
            >
              <ChevronLeftIcon class="h-4 w-4" />
            </button>
            <span class="px-3 py-1.5 w-22 sm:w-24 text-center">{{ monthLabel }}</span>
            <button
              class="px-2 py-1.5 hover:bg-surface-recessed rounded-r-md border-l border-page-border"
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
                <li v-for="holding in event.holdings" v-bind:key="holding.asset_id">
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
                <li v-for="price in event.prices" v-bind:key="price.asset_id">
                  {{ assetLabel(price.asset_id) }} is now {{ formatCurrency(price.price)
                  }}<span class="hidden sm:inline"> per share</span>
                </li>
              </template>
              <template v-else-if="event.update_type === 'manual_holdings'">
                <li v-for="holding in event.holdings" v-bind:key="holding.asset_id">
                  {{ assetLabel(holding.asset_id) }} is now
                  {{ formatNumber(holding.quantity) }} shares
                </li>
              </template>
            </ul>
          </div>
        </HistoryEventCard>
      </div>
    </div>
  </AppLayout>
</template>
