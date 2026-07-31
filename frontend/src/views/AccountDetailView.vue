<script>
import AppLayout from '@/components/AppLayout.vue'
import PageHeader from '@/components/PageHeader.vue'
import EditAccountModal from '@/components/modals/EditAccountModal.vue'
import CloseAccountModal from '@/components/modals/CloseAccountModal.vue'
import {
  getAccount,
  getProfile,
  listHoldingUpdatesByAccount,
  listPriceUpdatesWithContext,
  listAssetsWithAllocations,
  listUpdatesByAccount,
  insertUpdate,
  insertHoldingUpdate,
  updateAccount,
  deleteAccount
} from '@/lib/data'
import { supabase } from '@/lib/supabase'
import { getColorClasses } from '@/lib/tagColors'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { PencilSquareIcon, CheckIcon, ChevronUpDownIcon } from '@heroicons/vue/24/solid'
import { Combobox, ComboboxInput, ComboboxButton, ComboboxOptions, ComboboxOption, Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue'

dayjs.extend(relativeTime)

export default {
  name: 'AccountDetailView',
  components: {
    AppLayout,
    PageHeader,
    EditAccountModal,
    CloseAccountModal,
    PencilSquareIcon,
    CheckIcon,
    ChevronUpDownIcon,
    Combobox,
    ComboboxInput,
    ComboboxButton,
    ComboboxOptions,
    ComboboxOption,
    Menu,
    MenuButton,
    MenuItems,
    MenuItem
  },
  data() {
    return {
      account: null,
      ownerName: null,
      assets: [],
      holdings: [],
      totalValue: null,
      assetClasses: [],
      allocationsByAsset: {},
      latestStatementDate: null,
      loading: true,
      error: null,

      showEditAccountModal: false,
      showCloseAccountModal: false,

      // Inline editing state
      editing: false,
      editDate: '',
      editQuantities: {},
      newRows: [],
      saving: false,
      comboboxAnchors: {}
    }
  },
  computed: {
    isArchived() {
      return !!this.account?.archived_at
    },
    displayAccountLast4() {
      return this.account?.last4 || null
    },
    displayLiquid() {
      if (typeof this.account?.is_liquid === 'boolean') {
        return this.account.is_liquid ? 'Liquid' : 'Not Liquid'
      }
      if (typeof this.account?.rebalancing === 'boolean') {
        return this.account.rebalancing ? 'Liquid' : 'Not Liquid'
      }
      return 'Liquid'
    },
    displayTaxType() {
      return 'Retirement'
    },
    displayTotalHoldings() {
      return this.formatCurrency(this.totalValue || 0)
    },
    displayLastUpdated() {
      return this.latestStatementDate ? this.relativeDate(this.latestStatementDate) : 'No data yet'
    },
    displayLastUpdatedDate() {
      return this.latestStatementDate
        ? dayjs(this.latestStatementDate).format('MMM D, YYYY')
        : 'Upload a statement or add holdings manually'
    },
    availableAssets() {
      const usedIds = new Set(this.holdings.map(h => h.asset_id))
      const newRowIds = new Set(this.newRows.filter(r => r.asset).map(r => r.asset.id))
      return this.assets.filter(a => !usedIds.has(a.id) && !newRowIds.has(a.id))
    }
  },
  async mounted() {
    await this.loadData()
  },
  methods: {
    async loadData() {
      this.loading = true
      this.error = null
      const accountId = Number(this.$route.params.id)

      try {
        const accountData = await getAccount(accountId)
        if (!accountData) {
          this.error = 'Account not found'
          this.loading = false
          return
        }
        this.account = accountData

        const [holdingsData, pricesData, assetsData, updatesData, ownerProfile] = await Promise.all([
          listHoldingUpdatesByAccount(accountId, 'desc'),
          listPriceUpdatesWithContext('desc'),
          listAssetsWithAllocations(),
          listUpdatesByAccount(accountId),
          accountData.created_by ? getProfile(accountData.created_by) : Promise.resolve(null)
        ])

        this.ownerName = ownerProfile?.name || null

        this.assets = assetsData

        const assetMap = {}
        for (const a of assetsData) {
          assetMap[a.id] = { ticker: a.ticker, name: a.name }
        }

        const allocationsByAsset = {}
        for (const a of assetsData) {
          if (a.allocations.length > 0) {
            allocationsByAsset[a.id] = a.allocations
              .map(alloc => ({
                name: alloc.asset_classes.name,
                color: alloc.asset_classes.color,
                sort_order: alloc.asset_classes.sort_order,
                percentage: parseFloat(alloc.percentage)
              }))
              .sort((x, y) => x.sort_order - y.sort_order)
          }
        }
        this.allocationsByAsset = allocationsByAsset

        const latestPriceByAsset = {}
        for (const p of pricesData) {
          if (!latestPriceByAsset[p.asset_id]) {
            latestPriceByAsset[p.asset_id] = parseFloat(p.price)
          }
        }

        const latestByAsset = {}
        for (const h of holdingsData) {
          if (!latestByAsset[h.asset_id]) {
            latestByAsset[h.asset_id] = h
          }
        }

        let total = 0
        const holdingsDisplay = []
        for (const assetId in latestByAsset) {
          const h = latestByAsset[assetId]
          const quantity = parseFloat(h.quantity)
          if (quantity <= 0) continue
          const asset = assetMap[h.asset_id] || {}
          const price = latestPriceByAsset[h.asset_id] || 0
          const value = quantity * price
          total += value
          holdingsDisplay.push({
            asset_id: h.asset_id,
            name: asset.name || 'Unknown',
            ticker: asset.ticker || null,
            assetClasses: (allocationsByAsset[h.asset_id] || []).map(c => ({ name: c.name, color: c.color })),
            quantity,
            value
          })
        }
        this.holdings = holdingsDisplay.sort((a, b) => b.value - a.value)
        this.totalValue = total !== 0 ? total : null

        const classValues = {}
        let unclassifiedValue = 0
        for (const h of holdingsDisplay) {
          const allocations = allocationsByAsset[h.asset_id] || []
          if (allocations.length === 0) {
            unclassifiedValue += h.value
          } else {
            for (const alloc of allocations) {
              if (!classValues[alloc.name]) {
                classValues[alloc.name] = { value: 0, color: alloc.color, sort_order: alloc.sort_order }
              }
              classValues[alloc.name].value += h.value * alloc.percentage
            }
          }
        }
        const classes = Object.entries(classValues)
          .filter(([, data]) => data.value > 0)
          .map(([name, data]) => ({ name, color: data.color, sort_order: data.sort_order }))
          .sort((a, b) => a.sort_order - b.sort_order)
        if (unclassifiedValue > 0) {
          classes.push({ name: 'Unclassified', color: 'gray', sort_order: 9999 })
        }
        this.assetClasses = classes

        this.latestStatementDate = updatesData.length > 0 ? updatesData[0].effective_date : null

      } catch (err) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },

    formatCurrency(value) {
      if (value == null) return '-'
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value)
    },

    formatQuantity(qty) {
      if (Number.isInteger(qty)) return qty.toString()
      return qty.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
    },

    relativeDate(dateStr) {
      if (!dateStr) return null
      return dayjs(dateStr).fromNow()
    },

    getClassColor(colorName) {
      return getColorClasses(colorName)
    },

    // Inline editing
    enterEditMode() {
      this.editDate = new Date().toISOString().split('T')[0]
      this.editQuantities = {}
      for (const h of this.holdings) {
        this.editQuantities[h.asset_id] = this.formatQuantity(h.quantity)
      }
      this.newRows = [{ asset: null, query: '', quantity: '' }]
      this.editing = true
    },

    cancelEdit() {
      this.editing = false
      this.editDate = ''
      this.editQuantities = {}
      this.newRows = []
    },

    onNewRowAssetSelected(index) {
      const row = this.newRows[index]
      if (row.asset) {
        // Add a new phantom row if this is the last one
        if (index === this.newRows.length - 1) {
          this.newRows.push({ asset: null, query: '', quantity: '' })
        }
      }
    },

    filteredAssetsForRow(index) {
      const query = this.newRows[index].query.toLowerCase().trim()
      let pool = this.availableAssets
      // Also exclude assets picked in other new rows (except this one)
      const otherPickedIds = new Set(
        this.newRows.filter((r, i) => i !== index && r.asset).map(r => r.asset.id)
      )
      pool = pool.filter(a => !otherPickedIds.has(a.id))
      if (!query) return pool
      return pool.filter(a =>
        (a.ticker && a.ticker.toLowerCase().includes(query)) ||
        (a.name && a.name.toLowerCase().includes(query))
      )
    },

    displayAsset(asset) {
      if (!asset) return ''
      if (!asset.ticker) return asset.name
      return `${asset.ticker} - ${asset.name}`
    },

    setComboboxAnchor(index, el) {
      if (el) {
        this.comboboxAnchors[index] = el
      } else {
        delete this.comboboxAnchors[index]
      }
    },

    comboboxDropdownStyle(index) {
      const el = this.comboboxAnchors[index]
      if (!el) return {}
      const rect = el.getBoundingClientRect()
      return {
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`
      }
    },

    getNewRowClasses(assetId) {
      return (this.allocationsByAsset[assetId] || []).map(c => ({ name: c.name, color: c.color }))
    },

    async saveEdits() {
      if (!this.editDate) {
        this.error = 'Please select an effective date'
        return
      }

      this.saving = true
      this.error = null

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        const holdingsToSave = []

        // Existing holdings with changed quantities
        for (const h of this.holdings) {
          const newQty = parseFloat(this.editQuantities[h.asset_id])
          if (isNaN(newQty) || newQty < 0) continue
          if (newQty !== h.quantity) {
            holdingsToSave.push({
              asset_id: h.asset_id,
              quantity: newQty
            })
          }
        }

        // New rows
        for (const row of this.newRows) {
          if (!row.asset) continue
          const qty = parseFloat(row.quantity)
          if (isNaN(qty) || qty <= 0) continue
          holdingsToSave.push({
            asset_id: row.asset.id,
            quantity: qty
          })
        }

        if (holdingsToSave.length > 0) {
          const update = await insertUpdate({
            family_id: user.user_metadata.family_id,
            account_id: this.account.id,
            update_type: 'manual_holdings',
            effective_date: this.editDate,
            created_by: user.id
          })

          for (const h of holdingsToSave) {
            await insertHoldingUpdate({
              update_id: update.id,
              asset_id: h.asset_id,
              quantity: h.quantity
            })
          }
        }

        this.editing = false
        this.editQuantities = {}
        this.newRows = []
        await this.loadData()
      } catch (err) {
        this.error = err.message
      } finally {
        this.saving = false
      }
    },

    async onAccountClosed() {
      this.showCloseAccountModal = false
      await this.loadData()
    },

    async reopenAccount() {
      if (!confirm(`Reopen "${this.account.name}"? It will appear in your accounts list again.`)) {
        return
      }

      try {
        await updateAccount(this.account.id, { archived_at: null })
        await this.loadData()
      } catch (err) {
        this.error = err.message
      }
    },

    async doDeleteAccount() {
      if (!confirm(`Delete "${this.account.name}"? This will also delete all statements for this account.`)) {
        return
      }

      try {
        await deleteAccount(this.account.id)
        this.$router.push('/accounts')
      } catch (err) {
        this.error = err.message
      }
    },

    async onAccountUpdated() {
      this.showEditAccountModal = false
      await this.loadData()
    }
  }
}
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Error display -->
      <div v-if="error" class="p-4 bg-error text-error-text rounded-lg">
        {{ error }}
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="text-muted-text">Loading...</div>

      <template v-if="!loading && account">
        <PageHeader :title="account.name" :description="isArchived ? 'CLOSED' : null">
          <template #actions>
            <Menu as="div" class="relative inline-block text-left shrink-0">
              <MenuButton class="inline-flex items-center rounded-md border border-page-border bg-surface px-4 py-2 text-sm font-medium text-secondary-text hover:bg-surface-recessed transition-colors">
                Manage<span class="hidden sm:inline">&nbsp;Account</span>
              </MenuButton>
              <MenuItems class="absolute right-0 mt-1 w-36 bg-surface border border-surface-border rounded-lg shadow-lg focus:outline-none z-50 py-1 flex flex-col">
                <MenuItem v-slot="{ active }">
                  <button
                    v-bind:class="['w-full text-left px-4 py-2 text-sm cursor-pointer', active ? 'bg-surface-recessed-deep text-primary-text' : 'text-secondary-text']"
                    v-on:click="showEditAccountModal = true"
                  >
                    Edit
                  </button>
                </MenuItem>
                <MenuItem v-if="!isArchived" v-slot="{ active }">
                  <button
                    v-bind:class="['w-full text-left px-4 py-2 text-sm cursor-pointer', active ? 'bg-surface-recessed-deep text-primary-text' : 'text-secondary-text']"
                    v-on:click="showCloseAccountModal = true"
                  >
                    Mark as Closed
                  </button>
                </MenuItem>
                <MenuItem v-if="isArchived" v-slot="{ active }">
                  <button
                    v-bind:class="['w-full text-left px-4 py-2 text-sm cursor-pointer', active ? 'bg-surface-recessed-deep text-primary-text' : 'text-secondary-text']"
                    v-on:click="reopenAccount"
                  >
                    Reopen
                  </button>
                </MenuItem>
                <MenuItem v-slot="{ active }">
                  <button
                    v-bind:class="['w-full text-left px-4 py-2 text-sm cursor-pointer', active ? 'bg-error text-error-text' : 'text-secondary-text']"
                    v-on:click="doDeleteAccount"
                  >
                    Delete
                  </button>
                </MenuItem>
              </MenuItems>
            </Menu>
          </template>
        </PageHeader>

        <div class="bg-surface shadow rounded-lg overflow-hidden">
          <div class="p-4">
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div class="lg:col-span-2 px-1 py-1 flex flex-col justify-between gap-4">
                <div>
                  <div class="text-xs font-semibold uppercase tracking-wide text-muted-text">Account value</div>
                  <div class="mt-1 text-2xl font-semibold text-primary-text">{{ displayTotalHoldings }}</div>
                  <div v-if="assetClasses.length" class="mt-2 flex flex-nowrap gap-1.5 overflow-x-auto">
                    <span
                      v-for="ac in assetClasses"
                      v-bind:key="ac.name"
                      class="inline-block shrink-0 px-2 py-0.5 text-xs font-medium rounded"
                      v-bind:class="[getClassColor(ac.color).bg, getClassColor(ac.color).text]"
                    >
                      {{ ac.name }}
                    </span>
                  </div>
                </div>
                <div>
                  <div class="text-xs font-semibold uppercase tracking-wide text-muted-text">As of date</div>
                  <div class="mt-1 text-sm text-primary-text">{{ displayLastUpdatedDate }} <span class="text-muted-text">({{ displayLastUpdated }})</span></div>
                </div>
              </div>

              <dl class="divide-y divide-surface-border rounded-lg bg-surface-recessed border border-surface-border px-4">
                <div class="flex items-baseline justify-between py-2.5">
                  <dt class="text-xs font-semibold uppercase tracking-wide text-muted-text">Owner</dt>
                  <dd class="text-sm font-semibold text-primary-text">
                    <template v-if="ownerName">{{ ownerName }}</template>
                    <span v-else class="text-placeholder-text font-normal">Unknown</span>
                  </dd>
                </div>
                <div class="flex items-baseline justify-between py-2.5">
                  <dt class="text-xs font-semibold uppercase tracking-wide text-muted-text">Account Number</dt>
                  <dd class="text-sm font-semibold text-primary-text">
                    <template v-if="displayAccountLast4">*****{{ displayAccountLast4 }}</template>
                    <span v-else class="text-placeholder-text font-normal">Not set</span>
                  </dd>
                </div>
                <div class="flex items-baseline justify-between py-2.5">
                  <dt class="text-xs font-semibold uppercase tracking-wide text-muted-text">Liquidity</dt>
                  <dd class="text-sm font-semibold text-primary-text">{{ displayLiquid }}</dd>
                </div>
                <div class="flex items-baseline justify-between py-2.5">
                  <dt class="text-xs font-semibold uppercase tracking-wide text-muted-text">Account Type</dt>
                  <dd class="text-sm font-semibold text-primary-text">{{ displayTaxType }}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <!-- Holdings table -->
        <div v-if="holdings.length > 0 || editing" class="bg-surface shadow rounded-lg overflow-x-auto">
          <table class="min-w-full divide-y divide-surface-border">
            <thead>
              <tr>
                <th class="bg-header rounded-tl-lg px-6 py-3 text-left text-xs font-medium text-header-text uppercase tracking-wider whitespace-nowrap min-w-48 max-w-48">
                  Name
                </th>
                <th class="bg-header px-6 py-3 text-left text-xs font-medium text-header-text uppercase tracking-wider whitespace-nowrap">
                  Ticker
                </th>
                <th class="bg-header px-6 py-3 text-left text-xs font-medium text-header-text uppercase tracking-wider whitespace-nowrap">
                  Asset Class
                </th>
                <th class="bg-header px-6 py-3 text-right text-xs font-medium text-header-text uppercase tracking-wider whitespace-nowrap w-40">
                  Quantity
                </th>
                <th class="bg-header rounded-tr-lg px-6 py-3 text-right text-xs font-medium text-header-text uppercase tracking-wider whitespace-nowrap">
                  Total Value
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-surface-border">
              <!-- Existing holdings -->
              <tr v-for="holding in holdings" v-bind:key="holding.asset_id">
                <td class="px-6 py-3 whitespace-nowrap bg-surface max-w-48">
                  <div class="h-8 flex items-center text-sm font-medium text-primary-text truncate">{{ holding.name }}</div>
                </td>
                <td class="px-6 py-3 whitespace-nowrap bg-surface">
                  <div class="h-8 flex items-center text-sm text-muted-text">{{ holding.ticker || '-' }}</div>
                </td>
                <td class="px-6 py-3 whitespace-nowrap bg-surface">
                  <div class="h-8 flex items-center">
                    <div v-if="holding.assetClasses.length" class="flex flex-nowrap gap-1">
                      <span
                        v-for="ac in holding.assetClasses"
                        v-bind:key="ac.name"
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
                      v-model="editQuantities[holding.asset_id]"
                      type="text"
                      inputmode="decimal"
                      class="w-28 h-8 px-2 text-sm text-right border border-surface-border-strong rounded bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span v-else class="text-sm text-primary-text">{{ formatQuantity(holding.quantity) }}</span>
                  </div>
                </td>
                <td class="px-6 py-3 whitespace-nowrap bg-surface text-right">
                  <div class="h-8 flex items-center justify-end text-sm text-primary-text">{{ formatCurrency(holding.value) }}</div>
                </td>
              </tr>

              <!-- Phantom rows for new holdings (edit mode only) -->
              <tr v-if="editing" v-for="(row, index) in newRows" v-bind:key="'new-' + index">
                <td class="px-6 py-3 bg-surface max-w-48">
                  <div class="h-8 flex items-center min-w-0">
                  <Combobox v-slot="{ open }" v-model="row.asset" as="div" class="relative w-full min-w-0" v-on:update:model-value="onNewRowAssetSelected(index)">
                    <div
                      class="relative min-w-0"
                      v-bind:ref="(el) => setComboboxAnchor(index, el)"
                    >
                      <ComboboxInput
                        v-bind:display-value="(a) => a ? a.name : ''"
                        v-on:change="row.query = $event.target.value"
                        placeholder="Search assets..."
                        class="w-full min-w-0 h-8 px-3 pr-8 text-sm border border-surface-border-strong rounded bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <ComboboxButton class="absolute inset-y-0 right-0 flex items-center pr-2">
                        <ChevronUpDownIcon class="w-4 h-4 text-placeholder-text" />
                      </ComboboxButton>
                    </div>
                    <!-- Portal out of the table: overflow-x-auto clips absolute dropdowns -->
                    <Teleport to="body">
                      <ComboboxOptions
                        v-bind:style="open ? comboboxDropdownStyle(index) : undefined"
                        class="fixed z-50 max-h-60 overflow-auto bg-surface border border-surface-border rounded-lg shadow-lg focus:outline-none"
                      >
                        <div v-if="filteredAssetsForRow(index).length === 0" class="px-3 py-2 text-sm text-muted-text">
                          No assets found
                        </div>
                        <ComboboxOption
                          v-for="asset in filteredAssetsForRow(index)"
                          v-bind:key="asset.id"
                          v-bind:value="asset"
                          v-slot="{ active, selected }"
                        >
                          <div
                            v-bind:class="[
                              'flex items-center justify-between px-3 py-2 text-sm cursor-pointer',
                              active ? 'bg-surface-recessed-deep' : '',
                              selected ? 'text-blue-600 font-medium' : 'text-secondary-text'
                            ]"
                          >
                            <span>{{ asset.ticker ? `${asset.ticker} - ${asset.name}` : asset.name }}</span>
                            <CheckIcon v-if="selected" class="w-4 h-4" />
                          </div>
                        </ComboboxOption>
                      </ComboboxOptions>
                    </Teleport>
                  </Combobox>
                  </div>
                </td>
                <td class="px-6 py-3 whitespace-nowrap bg-surface">
                  <div class="h-8 flex items-center text-sm text-muted-text">{{ row.asset?.ticker || '-' }}</div>
                </td>
                <td class="px-6 py-3 whitespace-nowrap bg-surface">
                  <div class="h-8 flex items-center">
                    <div v-if="row.asset && getNewRowClasses(row.asset.id).length" class="flex flex-nowrap gap-1">
                      <span
                        v-for="ac in getNewRowClasses(row.asset.id)"
                        v-bind:key="ac.name"
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
                  <div class="h-8 flex items-center justify-end text-sm text-placeholder-text">-</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Edit/Save button below table -->
        <div class="flex justify-end">
          <button
            v-if="!editing"
            v-on:click="enterEditMode"
            class="px-4 py-2 flex items-center gap-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            title="Edit holdings"
          >
            <PencilSquareIcon class="w-4 h-4" />
            Edit Holdings
          </button>
          <div v-else class="w-full flex flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <label class="flex items-center justify-center gap-2 text-sm text-muted-text sm:justify-start">
              Effective date
              <input
                v-model="editDate"
                type="date"
                class="px-3 py-1.5 text-sm border border-surface-border-strong rounded bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:gap-3">
              <button
                v-on:click="cancelEdit"
                class="px-4 py-2 text-sm text-muted-text hover:text-primary-text transition-colors self-center sm:self-auto"
              >
                Cancel
              </button>
              <button
                v-on:click="saveEdits"
                v-bind:disabled="saving"
                class="w-full sm:w-auto px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {{ saving ? 'Saving...' : 'Save' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Empty state (only when not editing) -->
        <div v-if="holdings.length === 0 && !editing" class="text-center py-12 text-muted-text">
          <p class="text-lg">No holdings yet</p>
          <p class="mt-1 text-sm">Click the edit button to add holdings manually.</p>
        </div>
      </template>
    </div>

    <!-- Modals -->
    <EditAccountModal
      v-if="showEditAccountModal"
      v-bind:account="account"
      v-on:close="showEditAccountModal = false"
      v-on:updated="onAccountUpdated"
    />
    <CloseAccountModal
      v-if="showCloseAccountModal"
      v-bind:account="account"
      v-bind:holdings="holdings"
      v-on:close="showCloseAccountModal = false"
      v-on:closed="onAccountClosed"
    />
  </AppLayout>
</template>
