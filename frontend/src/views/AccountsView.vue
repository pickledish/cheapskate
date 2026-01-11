<script>
import AppLayout from '@/components/AppLayout.vue'
import UploadStatementModal from '@/components/modals/UploadStatementModal.vue'
import UpdateValueModal from '@/components/modals/UpdateValueModal.vue'
import UpdateSharesModal from '@/components/modals/UpdateSharesModal.vue'
import { supabase } from '@/lib/supabase'

export default {
  name: 'AccountsView',
  components: {
    AppLayout,
    UploadStatementModal,
    UpdateValueModal,
    UpdateSharesModal
  },
  data() {
    return {
      // Regular accounts
      accounts: [],
      newAccountName: '',
      newAccountType: 'brokerage',
      accountTypes: ['retirement', 'brokerage', 'hsa', 'other'],

      // Private assets
      privateAssets: [],
      newAssetName: '',
      newAssetIsLiquid: false,

      // Loading/error state
      loading: true,
      error: null,

      // Modal state
      showUploadModal: false,
      selectedAccount: null,
      showValueModal: false,
      showSharesModal: false,
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
        // Load accounts and private assets in parallel
        const [accountsResult, assetsResult] = await Promise.all([
          supabase.from('user_accounts').select('*').order('created_at'),
          supabase.from('user_private_securities').select('*').order('created_at')
        ])

        if (accountsResult.error) throw accountsResult.error
        if (assetsResult.error) throw assetsResult.error

        this.accounts = accountsResult.data
        this.privateAssets = assetsResult.data
      } catch (err) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },

    // Regular account methods
    async createAccount() {
      if (!this.newAccountName.trim()) return

      try {
        const { data: { user } } = await supabase.auth.getUser()
        const { error } = await supabase.from('user_accounts').insert({
          user_id: user.id,
          name: this.newAccountName.trim(),
          account_type: this.newAccountType
        })
        if (error) throw error

        this.newAccountName = ''
        await this.loadData()
      } catch (err) {
        this.error = err.message
      }
    },

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

    async onStatementUploaded() {
      this.closeUploadModal()
      await this.loadData()
    },

    // Private asset methods
    async createPrivateAsset() {
      if (!this.newAssetName.trim()) return

      try {
        const { data: { user } } = await supabase.auth.getUser()
        const { error } = await supabase.from('user_private_securities').insert({
          user_id: user.id,
          name: this.newAssetName.trim(),
          is_liquid: this.newAssetIsLiquid,
          allocation: {}
        })
        if (error) throw error

        this.newAssetName = ''
        this.newAssetIsLiquid = false
        await this.loadData()
      } catch (err) {
        this.error = err.message
      }
    },

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

    openValueModal(asset) {
      this.selectedAsset = asset
      this.showValueModal = true
    },

    closeValueModal() {
      this.showValueModal = false
      this.selectedAsset = null
    },

    openSharesModal(asset) {
      this.selectedAsset = asset
      this.showSharesModal = true
    },

    closeSharesModal() {
      this.showSharesModal = false
      this.selectedAsset = null
    },

    async onAssetUpdated() {
      this.closeValueModal()
      this.closeSharesModal()
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

      <!-- Regular Accounts Section -->
      <section v-if="!loading">
        <h2 class="text-xl font-bold text-gray-900 mb-4">Investment Accounts</h2>
        <p class="text-sm text-gray-600 mb-4">
          Brokerage accounts, 401(k)s, IRAs, HSAs, etc. Upload PDF statements to track holdings.
        </p>

        <!-- Account list -->
        <div class="bg-white rounded-lg shadow overflow-hidden mb-4">
          <ul class="divide-y divide-gray-200">
            <li v-for="account in accounts" v-bind:key="account.id" class="p-4 flex items-center justify-between">
              <div>
                <span class="font-medium text-gray-900">{{ account.name }}</span>
                <span class="ml-2 text-sm text-gray-500">({{ account.account_type }})</span>
              </div>
              <div class="flex space-x-2">
                <button
                  v-on:click="openUploadModal(account)"
                  class="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Upload Statement
                </button>
                <button
                  v-on:click="deleteAccount(account)"
                  class="px-3 py-1 text-sm text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </div>
            </li>
            <li v-if="accounts.length === 0" class="p-4 text-gray-500 text-center">
              No accounts yet. Add one below.
            </li>
          </ul>
        </div>

        <!-- Add account form -->
        <form v-on:submit.prevent="createAccount" class="flex space-x-2">
          <input
            v-model="newAccountName"
            type="text"
            placeholder="Account name (e.g., Fidelity 401k)"
            class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            v-model="newAccountType"
            class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option v-for="type in accountTypes" v-bind:key="type" v-bind:value="type">
              {{ type }}
            </option>
          </select>
          <button
            type="submit"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Add Account
          </button>
        </form>
      </section>

      <!-- Private Assets Section -->
      <section v-if="!loading">
        <h2 class="text-xl font-bold text-gray-900 mb-4">Private Assets</h2>
        <p class="text-sm text-gray-600 mb-4">
          Real estate, private equity, startups, etc. Manually track value and quantity.
        </p>

        <!-- Private assets list -->
        <div class="bg-white rounded-lg shadow overflow-hidden mb-4">
          <ul class="divide-y divide-gray-200">
            <li v-for="asset in privateAssets" v-bind:key="asset.id" class="p-4 flex items-center justify-between">
              <div>
                <span class="font-medium text-gray-900">{{ asset.name }}</span>
                <span v-if="asset.is_liquid" class="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                  Liquid
                </span>
                <span v-else class="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  Illiquid
                </span>
              </div>
              <div class="flex space-x-2">
                <button
                  v-on:click="openValueModal(asset)"
                  class="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Update Value
                </button>
                <button
                  v-on:click="openSharesModal(asset)"
                  class="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  Update Shares
                </button>
                <button
                  v-on:click="deletePrivateAsset(asset)"
                  class="px-3 py-1 text-sm text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </div>
            </li>
            <li v-if="privateAssets.length === 0" class="p-4 text-gray-500 text-center">
              No private assets yet. Add one below.
            </li>
          </ul>
        </div>

        <!-- Add private asset form -->
        <form v-on:submit.prevent="createPrivateAsset" class="flex space-x-2 items-center">
          <input
            v-model="newAssetName"
            type="text"
            placeholder="Asset name (e.g., Primary Residence)"
            class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <label class="flex items-center space-x-2 text-sm text-gray-700">
            <input
              v-model="newAssetIsLiquid"
              type="checkbox"
              class="rounded border-gray-300"
            />
            <span>Liquid</span>
          </label>
          <button
            type="submit"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Add Asset
          </button>
        </form>
      </section>
    </div>

    <!-- Modals -->
    <UploadStatementModal
      v-if="showUploadModal"
      v-bind:account="selectedAccount"
      v-on:close="closeUploadModal"
      v-on:uploaded="onStatementUploaded"
    />

    <UpdateValueModal
      v-if="showValueModal"
      v-bind:asset="selectedAsset"
      v-on:close="closeValueModal"
      v-on:updated="onAssetUpdated"
    />

    <UpdateSharesModal
      v-if="showSharesModal"
      v-bind:asset="selectedAsset"
      v-on:close="closeSharesModal"
      v-on:updated="onAssetUpdated"
    />
  </AppLayout>
</template>
