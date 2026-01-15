<script>
import AppLayout from '@/components/AppLayout.vue'
import NetWorthBarChart from '@/components/charts/NetWorthBarChart.vue'
import { supabase } from '@/lib/supabase'

export default {
  name: 'DashboardView',
  components: { AppLayout, NetWorthBarChart },
  data() {
    return {
      monthLabels: [],
      monthValues: [],
      loading: true
    }
  },
  async mounted() {
    await this.loadData()
  },
  methods: {
    async loadData() {
      this.loading = true

      const { data: holdingsData } = await supabase
        .from('asset_holdings')
        .select('asset_id, account_id, holding_date, quantity')
        .order('holding_date', { ascending: true })

      const { data: pricesData } = await supabase
        .from('asset_prices')
        .select('asset_id, price_date, price')
        .order('price_date', { ascending: true })

      const months = this.getLast12Months()
      const values = []

      for (const month of months) {
        const monthEnd = this.getMonthEnd(month)
        const netWorth = this.computeNetWorthAsOf(monthEnd, holdingsData || [], pricesData || [])
        values.push(netWorth)
      }

      this.monthLabels = months.map(m => this.formatMonth(m))
      this.monthValues = values
      this.loading = false
    },

    getLast12Months() {
      const months = []
      const now = new Date()
      // Start from last month (skip current incomplete month)
      for (let i = 12; i >= 1; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
      }
      return months
    },

    getMonthEnd(monthStr) {
      const [year, month] = monthStr.split('-').map(Number)
      const nextMonth = new Date(year, month, 1)
      nextMonth.setDate(nextMonth.getDate() - 1)
      return nextMonth.toISOString().split('T')[0]
    },

    formatMonth(monthStr) {
      const [year, month] = monthStr.split('-')
      const date = new Date(year, month - 1)
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    },

    computeNetWorthAsOf(asOfDate, holdings, prices) {
      // Get latest holding per (asset_id, account_id) on or before asOfDate
      const latestHoldings = {}
      for (const h of holdings) {
        if (h.holding_date <= asOfDate) {
          const key = `${h.asset_id}-${h.account_id}`
          latestHoldings[key] = {
            asset_id: h.asset_id,
            quantity: parseFloat(h.quantity)
          }
        }
      }

      // Sum quantities by asset
      const quantityByAsset = {}
      for (const holding of Object.values(latestHoldings)) {
        quantityByAsset[holding.asset_id] =
          (quantityByAsset[holding.asset_id] || 0) + holding.quantity
      }

      // Get latest price per asset on or before asOfDate
      const latestPrices = {}
      for (const p of prices) {
        if (p.price_date <= asOfDate) {
          latestPrices[p.asset_id] = parseFloat(p.price)
        }
      }

      // Compute total net worth
      let total = 0
      for (const assetId in quantityByAsset) {
        const quantity = quantityByAsset[assetId]
        const price = latestPrices[assetId] || 0
        total += quantity * price
      }

      return total
    }
  }
}
</script>

<template>
  <AppLayout>
    <h1 class="text-2xl font-bold text-gray-900 mb-4">Net Worth</h1>
    <div v-if="loading" class="text-gray-600">Loading...</div>
    <NetWorthBarChart v-else :labels="monthLabels" :values="monthValues" />
  </AppLayout>
</template>
