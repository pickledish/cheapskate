<script>
import AppLayout from '@/components/AppLayout.vue'
import NetWorthBarChart from '@/components/charts/NetWorthBarChart.vue'
import { listHoldingUpdatesWithContext, listPriceUpdatesWithContext, listAccounts, listProfiles, listAssets, listAssetClasses, listAssetAllocations } from '@/lib/data'
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue'
import { ChevronDownIcon, CheckIcon } from '@heroicons/vue/20/solid'

export default {
  name: 'DashboardView',
  components: { AppLayout, NetWorthBarChart, Menu, MenuButton, MenuItems, MenuItem, ChevronDownIcon, CheckIcon },
  data() {
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
        { value: 'assetClass', label: 'Asset Class' }
      ],
      // Raw data from database
      holdingsData: [],
      pricesData: [],
      accountsData: [],
      profilesData: [],
      assetsData: [],
      assetClassesData: [],
      allocationsData: []
    }
  },
  computed: {
    selectedGroupByLabel() {
      const opt = this.groupByOptions.find(o => o.value === this.groupBy)
      return opt ? opt.label : 'None'
    }
  },
  watch: {
    groupBy() {
      this.computeChartData()
    }
  },
  async mounted() {
    await this.loadData()
  },
  methods: {
    async loadData() {
      this.loading = true

      const [holdings, prices, accounts, profiles, assets, assetClasses, allocations] = await Promise.all([
        listHoldingUpdatesWithContext('asc'),
        listPriceUpdatesWithContext('asc'),
        listAccounts(),
        listProfiles(),
        listAssets(),
        listAssetClasses(),
        listAssetAllocations()
      ])

      this.holdingsData = holdings
      this.pricesData = prices
      this.accountsData = accounts
      this.profilesData = profiles
      this.assetsData = assets
      this.assetClassesData = assetClasses
      this.allocationsData = allocations

      this.computeChartData()
      this.loading = false
    },

    computeChartData() {
      const months = this.getLast12Months()
      this.monthLabels = months.map(m => this.formatMonth(m))

      if (this.groupBy === 'none') {
        const values = months.map(month => {
          const monthEnd = this.getMonthEnd(month)
          return this.computeNetWorthAsOf(monthEnd)
        })
        this.chartSeries = [{ name: 'Net Worth', data: values }]
      } else if (this.groupBy === 'account') {
        this.chartSeries = this.computeGroupedByAccount(months)
      } else if (this.groupBy === 'owner') {
        this.chartSeries = this.computeGroupedByOwner(months)
      } else if (this.groupBy === 'asset') {
        this.chartSeries = this.computeGroupedByAsset(months)
      } else if (this.groupBy === 'assetClass') {
        this.chartSeries = this.computeGroupedByAssetClass(months)
      }
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

    formatMonth(monthStr) {
      const [year, month] = monthStr.split('-')
      const date = new Date(year, month - 1)
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    },

    getLatestHoldings(asOfDate) {
      const latestHoldings = {}
      for (const h of this.holdingsData) {
        if (h.holding_date <= asOfDate) {
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
    },

    computeNetWorthAsOf(asOfDate) {
      const holdings = this.getLatestHoldings(asOfDate)
      const prices = this.getLatestPrices(asOfDate)

      const quantityByAsset = {}
      for (const h of holdings) {
        quantityByAsset[h.asset_id] = (quantityByAsset[h.asset_id] || 0) + h.quantity
      }

      let total = 0
      for (const assetId in quantityByAsset) {
        total += quantityByAsset[assetId] * (prices[assetId] || 0)
      }
      return total
    },

    computeGroupedByAccount(months) {
      const accountMap = Object.fromEntries(this.accountsData.map(a => [a.id, a.name]))
      const accountIds = this.accountsData.map(a => a.id)

      return accountIds.map(accountId => {
        const data = months.map(month => {
          const monthEnd = this.getMonthEnd(month)
          const holdings = this.getLatestHoldings(monthEnd).filter(h => h.account_id === accountId)
          const prices = this.getLatestPrices(monthEnd)

          let total = 0
          for (const h of holdings) {
            total += h.quantity * (prices[h.asset_id] || 0)
          }
          return total
        })
        return { name: accountMap[accountId] || `Account ${accountId}`, data }
      }).filter(s => s.data.some(v => v !== 0))
    },

    computeGroupedByOwner(months) {
      // Map profile id -> name
      const profileMap = Object.fromEntries(this.profilesData.map(p => [p.id, p.name]))
      // Map account id -> owner id
      const accountOwnerMap = Object.fromEntries(this.accountsData.map(a => [a.id, a.created_by]))
      // Get unique owner ids
      const ownerIds = [...new Set(this.accountsData.map(a => a.created_by))]

      return ownerIds.map(ownerId => {
        // Get all account ids belonging to this owner
        const ownerAccountIds = this.accountsData
          .filter(a => a.created_by === ownerId)
          .map(a => a.id)

        const data = months.map(month => {
          const monthEnd = this.getMonthEnd(month)
          const holdings = this.getLatestHoldings(monthEnd).filter(h => ownerAccountIds.includes(h.account_id))
          const prices = this.getLatestPrices(monthEnd)

          let total = 0
          for (const h of holdings) {
            total += h.quantity * (prices[h.asset_id] || 0)
          }
          return total
        })
        return { name: profileMap[ownerId] || 'Unknown', data }
      }).filter(s => s.data.some(v => v !== 0))
    },

    computeGroupedByAsset(months) {
      const assetMap = Object.fromEntries(this.assetsData.map(a => [a.id, a.ticker || a.name]))
      const assetIds = this.assetsData.map(a => a.id)

      return assetIds.map(assetId => {
        const data = months.map(month => {
          const monthEnd = this.getMonthEnd(month)
          const holdings = this.getLatestHoldings(monthEnd).filter(h => h.asset_id === assetId)
          const prices = this.getLatestPrices(monthEnd)

          let total = 0
          for (const h of holdings) {
            total += h.quantity * (prices[h.asset_id] || 0)
          }
          return total
        })
        return { name: assetMap[assetId] || `Asset ${assetId}`, data }
      }).filter(s => s.data.some(v => v !== 0))
    },

    computeGroupedByAssetClass(months) {
      const classMap = Object.fromEntries(this.assetClassesData.map(c => [c.id, c.name]))
      const classIds = this.assetClassesData.map(c => c.id)

      // Build allocation lookup: asset_id -> [{class_id, percentage}, ...]
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

      return classIds.map(classId => {
        const data = months.map(month => {
          const monthEnd = this.getMonthEnd(month)
          const holdings = this.getLatestHoldings(monthEnd)
          const prices = this.getLatestPrices(monthEnd)

          let total = 0
          for (const h of holdings) {
            const assetValue = h.quantity * (prices[h.asset_id] || 0)
            const allocations = allocationsByAsset[h.asset_id] || []
            const classAlloc = allocations.find(a => a.classId === classId)
            if (classAlloc) {
              total += assetValue * classAlloc.percentage
            }
          }
          return total
        })
        return { name: classMap[classId] || `Class ${classId}`, data }
      }).filter(s => s.data.some(v => v !== 0))
    }
  }
}
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Net Worth</h2>
          <p class="mt-1 text-sm text-gray-600">
            Track your total net worth over time. Group by account, owner, asset, or asset class.
          </p>
        </div>
        <Menu as="div" class="relative">
          <MenuButton class="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
            Group by: {{ selectedGroupByLabel }}
            <ChevronDownIcon class="w-4 h-4 text-gray-500" />
          </MenuButton>
          <transition
            enter-active-class="transition duration-100 ease-out"
            enter-from-class="transform scale-95 opacity-0"
            enter-to-class="transform scale-100 opacity-100"
            leave-active-class="transition duration-75 ease-in"
            leave-from-class="transform scale-100 opacity-100"
            leave-to-class="transform scale-95 opacity-0"
          >
            <MenuItems class="absolute right-0 z-10 mt-1 w-40 origin-top-right bg-white border border-gray-200 rounded-md shadow-lg focus:outline-none">
              <div class="py-1">
                <MenuItem v-for="option in groupByOptions" :key="option.value" v-slot="{ active }">
                  <button
                    type="button"
                    :class="[
                      'flex items-center justify-between w-full px-3 py-2 text-sm text-left',
                      active ? 'bg-gray-100' : '',
                      groupBy === option.value ? 'text-blue-600 font-medium' : 'text-gray-700'
                    ]"
                    @click="groupBy = option.value"
                  >
                    {{ option.label }}
                    <CheckIcon v-if="groupBy === option.value" class="w-4 h-4" />
                  </button>
                </MenuItem>
              </div>
            </MenuItems>
          </transition>
        </Menu>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="text-gray-500">Loading...</div>

      <!-- Chart card -->
      <div v-else class="bg-white shadow rounded-lg overflow-hidden">
        <div class="bg-gray-600 px-6 py-3">
          <h3 class="text-xs font-medium text-gray-100 uppercase tracking-wider">Net Worth Over Time</h3>
        </div>
        <div class="p-6">
          <NetWorthBarChart :labels="monthLabels" :series="chartSeries" />
        </div>
      </div>
    </div>
  </AppLayout>
</template>
