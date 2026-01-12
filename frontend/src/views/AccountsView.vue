<script>
import AppLayout from '@/components/AppLayout.vue'
import AddAccountModal from '@/components/modals/AddAccountModal.vue'
import UploadStatementModal from '@/components/modals/UploadStatementModal.vue'
import UpdatePositionModal from '@/components/modals/UpdatePositionModal.vue'
import { supabase } from '@/lib/supabase'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

export default {
  name: 'AccountsView',
  components: {
    AppLayout,
    AddAccountModal,
    UploadStatementModal,
    UpdatePositionModal
  },
  data() {
    return {
      accounts: [],
      loading: true,
      error: null,

      // Modal state
      showAddAccountModal: false,
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

        // Merge metadata into accounts
        this.accounts = accountsData.map(account => ({
          ...account,
          latestStatementDate: latestStatementByAccount[account.id] || null
        }))

      } catch (err) {
        this.error = err.message
      } finally {
        this.loading = false
      }
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
            class="bg-white rounded-lg shadow p-4 flex flex-col"
          >
            <div class="flex-1">
              <h3 class="font-semibold text-gray-900">{{ account.name }}</h3>
              <p class="text-sm text-gray-500">{{ account.account_type }}</p>
              <p class="text-xs text-gray-400 mt-2">
                <span v-if="account.latestStatementDate">
                  Last updated {{ relativeDate(account.latestStatementDate) }}
                </span>
                <span v-else class="italic">No data yet</span>
              </p>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <button
                v-on:click="openUploadModal(account)"
                class="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Upload Statement
              </button>
              <button
                v-on:click="openUpdatePositionModal(account)"
                class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Update Shares
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
    </div>

    <!-- Modals -->
    <AddAccountModal
      v-if="showAddAccountModal"
      v-on:close="showAddAccountModal = false"
      v-on:created="onAccountCreated"
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
