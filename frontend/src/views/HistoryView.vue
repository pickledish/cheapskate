<script>
import AppLayout from '@/components/AppLayout.vue'
import PageHeader from '@/components/PageHeader.vue'
import HistoryEventCard from '@/components/HistoryEventCard.vue'
import {
  listUpdatesWithDetails,
  listAccounts,
  listAssets,
  listProfiles,
  deleteUpdate,
  updateAccount
} from '@/lib/data'
import dayjs from 'dayjs'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/vue/24/outline'

export default {
  name: 'HistoryView',
  components: {
    AppLayout,
    PageHeader,
    HistoryEventCard,
    ChevronLeftIcon,
    ChevronRightIcon
  },
  data() {
    const now = dayjs()
    return {
      events: [],
      loading: true,
      error: null,
      selectedYear: now.year(),
      selectedMonth: now.month() + 1
    }
  },
  computed: {
    monthLabel() {
      return dayjs().year(this.selectedYear).month(this.selectedMonth - 1).format('MMM YYYY')
    }
  },
  async mounted() {
    await this.loadData()
  },
  methods: {
    prevMonth() {
      if (this.selectedMonth === 1) {
        this.selectedMonth = 12
        this.selectedYear--
      } else {
        this.selectedMonth--
      }
      this.loadData()
    },
    nextMonth() {
      if (this.selectedMonth === 12) {
        this.selectedMonth = 1
        this.selectedYear++
      } else {
        this.selectedMonth++
      }
      this.loadData()
    },
    async loadData() {
      this.loading = true
      this.error = null

      try {
        const [updates, accounts, assets, profiles] = await Promise.all([
          listUpdatesWithDetails(this.selectedYear, this.selectedMonth),
          listAccounts(),
          listAssets(),
          listProfiles()
        ])

        const accountMap = Object.fromEntries(accounts.map(a => [a.id, a.name]))
        const assetMap = Object.fromEntries(assets.map(a => [a.id, { ticker: a.ticker, name: a.name }]))
        const profileMap = Object.fromEntries(profiles.map(p => [p.id, p.name]))

        this.events = updates.map(u => ({
          id: u.id,
          type: u.update_type,
          accountId: u.account_id,
          accountName: u.account_id ? accountMap[u.account_id] || 'Unknown' : null,
          effectiveDate: u.effective_date,
          createdAt: u.created_at,
          creatorName: u.created_by ? profileMap[u.created_by] : null,
          prices: u.prices.map(p => ({
            assetName: assetMap[p.asset_id]?.ticker || assetMap[p.asset_id]?.name || 'Unknown',
            price: p.price
          })),
          holdings: u.holdings.map(h => ({
            assetName: assetMap[h.asset_id]?.ticker || assetMap[h.asset_id]?.name || 'Unknown',
            quantity: h.quantity
          }))
        }))
      } catch (err) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },

    formatEffectiveDate(dateStr) {
      return dayjs(dateStr).format('MMM D YYYY')
    },

    formatCurrency(value) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(value)
    },

    formatNumber(value) {
      return Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 })
    },

    getPriceForAsset(event, assetName) {
      const priceUpdate = event.prices.find(p => p.assetName === assetName)
      return priceUpdate ? priceUpdate.price : null
    },

    async undoClose(event) {
      if (!confirm(`Undo close of "${event.accountName}"? This will restore the account and undo the zeroed-out holdings.`)) return
      try {
        await deleteUpdate(event.id)
        await updateAccount(event.accountId, { archived_at: null })
        await this.loadData()
      } catch (err) {
        this.error = err.message
      }
    },

    async doDeleteUpdate(updateId) {
      if (!confirm('Undo this update?')) return
      try {
        await deleteUpdate(updateId)
        await this.loadData()
      } catch (err) {
        this.error = err.message
      }
    },

    onUndo(event) {
      if (event.type === 'mark_as_closed') {
        this.undoClose(event)
      } else {
        this.doDeleteUpdate(event.id)
      }
    }
  }
}
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <PageHeader
        title="Update History"
        description="View all price and position updates, from statement uploads and manual entries. Undo mistakes."
      >
        <template #actions>
          <div class="inline-flex items-center text-sm font-medium text-secondary-text bg-surface border border-gray-300 rounded-md shrink-0">
            <button @click="prevMonth" class="px-2 py-1.5 hover:bg-recessed rounded-l-md border-r border-gray-300">
              <ChevronLeftIcon class="h-4 w-4" />
            </button>
            <span class="px-3 py-1.5 w-22 sm:w-24 text-center">{{ monthLabel }}</span>
            <button @click="nextMonth" class="px-2 py-1.5 hover:bg-recessed rounded-r-md border-l border-gray-300">
              <ChevronRightIcon class="h-4 w-4" />
            </button>
          </div>
        </template>
      </PageHeader>

      <div v-if="loading" class="text-muted-text">Loading...</div>
      <div v-if="error" class="p-4 bg-red-50 text-red-800 rounded-md">{{ error }}</div>

      <div v-if="!loading && events.length === 0" class="text-muted-text text-center py-8">
        No update history yet.
      </div>

      <div v-if="!loading && events.length > 0" class="space-y-4">
        <HistoryEventCard
          v-for="event in events"
          :key="event.id"
          :type="event.type"
          :account-name="event.accountName"
          :created-at="event.createdAt"
          :creator-name="event.creatorName"
          v-on:undo="onUndo(event)"
        >
          <div class="text-sm text-secondary-text">
            <p class="font-medium mb-2">Effective {{ formatEffectiveDate(event.effectiveDate) }}:</p>
            <ul class="list-disc list-inside space-y-0.5 text-muted-text ml-2">
              <template v-if="event.type === 'statement'">
                <li v-for="holding in event.holdings" :key="holding.assetName">
                  {{ holding.assetName }} is now {{ formatNumber(holding.quantity) }} shares<template v-if="getPriceForAsset(event, holding.assetName)"> at {{ formatCurrency(getPriceForAsset(event, holding.assetName)) }}<span class="hidden sm:inline"> per share</span></template>
                </li>
                <li v-for="price in event.prices.filter(p => !event.holdings.some(h => h.assetName === p.assetName))" :key="'price-' + price.assetName">
                  {{ price.assetName }} is now {{ formatCurrency(price.price) }}<span class="hidden sm:inline"> per share</span>
                </li>
              </template>
              <template v-else-if="event.type === 'mark_as_closed'">
                <li>All holdings set to zero</li>
              </template>
              <template v-else-if="event.type === 'manual_price'">
                <li v-for="price in event.prices" :key="price.assetName">
                  {{ price.assetName }} is now {{ formatCurrency(price.price) }}<span class="hidden sm:inline"> per share</span>
                </li>
              </template>
              <template v-else-if="event.type === 'manual_holdings'">
                <li v-for="holding in event.holdings" :key="holding.assetName">
                  {{ holding.assetName }} is now {{ formatNumber(holding.quantity) }} shares
                </li>
              </template>
            </ul>
          </div>
        </HistoryEventCard>
      </div>
    </div>
  </AppLayout>
</template>
