<script>
import AppLayout from '@/components/AppLayout.vue'
import AddAssetModal from '@/components/modals/AddAssetModal.vue'
import EditAssetModal from '@/components/modals/EditAssetModal.vue'
import UpdatePriceModal from '@/components/modals/UpdatePriceModal.vue'
import { supabase } from '@/lib/supabase'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

export default {
  name: 'AssetsView',
  components: {
    AppLayout,
    AddAssetModal,
    EditAssetModal,
    UpdatePriceModal
  },
  data() {
    return {
      assets: [],
      loading: true,
      error: null,

      // Modal state
      showAddAssetModal: false,
      showEditAssetModal: false,
      showUpdatePriceModal: false,
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
        // Load securities
        const { data: securitiesData, error: securitiesError } = await supabase
          .from('user_securities')
          .select('*')
          .order('name')

        if (securitiesError) throw securitiesError

        // Load most recent prices for each security
        const { data: pricesData, error: pricesError } = await supabase
          .from('user_security_prices')
          .select('security_id, price_date, price')
          .order('price_date', { ascending: false })

        if (pricesError) throw pricesError

        // Build map of security_id -> { price, date }
        const latestPriceByAsset = {}
        for (const p of pricesData) {
          if (!latestPriceByAsset[p.security_id]) {
            latestPriceByAsset[p.security_id] = {
              price: p.price,
              date: p.price_date
            }
          }
        }

        // Merge metadata into assets
        this.assets = securitiesData.map(asset => ({
          ...asset,
          latestPrice: latestPriceByAsset[asset.id]?.price || null,
          latestPriceDate: latestPriceByAsset[asset.id]?.date || null
        }))

      } catch (err) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },

    openEditModal(asset) {
      this.selectedAsset = asset
      this.showEditAssetModal = true
    },

    closeEditModal() {
      this.showEditAssetModal = false
      this.selectedAsset = null
    },

    openUpdatePriceModal(asset) {
      this.selectedAsset = asset
      this.showUpdatePriceModal = true
    },

    closeUpdatePriceModal() {
      this.showUpdatePriceModal = false
      this.selectedAsset = null
    },

    async onAssetCreated() {
      this.showAddAssetModal = false
      await this.loadData()
    },

    async onAssetUpdated() {
      this.closeEditModal()
      this.closeUpdatePriceModal()
      await this.loadData()
    },

    formatPrice(price) {
      if (price === null) return '-'
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(price)
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
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex justify-between items-center">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Assets</h1>
          <p class="text-sm text-gray-600">
            All your securities and assets. Edit metadata or update prices here.
          </p>
        </div>
        <button
          v-on:click="showAddAssetModal = true"
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Add Asset
        </button>
      </div>

      <!-- Error display -->
      <div v-if="error" class="p-4 bg-red-50 text-red-800 rounded-md">
        {{ error }}
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="text-gray-500">Loading...</div>

      <!-- Assets table -->
      <div v-if="!loading && assets.length > 0" class="bg-white shadow rounded-lg overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ticker
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Liquid
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Latest Price
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="asset in assets" v-bind:key="asset.id">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">{{ asset.name }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-500">{{ asset.ticker || '-' }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  v-if="asset.is_liquid"
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                >
                  Yes
                </span>
                <span v-else class="text-sm text-gray-400">No</span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">{{ formatPrice(asset.latestPrice) }}</div>
                <div v-if="asset.latestPriceDate" class="text-xs text-gray-400">
                  {{ relativeDate(asset.latestPriceDate) }}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                <button
                  v-on:click="openEditModal(asset)"
                  class="text-blue-600 hover:text-blue-900"
                >
                  Edit
                </button>
                <button
                  v-on:click="openUpdatePriceModal(asset)"
                  class="text-blue-600 hover:text-blue-900"
                >
                  Update Price
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Empty state -->
      <div v-if="!loading && assets.length === 0" class="text-center py-12 bg-white rounded-lg shadow">
        <p class="text-gray-500 mb-4">No assets yet. Add your first asset to get started.</p>
        <button
          v-on:click="showAddAssetModal = true"
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Add Asset
        </button>
      </div>
    </div>

    <!-- Modals -->
    <AddAssetModal
      v-if="showAddAssetModal"
      v-on:close="showAddAssetModal = false"
      v-on:created="onAssetCreated"
    />

    <EditAssetModal
      v-if="showEditAssetModal"
      v-bind:asset="selectedAsset"
      v-on:close="closeEditModal"
      v-on:updated="onAssetUpdated"
    />

    <UpdatePriceModal
      v-if="showUpdatePriceModal"
      v-bind:asset="selectedAsset"
      v-on:close="closeUpdatePriceModal"
      v-on:updated="onAssetUpdated"
    />
  </AppLayout>
</template>
