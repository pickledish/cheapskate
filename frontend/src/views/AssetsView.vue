<script>
import AppLayout from '@/components/AppLayout.vue'
import AddAssetModal from '@/components/modals/AddAssetModal.vue'
import EditAssetModal from '@/components/modals/EditAssetModal.vue'
import UpdatePriceModal from '@/components/modals/UpdatePriceModal.vue'
import { supabase } from '@/lib/supabase'
import { getColorClasses } from '@/lib/tagColors'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { Bars3Icon } from '@heroicons/vue/24/solid'
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue'

dayjs.extend(relativeTime)

export default {
  name: 'AssetsView',
  components: {
    AppLayout,
    AddAssetModal,
    EditAssetModal,
    UpdatePriceModal,
    Bars3Icon,
    Menu,
    MenuButton,
    MenuItems,
    MenuItem
  },
  data() {
    return {
      assets: [],
      assetClasses: [],
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
        // Load all data in parallel
        const [assetsResult, pricesResult, allocationsResult, classesResult] = await Promise.all([
          supabase.from('assets').select('*').order('name'),
          supabase.from('asset_prices').select('asset_id, price_date, price').order('price_date', { ascending: false }),
          supabase.from('asset_allocations').select('asset_id, asset_class_id, percentage, asset_classes(name, color, sort_order)'),
          supabase.from('asset_classes').select('id, name').order('name')
        ])

        if (assetsResult.error) throw assetsResult.error
        if (pricesResult.error) throw pricesResult.error
        if (allocationsResult.error) throw allocationsResult.error
        if (classesResult.error) throw classesResult.error

        const assetsData = assetsResult.data
        const pricesData = pricesResult.data
        const allocationsData = allocationsResult.data
        this.assetClasses = classesResult.data || []

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

        // Build map of asset_id -> [{ name, color }], sorted by sort_order (for display)
        // Also build map of asset_id -> [{asset_class_id, percentage}] (for editing)
        const classesByAsset = {}
        const allocationsByAsset = {}
        for (const a of allocationsData) {
          if (!classesByAsset[a.asset_id]) {
            classesByAsset[a.asset_id] = []
          }
          classesByAsset[a.asset_id].push({
            name: a.asset_classes.name,
            color: a.asset_classes.color,
            sort_order: a.asset_classes.sort_order
          })

          if (!allocationsByAsset[a.asset_id]) {
            allocationsByAsset[a.asset_id] = []
          }
          allocationsByAsset[a.asset_id].push({
            asset_class_id: a.asset_class_id,
            percentage: Math.round(a.percentage * 100)
          })
        }
        // Sort each asset's classes by sort_order and keep name + color
        for (const assetId in classesByAsset) {
          classesByAsset[assetId] = classesByAsset[assetId]
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(c => ({ name: c.name, color: c.color }))
        }

        // Merge metadata into assets
        this.assets = assetsData.map(asset => ({
          ...asset,
          latestPrice: latestPriceByAsset[asset.id]?.price || null,
          latestPriceDate: latestPriceByAsset[asset.id]?.date || null,
          assetClasses: classesByAsset[asset.id] || [],
          allocations: allocationsByAsset[asset.id] || []
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

    getClassColor(colorName) {
      return getColorClasses(colorName)
    },

    async deleteAsset(asset) {
      if (!confirm(`Delete "${asset.name}"? This will also delete all price history and holdings for this asset.`)) {
        return
      }

      try {
        const { error } = await supabase.from('assets').delete().eq('id', asset.id)
        if (error) throw error
        await this.loadData()
      } catch (err) {
        this.error = err.message
      }
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
          <h2 class="text-2xl font-bold text-gray-900">Assets</h2>
          <p class="mt-1 text-sm text-gray-600">
            All your securities and assets. Edit metadata or update prices here.
          </p>
        </div>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search assets..."
          class="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
        />
      </div>
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
                      v-for="ac in asset.assetClasses"
                      v-bind:key="ac.name"
                      class="inline-block px-2 py-0.5 text-xs font-medium rounded"
                      v-bind:class="[getClassColor(ac.color).bg, getClassColor(ac.color).text]"
                    >
                      {{ ac.name }}
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
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <Menu as="div" class="relative inline-block text-left">
                    <MenuButton class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded cursor-pointer">
                      <Bars3Icon class="w-5 h-5" />
                    </MenuButton>
                    <MenuItems class="absolute right-0 mt-1 w-36 bg-white rounded-md shadow-lg focus:outline-none z-10 py-1 flex flex-col">
                      <MenuItem v-slot="{ active }">
                        <button
                          v-bind:class="['w-full text-left px-4 py-2 text-sm cursor-pointer', active ? 'bg-gray-100 text-gray-900' : 'text-gray-700']"
                          v-on:click="openEditModal(asset)"
                        >
                          Edit
                        </button>
                      </MenuItem>
                      <MenuItem v-slot="{ active }">
                        <button
                          v-bind:class="['w-full text-left px-4 py-2 text-sm cursor-pointer', active ? 'bg-gray-100 text-gray-900' : 'text-gray-700']"
                          v-on:click="openUpdatePriceModal(asset)"
                        >
                          Update Price
                        </button>
                      </MenuItem>
                      <MenuItem v-slot="{ active }">
                        <button
                          v-bind:class="['w-full text-left px-4 py-2 text-sm cursor-pointer', active ? 'bg-red-50 text-red-600' : 'text-gray-700']"
                          v-on:click="deleteAsset(asset)"
                        >
                          Delete
                        </button>
                      </MenuItem>
                    </MenuItems>
                  </Menu>
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
      v-bind:asset-classes="assetClasses"
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
