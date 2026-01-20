<script>
import AppLayout from '@/components/AppLayout.vue'
import AllocationHistoryChart from '@/components/charts/AllocationHistoryChart.vue'
import AllocationComparisonGrid from '@/components/charts/AllocationComparisonGrid.vue'
import { supabase } from '@/lib/supabase'

export default {
  name: 'CompositionView',
  components: { AppLayout, AllocationHistoryChart, AllocationComparisonGrid },
  data() {
    return {
      loading: true,
      error: null,
      monthLabels: [],
      chartSeries: [],
      comparisonAllocations: [],
      currentTotalValue: 0,
      // Raw data from database
      holdingsData: [],
      pricesData: [],
      accountsData: [],
      assetClassesData: [],
      allocationsData: []
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
        const [holdingsResult, pricesResult, accountsResult, assetClassesResult, allocationsResult] = await Promise.all([
          supabase.from('asset_holdings').select('asset_id, account_id, holding_date, quantity').order('holding_date', { ascending: true }),
          supabase.from('asset_prices').select('asset_id, price_date, price').order('price_date', { ascending: true }),
          supabase.from('accounts').select('id, name, rebalancing'),
          supabase.from('asset_classes').select('id, name, color, sort_order, goal').order('sort_order'),
          supabase.from('asset_allocations').select('asset_id, asset_class_id, percentage')
        ])

        if (holdingsResult.error) throw holdingsResult.error
        if (pricesResult.error) throw pricesResult.error
        if (accountsResult.error) throw accountsResult.error
        if (assetClassesResult.error) throw assetClassesResult.error
        if (allocationsResult.error) throw allocationsResult.error

        this.holdingsData = holdingsResult.data || []
        this.pricesData = pricesResult.data || []
        this.accountsData = accountsResult.data || []
        this.assetClassesData = assetClassesResult.data || []
        this.allocationsData = allocationsResult.data || []

        this.computeChartData()
      } catch (err) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },

    computeChartData() {
      const allMonths = this.getLast12Months()

      // Get rebalancing account IDs
      const rebalancingAccountIds = new Set(
        this.accountsData.filter(a => a.rebalancing).map(a => a.id)
      )

      // Build allocation lookup: asset_id -> [{classId, percentage}, ...]
      const allocationsByAsset = {}
      for (const alloc of this.allocationsData) {
        if (!allocationsByAsset[alloc.asset_id]) {
          allocationsByAsset[alloc.asset_id] = []
        }
        allocationsByAsset[alloc.asset_id].push({
          classId: alloc.asset_class_id,
          percentage: parseFloat(alloc.percentage)
        })
      }

      // First pass: find which months have data
      const monthsWithData = allMonths.filter(month => {
        const monthEnd = this.getMonthEnd(month)
        const holdings = this.getLatestHoldings(monthEnd, rebalancingAccountIds)
        const prices = this.getLatestPrices(monthEnd)
        let totalValue = 0
        for (const h of holdings) {
          totalValue += h.quantity * (prices[h.asset_id] || 0)
        }
        return totalValue > 0
      })

      this.monthLabels = monthsWithData.map(m => this.formatMonth(m))

      // Build class map for names and colors
      const classMap = Object.fromEntries(this.assetClassesData.map(c => [c.id, { name: c.name, color: c.color }]))
      const classIds = this.assetClassesData.map(c => c.id)

      // Compute values by class for each month (only months with data)
      const seriesData = classIds.map(classId => {
        const data = monthsWithData.map(month => {
          const monthEnd = this.getMonthEnd(month)
          const holdings = this.getLatestHoldings(monthEnd, rebalancingAccountIds)
          const prices = this.getLatestPrices(monthEnd)

          let classValue = 0
          let totalValue = 0

          for (const h of holdings) {
            const assetValue = h.quantity * (prices[h.asset_id] || 0)
            totalValue += assetValue

            const allocations = allocationsByAsset[h.asset_id] || []
            const classAlloc = allocations.find(a => a.classId === classId)
            if (classAlloc) {
              classValue += assetValue * classAlloc.percentage
            }
          }

          // Return percentage (will be normalized after)
          return { classValue, totalValue }
        })
        const classInfo = classMap[classId] || { name: `Class ${classId}`, color: 'red' }
        return { classId, name: classInfo.name, color: classInfo.color, data }
      })

      // Normalize: convert to percentages of total for each month
      this.chartSeries = seriesData
        .map(s => ({
          name: s.name,
          color: s.color,
          data: s.data.map(d => d.totalValue > 0 ? d.classValue / d.totalValue : 0)
        }))
        .filter(s => s.data.some(v => v > 0))

      // Compute current vs goal comparison for the grid
      // Use the most recent holdings (today) for current allocation
      const today = new Date().toISOString().split('T')[0]
      const currentHoldings = this.getLatestHoldings(today, rebalancingAccountIds)
      const currentPrices = this.getLatestPrices(today)

      // Calculate current value by class
      const currentValueByClass = {}
      let currentTotal = 0
      for (const h of currentHoldings) {
        const assetValue = h.quantity * (currentPrices[h.asset_id] || 0)
        currentTotal += assetValue

        const allocations = allocationsByAsset[h.asset_id] || []
        for (const alloc of allocations) {
          currentValueByClass[alloc.classId] = (currentValueByClass[alloc.classId] || 0) + assetValue * alloc.percentage
        }
      }

      // Store total value for the comparison grid
      this.currentTotalValue = currentTotal

      // Build comparison data for all asset classes (respecting sort_order)
      this.comparisonAllocations = this.assetClassesData.map(ac => ({
        name: ac.name,
        color: ac.color,
        current: currentTotal > 0 ? (currentValueByClass[ac.id] || 0) / currentTotal : 0,
        goal: ac.goal || 0
      }))
    },

    getLast12Months() {
      const months = []
      const now = new Date()
      for (let i = 11; i >= 0; i--) {
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
      const now = new Date()
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      if (monthStr === currentMonth) {
        return 'Current'
      }
      const [year, month] = monthStr.split('-')
      const date = new Date(year, month - 1)
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    },

    getLatestHoldings(asOfDate, accountIds) {
      const latestHoldings = {}
      for (const h of this.holdingsData) {
        if (h.holding_date <= asOfDate && accountIds.has(h.account_id)) {
          const key = `${h.asset_id}-${h.account_id}`
          latestHoldings[key] = {
            asset_id: h.asset_id,
            account_id: h.account_id,
            quantity: parseFloat(h.quantity)
          }
        }
      }
      return Object.values(latestHoldings)
    },

    getLatestPrices(asOfDate) {
      const latestPrices = {}
      for (const p of this.pricesData) {
        if (p.price_date <= asOfDate) {
          latestPrices[p.asset_id] = parseFloat(p.price)
        }
      }
      return latestPrices
    }
  }
}
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Portfolio Composition</h1>
        <p class="text-sm text-gray-600 mt-1">Asset class allocation over time (rebalancing accounts only)</p>
      </div>

      <div v-if="error" class="p-4 bg-red-50 text-red-800 rounded-md">
        {{ error }}
      </div>

      <div v-if="loading" class="text-gray-500">Loading...</div>

      <template v-if="!loading && !error">
        <!-- Current vs Goal comparison grid -->
        <div class="bg-white shadow rounded-lg p-6">
          <h2 class="text-lg font-medium text-gray-900 mb-4">Current vs Target Allocation</h2>
          <AllocationComparisonGrid :allocations="comparisonAllocations" :totalValue="currentTotalValue" />
        </div>

        <!-- Allocation history chart -->
        <div class="bg-white shadow rounded-lg p-6">
          <h2 class="text-lg font-medium text-gray-900 mb-4">Allocation Over Time</h2>
          <AllocationHistoryChart :labels="monthLabels" :series="chartSeries" />
        </div>
      </template>
    </div>
  </AppLayout>
</template>
