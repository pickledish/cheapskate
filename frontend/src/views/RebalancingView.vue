<script>
import AppLayout from '@/components/AppLayout.vue'
import PageHeader from '@/components/PageHeader.vue'
import AllocationHistoryChart from '@/components/charts/AllocationHistoryChart.vue'
import AllocationComparisonGrid from '@/components/charts/AllocationComparisonGrid.vue'
import { listHoldingUpdatesWithContext, listPriceUpdatesWithContext, listAccounts, listAssetClasses, listAssetAllocations } from '@/lib/data'
import { formatMonth } from '@/lib/format'

export default {
  name: 'RebalancingView',
  components: { AppLayout, PageHeader, AllocationHistoryChart, AllocationComparisonGrid },
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
        const [holdings, prices, accounts, assetClasses, allocations] = await Promise.all([
          listHoldingUpdatesWithContext('asc'),
          listPriceUpdatesWithContext('asc'),
          listAccounts(),
          listAssetClasses(),
          listAssetAllocations()
        ])

        this.holdingsData = holdings
        this.pricesData = prices
        this.accountsData = accounts
        this.assetClassesData = assetClasses
        this.allocationsData = allocations

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

      // Build class map for names, colors, and goals
      const classMap = Object.fromEntries(this.assetClassesData.map(c => [c.id, { name: c.name, color: c.color, goal: c.goal || 0 }]))
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
        const classInfo = classMap[classId] || { name: `Class ${classId}`, color: 'red', goal: 0 }
        return { classId, name: classInfo.name, color: classInfo.color, goal: classInfo.goal, data }
      })

      // Normalize: convert to percentages of total for each month
      // Exclude asset classes with no goal and no liquid holdings (nothing to rebalance)
      const normalizedSeries = seriesData
        .map(s => ({
          name: s.name,
          color: s.color,
          goal: s.goal,
          data: s.data.map(d => d.totalValue > 0 ? d.classValue / d.totalValue : 0)
        }))
        .filter(s => s.goal > 0 || s.data.some(v => v > 0))

      // Compute unclassified portion for each month (assets with no/incomplete allocations)
      const unclassifiedData = monthsWithData.map((month, monthIndex) => {
        const classifiedTotal = normalizedSeries.reduce((sum, s) => sum + s.data[monthIndex], 0)
        return Math.max(0, 1 - classifiedTotal)
      })

      // Add unclassified series if any month has unclassified value
      if (unclassifiedData.some(v => v > 0.001)) {
        normalizedSeries.push({
          name: 'Unclassified',
          color: 'gray',
          data: unclassifiedData
        })
      }

      this.chartSeries = normalizedSeries

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
      // Exclude asset classes with no goal and no liquid holdings (nothing to rebalance)
      this.comparisonAllocations = this.assetClassesData.map(ac => ({
        name: ac.name,
        color: ac.color,
        current: currentTotal > 0 ? (currentValueByClass[ac.id] || 0) / currentTotal : 0,
        goal: ac.goal || 0
      })).filter(ac => ac.goal > 0 || ac.current > 0)
    },

    getLast12Months() {
      const months = []
      const now = new Date()
      // Start from 12 months ago, end at previous month (exclude current month)
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

    formatMonth,

    getLatestHoldings(effectiveDate, accountIds) {
      const latestHoldings = {}
      for (const h of this.holdingsData) {
        if (h.effective_date <= effectiveDate && accountIds.has(h.account_id)) {
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

    getLatestPrices(effectiveDate) {
      const latestPrices = {}
      for (const p of this.pricesData) {
        if (p.effective_date <= effectiveDate) {
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
      <PageHeader
        title="Rebalancing"
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
            <h3 class="text-xs font-medium text-header-text uppercase tracking-wider">Current vs Target Allocation</h3>
          </div>
          <div class="p-6">
            <AllocationComparisonGrid v-if="comparisonAllocations.length > 0 && comparisonAllocations.some(a => a.current > 0)" :allocations="comparisonAllocations" :totalValue="currentTotalValue" />
            <div v-else class="text-center text-muted-text py-7">No allocation history to display.</div>
          </div>
        </div>

        <!-- Allocation history chart -->
        <div class="bg-surface shadow rounded-lg overflow-hidden">
          <div class="bg-header px-6 py-3">
            <h3 class="text-xs font-medium text-header-text uppercase tracking-wider">Allocation Over Time</h3>
          </div>
          <div class="p-6">
            <AllocationHistoryChart :labels="monthLabels" :series="chartSeries" />
          </div>
        </div>
      </template>
    </div>
  </AppLayout>
</template>
