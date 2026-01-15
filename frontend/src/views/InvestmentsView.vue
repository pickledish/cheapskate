<script>
import AppLayout from '@/components/AppLayout.vue'
import AssetClassPieChart from '@/components/charts/AssetClassPieChart.vue'
import { supabase } from '@/lib/supabase'

export default {
  name: 'InvestmentsView',
  components: { AppLayout, AssetClassPieChart },
  data() {
    return {
      loading: true,
      error: null,
      classLabels: [],
      classValues: [],
      goalLabels: [],
      goalValues: [],
      totalValue: 0,
      totalGoals: 0,
      hasAnyGoals: false
    }
  },
  computed: {
    goalsAreValid() {
      return this.hasAnyGoals && Math.abs(this.totalGoals - 1) < 0.001
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
        // Load all data in parallel
        const [accountsResult, holdingsResult, pricesResult, allocationsResult, assetClassesResult] = await Promise.all([
          supabase.from('accounts').select('id').eq('rebalancing', true),
          supabase.from('asset_holdings').select('asset_id, account_id, quantity, holding_date').order('holding_date', { ascending: false }),
          supabase.from('asset_prices').select('asset_id, price, price_date').order('price_date', { ascending: false }),
          supabase.from('asset_allocations').select('asset_id, percentage, asset_classes(id, name)'),
          supabase.from('asset_classes').select('id, name, goal, sort_order').order('sort_order')
        ])

        if (accountsResult.error) throw accountsResult.error
        if (holdingsResult.error) throw holdingsResult.error
        if (pricesResult.error) throw pricesResult.error
        if (allocationsResult.error) throw allocationsResult.error
        if (assetClassesResult.error) throw assetClassesResult.error

        const accountsData = accountsResult.data
        const holdingsData = holdingsResult.data
        const pricesData = pricesResult.data
        const allocationsData = allocationsResult.data
        const assetClassesData = assetClassesResult.data

        const rebalancingAccountIds = new Set(accountsData.map(a => a.id))

        // Filter to only holdings from rebalancing accounts
        const filteredHoldings = holdingsData.filter(h => rebalancingAccountIds.has(h.account_id))

        // Build sort order map for chart ordering
        const classSortOrder = {}
        for (const ac of assetClassesData) {
          classSortOrder[ac.name] = ac.sort_order
        }

        // Calculate total goals (only classes with goal > 0)
        const classesWithGoals = assetClassesData.filter(ac => ac.goal > 0)
        this.hasAnyGoals = classesWithGoals.length > 0
        this.totalGoals = classesWithGoals.reduce((sum, ac) => sum + ac.goal, 0)

        // Build goal labels for pie chart, sorted by sort_order
        // (values computed later after we have total portfolio value)
        this.goalLabels = classesWithGoals.map(ac => ac.name)
        const goalRatios = classesWithGoals.map(ac => ac.goal)

        // Build map: get latest holding per asset-account combo, then sum by asset
        const latestHoldingByAssetAccount = {}
        for (const h of filteredHoldings) {
          const key = `${h.asset_id}-${h.account_id}`
          if (!latestHoldingByAssetAccount[key]) {
            latestHoldingByAssetAccount[key] = {
              asset_id: h.asset_id,
              quantity: parseFloat(h.quantity)
            }
          }
        }

        // Sum quantities by asset
        const totalQuantityByAsset = {}
        for (const holding of Object.values(latestHoldingByAssetAccount)) {
          totalQuantityByAsset[holding.asset_id] =
            (totalQuantityByAsset[holding.asset_id] || 0) + holding.quantity
        }

        // Build map: asset_id -> latest price
        const latestPriceByAsset = {}
        for (const p of pricesData) {
          if (!latestPriceByAsset[p.asset_id]) {
            latestPriceByAsset[p.asset_id] = parseFloat(p.price)
          }
        }

        // Build map: asset_id -> [{ className, percentage }]
        const allocationsByAsset = {}
        for (const a of allocationsData) {
          if (!allocationsByAsset[a.asset_id]) {
            allocationsByAsset[a.asset_id] = []
          }
          allocationsByAsset[a.asset_id].push({
            className: a.asset_classes.name,
            percentage: parseFloat(a.percentage)
          })
        }

        // Calculate value per asset class
        const valueByClass = {}
        let total = 0

        for (const assetId in totalQuantityByAsset) {
          const quantity = totalQuantityByAsset[assetId]
          const price = latestPriceByAsset[assetId] || 0
          const positionValue = quantity * price
          total += positionValue

          const allocations = allocationsByAsset[assetId]
          if (allocations && allocations.length > 0) {
            // Distribute value across classes by percentage
            for (const alloc of allocations) {
              const classValue = positionValue * alloc.percentage
              valueByClass[alloc.className] = (valueByClass[alloc.className] || 0) + classValue
            }
          } else {
            // No allocation defined - put in "Unclassified"
            valueByClass['Unclassified'] = (valueByClass['Unclassified'] || 0) + positionValue
          }
        }

        // Convert to arrays for chart, sorted by user-defined sort_order
        const sorted = Object.entries(valueByClass)
          .sort((a, b) => {
            const orderA = classSortOrder[a[0]] ?? 999
            const orderB = classSortOrder[b[0]] ?? 999
            return orderA - orderB
          })

        this.classLabels = sorted.map(([name]) => name)
        this.classValues = sorted.map(([, value]) => value)
        this.totalValue = total

        // Compute goal values as dollar amounts (ratio × total portfolio value)
        this.goalValues = goalRatios.map(ratio => ratio * total)

      } catch (err) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },

    formatCurrency(value) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value)
    }
  }
}
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Rebalancing</h1>
        <p class="text-sm text-gray-600 mt-1">Portfolio composition by asset class (rebalancing accounts only)</p>
      </div>

      <!-- Error display -->
      <div v-if="error" class="p-4 bg-red-50 text-red-800 rounded-md">
        {{ error }}
      </div>

      <!-- Goals warning -->
      <div v-if="!loading && hasAnyGoals && Math.abs(totalGoals - 1) > 0.001" class="p-4 bg-amber-50 text-amber-800 rounded-md">
        Target allocations sum to {{ totalGoals * 100 }}%, not 100%. Update your asset class goals.
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="text-gray-500">Loading...</div>

      <!-- Content -->
      <div v-if="!loading && !error">
        <!-- Total value -->
        <div class="bg-white shadow rounded-lg p-6 mb-6">
          <p class="text-sm text-gray-500 mb-1">Total Portfolio Value</p>
          <p class="text-3xl font-bold text-gray-900">{{ formatCurrency(totalValue) }}</p>
        </div>

        <!-- Pie charts -->
        <div class="grid gap-6" v-bind:class="goalsAreValid ? 'grid-cols-2' : 'grid-cols-1'">
          <!-- Current allocation -->
          <div class="bg-white shadow rounded-lg p-6">
            <h2 class="text-lg font-medium text-gray-900 mb-4">Current Allocation</h2>
            <AssetClassPieChart :labels="classLabels" :values="classValues" />
          </div>

          <!-- Target allocation (only if goals sum to 100%) -->
          <div v-if="goalsAreValid" class="bg-white shadow rounded-lg p-6">
            <h2 class="text-lg font-medium text-gray-900 mb-4">Target Allocation</h2>
            <AssetClassPieChart :labels="goalLabels" :values="goalValues" />
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
