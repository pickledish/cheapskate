<script>
import AppLayout from '@/components/AppLayout.vue'
import AddAssetModal from '@/components/modals/AddAssetModal.vue'
import EditAssetModal from '@/components/modals/EditAssetModal.vue'
import UpdatePriceModal from '@/components/modals/UpdatePriceModal.vue'
import { supabase } from '@/lib/supabase'
import { getTagColor } from '@/lib/tagColors'
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
      searchQuery: '',

      // Modal state
      showAddAssetModal: false,
      showEditAssetModal: false,
      showUpdatePriceModal: false,
      selectedAsset: null
    }
  },
  computed: {
    filteredAssets() {
      const query = this.searchQuery.toLowerCase().trim()
      if (!query) return this.assets

      return this.assets.filter(asset => {
        // Search in name
        if (asset.name.toLowerCase().includes(query)) return true

        // Search in ticker
        if (asset.ticker && asset.ticker.toLowerCase().includes(query)) return true

        return false
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
        // Load assets
        const { data: assetsData, error: assetsError } = await supabase
          .from('assets')
          .select('*')
          .order('name')

        if (assetsError) throw assetsError

        // Load most recent prices for each asset
        const { data: pricesData, error: pricesError } = await supabase
          .from('asset_prices')
          .select('asset_id, price_date, price')
          .order('price_date', { ascending: false })

        if (pricesError) throw pricesError

        // Load asset allocations with class names
        const { data: allocationsData, error: allocationsError } = await supabase
          .from('asset_allocations')
          .select('asset_id, asset_classes(name)')

        if (allocationsError) throw allocationsError

        // Build map of asset_id -> { price, date }
        const latestPriceByAsset = {}
        for (const p of pricesData) {
          if (!latestPriceByAsset[p.asset_id]) {
            latestPriceByAsset[p.asset_id] = {
              price: p.price,
              date: p.price_date
            }
          }
        }

        // Build map of asset_id -> [class names]
        const classesByAsset = {}
        for (const a of allocationsData) {
          if (!classesByAsset[a.asset_id]) {
            classesByAsset[a.asset_id] = []
          }
          classesByAsset[a.asset_id].push(a.asset_classes.name)
        }

        // Merge metadata into assets
        this.assets = assetsData.map(asset => ({
          ...asset,
          latestPrice: latestPriceByAsset[asset.id]?.price || null,
          latestPriceDate: latestPriceByAsset[asset.id]?.date || null,
          assetClasses: classesByAsset[asset.id] || []
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
    },

    getClassColor(className) {
      return getTagColor(className)
    }
  }
}
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-0.5">
        <h2 class="text-2xl font-bold text-gray-900">Assets</h2>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search assets..."
          class="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
        />
      </div>
      <p class="text-sm text-gray-600 mb-4">
        All your securities and assets. Edit metadata or update prices here.
      </p>

      <!-- Error display -->
      <div v-if="error" class="p-4 bg-red-50 text-red-800 rounded-md">
        {{ error }}
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="text-gray-500">Loading...</div>

      <!-- Assets table -->
      <div v-if="!loading">
        <div v-if="assets.length > 0" class="bg-white shadow rounded-lg overflow-hidden">
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
                  Asset Class
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
              <tr v-for="asset in filteredAssets" v-bind:key="asset.id">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm font-medium text-gray-900">{{ asset.name }}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-500">{{ asset.ticker || '-' }}</div>
                </td>
                <td class="px-6 py-4">
                  <div v-if="asset.assetClasses.length" class="flex flex-wrap gap-1">
                    <span
                      v-for="className in asset.assetClasses"
                      v-bind:key="className"
                      class="inline-block px-2 py-0.5 text-xs font-medium rounded"
                      v-bind:class="[getClassColor(className).bg, getClassColor(className).text]"
                    >
                      {{ className }}
                    </span>
                  </div>
                  <span v-else class="text-sm text-gray-400">-</span>
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

        <!-- Add asset button -->
        <button
          v-on:click="showAddAssetModal = true"
          class="mt-4 w-full bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4 flex items-center justify-center text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          <span class="text-xl mr-2">+</span>
          <span class="text-sm font-medium">Add Asset</span>
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
