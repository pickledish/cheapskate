<script lang="ts">
import { defineComponent, type ComponentPublicInstance } from 'vue';
import AppLayout from '@/components/AppLayout.vue';
import PageHeader from '@/components/PageHeader.vue';
import EditAccountModal from '@/components/modals/EditAccountModal.vue';
import CloseAccountModal from '@/components/modals/CloseAccountModal.vue';
import IncludeInPortfolioModal from '@/components/modals/IncludeInPortfolioModal.vue';
import InstitutionIcon from '@/components/InstitutionIcon.vue';
import {
  getAccount,
  getProfile,
  listHoldingUpdatesByAccount,
  listPriceUpdatesWithContext,
  listAssetsWithAllocations,
  listAssetClasses,
  listUpdatesByAccount,
  insertUpdate,
  insertHoldingUpdate,
  deleteAccount,
  type Account,
  type AssetClass,
  type AssetWithAllocations,
} from '@/lib/data';
import { getLatestPrices, getLatestHoldings, getValueByClass } from '@/lib/derived/derived';
import { supabase } from '@/lib/supabase';
import { getColorClasses } from '@/lib/tagColors';
import { formatCurrency, formatQuantity } from '@/lib/util/currency';
import dayjs from 'dayjs';
import { PencilSquareIcon, CheckIcon, ChevronUpDownIcon } from '@heroicons/vue/24/solid';
import {
  Combobox,
  ComboboxInput,
  ComboboxButton,
  ComboboxOptions,
  ComboboxOption,
  Menu as HeadlessMenu,
  MenuButton,
  MenuItems,
  MenuItem,
} from '@headlessui/vue';
import { assetIdToString, type AssetAllocationInfo, type AssetId } from '@/lib/data/assets';
import { accountIdToString, type AccountId } from '@/lib/data/accounts';
import { assetClassIdToString, type AssetClassId } from '@/lib/data/asset-classes';
import { formatError } from '@/lib/util/error';

export default defineComponent({
  name: 'AccountDetailView',
  components: {
    AppLayout,
    PageHeader,
    EditAccountModal,
    CloseAccountModal,
    IncludeInPortfolioModal,
    InstitutionIcon,
    PencilSquareIcon,
    CheckIcon,
    ChevronUpDownIcon,
    Combobox,
    ComboboxInput,
    ComboboxButton,
    ComboboxOptions,
    ComboboxOption,
    HeadlessMenu,
    MenuButton,
    MenuItems,
    MenuItem,
  },
  data(): {
    account: Account | null;
    ownerName: string | null;
    assets: AssetWithAllocations[];
    assetClassesData: AssetClass[];
    heldAssetIdsInSortedOrder: AssetId[];
    quantityByAsset: Map<AssetId, number>;
    valueByAsset: Map<AssetId, number>;
    totalValue: number | null;
    heldAssetClassesInSortedOrder: AssetClass[];
    hasUnclassified: boolean;
    allocationsByAsset: Map<AssetId, AssetAllocationInfo[]>;
    latestEffectiveDate: string | null;
    loading: boolean;
    error: string | null;
    showEditAccountModal: boolean;
    showCloseAccountModal: boolean;
    showIncludeInPortfolioModal: boolean;
    editing: boolean;
    effectiveDate: string;
    editQuantities: Map<AssetId, string>;
    newRows: { asset: AssetWithAllocations | null; query: string; quantity: string }[];
    saving: boolean;
    comboboxAnchors: Record<number, HTMLElement>;
  } {
    return {
      account: null,
      ownerName: null,
      assets: [],
      assetClassesData: [],
      heldAssetIdsInSortedOrder: [],
      quantityByAsset: new Map(),
      valueByAsset: new Map(),
      totalValue: null,
      heldAssetClassesInSortedOrder: [],
      hasUnclassified: false,
      allocationsByAsset: new Map(),
      latestEffectiveDate: null,
      loading: true,
      error: null,

      showEditAccountModal: false,
      showCloseAccountModal: false,
      showIncludeInPortfolioModal: false,

      // Inline editing state
      editing: false,
      effectiveDate: '',
      editQuantities: new Map(),
      newRows: [],
      saving: false,
      comboboxAnchors: {},
    };
  },
  computed: {
    isArchived(): boolean {
      return !!this.account?.is_archived;
    },
    displayAccountLast4(): string | null {
      return this.account?.last4 || null;
    },
    displayInPortfolio(): string {
      return this.account?.in_portfolio ? 'Yes' : 'No';
    },
    canIncludeInPortfolio(): boolean {
      return !!this.account && !this.account.in_portfolio && !this.isArchived;
    },
    displayTotalHoldings(): string {
      return this.formatCurrency(this.totalValue || 0);
    },
    displayEffectiveDate(): string {
      return this.latestEffectiveDate
        ? dayjs(this.latestEffectiveDate).format('MMM D, YYYY')
        : 'Upload a statement or add holdings manually';
    },
    assetsById(): Map<AssetId, AssetWithAllocations> {
      const byId: Map<AssetId, AssetWithAllocations> = new Map();
      for (const a of this.assets) {
        byId.set(a.id, a);
      }
      return byId;
    },
    assetClassById(): Map<AssetClassId, AssetClass> {
      return new Map(this.assetClassesData.map((c) => [c.id, c]));
    },
    availableAssets(): AssetWithAllocations[] {
      const usedIds = new Set(this.heldAssetIdsInSortedOrder);
      const newRowIds = new Set(this.newRows.flatMap((r) => (r.asset ? [r.asset.id] : [])));
      return this.assets.filter((a) => !usedIds.has(a.id) && !newRowIds.has(a.id));
    },
    showAssetClassTags(): boolean {
      return this.heldAssetClassesInSortedOrder.length > 0 || this.hasUnclassified;
    },
  },
  async mounted() {
    await this.loadData();
  },
  methods: {
    async loadData() {
      this.loading = true;
      this.error = null;
      const accountId = Number(this.$route.params.id) as unknown as AccountId;

      try {
        const accountData = await getAccount(accountId);
        if (!accountData) {
          this.error = 'Account not found';
          this.loading = false;
          return;
        }
        this.account = accountData;

        const [holdingsData, pricesData, assetsData, assetClasses, updatesData, ownerProfile] =
          await Promise.all([
            listHoldingUpdatesByAccount(accountId, 'desc'),
            listPriceUpdatesWithContext('desc'),
            listAssetsWithAllocations(),
            listAssetClasses(),
            listUpdatesByAccount(accountId),
            accountData.created_by ? getProfile(accountData.created_by) : Promise.resolve(null),
          ]);

        this.ownerName = ownerProfile?.name || null;
        this.assets = assetsData;
        this.assetClassesData = assetClasses;

        const allocationsByAsset: Map<AssetId, AssetAllocationInfo[]> = new Map();
        for (const a of assetsData) {
          if (a.allocations.length > 0) {
            allocationsByAsset.set(a.id, a.allocations);
          }
        }
        this.allocationsByAsset = allocationsByAsset;

        const latestPriceByAsset = getLatestPrices(pricesData);
        const latestByAsset = getLatestHoldings(holdingsData);
        const positiveHoldings = Object.values(latestByAsset).filter((h) => h.quantity > 0);

        let total = 0;
        const quantityByAsset: Map<AssetId, number> = new Map();
        const valueByAsset: Map<AssetId, number> = new Map();
        for (const h of positiveHoldings) {
          const value = h.quantity * (latestPriceByAsset.get(h.asset_id)?.price ?? 0);
          total += value;
          quantityByAsset.set(h.asset_id, h.quantity);
          valueByAsset.set(h.asset_id, value);
        }
        const heldAssetIdsInSortedOrder = Array.from(valueByAsset.keys()).sort(
          (a, b) => (valueByAsset.get(b) ?? 0) - (valueByAsset.get(a) ?? 0),
        );
        this.quantityByAsset = quantityByAsset;
        this.valueByAsset = valueByAsset;
        this.heldAssetIdsInSortedOrder = heldAssetIdsInSortedOrder;
        this.totalValue = total !== 0 ? total : null;

        const { byClass, unclassified } = getValueByClass(
          positiveHoldings,
          latestPriceByAsset,
          assetsData,
        );
        this.heldAssetClassesInSortedOrder = assetClasses
          .filter((ac) => (byClass.get(ac.id) || 0) > 0)
          .sort((a, b) => a.sort_order - b.sort_order);
        this.hasUnclassified = unclassified > 0;

        this.latestEffectiveDate =
          // updatesData is sorted most recently first
          updatesData.find(
            (u) => u.update_type === 'statement' || u.update_type === 'manual_holdings',
          )?.effective_date ?? null;
      } catch (err) {
        this.error = formatError(err);
      } finally {
        this.loading = false;
      }
    },

    formatCurrency,
    formatQuantity,
    assetIdToString,
    accountIdToString,
    assetClassIdToString,

    getClassColor(colorName: string) {
      return getColorClasses(colorName);
    },

    assetName(assetId: AssetId): string {
      return this.assetsById.get(assetId)?.name || 'Unknown';
    },

    assetTicker(assetId: AssetId): string | null {
      return this.assetsById.get(assetId)?.ticker ?? null;
    },

    classesForAsset(assetId: AssetId): AssetClass[] {
      return (this.allocationsByAsset.get(assetId) || [])
        .map((a) => this.assetClassById.get(a.asset_class_id))
        .filter((c): c is AssetClass => !!c)
        .sort((a, b) => a.sort_order - b.sort_order);
    },

    quantityFor(assetId: AssetId): number {
      return this.quantityByAsset.get(assetId) ?? 0;
    },

    valueFor(assetId: AssetId): number {
      return this.valueByAsset.get(assetId) ?? 0;
    },

    // Inline editing
    enterEditMode() {
      this.effectiveDate = new Date().toISOString().split('T')[0]!;
      this.editQuantities = new Map();
      for (const assetId of this.heldAssetIdsInSortedOrder) {
        this.editQuantities.set(assetId, this.formatQuantity(this.quantityFor(assetId)));
      }
      this.newRows = [{ asset: null, query: '', quantity: '' }];
      this.editing = true;
    },

    cancelEdit() {
      this.editing = false;
      this.effectiveDate = '';
      this.editQuantities = new Map();
      this.newRows = [];
    },

    onNewRowAssetSelected(index: number) {
      const row = this.newRows[index];
      if (row?.asset) {
        // Add a new phantom row if this is the last one
        if (index === this.newRows.length - 1) {
          this.newRows.push({ asset: null, query: '', quantity: '' });
        }
      }
    },

    filteredAssetsForRow(index: number): AssetWithAllocations[] {
      const query = (this.newRows[index]?.query ?? '').toLowerCase().trim();
      let pool = this.availableAssets;
      // Also exclude assets picked in other new rows (except this one)
      const otherPickedIds = new Set(
        this.newRows.flatMap((r, i) => (i !== index && r.asset ? [r.asset.id] : [])),
      );
      pool = pool.filter((a) => !otherPickedIds.has(a.id));
      if (!query) return pool;
      return pool.filter(
        (a) =>
          (a.ticker && a.ticker.toLowerCase().includes(query)) ||
          (a.name && a.name.toLowerCase().includes(query)),
      );
    },

    displayAsset(asset: AssetWithAllocations | null): string {
      if (!asset) return '';
      if (!asset.ticker) return asset.name;
      return `${asset.ticker} - ${asset.name}`;
    },

    setComboboxAnchor(index: number, el: Element | ComponentPublicInstance | null) {
      if (el instanceof HTMLElement) {
        this.comboboxAnchors[index] = el;
      } else {
        delete this.comboboxAnchors[index];
      }
    },

    comboboxDropdownStyle(index: number): Record<string, string> {
      const el = this.comboboxAnchors[index];
      if (!el) return {};
      const rect = el.getBoundingClientRect();
      return {
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
      };
    },

    async saveEdits() {
      if (!this.effectiveDate) {
        this.error = 'Please select a date';
        return;
      }
      const account = this.account;
      if (!account) return;

      this.saving = true;
      this.error = null;

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const holdingsToSave: Map<AssetId, number> = new Map();

        // Existing holdings with changed quantities
        for (const assetId of this.heldAssetIdsInSortedOrder) {
          const newQty = parseFloat(this.editQuantities.get(assetId) ?? '');
          if (isNaN(newQty) || newQty < 0) continue;
          if (newQty !== this.quantityFor(assetId)) {
            holdingsToSave.set(assetId, newQty);
          }
        }

        // New rows
        for (const row of this.newRows) {
          if (!row.asset) continue;
          const qty = parseFloat(row.quantity);
          if (isNaN(qty) || qty <= 0) continue;
          holdingsToSave.set(row.asset.id, qty);
        }

        if (holdingsToSave.size > 0) {
          const update = await insertUpdate({
            family_id: user.user_metadata.family_id,
            account_id: account.id,
            update_type: 'manual_holdings',
            effective_date: this.effectiveDate,
            created_by: user.id,
          });

          for (const [asset_id, quantity] of holdingsToSave) {
            await insertHoldingUpdate({
              update_id: update.id,
              asset_id,
              quantity,
            });
          }
        }

        this.editing = false;
        this.editQuantities = new Map();
        this.newRows = [];
        await this.loadData();
      } catch (err) {
        this.error = formatError(err);
      } finally {
        this.saving = false;
      }
    },

    async onAccountClosed() {
      this.showCloseAccountModal = false;
      await this.loadData();
    },

    async onIncludedInPortfolio() {
      this.showIncludeInPortfolioModal = false;
      await this.loadData();
    },

    async doDeleteAccount() {
      const account = this.account;
      if (!account) return;
      if (
        !confirm(`Delete "${account.name}"? This will also delete all statements for this account.`)
      ) {
        return;
      }

      try {
        await deleteAccount(account.id);
        await this.$router.push('/accounts');
      } catch (err) {
        this.error = formatError(err);
      }
    },

    async onAccountUpdated() {
      this.showEditAccountModal = false;
      await this.loadData();
    },
  },
});
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Error display -->
      <div v-if="error" class="p-4 bg-error text-error-text rounded-md">
        {{ error }}
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="text-muted-text">Loading...</div>

      <template v-if="!loading && account">
        <PageHeader v-bind:title="account.name" v-bind:description="isArchived ? 'CLOSED' : null">
          <template v-slot:actions>
            <HeadlessMenu as="div" class="relative inline-block text-left shrink-0">
              <MenuButton
                class="inline-flex items-center rounded-md border border-page-border bg-surface px-4 py-2 text-sm font-medium text-secondary-text hover:bg-surface-recessed transition-colors"
              >
                Manage<span class="hidden sm:inline">&nbsp;Account</span>
              </MenuButton>
              <MenuItems
                class="absolute right-0 mt-1 w-42 bg-surface border border-surface-border rounded-md shadow-lg focus:outline-none z-50 py-1 flex flex-col"
              >
                <MenuItem v-slot:default="{ active }">
                  <button
                    v-bind:class="[
                      'w-full text-left px-4 py-2 text-sm cursor-pointer',
                      active ? 'bg-surface-recessed-deep text-primary-text' : 'text-secondary-text',
                    ]"
                    v-on:click="showEditAccountModal = true"
                  >
                    Edit
                  </button>
                </MenuItem>
                <MenuItem v-if="canIncludeInPortfolio" v-slot:default="{ active }">
                  <button
                    v-bind:class="[
                      'w-full text-left px-4 py-2 text-sm cursor-pointer',
                      active ? 'bg-surface-recessed-deep text-primary-text' : 'text-secondary-text',
                    ]"
                    v-on:click="showIncludeInPortfolioModal = true"
                  >
                    Include in Portfolio
                  </button>
                </MenuItem>
                <MenuItem v-if="!isArchived" v-slot:default="{ active }">
                  <button
                    v-bind:class="[
                      'w-full text-left px-4 py-2 text-sm cursor-pointer',
                      active ? 'bg-surface-recessed-deep text-primary-text' : 'text-secondary-text',
                    ]"
                    v-on:click="showCloseAccountModal = true"
                  >
                    Mark as Closed
                  </button>
                </MenuItem>
                <MenuItem v-slot:default="{ active }">
                  <button
                    v-bind:class="[
                      'w-full text-left px-4 py-2 text-sm cursor-pointer',
                      active ? 'bg-error text-error-text' : 'text-secondary-text',
                    ]"
                    v-on:click="doDeleteAccount"
                  >
                    Delete
                  </button>
                </MenuItem>
              </MenuItems>
            </HeadlessMenu>
          </template>
        </PageHeader>

        <div class="bg-surface shadow rounded-lg overflow-hidden">
          <div class="p-4">
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div class="lg:col-span-2 px-1 py-1 flex flex-col justify-between gap-4">
                <div>
                  <div class="text-xs font-semibold uppercase tracking-wide text-muted-text">
                    Account value
                  </div>
                  <div class="mt-1 text-2xl font-semibold text-primary-text">
                    {{ displayTotalHoldings }}
                  </div>
                  <div
                    v-if="showAssetClassTags"
                    class="mt-2 flex flex-nowrap gap-1.5 overflow-x-auto"
                  >
                    <span
                      v-for="ac in heldAssetClassesInSortedOrder"
                      v-bind:key="assetClassIdToString(ac.id)"
                      class="inline-block shrink-0 px-2 py-0.5 text-xs font-medium rounded"
                      v-bind:class="[getClassColor(ac.color).bg, getClassColor(ac.color).text]"
                    >
                      {{ ac.name }}
                    </span>
                    <span
                      v-if="hasUnclassified"
                      class="inline-block shrink-0 px-2 py-0.5 text-xs font-medium rounded"
                      v-bind:class="[getClassColor('gray').bg, getClassColor('gray').text]"
                    >
                      Unclassified
                    </span>
                  </div>
                </div>
                <div>
                  <div class="text-xs font-semibold uppercase tracking-wide text-muted-text">
                    Holdings as of
                  </div>
                  <div class="mt-1 text-sm text-primary-text">
                    {{ displayEffectiveDate }}
                    <span class="mx-1 text-muted-text">·</span>
                    <router-link
                      class="text-muted-text hover:text-secondary-text"
                      v-bind:to="{
                        name: 'history',
                        query: { account: accountIdToString(account.id) },
                      }"
                    >
                      View update history →
                    </router-link>
                  </div>
                </div>
              </div>

              <dl
                class="divide-y divide-surface-border rounded-lg bg-surface-recessed border border-surface-border px-4"
              >
                <div class="flex items-center justify-between py-2.5">
                  <dt class="text-xs font-semibold uppercase tracking-wide text-muted-text">
                    Institution
                  </dt>
                  <dd class="flex items-center gap-2 text-sm font-semibold text-primary-text">
                    <InstitutionIcon v-bind:name="account.institution" />
                    <template v-if="account.institution">{{ account.institution }}</template>
                    <span v-else class="text-placeholder-text font-normal">Not set</span>
                  </dd>
                </div>
                <div class="flex items-baseline justify-between py-2.5">
                  <dt class="text-xs font-semibold uppercase tracking-wide text-muted-text">
                    Account Number
                  </dt>
                  <dd class="text-sm font-semibold text-primary-text">
                    <template v-if="displayAccountLast4">*****{{ displayAccountLast4 }}</template>
                    <span v-else class="text-placeholder-text font-normal">Not set</span>
                  </dd>
                </div>
                <div class="flex items-baseline justify-between py-2.5">
                  <dt class="text-xs font-semibold uppercase tracking-wide text-muted-text">
                    Owner
                  </dt>
                  <dd class="text-sm font-semibold text-primary-text">
                    <template v-if="ownerName">{{ ownerName }}</template>
                    <span v-else class="text-placeholder-text font-normal">Unknown</span>
                  </dd>
                </div>
                <div class="flex items-baseline justify-between py-2.5">
                  <dt class="text-xs font-semibold uppercase tracking-wide text-muted-text">
                    Included In Portfolio
                  </dt>
                  <dd class="text-sm font-semibold text-primary-text">{{ displayInPortfolio }}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <!-- Holdings table -->
        <div
          v-if="heldAssetIdsInSortedOrder.length > 0 || editing"
          class="bg-page shadow rounded-lg overflow-x-auto"
        >
          <table class="min-w-full divide-y divide-surface-border bg-surface">
            <thead>
              <tr>
                <th
                  class="bg-header rounded-tl-lg px-6 py-3 text-left text-xs font-medium text-header-text uppercase tracking-wider whitespace-nowrap min-w-48 max-w-48"
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
                  class="bg-header px-6 py-3 text-right text-xs font-medium text-header-text uppercase tracking-wider whitespace-nowrap w-40"
                >
                  Quantity
                </th>
                <th
                  class="bg-header rounded-tr-lg px-6 py-3 text-right text-xs font-medium text-header-text uppercase tracking-wider whitespace-nowrap"
                >
                  Total Value
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-surface-border">
              <!-- Existing holdings -->
              <tr
                v-for="assetId in heldAssetIdsInSortedOrder"
                v-bind:key="assetIdToString(assetId)"
              >
                <td class="px-6 py-3 whitespace-nowrap bg-surface max-w-48">
                  <div class="h-8 flex items-center text-sm font-medium text-primary-text truncate">
                    {{ assetName(assetId) }}
                  </div>
                </td>
                <td class="px-6 py-3 whitespace-nowrap bg-surface">
                  <div class="h-8 flex items-center text-sm text-muted-text">
                    {{ assetTicker(assetId) || '-' }}
                  </div>
                </td>
                <td class="px-6 py-3 whitespace-nowrap bg-surface">
                  <div class="h-8 flex items-center">
                    <div v-if="classesForAsset(assetId).length" class="flex flex-nowrap gap-1">
                      <span
                        v-for="ac in classesForAsset(assetId)"
                        v-bind:key="assetClassIdToString(ac.id)"
                        class="inline-block shrink-0 px-2 py-0.5 text-xs font-medium rounded"
                        v-bind:class="[getClassColor(ac.color).bg, getClassColor(ac.color).text]"
                      >
                        {{ ac.name }}
                      </span>
                    </div>
                    <span v-else class="text-sm text-placeholder-text">-</span>
                  </div>
                </td>
                <td class="px-6 py-3 whitespace-nowrap bg-surface text-right">
                  <div class="h-8 flex items-center justify-end">
                    <input
                      v-if="editing"
                      v-bind:value="editQuantities.get(assetId)"
                      type="text"
                      inputmode="decimal"
                      class="w-28 h-8 px-2 text-sm text-right border border-surface-border-strong rounded bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                      v-on:input="
                        editQuantities.set(assetId, ($event.target as HTMLInputElement).value)
                      "
                    />
                    <!-- prettier-ignore -->
                    <span v-else class="text-sm text-primary-text">
                      {{ formatQuantity(quantityFor(assetId)) }}
                    </span>
                  </div>
                </td>
                <td class="px-6 py-3 whitespace-nowrap bg-surface text-right">
                  <div class="h-8 flex items-center justify-end text-sm text-primary-text">
                    {{ formatCurrency(valueFor(assetId)) }}
                  </div>
                </td>
              </tr>

              <!-- Phantom rows for new holdings (edit mode only) -->
              <template v-if="editing">
                <tr v-for="(row, index) in newRows" v-bind:key="'new-' + index">
                  <td class="px-6 py-3 bg-surface max-w-48">
                    <div class="h-8 flex items-center min-w-0">
                      <Combobox
                        v-slot:default="{ open }"
                        v-model="row.asset"
                        as="div"
                        class="relative w-full min-w-0"
                        v-on:update:model-value="onNewRowAssetSelected(index)"
                      >
                        <div
                          v-bind:ref="(el) => setComboboxAnchor(index, el)"
                          class="relative min-w-0"
                        >
                          <ComboboxInput
                            v-bind:display-value="
                              (a) => (a ? (a as AssetWithAllocations).name : '')
                            "
                            placeholder="Search assets..."
                            class="w-full min-w-0 h-8 px-3 pr-8 text-sm border border-surface-border-strong rounded bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                            v-on:change="row.query = $event.target.value"
                          />
                          <ComboboxButton class="absolute inset-y-0 right-0 flex items-center pr-2">
                            <ChevronUpDownIcon class="w-4 h-4 text-placeholder-text" />
                          </ComboboxButton>
                        </div>
                        <!-- Portal out of the table: overflow-x-auto clips absolute dropdowns -->
                        <Teleport to="body">
                          <ComboboxOptions
                            v-bind:style="open ? comboboxDropdownStyle(index) : undefined"
                            class="fixed z-50 max-h-60 overflow-auto bg-surface border border-surface-border rounded-md shadow-lg focus:outline-none"
                          >
                            <div
                              v-if="filteredAssetsForRow(index).length === 0"
                              class="px-3 py-2 text-sm text-muted-text"
                            >
                              No assets found
                            </div>
                            <ComboboxOption
                              v-for="asset in filteredAssetsForRow(index)"
                              v-bind:key="assetIdToString(asset.id)"
                              v-slot:default="{ active, selected }"
                              v-bind:value="asset"
                            >
                              <div
                                v-bind:class="[
                                  'flex items-center justify-between px-3 py-2 text-sm cursor-pointer',
                                  active ? 'bg-surface-recessed-deep' : '',
                                  selected ? 'text-link font-medium' : 'text-secondary-text',
                                ]"
                              >
                                <!-- prettier-ignore -->
                                <span>
                                {{ asset.ticker ? `${asset.ticker} - ${asset.name}` : asset.name }}
                              </span>
                                <CheckIcon v-if="selected" class="w-4 h-4" />
                              </div>
                            </ComboboxOption>
                          </ComboboxOptions>
                        </Teleport>
                      </Combobox>
                    </div>
                  </td>
                  <td class="px-6 py-3 whitespace-nowrap bg-surface">
                    <div class="h-8 flex items-center text-sm text-muted-text">
                      {{ row.asset?.ticker || '-' }}
                    </div>
                  </td>
                  <td class="px-6 py-3 whitespace-nowrap bg-surface">
                    <div class="h-8 flex items-center">
                      <div
                        v-if="row.asset && classesForAsset(row.asset.id).length"
                        class="flex flex-nowrap gap-1"
                      >
                        <span
                          v-for="ac in classesForAsset(row.asset.id)"
                          v-bind:key="assetClassIdToString(ac.id)"
                          class="inline-block shrink-0 px-2 py-0.5 text-xs font-medium rounded"
                          v-bind:class="[getClassColor(ac.color).bg, getClassColor(ac.color).text]"
                        >
                          {{ ac.name }}
                        </span>
                      </div>
                      <span v-else class="text-sm text-placeholder-text">-</span>
                    </div>
                  </td>
                  <td class="px-6 py-3 whitespace-nowrap bg-surface text-right">
                    <div class="h-8 flex items-center justify-end">
                      <input
                        v-model="row.quantity"
                        type="text"
                        inputmode="decimal"
                        placeholder="0"
                        class="w-28 h-8 px-2 text-sm text-right border border-surface-border-strong rounded bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </td>
                  <td class="px-6 py-3 whitespace-nowrap bg-surface text-right">
                    <div class="h-8 flex items-center justify-end text-sm text-placeholder-text">
                      -
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <!-- Edit/Save button below table -->
        <div class="flex justify-end">
          <button
            v-if="!editing"
            class="px-4 py-2 flex items-center gap-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            title="Edit holdings"
            v-on:click="enterEditMode"
          >
            <PencilSquareIcon class="w-4 h-4" />
            Edit Holdings
          </button>
          <div v-else class="w-full flex flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <label
              class="flex items-center justify-center gap-2 text-sm text-muted-text sm:justify-start"
            >
              As of
              <input
                v-model="effectiveDate"
                type="date"
                class="px-3 py-1.5 text-sm border border-surface-border-strong rounded bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:gap-3">
              <button
                class="px-4 py-2 text-sm text-secondary-text hover:text-primary-text transition-colors self-center sm:self-auto"
                v-on:click="cancelEdit"
              >
                Cancel
              </button>
              <button
                v-bind:disabled="saving"
                class="w-full sm:w-auto px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                v-on:click="saveEdits"
              >
                {{ saving ? 'Saving...' : 'Save' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Empty state (only when not editing) -->
        <div
          v-if="heldAssetIdsInSortedOrder.length === 0 && !editing"
          class="text-center py-12 text-muted-text"
        >
          <p class="text-lg">No holdings yet</p>
          <p class="mt-1 text-sm">Click the edit button to add holdings manually.</p>
        </div>
      </template>
    </div>

    <!-- Modals -->
    <EditAccountModal
      v-if="showEditAccountModal && account"
      v-bind:account="account"
      v-on:close="showEditAccountModal = false"
      v-on:updated="onAccountUpdated"
    />
    <CloseAccountModal
      v-if="showCloseAccountModal && account"
      v-bind:account="account"
      v-bind:held-assets="heldAssetIdsInSortedOrder"
      v-on:close="showCloseAccountModal = false"
      v-on:closed="onAccountClosed"
    />
    <IncludeInPortfolioModal
      v-if="showIncludeInPortfolioModal && account"
      v-bind:account="account"
      v-on:close="showIncludeInPortfolioModal = false"
      v-on:included="onIncludedInPortfolio"
    />
  </AppLayout>
</template>
