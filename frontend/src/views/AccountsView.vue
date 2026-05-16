<script>
import AppLayout from '@/components/AppLayout.vue'
import AddAccountModal from '@/components/modals/AddAccountModal.vue'
import UploadStatementModal from '@/components/modals/UploadStatementModal.vue'
import OnboardingModal from '@/components/modals/OnboardingModal.vue'
import OnboardingContinueCard from '@/components/OnboardingContinueCard.vue'
import { supabase } from '@/lib/supabase'
import {
  listAccounts,
  listUpdates,
  listHoldingUpdatesWithContext,
  listPriceUpdatesWithContext,
  listAssetsWithAllocations
} from '@/lib/data'
import { getColorClasses } from '@/lib/tagColors'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

export default {
  name: 'AccountsView',
  components: {
    AppLayout,
    AddAccountModal,
    UploadStatementModal,
    OnboardingModal,
    OnboardingContinueCard
  },
  data() {
    return {
      accounts: [],
      hasAnyStatements: false,
      loading: true,
      error: null,

      showAddAccountModal: false,
      showUploadStatementModal: false,

      // Onboarding state
      showOnboardingModal: false,
      accountsCompleted: false
    }
  },
  computed: {
    filteredAccounts() {
      return this.accounts.filter(account => !account.archived_at)
    },
    showContinueCard() {
      // Show continue card if: has at least 1 account, has at least 1 statement, and not yet completed
      return this.accounts.length > 0 && this.hasAnyStatements && !this.accountsCompleted
    }
  },
  async mounted() {
    // Check onboarding state
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      this.accountsCompleted = session.user.user_metadata?.accounts_completed ?? false
      // Show onboarding modal if accounts not yet completed
      this.showOnboardingModal = !this.accountsCompleted
    }
    await this.loadData()
  },
  methods: {
    async loadData() {
      this.loading = true
      this.error = null
      try {
        // Load all data in parallel
        const [accountsData, updatesData, holdingsData, pricesData, assetsData] = await Promise.all([
          listAccounts(),
          listUpdates(),
          listHoldingUpdatesWithContext('desc'),
          listPriceUpdatesWithContext('desc'),
          listAssetsWithAllocations()
        ])

        // Track if any updates exist (for onboarding continue card)
        this.hasAnyStatements = updatesData.length > 0

        // Build map of asset_id -> allocations (class info)
        const allocationsByAsset = {}
        for (const a of assetsData) {
          if (a.allocations.length > 0) {
            allocationsByAsset[a.id] = a.allocations.map(alloc => ({
              name: alloc.asset_classes.name,
              color: alloc.asset_classes.color,
              sort_order: alloc.asset_classes.sort_order,
              percentage: parseFloat(alloc.percentage)
            }))
          }
        }

        // Build map of account_id -> most recent effective_date
        const latestStatementByAccount = {}
        for (const update of updatesData) {
          if (update.account_id && !latestStatementByAccount[update.account_id]) {
            latestStatementByAccount[update.account_id] = update.effective_date
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
        // We use absolute values for accountValues to get total exposure (not net value),
        // so that the 10% threshold for showing asset class tags works correctly for
        // accounts with both long and short positions.
        const accountValues = {}
        const holdingsByAccount = {}
        for (const key in latestHoldingByAccountAsset) {
          const holding = latestHoldingByAccountAsset[key]
          const price = latestPriceByAsset[holding.asset_id] || 0
          const value = holding.quantity * price

          accountValues[holding.account_id] = (accountValues[holding.account_id] || 0) + Math.abs(value)

          if (holding.quantity !== 0) {
            if (!holdingsByAccount[holding.account_id]) {
              holdingsByAccount[holding.account_id] = []
            }
            holdingsByAccount[holding.account_id].push({
              asset_id: holding.asset_id,
              value: value
            })
          }
        }

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

          // Convert to array, filter out classes <10% of account exposure, sort by sort_order
          // Use Math.abs since class values can be negative (from short positions)
          const classes = Object.entries(classValues)
            .filter(([, data]) => totalValue > 0 && Math.abs(data.value) / totalValue >= 0.10)
            .map(([name, data]) => ({ name, color: data.color, sort_order: data.sort_order }))
            .sort((a, b) => a.sort_order - b.sort_order)

          // Add "Unclassified" tag if >= 10% of account exposure
          if (totalValue > 0 && Math.abs(unclassifiedValue) / totalValue >= 0.10) {
            classes.push({ name: 'Unclassified', color: 'gray', sort_order: 9999 })
          }

          assetClassesByAccount[accountId] = classes
        }

        // Merge metadata into accounts
        this.accounts = accountsData.map(account => ({
          ...account,
          latestStatementDate: latestStatementByAccount[account.id] || null,
          assetClasses: assetClassesByAccount[account.id] || []
        }))

      } catch (err) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },

    async onAccountCreated() {
      this.showAddAccountModal = false
      await this.loadData()
    },

    async onStatementUploaded() {
      this.showUploadStatementModal = false
      await this.loadData()
    },

    relativeDate(dateStr) {
      if (!dateStr) return null
      return dayjs(dateStr).fromNow()
    },

    getClassColor(colorName) {
      return getColorClasses(colorName)
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
          <h2 class="text-2xl font-bold text-gray-900">Accounts</h2>
          <p class="mt-1 text-sm text-gray-600">
            Create and manage accounts. Update holdings manually, or upload statements to be parsed automatically.
          </p>
        </div>
        <button
          v-on:click="showUploadStatementModal = true"
          class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          Upload Statement
        </button>
      </div>

      <!-- Error display -->
      <div v-if="error" class="p-4 bg-red-50 text-red-800 rounded-md">
        {{ error }}
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="text-gray-500">Loading...</div>

      <!-- Investment Accounts Section -->
      <section v-if="!loading" class="space-y-6">
        <!-- Card grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Account cards -->
          <router-link
            v-for="account in filteredAccounts"
            v-bind:key="account.id"
            v-bind:to="'/accounts/' + account.id"
            class="bg-white rounded-lg shadow p-4 flex flex-col hover:shadow-md transition-shadow"
          >
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
            <!-- Holdings as of date -->
            <p class="mt-3 text-xs text-gray-400">
              <span v-if="account.latestStatementDate">
                Data from {{ relativeDate(account.latestStatementDate) }}
              </span>
              <span v-else class="italic">No data yet</span>
            </p>
          </router-link>

          <!-- Add account card -->
          <button
            v-on:click="showAddAccountModal = true"
            class="bg-canvas border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors min-h-[100px]"
          >
            <span class="text-3xl mb-2">+</span>
            <span class="text-sm font-medium">Add Account</span>
          </button>
        </div>

        <!-- Onboarding continue card -->
        <OnboardingContinueCard
          v-if="showContinueCard"
          step="accounts"
          message="You've added an account and uploaded a statement. Now let's categorize your assets!"
          next-step-label="Continue to Assets"
          next-route="/assets"
        />
      </section>
    </div>

    <!-- Modals -->
    <AddAccountModal
      v-if="showAddAccountModal"
      v-on:close="showAddAccountModal = false"
      v-on:created="onAccountCreated"
    />

    <UploadStatementModal
      v-if="showUploadStatementModal"
      v-on:close="showUploadStatementModal = false"
      v-on:uploaded="onStatementUploaded"
    />

    <!-- Onboarding modal -->
    <OnboardingModal
      v-if="showOnboardingModal"
      title="Add Your Investment Accounts"
      v-bind:step-number="2"
      v-on:close="showOnboardingModal = false"
    >
      <div class="space-y-4 text-gray-600">
        <p>
          Now let's add your <strong>investment accounts</strong>.
        </p>
        <p>
          Create at least one account (for example "401k" or "Brokerage") and upload a statement
          to import your holdings.
        </p>
        <p>
          The statement will be automatically parsed to extract your assets and their current values.
        </p>
      </div>
    </OnboardingModal>
  </AppLayout>
</template>
