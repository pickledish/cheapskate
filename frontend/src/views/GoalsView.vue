<script>
import AppLayout from '@/components/AppLayout.vue'
import AddAssetClassModal from '@/components/modals/AddAssetClassModal.vue'
import EditAssetClassModal from '@/components/modals/EditAssetClassModal.vue'
import OnboardingModal from '@/components/modals/OnboardingModal.vue'
import OnboardingContinueCard from '@/components/OnboardingContinueCard.vue'
import GoalAllocationChart from '@/components/charts/GoalAllocationChart.vue'
import { VueDraggable } from 'vue-draggable-plus'
import { supabase } from '@/lib/supabase'
import { listAssetClasses, listAssetAllocations, updateSortOrder, deleteAssetClass } from '@/lib/data'
import { getColorClasses } from '@/lib/tagColors'
import { Bars3Icon } from '@heroicons/vue/24/solid'
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue'

export default {
  name: 'GoalsView',
  components: {
    AppLayout,
    AddAssetClassModal,
    EditAssetClassModal,
    OnboardingModal,
    OnboardingContinueCard,
    GoalAllocationChart,
    VueDraggable,
    Bars3Icon,
    Menu,
    MenuButton,
    MenuItems,
    MenuItem
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
      selectedAssetClass: null,

      // Onboarding state
      showOnboardingModal: false,
      goalsCompleted: false
    }
  },
  async mounted() {
    // Check onboarding state
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      this.goalsCompleted = session.user.user_metadata?.goals_completed ?? false
      // Show onboarding modal if goals not yet completed
      this.showOnboardingModal = !this.goalsCompleted
    }
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
    },
    showContinueCard() {
      return this.goalsAreValid && !this.goalsCompleted
    }
  },
  methods: {
    async loadData() {
      this.loading = true
      this.error = null
      try {
        const [classes, allocations] = await Promise.all([
          listAssetClasses(),
          listAssetAllocations()
        ])

        this.assetClasses = classes

        // Count unique assets per class
        const countByClass = {}
        for (const alloc of allocations) {
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

    async doDeleteAssetClass(assetClass) {
      if (!confirm(`Delete "${assetClass.name}"? This may affect assets using this class.`)) {
        return
      }

      try {
        await deleteAssetClass(assetClass.id)
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
        for (let index = 0; index < this.assetClasses.length; index++) {
          await updateSortOrder(this.assetClasses[index].id, index)
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
          <h2 class="text-2xl font-bold text-gray-900">Goals</h2>
          <p class="mt-1 text-sm text-gray-600">
            Create and manage asset classes. Define a "goal" portfolio allocation for the rebalancing view.
          </p>
        </div>
        <button
          v-on:click="showAddModal = true"
          class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
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
        <div class="w-7/12 bg-white shadow rounded-lg self-start">
        <table class="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th class="bg-gray-600 rounded-tl-lg w-10"></th>
              <th class="bg-gray-600 px-6 py-3 text-left text-xs font-medium text-gray-100 uppercase tracking-wider">
                Name
              </th>
              <th class="bg-gray-600 px-6 py-3 text-left text-xs font-medium text-gray-100 uppercase tracking-wider">
                Assets
              </th>
              <th class="bg-gray-600 px-6 py-3 text-left text-xs font-medium text-gray-100 uppercase tracking-wider">
                Goal
              </th>
              <th class="bg-gray-600 rounded-tr-lg px-6 py-3 text-right text-xs font-medium text-gray-100 uppercase tracking-wider">
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
            class="divide-y divide-gray-200"
          >
            <tr v-for="(assetClass, index) in assetClasses" v-bind:key="assetClass.id">
              <td
                class="drag-handle cursor-grab px-3 py-4 text-gray-400 hover:text-gray-600 bg-white"
                v-bind:class="{ 'rounded-bl-lg': index === assetClasses.length - 1 && !hasAnyGoals }"
              >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
                </svg>
              </td>
              <td class="px-6 py-4 whitespace-nowrap bg-white">
                <span
                  class="inline-block px-2 py-0.5 text-xs font-medium rounded"
                  v-bind:class="[getClassColor(assetClass.color).bg, getClassColor(assetClass.color).text]"
                >
                  {{ assetClass.name }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 bg-white">
                {{ assetCountByClass[assetClass.id] || 0 }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 bg-white">
                {{ assetClass.goal > 0 ? (assetClass.goal * 100) + '%' : '-' }}
              </td>
              <td
                class="px-6 py-2 whitespace-nowrap text-right bg-white"
                v-bind:class="{ 'rounded-br-lg': index === assetClasses.length - 1 && !hasAnyGoals }"
              >
                <Menu as="div" class="relative inline-block text-left">
                  <MenuButton class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded cursor-pointer">
                    <Bars3Icon class="w-5 h-5" />
                  </MenuButton>
                  <MenuItems class="absolute right-0 mt-1 w-32 bg-white rounded-md shadow-lg focus:outline-none z-50 py-1 flex flex-col">
                    <MenuItem v-slot="{ active }">
                      <button
                        v-bind:class="['w-full text-left px-4 py-2 text-sm cursor-pointer', active ? 'bg-gray-100 text-gray-900' : 'text-gray-700']"
                        v-on:click="openEditModal(assetClass)"
                      >
                        Edit
                      </button>
                    </MenuItem>
                    <MenuItem v-slot="{ active }">
                      <button
                        v-bind:class="['w-full text-left px-4 py-2 text-sm cursor-pointer', active ? 'bg-red-50 text-red-600' : 'text-gray-700']"
                        v-on:click="doDeleteAssetClass(assetClass)"
                      >
                        Delete
                      </button>
                    </MenuItem>
                  </MenuItems>
                </Menu>
              </td>
            </tr>
          </VueDraggable>
          <tfoot v-if="hasAnyGoals">
            <tr>
              <td class="bg-white rounded-bl-lg"></td>
              <td class="px-6 py-4 text-sm font-medium text-gray-900 bg-white">
                Total
              </td>
              <td class="bg-white"></td>
              <td class="px-6 py-4 text-sm font-medium bg-white" v-bind:class="goalsAreValid ? 'text-green-600' : 'text-amber-600'">
                {{ Math.round(totalGoals * 100) }}%
              </td>
              <td class="bg-white rounded-br-lg"></td>
            </tr>
          </tfoot>
        </table>
        </div>

        <!-- Right side panel -->
        <div class="w-5/12 bg-white shadow rounded-lg overflow-hidden self-start">
          <div class="bg-gray-600 px-6 py-3">
            <h3 class="text-xs font-medium text-gray-100 uppercase tracking-wider">Target Allocation</h3>
          </div>
          <div v-if="goalsAreValid" class="p-4 h-72">
            <GoalAllocationChart v-bind:asset-classes="assetClasses" />
          </div>
          <div v-else class="p-6 text-center text-gray-500">
            <p>Configure goals to total 100% to see allocation chart.</p>
          </div>
        </div>
      </div>

      <!-- Onboarding continue card -->
      <OnboardingContinueCard
        v-if="showContinueCard"
        step="goals"
        message="Your asset classes are set up with a complete allocation. Ready to add your investment accounts!"
        next-step-label="Continue to Accounts"
        next-route="/accounts"
      />

      <!-- Empty state -->
      <div v-if="!loading && assetClasses.length === 0" class="text-center py-12 bg-white rounded-lg shadow">
        <p class="text-gray-500 mb-4">No asset classes yet. Add your first to categorize your assets.</p>
        <button
          v-on:click="showAddModal = true"
          class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
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

    <!-- Onboarding modal -->
    <OnboardingModal
      v-if="showOnboardingModal"
      title="Set Your Investment Goals"
      v-bind:step-number="1"
      v-on:close="showOnboardingModal = false"
    >
      <div class="space-y-4 text-gray-600">
        <p>
          <strong>Welcome to Cheapskate!</strong>
        </p>
        <p>
          Let's set up your portfolio tracking in three simple steps.
        </p>
        <p>
          First, create some <strong>asset classes</strong> (like stocks, bonds, and cash), then set a <strong>goal percentage</strong> for each class, totaling to 100%.
        </p>
        <p>
          For example, a <a href="https://www.bogleheads.org/wiki/Three-fund_portfolio" class="text-blue-600 underline">Boglehead-style</a> composition might look like this:
        </p>
        <table class="mx-auto text-sm mt-5 mb-3">
          <tr class="border-b border-gray-200">
            <td class="py-1 pr-12">US Stocks</td>
            <td class="py-1 text-right font-bold">60%</td>
          </tr>
          <tr class="border-b border-gray-200">
            <td class="py-1 pr-12">International Stocks</td>
            <td class="py-1 text-right font-bold">20%</td>
          </tr>
          <tr>
            <td class="py-1 pr-12">Bonds</td>
            <td class="py-1 text-right font-bold">20%</td>
          </tr>
        </table>
      </div>
    </OnboardingModal>
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
