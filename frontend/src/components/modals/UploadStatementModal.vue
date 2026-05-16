<script>
import BaseModal from './BaseModal.vue'
import { Disclosure, DisclosureButton, DisclosurePanel, Combobox, ComboboxInput, ComboboxButton, ComboboxOptions, ComboboxOption, Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue'
import { CheckIcon, ChevronUpDownIcon, ChevronUpIcon } from '@heroicons/vue/24/solid'
import { supabase } from '@/lib/supabase'
import {
  listAccounts,
  findAccountByLast4,
  insertAccount,
  updateAccount,
  insertUpdate,
  insertPriceUpdate,
  insertHoldingUpdate,
  deleteUpdate,
  findAssetByTickerOrName,
  insertAsset,
  listHoldingUpdatesByAccount,
  listAssets
} from '@/lib/data'

export default {
  name: 'UploadStatementModal',
  components: { BaseModal, Disclosure, DisclosureButton, DisclosurePanel, Combobox, ComboboxInput, ComboboxButton, ComboboxOptions, ComboboxOption, Menu, MenuButton, MenuItems, MenuItem, CheckIcon, ChevronUpDownIcon, ChevronUpIcon },
  emits: ['close', 'uploaded'],
  data() {
    return {
      // Step: 'upload' | 'match' | 'preview' | 'saving'
      step: 'upload',

      // File state
      file: null,
      parseMode: 'cloud', // 'cloud' | 'local'

      // Parsed data
      holdings: [],
      statementDate: '',
      parsedLast4: null,

      // Account matching
      matchedAccount: null,
      allAccounts: [],
      selectedAccount: null,
      accountQuery: '',
      createNewAccount: false,
      newAccountName: '',
      matchingAccountIds: [],

      // Existing holdings for sold-position detection
      existingHoldings: [],

      // Loading/error
      loading: false,
      error: null
    }
  },
  computed: {
    todayDate() {
      return new Date().toISOString().split('T')[0]
    },
    parseButtonText() {
      if (this.loading) return 'Parsing...'
      return this.parseMode === 'local' ? 'Parse with Local LLM' : 'Parse with Gemini'
    },
    modalTitle() {
      if (this.step === 'match') return 'Select Account'
      if (this.matchedAccount) return `Upload Statement - ${this.matchedAccount.name}`
      return 'Upload Statement'
    },
    filteredAccounts() {
      const query = this.accountQuery.toLowerCase().trim()
      if (!query) return this.allAccounts
      return this.allAccounts.filter(a =>
        a.name.toLowerCase().includes(query) ||
        (a.last4 && a.last4.includes(query))
      )
    },
    sortedAccounts() {
      const matching = this.filteredAccounts.filter(a => this.matchingAccountIds.includes(a.id))
      const others = this.filteredAccounts.filter(a => !this.matchingAccountIds.includes(a.id))
      return [...matching, ...others]
    },
    resolvedAccount() {
      return this.matchedAccount
    }
  },
  methods: {
    displayAccount(account) {
      if (!account) return ''
      return account.last4 ? `${account.name} (****${account.last4})` : account.name
    },

    onFileChange(event) {
      this.file = event.target.files[0]
      this.error = null
    },

    triggerParse() {
      if (this.parseMode === 'local') {
        this.parseFileWithLocalLlm()
      } else {
        this.parseFile()
      }
    },

    async parseFileWithLocalLlm() {
      // TODO: Wire up to local LLM endpoint
      await this.parseFile()
    },

    async parseFile() {
      if (!this.file) {
        this.error = 'Please select a file'
        return
      }

      this.loading = true
      this.error = null

      try {
        // Convert file to base64
        const base64 = await this.fileToBase64(this.file)

        // Call parse-pdf edge function
        const { data: result, error: invokeError } = await supabase.functions.invoke('parse-pdf', {
          body: { pdf_base64: base64 }
        })
        if (invokeError) throw invokeError

        this.holdings = result.holdings || []
        this.statementDate = result.statement_date || this.todayDate
        this.parsedLast4 = result.last4 || null

        // Try to auto-match by last4
        if (this.parsedLast4) {
          const matches = await findAccountByLast4(this.parsedLast4)
          this.matchingAccountIds = matches.map(a => a.id)

          if (matches.length === 1) {
            this.matchedAccount = matches[0]
            // Prefetch accounts so rejectAutoMatch() is instant if user clicks "Not the right account?"
            listAccounts().then(accts => this.allAccounts = accts)
            await this.onAccountResolved()
            return
          }

          if (matches.length > 1) {
            // Multiple matches - show account selection with matches highlighted
            this.allAccounts = await listAccounts()
            this.step = 'match'
            return
          }
        }

        // No match -- show account selection
        this.allAccounts = await listAccounts()
        this.step = 'match'

      } catch (err) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },

    async confirmAccountSelection() {
      this.error = null

      if (this.createNewAccount) {
        if (!this.newAccountName.trim()) {
          this.error = 'Please enter an account name'
          return
        }

        this.loading = true
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) throw new Error('Not authenticated')

          const newAccount = await insertAccount({
            family_id: user.user_metadata.family_id,
            created_by: user.id,
            name: this.newAccountName.trim(),
            rebalancing: true, // uhh just hardcode 'true' for now I guess
            last4: this.parsedLast4
          })
          this.matchedAccount = newAccount
          this.matchingAccountIds = []
          await this.onAccountResolved()
        } catch (err) {
          this.error = err.message
          this.loading = false
        }
        return
      }

      if (!this.selectedAccount) {
        this.error = 'Please select an account'
        return
      }

      this.loading = true
      try {
        this.matchedAccount = this.selectedAccount
        this.matchingAccountIds = []
        await this.onAccountResolved()
      } catch (err) {
        this.error = err.message
        this.loading = false
      }
    },

    async rejectAutoMatch() {
      this.matchedAccount = null
      this.selectedAccount = null
      // might've already been loaded in prefetch
      if (this.allAccounts.length === 0) {
        this.allAccounts = await listAccounts()
      }
      this.step = 'match'
    },

    async onAccountResolved() {
      try {
        // Fetch existing holdings for sold-position detection
        const [holdingsData, assetsData] = await Promise.all([
          listHoldingUpdatesByAccount(this.matchedAccount.id, 'desc'),
          listAssets()
        ])

        const assetMap = {}
        for (const a of assetsData) {
          assetMap[a.id] = { ticker: a.ticker, name: a.name }
        }

        // Get latest holding per asset
        const latestByAsset = {}
        for (const h of holdingsData) {
          if (!latestByAsset[h.asset_id]) {
            latestByAsset[h.asset_id] = h
          }
        }

        this.existingHoldings = Object.values(latestByAsset)
          .filter(h => parseFloat(h.quantity) > 0)
          .map(h => ({
            asset_id: h.asset_id,
            ticker: assetMap[h.asset_id]?.ticker || null,
            name: assetMap[h.asset_id]?.name || null
          }))

        this.addSoldPositions()
        this.step = 'preview'
      } catch (err) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },

    fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          // Remove data URL prefix (e.g., "data:application/pdf;base64,")
          const base64 = reader.result.split(',')[1]
          resolve(base64)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
    },

    removeHolding(index) {
      this.holdings.splice(index, 1)
    },

    addSoldPositions() {
      // Build set of parsed holding names (lowercase for case-insensitive matching)
      const parsedNames = new Set(
        this.holdings.map(h => h.name.toLowerCase())
      )

      // Check each existing holding to see if it's missing from the parsed results
      for (const existing of this.existingHoldings) {
        const tickerMatch = existing.ticker && parsedNames.has(existing.ticker.toLowerCase())
        const nameMatch = existing.name && parsedNames.has(existing.name.toLowerCase())

        if (!tickerMatch && !nameMatch) {
          // Asset not in statement - add as sold (quantity=0)
          this.holdings.push({
            name: existing.ticker || existing.name,
            quantity: 0,
            total_value: null,
            price: null
          })
        }
      }
    },

    computePrice(holding) {
      if (holding.price) return holding.price
      if (holding.quantity && holding.quantity !== 0) {
        return holding.total_value / holding.quantity
      }
      return holding.total_value // fallback for quantity=0 edge case
    },

    formatCurrency(value) {
      if (value === null || value === undefined) return '-'
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(value)
    },

    formatNumber(value) {
      if (value === null || value === undefined) return '-'
      return value.toLocaleString(undefined, { maximumFractionDigits: 4 })
    },

    async saveStatement() {
      if (this.holdings.length === 0) {
        this.error = 'No holdings to save'
        return
      }

      if (!this.statementDate) {
        this.error = 'Please enter a statement date'
        return
      }

      const account = this.resolvedAccount
      if (!account) {
        this.error = 'No account selected'
        return
      }

      this.step = 'saving'
      this.loading = true
      this.error = null

      let update = null

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        // Backfill last4 if the account doesn't have one yet
        if (this.parsedLast4 && !account.last4) {
          await updateAccount(account.id, { last4: this.parsedLast4 })
        }

        // 1. Create the update record
        update = await insertUpdate({
          family_id: user.user_metadata.family_id,
          account_id: account.id,
          update_type: 'statement',
          effective_date: this.statementDate,
          created_by: user.id
        })

        // 2. Process each holding
        for (const holding of this.holdings) {
          // Look up asset by ticker=name OR name=name
          let asset = await findAssetByTickerOrName(holding.name)

          // If not found, auto-create
          if (!asset) {
            try {
              asset = await insertAsset({
                family_id: user.user_metadata.family_id,
                created_by: user.id,
                ticker: holding.name,
                name: holding.name
              })
            } catch (createError) {
              // Rollback: delete the update
              await deleteUpdate(update.id)
              throw createError
            }
          }

          // Compute price (null for sold positions)
          const price = this.computePrice(holding)

          // Insert price (skip for sold positions where price is null)
          if (price != null) {
            try {
              await insertPriceUpdate({
                update_id: update.id,
                asset_id: asset.id,
                price: price
              })
            } catch (priceError) {
              await deleteUpdate(update.id)
              throw priceError
            }
          }

          // Insert holding
          try {
            await insertHoldingUpdate({
              update_id: update.id,
              asset_id: asset.id,
              quantity: holding.quantity
            })
          } catch (holdingError) {
            await deleteUpdate(update.id)
            throw holdingError
          }
        }

        // Success!
        this.$emit('uploaded')

      } catch (err) {
        this.error = err.message
        this.step = 'preview'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<template>
  <BaseModal v-bind:title="modalTitle" max-width="max-w-2xl" v-on:close="$emit('close')">
    <!-- Error display -->
    <div v-if="error" class="mb-4 p-3 bg-red-50 text-red-800 rounded-md text-sm">
      {{ error }}
    </div>

    <!-- Step 1: Upload -->
    <div v-if="step === 'upload'">
      <p class="text-sm text-gray-600 mb-4">
        Select a PDF statement to upload. It will be parsed using AI to extract holdings.
      </p>

      <Disclosure v-slot="{ open }" default-open as="div" class="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <DisclosureButton class="w-full flex items-center justify-between text-left">
          <h4 class="text-sm font-medium text-blue-900">Privacy Notice</h4>
          <svg
            class="w-4 h-4 text-blue-700 transition-transform duration-200"
            v-bind:class="{ '-rotate-90': !open }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </DisclosureButton>
        <div
          class="grid transition-all duration-200 ease-out"
          v-bind:class="open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'"
        >
          <DisclosurePanel static class="overflow-hidden">
            <div class="mt-2">
              <p class="text-sm text-blue-800 mb-2">
                Cheapskate extracts and stores only ticker symbols, share quantities, and account last-4 digits from your statement — no full account numbers, addresses, or other personal information.
              </p>
              <p class="text-sm text-blue-800">
                Gemini is also configured in <a href="https://docs.cloud.google.com/vertex-ai/generative-ai/docs/vertex-ai-zero-data-retention" class="font-semibold underline hover:text-blue-900">zero-retention mode</a>, so your document is deleted from Google's servers as soon as the parsing is completed.
              </p>
            </div>
          </DisclosurePanel>
        </div>
      </Disclosure>

      <input
        type="file"
        accept=".pdf"
        v-on:change="onFileChange"
        class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
      />

      <div class="mt-4 flex justify-end space-x-2">
        <button
          v-on:click="$emit('close')"
          class="px-4 py-2 text-gray-700 hover:text-gray-900"
        >
          Cancel
        </button>
        <div class="inline-flex rounded-md">
          <button
            v-on:click="triggerParse"
            v-bind:disabled="!file || loading"
            class="px-4 py-2 bg-blue-600 text-white rounded-l-md hover:bg-blue-700 disabled:opacity-50"
          >
            {{ parseButtonText }}
          </button>
          <Menu as="div" class="relative flex">
            <MenuButton
              v-bind:disabled="!file || loading"
              class="px-2 bg-blue-600 text-white border-l border-blue-500 rounded-r-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              <ChevronUpIcon class="w-4 h-4" />
            </MenuButton>
            <MenuItems class="absolute right-0 bottom-full mb-1 w-48 bg-white rounded-md shadow-lg z-50 py-1">
              <MenuItem v-slot="{ active }">
                <button
                  v-on:click="parseMode = 'cloud'"
                  v-bind:class="[
                    'w-full text-left px-4 py-2 text-sm',
                    active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                  ]"
                >
                  Parse with Gemini
                </button>
              </MenuItem>
              <MenuItem v-slot="{ active }">
                <button
                  v-on:click="parseMode = 'local'"
                  v-bind:class="[
                    'w-full text-left px-4 py-2 text-sm',
                    active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                  ]"
                >
                  Parse with Local LLM
                </button>
              </MenuItem>
            </MenuItems>
          </Menu>
        </div>
      </div>
    </div>

    <!-- Step 2: Account matching (only shown when no auto-match) -->
    <div v-if="step === 'match'">
      <p class="text-sm text-gray-600 mb-2">
        <template v-if="matchingAccountIds.length > 1">
          Multiple accounts match account number ending in <strong>{{ parsedLast4 }}</strong>.
        </template>
        <template v-else-if="parsedLast4">
          No account found matching account number ending in <strong>{{ parsedLast4 }}</strong>.
        </template>
        <template v-else>
          Could not detect an account number in the statement.
        </template>
      </p>
      <p class="text-sm text-gray-600 mb-4">
        <template v-if="matchingAccountIds.length > 1">
          Please select the correct one.
        </template>
        <template v-else>
          Please select an existing account or create a new one.
        </template>
      </p>

      <div class="space-y-4">
        <!-- Account combobox -->
        <div>
          <Combobox v-model="selectedAccount" as="div" class="relative" v-on:update:model-value="createNewAccount = false">
            <div class="relative">
              <ComboboxInput
                v-bind:display-value="displayAccount"
                v-on:change="accountQuery = $event.target.value"
                v-on:focus="$refs.comboboxButton.$el.click()"
                placeholder="Search accounts..."
                class="w-full px-3 py-2 pr-8 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <ComboboxButton ref="comboboxButton" class="absolute inset-y-0 right-0 flex items-center pr-2">
                <ChevronUpDownIcon class="w-4 h-4 text-gray-400" />
              </ComboboxButton>
            </div>
            <ComboboxOptions class="absolute z-10 mt-1 w-full max-h-60 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg focus:outline-none">
              <div v-if="sortedAccounts.length === 0" class="px-3 py-2 text-sm text-gray-500">
                No accounts found
              </div>
              <ComboboxOption
                v-for="acct in sortedAccounts"
                v-bind:key="acct.id"
                v-bind:value="acct"
                v-slot="{ active, selected }"
              >
                <div
                  v-bind:class="[
                    'flex items-center justify-between px-3 py-2 text-sm cursor-pointer',
                    active ? 'bg-gray-100' : '',
                    selected ? 'text-blue-600 font-medium' : 'text-gray-700'
                  ]"
                >
                  <span class="flex items-center gap-2">
                    {{ acct.last4 ? `${acct.name} (****${acct.last4})` : acct.name }}
                    <span
                      v-if="matchingAccountIds.includes(acct.id)"
                      class="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded"
                    >Matches</span>
                  </span>
                  <CheckIcon v-if="selected" class="w-4 h-4 flex-shrink-0" />
                </div>
              </ComboboxOption>
            </ComboboxOptions>
          </Combobox>
        </div>

        <!-- Create new account option -->
        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            v-model="createNewAccount"
            v-on:change="createNewAccount ? selectedAccount = null : null"
            class="rounded border-gray-300 text-blue-600 mt-0.5"
          />
          <div class="flex-1">
            <div class="text-sm font-medium text-gray-700">Create new account instead</div>
            <input
              v-if="createNewAccount"
              v-model="newAccountName"
              type="text"
              placeholder="Account name (e.g., Fidelity 401k)"
              class="mt-2 w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </label>
      </div>

      <div class="mt-4 flex justify-end space-x-2">
        <button
          v-on:click="step = 'upload'"
          class="px-4 py-2 text-gray-700 hover:text-gray-900"
        >
          Back
        </button>
        <button
          v-on:click="confirmAccountSelection"
          v-bind:disabled="loading || (!selectedAccount && !createNewAccount)"
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {{ loading ? 'Loading...' : 'Continue' }}
        </button>
      </div>
    </div>

    <!-- Step 3: Preview -->
    <div v-if="step === 'preview'">
      <p class="text-sm text-gray-600 mb-2">
        <template v-if="resolvedAccount">
          <template v-if="matchingAccountIds.length === 1">
            Auto-matched to <strong>{{ resolvedAccount.name }}</strong><template v-if="resolvedAccount.last4 || parsedLast4"> (****{{ resolvedAccount.last4 || parsedLast4 }})</template>.
            <button
              v-on:click="rejectAutoMatch"
              class="text-blue-600 hover:text-blue-800 underline"
            >Not the right account?</button>
          </template>
          <template v-else>
            Uploading to <strong>{{ resolvedAccount.name }}</strong><template v-if="resolvedAccount.last4 || parsedLast4"> (****{{ resolvedAccount.last4 || parsedLast4 }})</template>.
          </template>
        </template>
      </p>
      <p class="text-sm text-gray-600 mb-4">
        Review the parsed holdings below. New assets will be created automatically.
      </p>

      <!-- Statement date -->
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Statement Date
        </label>
        <input
          v-model="statementDate"
          type="date"
          class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <!-- Holdings table -->
      <div class="border rounded-md overflow-hidden mb-4 max-h-64 overflow-y-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50 sticky top-0">
            <tr>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
              <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
              <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
              <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase"></th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="(holding, index) in holdings" v-bind:key="index">
              <td class="px-4 py-2 text-sm text-gray-900">{{ holding.name }}</td>
              <td class="px-4 py-2 text-sm text-gray-900 text-right">{{ formatNumber(holding.quantity) }}</td>
              <td class="px-4 py-2 text-sm text-gray-900 text-right">{{ formatCurrency(holding.total_value) }}</td>
              <td class="px-4 py-2 text-sm text-gray-900 text-right">{{ formatCurrency(computePrice(holding)) }}</td>
              <td class="px-4 py-2 text-right">
                <button
                  v-on:click="removeHolding(index)"
                  class="text-red-600 hover:text-red-800 text-sm"
                >
                  Remove
                </button>
              </td>
            </tr>
            <tr v-if="holdings.length === 0">
              <td colspan="5" class="px-4 py-4 text-sm text-gray-500 text-center">
                No holdings found
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex justify-end space-x-2">
        <button
          v-on:click="step = 'upload'"
          class="px-4 py-2 text-gray-700 hover:text-gray-900"
        >
          Back
        </button>
        <button
          v-on:click="saveStatement"
          v-bind:disabled="holdings.length === 0"
          class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          Save Statement
        </button>
      </div>
    </div>

    <!-- Step 4: Saving -->
    <div v-if="step === 'saving'" class="text-center py-8">
      <p class="text-gray-600">Saving statement...</p>
    </div>
  </BaseModal>
</template>
