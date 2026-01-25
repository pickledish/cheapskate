<script>
import AppLayout from '@/components/AppLayout.vue'
import AddAccountModal from '@/components/modals/AddAccountModal.vue'
import EditAccountModal from '@/components/modals/EditAccountModal.vue'
import UploadStatementModal from '@/components/modals/UploadStatementModal.vue'
import UpdatePositionModal from '@/components/modals/UpdatePositionModal.vue'
import { supabase } from '@/lib/supabase'
import { getColorClasses } from '@/lib/tagColors'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { Bars3Icon } from '@heroicons/vue/24/solid'
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue'

dayjs.extend(relativeTime)

export default {
  name: 'AccountsView',
  components: {
    AppLayout,
    AddAccountModal,
    EditAccountModal,
    UploadStatementModal,
    UpdatePositionModal,
    Bars3Icon,
    Menu,
    MenuButton,
    MenuItems,
    MenuItem
  },
  data() {
    return {
      accounts: [],
      assets: [],
      holdingsByAccount: {},
      hasAnyStatements: false,
      loading: true,
      error: null,
      searchQuery: '',

      // Modal state
      showAddAccountModal: false,
      showEditAccountModal: false,
      showUploadModal: false,
      showUpdatePositionModal: false,
      selectedAccount: null
    }
  },
  computed: {
    filteredAccounts() {
      const query = this.searchQuery.toLowerCase().trim()
      if (!query) return this.accounts

      return this.accounts.filter(account => {
        // Search in name
        return account.name.toLowerCase().includes(query)
      })
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
        const [accountsResult, statementsResult, holdingsResult, pricesResult, assetsResult, allocationsResult] = await Promise.all([
          supabase.from('accounts').select('*').order('created_at'),
          supabase.from('statements').select('account_id, statement_date').order('statement_date', { ascending: false }),
          supabase.from('asset_holdings').select('account_id, asset_id, holding_date, quantity').order('holding_date', { ascending: false }),
          supabase.from('asset_prices').select('asset_id, price_date, price').order('price_date', { ascending: false }),
          supabase.from('assets').select('id, ticker, name'),
          supabase.from('asset_allocations').select('asset_id, asset_class_id, percentage, asset_classes(name, color, sort_order)')
        ])

        if (accountsResult.error) throw accountsResult.error
        if (statementsResult.error) throw statementsResult.error
        if (holdingsResult.error) throw holdingsResult.error
        if (pricesResult.error) throw pricesResult.error
        if (assetsResult.error) throw assetsResult.error
        if (allocationsResult.error) throw allocationsResult.error

        const accountsData = accountsResult.data
        const statementsData = statementsResult.data
        const holdingsData = holdingsResult.data
        const pricesData = pricesResult.data
        const assetsData = assetsResult.data
        const allocationsData = allocationsResult.data

        // Store assets list for modal usage
        this.assets = assetsData

        // Track if any statements exist (for privacy notice default state)
        this.hasAnyStatements = statementsData.length > 0

        // Build map of asset_id -> asset info
        const assetMap = {}
        for (const a of assetsData) {
          assetMap[a.id] = { ticker: a.ticker, name: a.name }
        }

        // Build map of asset_id -> allocations (class info)
        const allocationsByAsset = {}
        for (const a of allocationsData) {
          if (!allocationsByAsset[a.asset_id]) {
            allocationsByAsset[a.asset_id] = []
          }
          allocationsByAsset[a.asset_id].push({
            name: a.asset_classes.name,
            color: a.asset_classes.color,
            sort_order: a.asset_classes.sort_order,
            percentage: parseFloat(a.percentage)
          })
        }

        // Build map of account_id -> most recent statement_date
        const latestStatementByAccount = {}
        for (const stmt of statementsData) {
          if (!latestStatementByAccount[stmt.account_id]) {
            latestStatementByAccount[stmt.account_id] = stmt.statement_date
          }
        }

        // Build map of asset_id -> latest price
        const latestPriceByAsset = {}
        for (const p of pricesData) {
          if (!latestPriceByAsset[p.asset_id]) {
            latestPriceByAsset[p.asset_id] = parseFloat(p.price)
          }
        }

        // Build map of (account_id, asset_id) -> latest holding info
        const latestHoldingByAccountAsset = {}
        for (const h of holdingsData) {
          const key = `${h.account_id}-${h.asset_id}`
          if (!latestHoldingByAccountAsset[key]) {
            latestHoldingByAccountAsset[key] = {
              asset_id: h.asset_id,
              account_id: h.account_id,
              quantity: parseFloat(h.quantity)
            }
          }
        }

        // Calculate total value per account and build holdingsByAccount
        const accountValues = {}
        const holdingsByAccount = {}
        for (const key in latestHoldingByAccountAsset) {
          const holding = latestHoldingByAccountAsset[key]
          const asset = assetMap[holding.asset_id] || {}
          const price = latestPriceByAsset[holding.asset_id] || 0
          const value = holding.quantity * price

          accountValues[holding.account_id] = (accountValues[holding.account_id] || 0) + value

          // Add to holdingsByAccount (only if quantity > 0)
          if (holding.quantity > 0) {
            if (!holdingsByAccount[holding.account_id]) {
              holdingsByAccount[holding.account_id] = []
            }
            holdingsByAccount[holding.account_id].push({
              asset_id: holding.asset_id,
              ticker: asset.ticker,
              name: asset.name,
              quantity: holding.quantity,
              value: value
            })
          }
        }
        this.holdingsByAccount = holdingsByAccount

        // Calculate asset classes per account
        const assetClassesByAccount = {}
        for (const accountId in holdingsByAccount) {
          const holdings = holdingsByAccount[accountId]
          const totalValue = accountValues[accountId] || 0

          // Aggregate value by class, track unclassified value
          const classValues = {}
          let unclassifiedValue = 0
          for (const h of holdings) {
            const allocations = allocationsByAsset[h.asset_id] || []
            if (allocations.length === 0) {
              // Asset has no allocations - fully unclassified
              unclassifiedValue += h.value
            } else {
              for (const alloc of allocations) {
                const classValue = h.value * alloc.percentage
                if (!classValues[alloc.name]) {
                  classValues[alloc.name] = { value: 0, color: alloc.color, sort_order: alloc.sort_order }
                }
                classValues[alloc.name].value += classValue
              }
            }
          }

          // Convert to array, filter out classes <10% of account value, sort by sort_order
          const classes = Object.entries(classValues)
            .filter(([name, data]) => totalValue > 0 && data.value / totalValue >= 0.10)
            .map(([name, data]) => ({ name, color: data.color, sort_order: data.sort_order }))
            .sort((a, b) => a.sort_order - b.sort_order)

          // Add "Unclassified" tag if >= 10% of account value
          if (totalValue > 0 && unclassifiedValue / totalValue >= 0.10) {
            classes.push({ name: 'Unclassified', color: 'gray', sort_order: 9999 })
          }

          assetClassesByAccount[accountId] = classes
        }

        // Merge metadata into accounts
        this.accounts = accountsData.map(account => ({
          ...account,
          latestStatementDate: latestStatementByAccount[account.id] || null,
          totalValue: accountValues[account.id] || null,
          assetClasses: assetClassesByAccount[account.id] || []
        }))

      } catch (err) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },

    formatCurrency(value) {
      if (value == null) return null
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value)
    },

    async deleteAccount(account) {
      if (!confirm(`Delete "${account.name}"? This will also delete all statements for this account.`)) {
        return
      }

      try {
        const { error } = await supabase.from('accounts').delete().eq('id', account.id)
        if (error) throw error
        await this.loadData()
      } catch (err) {
        this.error = err.message
      }
    },

    openUploadModal(account) {
      this.selectedAccount = account
      this.showUploadModal = true
    },

    closeUploadModal() {
      this.showUploadModal = false
      this.selectedAccount = null
    },

    openUpdatePositionModal(account) {
      this.selectedAccount = account
      this.showUpdatePositionModal = true
    },

    closeUpdatePositionModal() {
      this.showUpdatePositionModal = false
      this.selectedAccount = null
    },

    async onAccountCreated() {
      this.showAddAccountModal = false
      await this.loadData()
    },

    async onStatementUploaded() {
      this.closeUploadModal()
      await this.loadData()
    },

    async onPositionUpdated() {
      this.closeUpdatePositionModal()
      await this.loadData()
    },

    relativeDate(dateStr) {
      if (!dateStr) return null
      return dayjs(dateStr).fromNow()
    },

    getClassColor(colorName) {
      return getColorClasses(colorName)
    },

    openEditAccountModal(account) {
      this.selectedAccount = account
      this.showEditAccountModal = true
    },

    closeEditAccountModal() {
      this.showEditAccountModal = false
      this.selectedAccount = null
    },

    async onAccountUpdated() {
      this.closeEditAccountModal()
      await this.loadData()
    }
  }
}
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Error display -->
      <div v-if="error" class="p-4 bg-red-50 text-red-800 rounded-md">
        {{ error }}
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="text-gray-500">Loading...</div>

      <!-- Investment Accounts Section -->
      <section v-if="!loading" class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">Investment Accounts</h2>
            <p class="mt-1 text-sm text-gray-600">
              Brokerage accounts, 401(k)s, IRAs, HSAs, etc. Upload PDF statements or manually update shares.
            </p>
          </div>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search accounts..."
            class="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
          />
        </div>
        <!-- Card grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Account cards -->
          <div
            v-for="account in filteredAccounts"
            v-bind:key="account.id"
            class="bg-white rounded-lg shadow p-4 flex flex-col relative"
          >
            <!-- Menu in upper right -->
            <Menu as="div" class="absolute top-3 right-3">
              <MenuButton class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded cursor-pointer">
                <Bars3Icon class="w-5 h-5" />
              </MenuButton>
              <MenuItems class="absolute right-0 mt-1 w-32 bg-white rounded-md shadow-lg focus:outline-none z-10 py-1">
                <MenuItem v-slot="{ active }">
                  <button
                    v-bind:class="['w-full text-left px-4 py-2 text-sm cursor-pointer', active ? 'bg-gray-100 text-gray-900' : 'text-gray-700']"
                    v-on:click="openEditAccountModal(account)"
                  >
                    Edit
                  </button>
                </MenuItem>
                <MenuItem v-slot="{ active }">
                  <button
                    v-bind:class="['w-full text-left px-4 py-2 text-sm cursor-pointer', active ? 'bg-red-50 text-red-600' : 'text-gray-700']"
                    v-on:click="deleteAccount(account)"
                  >
                    Delete
                  </button>
                </MenuItem>
              </MenuItems>
            </Menu>

            <div class="flex-1 pr-6">
              <h3 class="font-semibold text-gray-900">{{ account.name }}</h3>
              <!-- Asset class tags -->
              <div v-if="account.assetClasses.length" class="flex flex-wrap gap-1 mt-3">
                <span
                  v-for="ac in account.assetClasses"
                  v-bind:key="ac.name"
                  class="inline-block px-2 py-0.5 text-xs font-medium rounded"
                  v-bind:class="[getClassColor(ac.color).bg, getClassColor(ac.color).text]"
                >
                  {{ ac.name }}
                </span>
              </div>
              <!-- Value and last updated -->
              <div class="mt-3">
                <p v-if="account.totalValue != null" class="text-xs text-gray-400">
                  Total value - {{ formatCurrency(account.totalValue) }}
                </p>
                <p class="text-xs text-gray-400">
                  <span v-if="account.latestStatementDate">
                    Last updated - {{ relativeDate(account.latestStatementDate) }}
                  </span>
                  <span v-else class="italic">No data yet</span>
                </p>
              </div>
            </div>
            <!-- Action buttons - full width, both grey -->
            <div class="mt-4 grid grid-cols-2 gap-2">
              <button
                v-on:click="openUploadModal(account)"
                class="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-blue-600 hover:text-white transition-colors"
              >
                Upload Statement
              </button>
              <button
                v-on:click="openUpdatePositionModal(account)"
                class="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-blue-600 hover:text-white transition-colors"
              >
                Update Holdings
              </button>
            </div>
          </div>

          <!-- Add account card -->
          <button
            v-on:click="showAddAccountModal = true"
            class="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors min-h-[140px]"
          >
            <span class="text-3xl mb-2">+</span>
            <span class="text-sm font-medium">Add Account</span>
          </button>
        </div>
      </section>
    </div>

    <!-- Modals -->
    <AddAccountModal
      v-if="showAddAccountModal"
      v-on:close="showAddAccountModal = false"
      v-on:created="onAccountCreated"
    />

    <EditAccountModal
      v-if="showEditAccountModal"
      v-bind:account="selectedAccount"
      v-on:close="closeEditAccountModal"
      v-on:updated="onAccountUpdated"
    />

    <UploadStatementModal
      v-if="showUploadModal"
      v-bind:account="selectedAccount"
      v-bind:existing-holdings="holdingsByAccount[selectedAccount?.id] || []"
      v-bind:has-existing-statements="hasAnyStatements"
      v-on:close="closeUploadModal"
      v-on:uploaded="onStatementUploaded"
    />

    <UpdatePositionModal
      v-if="showUpdatePositionModal"
      v-bind:account="selectedAccount"
      v-bind:assets="assets"
      v-on:close="closeUpdatePositionModal"
      v-on:updated="onPositionUpdated"
    />
  </AppLayout>
</template>
