<script>
import AppLayout from '@/components/AppLayout.vue'
import AddAssetClassModal from '@/components/modals/AddAssetClassModal.vue'
import EditAssetClassModal from '@/components/modals/EditAssetClassModal.vue'
import { supabase } from '@/lib/supabase'
import { getTagColor } from '@/lib/tagColors'

export default {
  name: 'AssetClassesView',
  components: {
    AppLayout,
    AddAssetClassModal,
    EditAssetClassModal
  },
  data() {
    return {
      assetClasses: [],
      loading: true,
      error: null,

      // Modal state
      showAddModal: false,
      showEditModal: false,
      selectedAssetClass: null
    }
  },
  async mounted() {
    await this.loadData()
  },
  computed: {
    totalGoals() {
      return this.assetClasses.reduce((sum, ac) => sum + (ac.goal || 0), 0)
    },
    hasAnyGoals() {
      return this.assetClasses.some(ac => ac.goal > 0)
    }
  },
  methods: {
    async loadData() {
      this.loading = true
      this.error = null
      try {
        const { data, error } = await supabase
          .from('asset_classes')
          .select('*')
          .order('name')

        if (error) throw error

        this.assetClasses = data

      } catch (err) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },

    openEditModal(assetClass) {
      this.selectedAssetClass = assetClass
      this.showEditModal = true
    },

    closeEditModal() {
      this.showEditModal = false
      this.selectedAssetClass = null
    },

    async deleteAssetClass(assetClass) {
      if (!confirm(`Delete "${assetClass.name}"? This may affect assets using this class.`)) {
        return
      }

      try {
        const { error } = await supabase.from('asset_classes').delete().eq('id', assetClass.id)
        if (error) throw error
        await this.loadData()
      } catch (err) {
        this.error = err.message
      }
    },

    async onCreated() {
      this.showAddModal = false
      await this.loadData()
    },

    async onUpdated() {
      this.closeEditModal()
      await this.loadData()
    },

    getClassColor(name) {
      return getTagColor(name)
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
          <h1 class="text-2xl font-bold text-gray-900">Asset Classes</h1>
          <p class="text-sm text-gray-600">
            Define asset classes for portfolio allocation tracking (e.g., stocks, bonds, cash).
          </p>
        </div>
        <button
          v-on:click="showAddModal = true"
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Add Asset Class
        </button>
      </div>

      <!-- Error display -->
      <div v-if="error" class="p-4 bg-red-50 text-red-800 rounded-md">
        {{ error }}
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="text-gray-500">Loading...</div>

      <!-- Asset classes table -->
      <div v-if="!loading && assetClasses.length > 0" class="bg-white shadow rounded-lg overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Goal
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="assetClass in assetClasses" v-bind:key="assetClass.id">
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  class="inline-block px-2 py-0.5 text-xs font-medium rounded"
                  v-bind:class="[getClassColor(assetClass.name).bg, getClassColor(assetClass.name).text]"
                >
                  {{ assetClass.name }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ assetClass.goal > 0 ? (assetClass.goal * 100) + '%' : '-' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                <button
                  v-on:click="openEditModal(assetClass)"
                  class="text-blue-600 hover:text-blue-900"
                >
                  Edit
                </button>
                <button
                  v-on:click="deleteAssetClass(assetClass)"
                  class="text-red-600 hover:text-red-900"
                >
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
          <tfoot v-if="hasAnyGoals" class="bg-gray-50">
            <tr>
              <td class="px-6 py-3 text-sm font-medium text-gray-900">
                Total
              </td>
              <td class="px-6 py-3 text-sm font-medium" v-bind:class="Math.abs(totalGoals - 1) < 0.001 ? 'text-green-600' : 'text-amber-600'">
                {{ totalGoals * 100 }}%
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Empty state -->
      <div v-if="!loading && assetClasses.length === 0" class="text-center py-12 bg-white rounded-lg shadow">
        <p class="text-gray-500 mb-4">No asset classes yet. Add your first to categorize your assets.</p>
        <button
          v-on:click="showAddModal = true"
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Add Asset Class
        </button>
      </div>
    </div>

    <!-- Modals -->
    <AddAssetClassModal
      v-if="showAddModal"
      v-on:close="showAddModal = false"
      v-on:created="onCreated"
    />

    <EditAssetClassModal
      v-if="showEditModal"
      v-bind:asset-class="selectedAssetClass"
      v-on:close="closeEditModal"
      v-on:updated="onUpdated"
    />
  </AppLayout>
</template>
