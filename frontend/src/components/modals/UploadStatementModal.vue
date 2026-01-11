<script>
import { supabase } from '@/lib/supabase'

export default {
  name: 'UploadStatementModal',
  props: {
    account: {
      type: Object,
      required: true
    }
  },
  emits: ['close', 'uploaded'],
  data() {
    return {
      // Step: 'upload' | 'preview' | 'saving'
      step: 'upload',

      // File state
      file: null,

      // Parsed data
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
        // 1. Create the statement record
        const { data: statement, error: statementError } = await supabase
          .from('user_statements')
          .insert({
            account_id: this.account.id,
            statement_date: this.statementDate
          })
          .select()
          .single()

        if (statementError) throw statementError

        // 2. Look up security IDs for all tickers
        const tickers = this.holdings.map(h => h.ticker)
        const { data: securities, error: secError } = await supabase
          .from('securities')
          .select('id, ticker')
          .in('ticker', tickers)

        if (secError) throw secError

        // Build ticker -> security_id map
        const tickerToId = {}
        for (const sec of securities) {
          tickerToId[sec.ticker] = sec.id
        }

        // Check for missing tickers
        const missingTickers = tickers.filter(t => !tickerToId[t])
        if (missingTickers.length > 0) {
          // Rollback: delete the statement we just created
          await supabase.from('user_statements').delete().eq('id', statement.id)
          throw new Error(`Unknown tickers: ${missingTickers.join(', ')}. Please add these to the securities table first.`)
        }

        // 3. Insert positions
        const positions = this.holdings.map(h => ({
          statement_id: statement.id,
          security_id: tickerToId[h.ticker],
          quantity: h.quantity
        }))

        const { error: posError } = await supabase
          .from('user_statement_positions')
          .insert(positions)

        if (posError) {
          // Rollback: delete the statement
          await supabase.from('user_statements').delete().eq('id', statement.id)
          throw posError
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
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900">
            Upload Statement - {{ account.name }}
          </h2>
          <button
            v-on:click="$emit('close')"
            class="text-gray-400 hover:text-gray-600"
          >
            &times;
          </button>
        </div>
      </div>

      <!-- Body -->
      <div class="px-6 py-4">
        <!-- Error display -->
        <div v-if="error" class="mb-4 p-3 bg-red-50 text-red-800 rounded-md">
          {{ error }}
        </div>

        <!-- Step 1: Upload -->
        <div v-if="step === 'upload'">
          <p class="text-sm text-gray-600 mb-4">
            Select a PDF statement to upload. It will be parsed using AI to extract holdings.
          </p>

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
            Review the parsed holdings below. Remove any incorrect entries, then confirm.
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
          <div class="border rounded-md overflow-hidden mb-4">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ticker</th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="(holding, index) in holdings" v-bind:key="index">
                  <td class="px-4 py-2 text-sm text-gray-900">{{ holding.ticker }}</td>
                  <td class="px-4 py-2 text-sm text-gray-900 text-right">{{ holding.quantity.toLocaleString() }}</td>
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
                  <td colspan="3" class="px-4 py-4 text-sm text-gray-500 text-center">
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
      </div>
    </div>
  </div>
</template>
