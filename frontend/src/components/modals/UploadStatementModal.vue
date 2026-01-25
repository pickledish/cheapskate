<script>
import BaseModal from './BaseModal.vue'
import { supabase } from '@/lib/supabase'

export default {
  name: 'UploadStatementModal',
  components: { BaseModal },
  props: {
    account: {
      type: Object,
      required: true
    },
    existingHoldings: {
      type: Array,
      default: () => []
    }
  },
  emits: ['close', 'uploaded'],
  data() {
    return {
      // Step: 'upload' | 'preview' | 'saving'
      step: 'upload',

      // File state
      file: null,

      // Parsed data (holdings now have: name, quantity, total_value, price?)
      holdings: [],
      statementDate: '',

      // Loading/error
      loading: false,
      error: null
    }
  },
  computed: {
    todayDate() {
      return new Date().toISOString().split('T')[0]
    },
    modalTitle() {
      return `Upload Statement - ${this.account.name}`
    }
  },
  methods: {
    onFileChange(event) {
      this.file = event.target.files[0]
      this.error = null
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

        // Get auth token
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          throw new Error('Not authenticated')
        }

        // Call parse-pdf edge function
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-pdf`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ pdf_base64: base64 })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `HTTP ${response.status}`)
        }

        const result = await response.json()

        this.holdings = result.holdings || []
        this.statementDate = result.statement_date || this.todayDate
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

      this.step = 'saving'
      this.loading = true
      this.error = null

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        // 1. Create the statement record
        const { data: statement, error: statementError } = await supabase
          .from('statements')
          .insert({
            account_id: this.account.id,
            statement_date: this.statementDate
          })
          .select()
          .single()

        if (statementError) throw statementError

        // 2. Process each holding
        for (const holding of this.holdings) {
          // Look up asset by ticker=name OR name=name
          let { data: asset } = await supabase
            .from('assets')
            .select('id')
            .or(`ticker.eq.${holding.name},name.eq.${holding.name}`)
            .single()

          // If not found, auto-create
          if (!asset) {
            const { data: newAsset, error: createError } = await supabase
              .from('assets')
              .insert({
                family_id: user.user_metadata.family_id,
                created_by: user.id,
                ticker: holding.name,
                name: holding.name
              })
              .select()
              .single()

            if (createError) {
              // Rollback: delete the statement
              await supabase.from('statements').delete().eq('id', statement.id)
              throw createError
            }
            asset = newAsset
          }

          // Compute price (null for sold positions)
          const price = this.computePrice(holding)

          // Insert/update price (skip for sold positions where price is null)
          if (price != null) {
            const { error: priceError } = await supabase
              .from('asset_prices')
              .upsert({
                asset_id: asset.id,
                price_date: this.statementDate,
                price: price,
                statement_id: statement.id,
                created_by: user.id
              }, {
                onConflict: 'asset_id,price_date'
              })

            if (priceError) {
              await supabase.from('statements').delete().eq('id', statement.id)
              throw priceError
            }
          }

          // Insert/update holding
          const { error: holdingError } = await supabase
            .from('asset_holdings')
            .upsert({
              asset_id: asset.id,
              account_id: this.account.id,
              holding_date: this.statementDate,
              quantity: holding.quantity,
              statement_id: statement.id,
              created_by: user.id
            }, {
              onConflict: 'asset_id,account_id,holding_date'
            })

          if (holdingError) {
            await supabase.from('statements').delete().eq('id', statement.id)
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

      <div class="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 class="text-sm font-medium text-blue-900 mb-2">Privacy Notice</h4>
        <p class="text-sm text-blue-800 mb-2">
          Cheapskate extracts and stores only ticker symbols and share quantities from your statement — no account numbers, addresses, or other personal information.
        </p>
        <p class="text-sm text-blue-800">
          Gemini is also configured in <a href="https://docs.cloud.google.com/vertex-ai/generative-ai/docs/vertex-ai-zero-data-retention" class="font-semibold underline hover:text-blue-900">zero-retention mode</a>, so your document is deleted from Google's servers as soon as the parsing is completed.
        </p>
      </div>

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
        <button
          v-on:click="parseFile"
          v-bind:disabled="!file || loading"
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {{ loading ? 'Parsing...' : 'Parse PDF' }}
        </button>
      </div>
    </div>

    <!-- Step 2: Preview -->
    <div v-if="step === 'preview'">
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

    <!-- Step 3: Saving -->
    <div v-if="step === 'saving'" class="text-center py-8">
      <p class="text-gray-600">Saving statement...</p>
    </div>
  </BaseModal>
</template>
