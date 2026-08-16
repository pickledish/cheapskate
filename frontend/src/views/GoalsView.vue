<script lang="ts">
import { defineComponent, type ComponentPublicInstance } from 'vue';
import AppLayout from '@/components/AppLayout.vue';
import PageHeader from '@/components/PageHeader.vue';
import AddAssetClassModal from '@/components/modals/AddAssetClassModal.vue';
import EditAssetClassModal from '@/components/modals/EditAssetClassModal.vue';
import OnboardingModal from '@/components/modals/OnboardingModal.vue';
import OnboardingContinueCard from '@/components/OnboardingContinueCard.vue';
import GoalAllocationChart from '@/components/charts/GoalAllocationChart.vue';
import { VueDraggable } from 'vue-draggable-plus';
import { supabase } from '@/lib/supabase';
import {
  listAssetClasses,
  listAssetAllocations,
  updateSortOrder,
  deleteAssetClass,
  type AssetClass,
} from '@/lib/data';
import { getColorClasses } from '@/lib/tagColors';
import { Bars3Icon } from '@heroicons/vue/24/solid';
import { Menu as HeadlessMenu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue';
import type { AssetId } from '@/lib/data/assets';
import { assetClassIdToString, type AssetClassId } from '@/lib/data/asset-classes';

export default defineComponent({
  name: 'GoalsView',
  components: {
    AppLayout,
    PageHeader,
    AddAssetClassModal,
    EditAssetClassModal,
    OnboardingModal,
    OnboardingContinueCard,
    GoalAllocationChart,
    VueDraggable,
    Bars3Icon,
    HeadlessMenu,
    MenuButton,
    MenuItems,
    MenuItem,
  },
  data(): {
    assetClasses: AssetClass[];
    assetCountByClass: Map<AssetClassId, number>;
    loading: boolean;
    error: string | null;
    showAddModal: boolean;
    showEditModal: boolean;
    selectedAssetClass: AssetClass | null;
    showOnboardingModal: boolean;
    goalsCompleted: boolean;
    menuAnchors: Record<number, HTMLElement>;
  } {
    return {
      assetClasses: [],
      assetCountByClass: new Map(),
      loading: true,
      error: null,

      // Modal state
      showAddModal: false,
      showEditModal: false,
      selectedAssetClass: null,

      // Onboarding state
      showOnboardingModal: false,
      goalsCompleted: false,
      menuAnchors: {},
    };
  },
  computed: {
    totalGoals(): number {
      return this.assetClasses.reduce((sum, ac) => sum + (ac.goal || 0), 0);
    },
    hasAnyGoals(): boolean {
      return this.assetClasses.some((ac) => ac.goal > 0);
    },
    goalsAreValid(): boolean {
      return Math.abs(this.totalGoals - 1) < 0.001;
    },
    showContinueCard(): boolean {
      return this.goalsAreValid && !this.goalsCompleted;
    },
  },
  async mounted() {
    // Check onboarding state
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      this.goalsCompleted = session.user.user_metadata?.goals_completed ?? false;
      // Show onboarding modal if goals not yet completed
      this.showOnboardingModal = !this.goalsCompleted;
    }
    await this.loadData();
  },
  methods: {
    async loadData() {
      this.loading = true;
      this.error = null;
      try {
        const [classes, allocations] = await Promise.all([
          listAssetClasses(),
          listAssetAllocations(),
        ]);

        this.assetClasses = classes;

        // Count unique assets per class
        const countByClass: Map<AssetClassId, Set<AssetId>> = new Map();
        for (const alloc of allocations) {
          let assets = countByClass.get(alloc.asset_class_id);
          if (!assets) {
            assets = new Set();
            countByClass.set(alloc.asset_class_id, assets);
          }
          assets.add(alloc.asset_id);
        }
        // Convert Sets to counts
        const assetCountByClass: Map<AssetClassId, number> = new Map();
        for (const [classId, assets] of countByClass) {
          assetCountByClass.set(classId, assets.size);
        }
        this.assetCountByClass = assetCountByClass;
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err);
      } finally {
        this.loading = false;
      }
    },

    openEditModal(assetClass: AssetClass) {
      this.selectedAssetClass = assetClass;
      this.showEditModal = true;
    },

    closeEditModal() {
      this.showEditModal = false;
      this.selectedAssetClass = null;
    },

    async doDeleteAssetClass(assetClass: AssetClass) {
      if (!confirm(`Delete "${assetClass.name}"? This may affect assets using this class.`)) {
        return;
      }

      try {
        await deleteAssetClass(assetClass.id);
        await this.loadData();
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err);
      }
    },

    async onCreated() {
      this.showAddModal = false;
      await this.loadData();
    },

    async onUpdated() {
      this.closeEditModal();
      await this.loadData();
    },

    getClassColor(colorName: string) {
      return getColorClasses(colorName);
    },

    assetClassIdToString,

    assetCount(classId: AssetClassId): number {
      return this.assetCountByClass.get(classId) || 0;
    },

    setMenuAnchor(index: number, el: Element | ComponentPublicInstance | null) {
      if (el instanceof HTMLElement) {
        this.menuAnchors[index] = el;
      } else {
        delete this.menuAnchors[index];
      }
    },

    menuDropdownStyle(index: number): Record<string, string> {
      const el = this.menuAnchors[index];
      if (!el) return {};
      const rect = el.getBoundingClientRect();
      return {
        top: `${rect.bottom + 4}px`,
        right: `${document.documentElement.clientWidth - rect.right}px`,
      };
    },

    async onReorder() {
      // Update sort_order for all items based on new array positions
      try {
        for (let index = 0; index < this.assetClasses.length; index++) {
          const assetClass = this.assetClasses[index];
          if (!assetClass) continue;
          await updateSortOrder(assetClass.id, index);
        }
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err);
        // Reload to restore correct order on error
        await this.loadData();
      }
    },
  },
});
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <PageHeader
        title="Goals"
        description='Create and manage asset classes. Define a "goal" allocation for your portfolio.'
      >
        <template v-slot:actions>
          <button
            class="shrink-0 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            v-on:click="showAddModal = true"
          >
            Add Asset Class
          </button>
        </template>
      </PageHeader>

      <!-- Error display -->
      <div v-if="error" class="p-4 bg-error text-error-text rounded-md">
        {{ error }}
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="text-muted-text">Loading...</div>

      <!-- Main content area -->
      <div
        v-if="!loading && assetClasses.length > 0"
        class="flex flex-col-reverse gap-6 md:flex-row"
      >
        <!-- Asset classes table -->
        <div class="w-full md:w-7/12 bg-page shadow rounded-lg self-start overflow-x-auto">
          <table class="min-w-full divide-y divide-surface-border bg-surface">
            <thead>
              <tr>
                <th class="bg-header rounded-tl-lg w-10"></th>
                <th
                  class="bg-header px-6 py-3 text-left text-xs font-medium text-header-text uppercase tracking-wider whitespace-nowrap"
                >
                  Name
                </th>
                <th
                  class="bg-header px-6 py-3 text-left text-xs font-medium text-header-text uppercase tracking-wider whitespace-nowrap"
                >
                  Assets
                </th>
                <th
                  class="bg-header px-6 py-3 text-left text-xs font-medium text-header-text uppercase tracking-wider whitespace-nowrap"
                >
                  Goal
                </th>
                <th
                  class="bg-header rounded-tr-lg px-6 py-3 text-right text-xs font-medium text-header-text uppercase tracking-wider whitespace-nowrap"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <VueDraggable
              v-model="assetClasses"
              tag="tbody"
              handle=".drag-handle"
              v-bind:animation="250"
              v-bind:easing="'cubic-bezier(0.25, 0.1, 0.25, 1)'"
              v-bind:force-fallback="true"
              fallback-class="drag-fallback-hidden"
              ghost-class="drag-ghost"
              chosen-class="drag-chosen"
              drag-class="drag-active"
              class="divide-y divide-surface-border"
              v-on:end="onReorder"
            >
              <tr
                v-for="(assetClass, index) in assetClasses"
                v-bind:key="assetClassIdToString(assetClass.id)"
              >
                <td
                  class="drag-handle cursor-grab px-3 py-4 text-placeholder-text hover:text-muted-text bg-surface"
                  v-bind:class="{
                    'rounded-bl-lg': index === assetClasses.length - 1 && !hasAnyGoals,
                  }"
                >
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"
                    />
                  </svg>
                </td>
                <td class="px-6 py-4 whitespace-nowrap bg-surface">
                  <span
                    class="inline-block px-2 py-0.5 text-xs font-medium rounded"
                    v-bind:class="[
                      getClassColor(assetClass.color).bg,
                      getClassColor(assetClass.color).text,
                    ]"
                  >
                    {{ assetClass.name }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-muted-text bg-surface">
                  {{ assetCount(assetClass.id) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-primary-text bg-surface">
                  {{ assetClass.goal > 0 ? assetClass.goal * 100 + '%' : '-' }}
                </td>
                <td
                  class="px-6 py-2 whitespace-nowrap text-right bg-surface"
                  v-bind:class="{
                    'rounded-br-lg': index === assetClasses.length - 1 && !hasAnyGoals,
                  }"
                >
                  <HeadlessMenu
                    v-slot:default="{ open }"
                    as="div"
                    class="relative inline-block text-left"
                  >
                    <div v-bind:ref="(el) => setMenuAnchor(index, el)" class="inline-block">
                      <MenuButton
                        class="w-8 h-8 flex items-center justify-center text-placeholder-text hover:text-muted-text hover:bg-surface-recessed-deep rounded cursor-pointer"
                      >
                        <Bars3Icon class="w-5 h-5" />
                      </MenuButton>
                    </div>
                    <!-- Portal out of the table: overflow-x-auto clips absolute menus -->
                    <Teleport to="body">
                      <MenuItems
                        v-bind:style="open ? menuDropdownStyle(index) : undefined"
                        class="fixed z-50 w-32 bg-surface border border-surface-border rounded-md shadow-lg focus:outline-none py-1 flex flex-col"
                      >
                        <MenuItem v-slot:default="{ active }">
                          <button
                            v-bind:class="[
                              'w-full text-left px-4 py-2 text-sm cursor-pointer',
                              active
                                ? 'bg-surface-recessed-deep text-primary-text'
                                : 'text-secondary-text',
                            ]"
                            v-on:click="openEditModal(assetClass)"
                          >
                            Edit
                          </button>
                        </MenuItem>
                        <MenuItem v-slot:default="{ active }">
                          <button
                            v-bind:class="[
                              'w-full text-left px-4 py-2 text-sm cursor-pointer',
                              active ? 'bg-error text-error-text' : 'text-secondary-text',
                            ]"
                            v-on:click="doDeleteAssetClass(assetClass)"
                          >
                            Delete
                          </button>
                        </MenuItem>
                      </MenuItems>
                    </Teleport>
                  </HeadlessMenu>
                </td>
              </tr>
            </VueDraggable>
            <tfoot v-if="hasAnyGoals">
              <tr>
                <td class="bg-surface rounded-bl-lg"></td>
                <td class="px-6 py-4 text-sm font-medium text-primary-text bg-surface">Total</td>
                <td class="bg-surface"></td>
                <td
                  class="px-6 py-4 text-sm font-medium bg-surface"
                  v-bind:class="goalsAreValid ? 'text-green-500' : 'text-amber-500'"
                >
                  {{ Math.round(totalGoals * 100) }}%
                </td>
                <td class="bg-surface rounded-br-lg"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Right side panel -->
        <div class="w-full md:w-5/12 bg-surface shadow rounded-lg overflow-hidden self-start">
          <div class="bg-header px-6 py-3">
            <h3 class="text-xs font-medium text-header-text uppercase tracking-wider">
              Target Allocation
            </h3>
          </div>
          <div v-if="goalsAreValid" class="p-4 h-72">
            <GoalAllocationChart v-bind:asset-classes="assetClasses" />
          </div>
          <div v-else class="p-6 text-center text-muted-text">
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
      <div
        v-if="!loading && assetClasses.length === 0"
        class="text-center py-12 bg-surface rounded-lg shadow"
      >
        <p class="text-muted-text mb-4">
          No asset classes yet. Add your first to categorize your assets.
        </p>
        <button
          class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          v-on:click="showAddModal = true"
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
      v-if="showEditModal && selectedAssetClass"
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
      <div class="space-y-4 text-muted-text">
        <p>
          <strong>Welcome to Cheapskate!</strong>
        </p>
        <p>Let's set up your portfolio tracking in three simple steps.</p>
        <p>
          First, create some <strong>asset classes</strong> (like stocks, bonds, and cash), then set
          a <strong>goal percentage</strong> for each class, totaling to 100%.
        </p>
        <!-- prettier-ignore -->
        <p>
          For example, a <a href="https://www.bogleheads.org/wiki/Three-fund_portfolio" class="text-blue-600 underline">Boglehead-style</a> composition might look like this:
        </p>
        <table class="mx-auto text-sm mt-5 mb-3">
          <tbody>
            <tr class="border-b border-surface-border">
              <td class="py-1 pr-12">US Stocks</td>
              <td class="py-1 text-right font-bold">60%</td>
            </tr>
            <tr class="border-b border-surface-border">
              <td class="py-1 pr-12">International Stocks</td>
              <td class="py-1 text-right font-bold">20%</td>
            </tr>
            <tr>
              <td class="py-1 pr-12">Bonds</td>
              <td class="py-1 text-right font-bold">20%</td>
            </tr>
          </tbody>
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
  background-color: var(--color-info);
  box-shadow:
    0 4px 6px -1px rgb(0 0 0 / 0.1),
    0 2px 4px -2px rgb(0 0 0 / 0.1);
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
