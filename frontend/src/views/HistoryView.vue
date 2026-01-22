<script>
import AppLayout from '@/components/AppLayout.vue'
import { supabase } from '@/lib/supabase'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { DocumentTextIcon, CurrencyDollarIcon, ChartBarIcon } from '@heroicons/vue/24/outline'
import { TrashIcon } from '@heroicons/vue/24/solid'

dayjs.extend(relativeTime)

export default {
  name: 'HistoryView',
  components: { AppLayout, DocumentTextIcon, CurrencyDollarIcon, ChartBarIcon, TrashIcon },
  data() {
    return {
      events: [],
      loading: true,
      error: null
    }
  },
  async mounted() {
    await this.loadData()
  },
  methods: {
    async loadData() {
      this.loading = true
      this.error = null

      try {
        const [pricesResult, holdingsResult, statementsResult, accountsResult, assetsResult, profilesResult] = await Promise.all([
          supabase.from('asset_prices')
            .select('asset_id, price_date, price, statement_id, created_by, created_at')
            .order('created_at', { ascending: false }),
          supabase.from('asset_holdings')
            .select('asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at')
            .order('created_at', { ascending: false }),
          supabase.from('statements')
            .select('id, account_id, statement_date, created_at')
            .order('created_at', { ascending: false }),
          supabase.from('accounts')
            .select('id, name'),
          supabase.from('assets')
            .select('id, ticker, name'),
          supabase.from('profiles')
            .select('id, name')
        ])

        if (pricesResult.error) throw pricesResult.error
        if (holdingsResult.error) throw holdingsResult.error
        if (statementsResult.error) throw statementsResult.error
        if (accountsResult.error) throw accountsResult.error
        if (assetsResult.error) throw assetsResult.error
        if (profilesResult.error) throw profilesResult.error

        this.processEvents(
          pricesResult.data || [],
          holdingsResult.data || [],
          statementsResult.data || [],
          accountsResult.data || [],
          assetsResult.data || [],
          profilesResult.data || []
        )
      } catch (err) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },

    processEvents(prices, holdings, statements, accounts, assets, profiles) {
      // Build lookup maps
      const accountMap = Object.fromEntries(accounts.map(a => [a.id, a.name]))
      const assetMap = Object.fromEntries(assets.map(a => [a.id, { ticker: a.ticker, name: a.name }]))
      const statementMap = Object.fromEntries(statements.map(s => [s.id, { accountId: s.account_id, effectiveDate: s.statement_date, createdAt: s.created_at }]))
      const profileMap = Object.fromEntries(profiles.map(p => [p.id, p.name]))

      const events = []
      const statementEvents = {} // statement_id -> event object

      // Process prices
      for (const p of prices) {
        const asset = assetMap[p.asset_id] || {}

        if (p.statement_id) {
          // Group under statement
          if (!statementEvents[p.statement_id]) {
            const stmt = statementMap[p.statement_id]
            statementEvents[p.statement_id] = {
              type: 'statement',
              statementId: p.statement_id,
              createdAt: stmt?.createdAt || p.created_at,
              effectiveDate: stmt?.effectiveDate || p.price_date,
              accountName: accountMap[stmt?.accountId] || 'Unknown',
              creatorName: p.created_by ? profileMap[p.created_by] : null,
              priceUpdates: [],
              holdingUpdates: []
            }
          }
          statementEvents[p.statement_id].priceUpdates.push({
            assetName: asset.ticker || asset.name || 'Unknown',
            price: p.price,
            effectiveDate: p.price_date
          })
        } else {
          // Manual price update
          events.push({
            type: 'manual_price',
            assetId: p.asset_id,
            createdAt: p.created_at,
            effectiveDate: p.price_date,
            assetName: asset.ticker || asset.name || 'Unknown',
            price: p.price,
            creatorName: p.created_by ? profileMap[p.created_by] : null
          })
        }
      }

      // Process holdings
      for (const h of holdings) {
        const asset = assetMap[h.asset_id] || {}

        if (h.statement_id) {
          // Group under statement
          if (!statementEvents[h.statement_id]) {
            const stmt = statementMap[h.statement_id]
            statementEvents[h.statement_id] = {
              type: 'statement',
              statementId: h.statement_id,
              createdAt: stmt?.createdAt || h.created_at,
              effectiveDate: stmt?.effectiveDate || h.holding_date,
              accountName: accountMap[stmt?.accountId] || 'Unknown',
              creatorName: h.created_by ? profileMap[h.created_by] : null,
              priceUpdates: [],
              holdingUpdates: []
            }
          }
          statementEvents[h.statement_id].holdingUpdates.push({
            assetName: asset.ticker || asset.name || 'Unknown',
            quantity: h.quantity,
            effectiveDate: h.holding_date,
            accountName: accountMap[h.account_id] || 'Unknown'
          })
        } else {
          // Manual holdings update
          events.push({
            type: 'manual_holding',
            assetId: h.asset_id,
            accountId: h.account_id,
            createdAt: h.created_at,
            effectiveDate: h.holding_date,
            assetName: asset.ticker || asset.name || 'Unknown',
            quantity: h.quantity,
            accountName: accountMap[h.account_id] || 'Unknown',
            creatorName: h.created_by ? profileMap[h.created_by] : null
          })
        }
      }

      // Merge statement events into events array
      events.push(...Object.values(statementEvents))

      // Sort by createdAt descending (most recent action first)
      events.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

      this.events = events
    },

    formatRelativeDate(dateStr) {
      return dayjs(dateStr).fromNow()
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

    // Get price for an asset from statement's price updates
    getPriceForAsset(event, assetName) {
      const priceUpdate = event.priceUpdates.find(p => p.assetName === assetName)
      return priceUpdate ? priceUpdate.price : null
    },

    async deleteStatement(statementId) {
      if (!confirm('Undo this statement upload?')) return
      try {
        const { error } = await supabase.from('statements').delete().eq('id', statementId)
        if (error) throw error
        await this.loadData()
      } catch (err) {
        this.error = err.message
      }
    },

    async deletePrice(assetId, priceDate) {
      if (!confirm('Undo this price update?')) return
      try {
        const { error } = await supabase.from('asset_prices').delete()
          .eq('asset_id', assetId)
          .eq('price_date', priceDate)
        if (error) throw error
        await this.loadData()
      } catch (err) {
        this.error = err.message
      }
    },

    async deleteHolding(assetId, accountId, holdingDate) {
      if (!confirm('Undo this shares update?')) return
      try {
        const { error } = await supabase.from('asset_holdings').delete()
          .eq('asset_id', assetId)
          .eq('account_id', accountId)
          .eq('holding_date', holdingDate)
        if (error) throw error
        await this.loadData()
      } catch (err) {
        this.error = err.message
      }
    }
  }
}
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-900">Update History</h2>
        <p class="mt-1 text-sm text-gray-600">
          A log of all price and position updates, from statement uploads and manual entries.
        </p>
      </div>

      <div v-if="loading" class="text-gray-500">Loading...</div>
      <div v-if="error" class="p-4 bg-red-50 text-red-800 rounded-md">{{ error }}</div>

      <div v-if="!loading && events.length === 0" class="text-gray-500 text-center py-8">
        No update history yet.
      </div>

      <div v-if="!loading && events.length > 0" class="space-y-4">
        <!-- Statement Event Card -->
        <div
          v-for="(event, index) in events"
          :key="event.type + '-' + event.createdAt + '-' + index"
          class="bg-white rounded-lg shadow p-4"
          :class="{
            'border-l-4 border-blue-500': event.type === 'statement',
            'border-l-4 border-green-500': event.type === 'manual_price',
            'border-l-4 border-purple-500': event.type === 'manual_holding'
          }"
        >
          <!-- Statement Upload -->
          <template v-if="event.type === 'statement'">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <DocumentTextIcon class="h-5 w-5 text-blue-500" />
                <span class="font-medium text-gray-900">Statement Upload</span>
                <span class="text-gray-400">-</span>
                <span class="font-medium text-gray-900">{{ event.accountName }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-sm text-gray-500">{{ formatRelativeDate(event.createdAt) }}<template v-if="event.creatorName"> by {{ event.creatorName }}</template></span>
                <button
                  @click="deleteStatement(event.statementId)"
                  class="w-8 h-8 -my-1 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                  title="Undo statement upload"
                >
                  <TrashIcon class="w-5 h-5" />
                </button>
              </div>
            </div>
            <hr class="my-3 border-gray-200" />
            <div class="text-sm text-gray-700">
              <p class="font-medium mb-2">Effective {{ formatEffectiveDate(event.effectiveDate) }}:</p>
              <ul class="list-disc list-inside space-y-0.5 text-gray-600 ml-2">
                <li v-for="holding in event.holdingUpdates" :key="holding.assetName">
                  {{ holding.assetName }} is now {{ formatNumber(holding.quantity) }} shares<template v-if="getPriceForAsset(event, holding.assetName)"> at {{ formatCurrency(getPriceForAsset(event, holding.assetName)) }} per share</template>
                </li>
                <!-- Show price-only updates (assets with price but no holding in this statement) -->
                <li v-for="price in event.priceUpdates.filter(p => !event.holdingUpdates.some(h => h.assetName === p.assetName))" :key="'price-' + price.assetName">
                  {{ price.assetName }} is now {{ formatCurrency(price.price) }} per share
                </li>
              </ul>
            </div>
          </template>

          <!-- Manual Price Update -->
          <template v-else-if="event.type === 'manual_price'">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <CurrencyDollarIcon class="h-5 w-5 text-green-500" />
                <span class="font-medium text-gray-900">Price Update</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-sm text-gray-500">{{ formatRelativeDate(event.createdAt) }}<template v-if="event.creatorName"> by {{ event.creatorName }}</template></span>
                <button
                  @click="deletePrice(event.assetId, event.effectiveDate)"
                  class="w-8 h-8 -my-1 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                  title="Undo price update"
                >
                  <TrashIcon class="w-5 h-5" />
                </button>
              </div>
            </div>
            <hr class="my-3 border-gray-200" />
            <div class="text-sm text-gray-700">
              <p class="font-medium mb-2">Effective {{ formatEffectiveDate(event.effectiveDate) }}:</p>
              <ul class="list-disc list-inside text-gray-600 ml-2">
                <li>{{ event.assetName }} is now {{ formatCurrency(event.price) }} per share</li>
              </ul>
            </div>
          </template>

          <!-- Manual Holding Update -->
          <template v-else-if="event.type === 'manual_holding'">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <ChartBarIcon class="h-5 w-5 text-purple-500" />
                <span class="font-medium text-gray-900">Shares Update</span>
                <span class="text-gray-400">-</span>
                <span class="font-medium text-gray-900">{{ event.accountName }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-sm text-gray-500">{{ formatRelativeDate(event.createdAt) }}<template v-if="event.creatorName"> by {{ event.creatorName }}</template></span>
                <button
                  @click="deleteHolding(event.assetId, event.accountId, event.effectiveDate)"
                  class="w-8 h-8 -my-1 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                  title="Undo shares update"
                >
                  <TrashIcon class="w-5 h-5" />
                </button>
              </div>
            </div>
            <hr class="my-3 border-gray-200" />
            <div class="text-sm text-gray-700">
              <p class="font-medium mb-2">Effective {{ formatEffectiveDate(event.effectiveDate) }}:</p>
              <ul class="list-disc list-inside text-gray-600 ml-2">
                <li>{{ event.assetName }} is now {{ formatNumber(event.quantity) }} shares</li>
              </ul>
            </div>
          </template>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
