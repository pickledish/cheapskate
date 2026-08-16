<script lang="ts">
import { defineComponent, type ComponentPublicInstance } from 'vue';
import AppLayout from '@/components/AppLayout.vue';
import PageHeader from '@/components/PageHeader.vue';
import AddAssetModal from '@/components/modals/AddAssetModal.vue';
import EditAssetModal from '@/components/modals/EditAssetModal.vue';
import UpdatePriceModal from '@/components/modals/UpdatePriceModal.vue';
import OnboardingModal from '@/components/modals/OnboardingModal.vue';
import OnboardingContinueCard from '@/components/OnboardingContinueCard.vue';
import { supabase } from '@/lib/supabase';
import {
  listAssetsWithAllocations,
  listPriceUpdatesWithContext,
  listAssetClasses,
  deleteAsset,
  type AssetWithAllocations,
  type AssetClass,
  type PriceUpdateWithContext,
} from '@/lib/data';
import { getLatestPrices } from '@/lib/derived/derived';
import { getColorClasses } from '@/lib/tagColors';
import { formatCurrency } from '@/lib/util/currency';
import { relativeDate } from '@/lib/util/date';
import { Bars3Icon } from '@heroicons/vue/24/solid';
import { Menu as HeadlessMenu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue';
import { assetIdToString, type AssetId } from '@/lib/data/assets';
import { assetClassIdToString } from '@/lib/data/asset-classes';

export default defineComponent({
  name: 'AssetsView',
  components: {
    AppLayout,
    PageHeader,
    AddAssetModal,
    EditAssetModal,
    UpdatePriceModal,
    OnboardingModal,
    OnboardingContinueCard,
    Bars3Icon,
    HeadlessMenu,
    MenuButton,
    MenuItems,
    MenuItem,
  },
  data(): {
    assets: AssetWithAllocations[];
    assetClasses: AssetClass[];
    latestPrices: Map<AssetId, PriceUpdateWithContext>;
    loading: boolean;
    error: string | null;
    searchQuery: string;
    menuAnchors: Record<number, HTMLElement>;
    showAddAssetModal: boolean;
    showEditAssetModal: boolean;
    showUpdatePriceModal: boolean;
    selectedAsset: AssetWithAllocations | null;
    showOnboardingModal: boolean;
    assetsCompleted: boolean;
  } {
    return {
      assets: [],
      assetClasses: [],
      latestPrices: new Map(),
      loading: true,
      error: null,
      searchQuery: '',
      menuAnchors: {},

      // Modal state
      showAddAssetModal: false,
      showEditAssetModal: false,
      showUpdatePriceModal: false,
      selectedAsset: null,

      // Onboarding state
      showOnboardingModal: false,
      assetsCompleted: false,
    };
  },
  computed: {
    filteredAssets(): AssetWithAllocations[] {
      const query = this.searchQuery.toLowerCase().trim();
      if (!query) return this.assets;

      return this.assets.filter((asset) => {
        // Search in name
        if (asset.name.toLowerCase().includes(query)) return true;

        // Search in ticker
        if (asset.ticker && asset.ticker.toLowerCase().includes(query)) return true;

        return false;
      });
    },
    allAssetsCategorized(): boolean {
      // All assets must have at least one allocation
      return this.assets.length > 0 && this.assets.every((a) => a.allocations.length > 0);
    },
    showContinueCard(): boolean {
      return this.allAssetsCategorized && !this.assetsCompleted;
    },
  },
  async mounted() {
    // Check onboarding state
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      this.assetsCompleted = session.user.user_metadata?.assets_completed ?? false;
      // Show onboarding modal if assets not yet completed
      this.showOnboardingModal = !this.assetsCompleted;
    }
    await this.loadData();
  },
  methods: {
    async loadData() {
      this.loading = true;
      this.error = null;
      try {
        // Load all data in parallel
        const [assetsData, pricesData, classesData] = await Promise.all([
          listAssetsWithAllocations(),
          listPriceUpdatesWithContext('desc'),
          listAssetClasses(),
        ]);

        // Sort by name for dropdown display (original behavior)
        this.assetClasses = [...classesData].sort((a, b) => a.name.localeCompare(b.name));

        this.latestPrices = getLatestPrices(pricesData);

        // Sort allocations by sort_order for display
        this.assets = assetsData.map((asset) => ({
          ...asset,
          allocations: [...asset.allocations].sort(
            (a, b) => a.asset_classes.sort_order - b.asset_classes.sort_order,
          ),
        }));
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err);
      } finally {
        this.loading = false;
      }
    },

    openEditModal(asset: AssetWithAllocations) {
      this.selectedAsset = asset;
      this.showEditAssetModal = true;
    },

    closeEditModal() {
      this.showEditAssetModal = false;
      this.selectedAsset = null;
    },

    openUpdatePriceModal(asset: AssetWithAllocations) {
      this.selectedAsset = asset;
      this.showUpdatePriceModal = true;
    },

    closeUpdatePriceModal() {
      this.showUpdatePriceModal = false;
      this.selectedAsset = null;
    },

    async onAssetCreated() {
      this.showAddAssetModal = false;
      await this.loadData();
    },

    async onAssetUpdated() {
      this.closeEditModal();
      this.closeUpdatePriceModal();
      await this.loadData();
    },

    formatPrice: formatCurrency,
    relativeDate,
    assetIdToString,
    assetClassIdToString,

    latestPrice(assetId: AssetId): number | null {
      return this.latestPrices.get(assetId)?.price ?? null;
    },

    latestEffectiveDate(assetId: AssetId): string | null {
      return this.latestPrices.get(assetId)?.effective_date ?? null;
    },

    getClassColor(colorName: string) {
      return getColorClasses(colorName);
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

    async doDeleteAsset(asset: AssetWithAllocations) {
      if (
        !confirm(
          `Delete "${asset.name}"? This will also delete all price history and holdings for this asset.`,
        )
      ) {
        return;
      }

      try {
        await deleteAsset(asset.id);
        await this.loadData();
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err);
      }
    },
  },
});
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <PageHeader
        title="Assets"
        description="Manage distinct assets and update metadata, like asset class. Manually update individual asset prices."
      >
        <template v-slot:actions>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search assets..."
            class="shrink-0 px-3 py-1.5 text-sm border border-page-border rounded-md bg-page text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
          />
        </template>
      </PageHeader>
      <!-- Error display -->
      <div v-if="error" class="p-4 bg-error text-error-text rounded-md">
        {{ error }}
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="text-muted-text">Loading...</div>

      <!-- Assets table -->
      <div v-if="!loading">
        <div v-if="assets.length > 0" class="bg-page shadow rounded-lg overflow-x-auto">
          <table class="min-w-full divide-y divide-surface-border bg-surface">
            <thead>
              <tr>
                <th
                  class="bg-header rounded-tl-lg px-6 py-3 text-left text-xs font-medium text-header-text uppercase tracking-wider whitespace-nowrap"
                >
                  Name
                </th>
                <th
                  class="bg-header px-6 py-3 text-left text-xs font-medium text-header-text uppercase tracking-wider whitespace-nowrap"
                >
                  Ticker
                </th>
                <th
                  class="bg-header px-6 py-3 text-left text-xs font-medium text-header-text uppercase tracking-wider whitespace-nowrap"
                >
                  Asset Class
                </th>
                <th
                  class="bg-header px-6 py-3 text-left text-xs font-medium text-header-text uppercase tracking-wider whitespace-nowrap"
                >
                  Latest Price
                </th>
                <th
                  class="bg-header rounded-tr-lg px-6 py-3 text-right text-xs font-medium text-header-text uppercase tracking-wider whitespace-nowrap"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-surface-border">
              <tr v-for="(asset, index) in filteredAssets" v-bind:key="assetIdToString(asset.id)">
                <td
                  class="px-6 py-4 whitespace-nowrap bg-surface"
                  v-bind:class="{ 'rounded-bl-lg': index === filteredAssets.length - 1 }"
                >
                  <div class="text-sm font-medium text-primary-text">{{ asset.name }}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap bg-surface">
                  <div class="text-sm text-muted-text">{{ asset.ticker || '-' }}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap bg-surface">
                  <div v-if="asset.allocations.length" class="flex flex-nowrap gap-1">
                    <span
                      v-for="alloc in asset.allocations"
                      v-bind:key="assetClassIdToString(alloc.asset_class_id)"
                      class="inline-block shrink-0 px-2 py-0.5 text-xs font-medium rounded"
                      v-bind:class="[
                        getClassColor(alloc.asset_classes.color).bg,
                        getClassColor(alloc.asset_classes.color).text,
                      ]"
                    >
                      {{ alloc.asset_classes.name }}
                    </span>
                  </div>
                  <span v-else class="text-sm text-placeholder-text">-</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap bg-surface">
                  <div class="text-sm text-primary-text">
                    {{ formatPrice(latestPrice(asset.id)) }}
                  </div>
                  <div v-if="latestEffectiveDate(asset.id)" class="text-xs text-placeholder-text">
                    {{ relativeDate(latestEffectiveDate(asset.id)) }}
                  </div>
                </td>
                <td
                  class="px-6 py-4 whitespace-nowrap text-right text-sm bg-surface"
                  v-bind:class="{ 'rounded-br-lg': index === filteredAssets.length - 1 }"
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
                        class="fixed z-50 w-36 bg-surface border border-surface-border rounded-md shadow-lg focus:outline-none py-1 flex flex-col"
                      >
                        <MenuItem v-slot:default="{ active }">
                          <button
                            v-bind:class="[
                              'w-full text-left px-4 py-2 text-sm cursor-pointer',
                              active
                                ? 'bg-surface-recessed-deep text-primary-text'
                                : 'text-secondary-text',
                            ]"
                            v-on:click="openEditModal(asset)"
                          >
                            Edit
                          </button>
                        </MenuItem>
                        <MenuItem v-slot:default="{ active }">
                          <button
                            v-bind:class="[
                              'w-full text-left px-4 py-2 text-sm cursor-pointer',
                              active
                                ? 'bg-surface-recessed-deep text-primary-text'
                                : 'text-secondary-text',
                            ]"
                            v-on:click="openUpdatePriceModal(asset)"
                          >
                            Update Price
                          </button>
                        </MenuItem>
                        <MenuItem v-slot:default="{ active }">
                          <button
                            v-bind:class="[
                              'w-full text-left px-4 py-2 text-sm cursor-pointer',
                              active ? 'bg-error text-error-text' : 'text-secondary-text',
                            ]"
                            v-on:click="doDeleteAsset(asset)"
                          >
                            Delete
                          </button>
                        </MenuItem>
                      </MenuItems>
                    </Teleport>
                  </HeadlessMenu>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Add asset button -->
        <button
          class="mt-4 w-full bg-page border-2 border-dashed border-page-border rounded-lg p-4 flex items-center justify-center text-muted-text hover:border-blue-400 hover:text-blue-600 transition-colors"
          v-on:click="showAddAssetModal = true"
        >
          <span class="text-xl mr-2">+</span>
          <span class="text-sm font-medium">Add Asset</span>
        </button>

        <!-- Onboarding continue card -->
        <OnboardingContinueCard
          v-if="showContinueCard"
          step="assets"
          message="All your assets are categorized. You're all set to start tracking your portfolio!"
          next-step-label="Go to Net Worth"
          next-route="/networth"
          class="mt-4"
        />
      </div>
    </div>

    <!-- Modals -->
    <AddAssetModal
      v-if="showAddAssetModal"
      v-on:close="showAddAssetModal = false"
      v-on:created="onAssetCreated"
    />

    <EditAssetModal
      v-if="showEditAssetModal && selectedAsset"
      v-bind:asset="selectedAsset"
      v-bind:asset-classes="assetClasses"
      v-on:close="closeEditModal"
      v-on:updated="onAssetUpdated"
    />

    <UpdatePriceModal
      v-if="showUpdatePriceModal && selectedAsset"
      v-bind:asset="selectedAsset"
      v-on:close="closeUpdatePriceModal"
      v-on:updated="onAssetUpdated"
    />

    <!-- Onboarding modal -->
    <OnboardingModal
      v-if="showOnboardingModal"
      title="Categorize Your Assets"
      v-bind:step-number="3"
      v-on:close="showOnboardingModal = false"
    >
      <div class="space-y-4 text-muted-text">
        <p>Almost done! Now let's <strong>categorize your assets</strong>.</p>
        <p>
          Each asset needs to be assigned an asset class. This is what allows Cheapskate to compare
          your <strong>actual portfolio allocation</strong> to the goal you specified.
        </p>
        <p>
          You can also assign multiple classes to a single asset, good for Target Date funds for
          example!
        </p>
        <p>Click <strong>Edit</strong> on each asset to assign its asset classes.</p>
      </div>
    </OnboardingModal>
  </AppLayout>
</template>
