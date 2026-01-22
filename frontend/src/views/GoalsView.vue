<script>
import AppLayout from '@/components/AppLayout.vue'
import AddAssetClassModal from '@/components/modals/AddAssetClassModal.vue'
import EditAssetClassModal from '@/components/modals/EditAssetClassModal.vue'
import GoalAllocationChart from '@/components/charts/GoalAllocationChart.vue'
import { VueDraggable } from 'vue-draggable-plus'
import { supabase } from '@/lib/supabase'
import { getColorClasses } from '@/lib/tagColors'
import { PencilIcon, TrashIcon } from '@heroicons/vue/24/solid'

export default {
  name: 'GoalsView',
  components: {
    AppLayout,
    AddAssetClassModal,
    EditAssetClassModal,
    GoalAllocationChart,
    VueDraggable,
    PencilIcon,
    TrashIcon
  },
  data() {
    return {
      assetClasses: [],
      assetCountByClass: {},
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
    },
    goalsAreValid() {
      return Math.abs(this.totalGoals - 1) < 0.001
    }
  },
  methods: {
    async loadData() {
      this.loading = true
      this.error = null
      try {
        const [classesResult, allocationsResult] = await Promise.all([
          supabase.from('asset_classes').select('*').order('sort_order'),
          supabase.from('asset_allocations').select('asset_id, asset_class_id')
        ])

        if (classesResult.error) throw classesResult.error
        if (allocationsResult.error) throw allocationsResult.error

        this.assetClasses = classesResult.data

        // Count unique assets per class
        const countByClass = {}
        for (const alloc of allocationsResult.data) {
          if (!countByClass[alloc.asset_class_id]) {
            countByClass[alloc.asset_class_id] = new Set()
          }
          countByClass[alloc.asset_class_id].add(alloc.asset_id)
        }
        // Convert Sets to counts
        this.assetCountByClass = {}
        for (const classId in countByClass) {
          this.assetCountByClass[classId] = countByClass[classId].size
        }

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

    getClassColor(colorName) {
      return getColorClasses(colorName)
    },

    async onReorder() {
      // Update sort_order for all items based on new array positions
      try {
        const updates = this.assetClasses.map((ac, index) => ({
          id: ac.id,
          sort_order: index
        }))

        for (const update of updates) {
          const { error } = await supabase
            .from('asset_classes')
            .update({ sort_order: update.sort_order })
            .eq('id', update.id)

          if (error) throw error
        }
      } catch (err) {
        this.error = err.message
        // Reload to restore correct order on error
        await this.loadData()
      }
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

      <!-- Main content area -->
      <div v-if="!loading && assetClasses.length > 0" class="flex gap-6">
        <!-- Asset classes table -->
        <div class="w-7/12 bg-white shadow rounded-lg overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="w-10"></th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Assets
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Goal
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <VueDraggable
            v-model="assetClasses"
            tag="tbody"
            handle=".drag-handle"
            v-on:end="onReorder"
            v-bind:animation="250"
            v-bind:easing="'cubic-bezier(0.25, 0.1, 0.25, 1)'"
            v-bind:force-fallback="true"
            fallback-class="drag-fallback-hidden"
            ghost-class="drag-ghost"
            chosen-class="drag-chosen"
            drag-class="drag-active"
            class="bg-white divide-y divide-gray-200"
          >
            <tr v-for="assetClass in assetClasses" v-bind:key="assetClass.id">
              <td class="drag-handle cursor-grab px-3 py-4 text-gray-400 hover:text-gray-600">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
                </svg>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  class="inline-block px-2 py-0.5 text-xs font-medium rounded"
                  v-bind:class="[getClassColor(assetClass.color).bg, getClassColor(assetClass.color).text]"
                >
                  {{ assetClass.name }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ assetCountByClass[assetClass.id] || 0 }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ assetClass.goal > 0 ? (assetClass.goal * 100) + '%' : '-' }}
              </td>
              <td class="px-6 py-2 whitespace-nowrap text-right">
                <div class="flex justify-end gap-1">
                  <button
                    v-on:click="openEditModal(assetClass)"
                    class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                    title="Edit"
                  >
                    <PencilIcon class="w-5 h-5" />
                  </button>
                  <button
                    v-on:click="deleteAssetClass(assetClass)"
                    class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                    title="Delete"
                  >
                    <TrashIcon class="w-5 h-5" />
                  </button>
                </div>
              </td>
            </tr>
          </VueDraggable>
          <tfoot v-if="hasAnyGoals" class="bg-gray-50">
            <tr>
              <td></td>
              <td class="px-6 py-3 text-sm font-medium text-gray-900">
                Total
              </td>
              <td></td>
              <td class="px-6 py-3 text-sm font-medium" v-bind:class="goalsAreValid ? 'text-green-600' : 'text-amber-600'">
                {{ Math.round(totalGoals * 100) }}%
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        </div>

        <!-- Right side panel -->
        <div class="w-5/12 bg-white shadow rounded-lg overflow-hidden self-start">
          <div class="bg-gray-50 px-6 py-3">
            <h3 class="text-xs font-medium text-gray-500 uppercase tracking-wider">Target Allocation</h3>
          </div>
          <div v-if="goalsAreValid" class="p-4 h-72">
            <GoalAllocationChart v-bind:asset-classes="assetClasses" />
          </div>
          <div v-else class="p-6 text-center text-gray-500">
            <p>Configure goals to total 100% to see allocation chart.</p>
          </div>
        </div>
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

<style>
/* Hide the fallback element that follows the cursor (must be global) */
.drag-fallback-hidden {
  display: none !important;
}
</style>

<style scoped>
/* Style for both chosen (on click) and ghost (placeholder) - keep consistent */
.drag-chosen,
.drag-ghost {
  background-color: #eff6ff;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
}

/* Active drag state */
.drag-active {
  cursor: grabbing;
}

/* Change cursor while dragging */
.drag-handle:active {
  cursor: grabbing;
}
</style>
