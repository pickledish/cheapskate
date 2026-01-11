<script>
import AppLayout from '@/components/AppLayout.vue'
import AddAccountModal from '@/components/modals/AddAccountModal.vue'
import AddPrivateAssetModal from '@/components/modals/AddPrivateAssetModal.vue'
import UploadStatementModal from '@/components/modals/UploadStatementModal.vue'
import UpdatePrivateAssetModal from '@/components/modals/UpdatePrivateAssetModal.vue'
import { supabase } from '@/lib/supabase'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

export default {
  name: 'AccountsView',
  components: {
    AppLayout,
    AddAccountModal,
    AddPrivateAssetModal,
    UploadStatementModal,
    UpdatePrivateAssetModal
  },
  data() {
    return {
      // Data with metadata
      accounts: [],
      privateAssets: [],

      // Loading/error state
      loading: true,
      error: null,

      // Modal state
      showAddAccountModal: false,
      showAddAssetModal: false,
      showUploadModal: false,
      selectedAccount: null,
      showUpdateAssetModal: false,
      selectedAsset: null
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
          .from('user_accounts')
          .select('*')
          .order('created_at')

        if (accountsError) throw accountsError

        // Load most recent statement date for each account
        const { data: statementsData, error: statementsError } = await supabase
          .from('user_statements')
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

        // Merge metadata into accounts
        this.accounts = accountsData.map(account => ({
          ...account,
          latestStatementDate: latestStatementByAccount[account.id] || null
        }))

        // Load private assets
        const { data: assetsData, error: assetsError } = await supabase
          .from('user_private_securities')
          .select('*')
          .order('created_at')

        if (assetsError) throw assetsError

        // Load most recent prices for private assets
        const { data: pricesData, error: pricesError } = await supabase
          .from('user_private_prices')
          .select('security_id, price_date')
          .order('price_date', { ascending: false })

        if (pricesError) throw pricesError

        // Load most recent positions for private assets
        const { data: positionsData, error: positionsError } = await supabase
          .from('user_private_positions')
          .select('security_id, position_date')
          .order('position_date', { ascending: false })

        if (positionsError) throw positionsError

        // Build maps
        const latestPriceByAsset = {}
        for (const price of pricesData) {
          if (!latestPriceByAsset[price.security_id]) {
            latestPriceByAsset[price.security_id] = price.price_date
          }
        }

        const latestPositionByAsset = {}
        for (const pos of positionsData) {
          if (!latestPositionByAsset[pos.security_id]) {
            latestPositionByAsset[pos.security_id] = pos.position_date
          }
        }

        // Merge metadata into private assets
        this.privateAssets = assetsData.map(asset => ({
          ...asset,
          latestPriceDate: latestPriceByAsset[asset.id] || null,
          latestPositionDate: latestPositionByAsset[asset.id] || null
        }))

      } catch (err) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },

    // Account methods
    async deleteAccount(account) {
      if (!confirm(`Delete "${account.name}"? This will also delete all statements for this account.`)) {
        return
      }

      try {
        const { error } = await supabase.from('user_accounts').delete().eq('id', account.id)
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

    async onAccountCreated() {
      this.showAddAccountModal = false
      await this.loadData()
    },

    async onStatementUploaded() {
      this.closeUploadModal()
      await this.loadData()
    },

    // Private asset methods
    async deletePrivateAsset(asset) {
      if (!confirm(`Delete "${asset.name}"? This will also delete all price and position history.`)) {
        return
      }

      try {
        const { error } = await supabase.from('user_private_securities').delete().eq('id', asset.id)
        if (error) throw error
        await this.loadData()
      } catch (err) {
        this.error = err.message
      }
    },

    openUpdateAssetModal(asset) {
      this.selectedAsset = asset
      this.showUpdateAssetModal = true
    },

    closeUpdateAssetModal() {
      this.showUpdateAssetModal = false
      this.selectedAsset = null
    },

    async onAssetCreated() {
      this.showAddAssetModal = false
      await this.loadData()
    },

    async onAssetUpdated() {
      this.closeUpdateAssetModal()
      await this.loadData()
    },

    relativeDate(dateStr) {
      if (!dateStr) return null
      return dayjs(dateStr).fromNow()
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
          Brokerage accounts, 401(k)s, IRAs, HSAs, etc. Upload PDF statements to track holdings.
        </p>

        <!-- Card grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Account cards -->
          <div
            v-for="account in accounts"
            v-bind:key="account.id"
            class="bg-white rounded-lg shadow p-4 flex flex-col"
          >
            <div class="flex-1">
              <h3 class="font-semibold text-gray-900">{{ account.name }}</h3>
              <p class="text-sm text-gray-500">{{ account.account_type }}</p>
              <p class="text-xs text-gray-400 mt-2">
                <span v-if="account.latestStatementDate">
                  Shares updated {{ relativeDate(account.latestStatementDate) }}
                </span>
                <span v-else class="italic">No statements yet</span>
              </p>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <button
                v-on:click="openUploadModal(account)"
                class="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Update
              </button>
              <button
                v-on:click="deleteAccount(account)"
                class="px-3 py-1 text-sm text-red-600 hover:text-red-800"
              >
                Delete
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

      <!-- Private Assets Section -->
      <section v-if="!loading">
        <h2 class="text-xl font-bold text-gray-900 mb-2">Private Assets</h2>
        <p class="text-sm text-gray-600 mb-4">
          Real estate, private equity, startups, etc. Manually track value and quantity.
        </p>

        <!-- Card grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Asset cards -->
          <div
            v-for="asset in privateAssets"
            v-bind:key="asset.id"
            class="bg-white rounded-lg shadow p-4 flex flex-col"
          >
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <h3 class="font-semibold text-gray-900">{{ asset.name }}</h3>
                <span
                  v-if="asset.is_liquid"
                  class="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded"
                >
                  Liquid
                </span>
              </div>
              <div class="text-xs text-gray-400 mt-2 space-y-1">
                <p>
                  <span v-if="asset.latestPriceDate">
                    Price updated {{ relativeDate(asset.latestPriceDate) }}
                  </span>
                  <span v-else class="italic">No price set</span>
                </p>
                <p>
                  <span v-if="asset.latestPositionDate">
                    Shares updated {{ relativeDate(asset.latestPositionDate) }}
                  </span>
                  <span v-else class="italic">No shares set</span>
                </p>
              </div>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <button
                v-on:click="openUpdateAssetModal(asset)"
                class="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Update
              </button>
              <button
                v-on:click="deletePrivateAsset(asset)"
                class="px-3 py-1 text-sm text-red-600 hover:text-red-800"
              >
                Delete
              </button>
            </div>
          </div>

          <!-- Add asset card -->
          <button
            v-on:click="showAddAssetModal = true"
            class="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors min-h-[140px]"
          >
            <span class="text-3xl mb-2">+</span>
            <span class="text-sm font-medium">Add Asset</span>
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

    <AddPrivateAssetModal
      v-if="showAddAssetModal"
      v-on:close="showAddAssetModal = false"
      v-on:created="onAssetCreated"
    />

    <UploadStatementModal
      v-if="showUploadModal"
      v-bind:account="selectedAccount"
      v-on:close="closeUploadModal"
      v-on:uploaded="onStatementUploaded"
    />

    <UpdatePrivateAssetModal
      v-if="showUpdateAssetModal"
      v-bind:asset="selectedAsset"
      v-on:close="closeUpdateAssetModal"
      v-on:updated="onAssetUpdated"
    />
  </AppLayout>
</template>
