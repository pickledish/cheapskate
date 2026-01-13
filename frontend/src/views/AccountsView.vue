<script>
import AppLayout from '@/components/AppLayout.vue'
import AddAccountModal from '@/components/modals/AddAccountModal.vue'
import EditAccountModal from '@/components/modals/EditAccountModal.vue'
import UploadStatementModal from '@/components/modals/UploadStatementModal.vue'
import UpdatePositionModal from '@/components/modals/UpdatePositionModal.vue'
import { supabase } from '@/lib/supabase'
import { getTagColor } from '@/lib/tagColors'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { PencilIcon, TrashIcon } from '@heroicons/vue/24/solid'

dayjs.extend(relativeTime)

export default {
  name: 'AccountsView',
  components: {
    AppLayout,
    AddAccountModal,
    EditAccountModal,
    UploadStatementModal,
    UpdatePositionModal,
    PencilIcon,
    TrashIcon
  },
  data() {
    return {
      accounts: [],
      loading: true,
      error: null,

      // Modal state
      showAddAccountModal: false,
      showEditAccountModal: false,
      showUploadModal: false,
      showUpdatePositionModal: false,
      selectedAccount: null
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
        // Load accounts
        const { data: accountsData, error: accountsError } = await supabase
          .from('accounts')
          .select('*')
          .order('created_at')

        if (accountsError) throw accountsError

        // Load most recent statement date for each account
        const { data: statementsData, error: statementsError } = await supabase
          .from('statements')
          .select('account_id, statement_date')
          .order('statement_date', { ascending: false })

        if (statementsError) throw statementsError

        // Build map of account_id -> most recent statement_date
        const latestStatementByAccount = {}
        for (const stmt of statementsData) {
          if (!latestStatementByAccount[stmt.account_id]) {
            latestStatementByAccount[stmt.account_id] = stmt.statement_date
          }
        }

        // Load holdings with asset info to calculate account values
        const { data: holdingsData, error: holdingsError } = await supabase
          .from('asset_holdings')
          .select('account_id, asset_id, holding_date, quantity')
          .order('holding_date', { ascending: false })

        if (holdingsError) throw holdingsError

        // Load all asset prices
        const { data: pricesData, error: pricesError } = await supabase
          .from('asset_prices')
          .select('asset_id, price_date, price')
          .order('price_date', { ascending: false })

        if (pricesError) throw pricesError

        // Build map of asset_id -> latest price
        const latestPriceByAsset = {}
        for (const p of pricesData) {
          if (!latestPriceByAsset[p.asset_id]) {
            latestPriceByAsset[p.asset_id] = parseFloat(p.price)
          }
        }

        // Build map of (account_id, asset_id) -> latest quantity
        const latestHoldingByAccountAsset = {}
        for (const h of holdingsData) {
          const key = `${h.account_id}-${h.asset_id}`
          if (!latestHoldingByAccountAsset[key]) {
            latestHoldingByAccountAsset[key] = parseFloat(h.quantity)
          }
        }

        // Calculate total value per account
        const accountValues = {}
        for (const key in latestHoldingByAccountAsset) {
          const [accountId, assetId] = key.split('-')
          const quantity = latestHoldingByAccountAsset[key]
          const price = latestPriceByAsset[assetId] || 0
          const value = quantity * price
          accountValues[accountId] = (accountValues[accountId] || 0) + value
        }

        // Merge metadata into accounts
        this.accounts = accountsData.map(account => ({
          ...account,
          latestStatementDate: latestStatementByAccount[account.id] || null,
          totalValue: accountValues[account.id] || null
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

    getTagEntries(tags) {
      if (!tags || typeof tags !== 'object') return []
      return Object.entries(tags)
    },

    getTagColor(key) {
      return getTagColor(key)
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
    <div class="space-y-8">
      <!-- Error display -->
      <div v-if="error" class="p-4 bg-red-50 text-red-800 rounded-md">
        {{ error }}
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="text-gray-500">Loading...</div>

      <!-- Investment Accounts Section -->
      <section v-if="!loading">
        <h2 class="text-xl font-bold text-gray-900 mb-2">Investment Accounts</h2>
        <p class="text-sm text-gray-600 mb-4">
          Brokerage accounts, 401(k)s, IRAs, HSAs, etc. Upload PDF statements or manually update shares.
        </p>

        <!-- Card grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Account cards -->
          <div
            v-for="account in accounts"
            v-bind:key="account.id"
            class="bg-white rounded-lg shadow p-4 flex flex-col relative"
          >
            <!-- Edit and Delete buttons in upper right -->
            <div class="absolute top-4 right-4 flex gap-1">
              <button
                v-on:click="openEditAccountModal(account)"
                class="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                title="Edit account"
              >
                <PencilIcon class="w-4 h-4" />
              </button>
              <button
                v-on:click="deleteAccount(account)"
                class="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                title="Delete account"
              >
                <TrashIcon class="w-4 h-4" />
              </button>
            </div>

            <div class="flex-1 pr-6">
              <h3 class="font-semibold text-gray-900">{{ account.name }}</h3>
              <!-- Tags -->
              <div class="flex flex-wrap gap-1 mt-2">
                <span
                  v-for="[key, value] in getTagEntries(account.tags)"
                  v-bind:key="key"
                  class="inline-block px-2 py-0.5 text-xs font-medium rounded"
                  v-bind:class="[getTagColor(key).bg, getTagColor(key).text]"
                >
                  {{ value }}
                </span>
              </div>
              <!-- Value and last updated -->
              <div class="mt-4">
                <p v-if="account.totalValue != null" class="text-xs text-gray-400">
                  Value - {{ formatCurrency(account.totalValue) }}
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
                Statement Upload
              </button>
              <button
                v-on:click="openUpdatePositionModal(account)"
                class="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-blue-600 hover:text-white transition-colors"
              >
                Manual Update
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
      v-on:close="closeUploadModal"
      v-on:uploaded="onStatementUploaded"
    />

    <UpdatePositionModal
      v-if="showUpdatePositionModal"
      v-bind:account="selectedAccount"
      v-on:close="closeUpdatePositionModal"
      v-on:updated="onPositionUpdated"
    />
  </AppLayout>
</template>
