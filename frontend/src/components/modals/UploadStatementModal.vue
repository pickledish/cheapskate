<script>
/**
 * Holding resolution shapes used by this modal (JSDoc stand-in until this is .ts).
 *
 * ParsedHolding — raw LLM output, kept immutable so re-resolving for a different account works:
 *   { name: string, ticker: string | null, quantity: number, total_value: number | null, price: number | null }
 *
 * ResolvedHolding — preview/save row after matching against tickers + per-account aliases:
 *   {
 *     name: string,              // fund name as printed on the statement
 *     ticker: string | null,     // ticker as printed (uppercased), or null
 *     quantity: number,
 *     total_value: number | null,
 *     price: number | null,
 *     kind: 'ticker' | 'new-ticker' | 'alias' | 'unresolved' | 'sold',
 *     assetId: number | null,    // set for ticker / alias / sold; null until materialize for the rest
 *     display: string,           // label shown in the preview table
 *     chosenAsset: Asset | null, // unresolved only: combobox selection (null => create new)
 *     assetQuery: string,        // unresolved only: combobox filter text
 *   }
 *
 * kind meanings:
 *   'ticker'      — statement printed a ticker we already have; assetId is set
 *   'new-ticker'  — statement printed a ticker we don't have; create asset with that ticker on save
 *   'alias'       — no ticker, but (account, normalized name) maps to an existing asset
 *   'unresolved'  — no ticker and no alias; user picks an asset or leaves blank to create + write alias
 *   'sold'        — previously held in this account but missing from this statement; quantity forced to 0
 */
import BaseModal from './BaseModal.vue';
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Combobox,
  ComboboxInput,
  ComboboxButton,
  ComboboxOptions,
  ComboboxOption,
  Menu,
  MenuButton,
  MenuItems,
  MenuItem,
} from '@headlessui/vue';
import { CheckIcon, ChevronUpDownIcon, ChevronUpIcon, TrashIcon } from '@heroicons/vue/24/solid';
import { supabase } from '@/lib/supabase';
import {
  listAccounts,
  findAccountByLast4,
  insertAccount,
  updateAccount,
  insertUpdate,
  insertPriceUpdate,
  insertHoldingUpdate,
  deleteUpdate,
  insertAsset,
  listHoldingUpdatesByAccount,
  listAssets,
  listAliasesByAccount,
  insertAssetAlias,
  normalizeLabel,
  getProfile,
} from '@/lib/data';
import { parseWithLocalLlm } from '@/lib/local-llm';
import { pdfToQuantizedTsv } from '@/lib/pdf';
import { formatCurrency, formatNumber } from '@/lib/format';

export default {
  name: 'UploadStatementModal',
  components: {
    BaseModal,
    Disclosure,
    DisclosureButton,
    DisclosurePanel,
    Combobox,
    ComboboxInput,
    ComboboxButton,
    ComboboxOptions,
    ComboboxOption,
    Menu,
    MenuButton,
    MenuItems,
    MenuItem,
    CheckIcon,
    ChevronUpDownIcon,
    ChevronUpIcon,
    TrashIcon,
  },
  emits: ['close', 'uploaded'],
  data() {
    return {
      // Step: 'upload' | 'match' | 'preview' | 'saving'
      step: 'upload',

      // File state
      file: null,
      parseMode: 'cloud', // 'cloud' | 'local'

      // Raw LLM output (kept so re-resolving for a different account works)
      parsedHoldings: [],
      effectiveDate: '',
      parsedLast4: null,

      // Resolved holdings for preview/save
      holdings: [],

      // Account matching
      matchedAccount: null,
      allAccounts: [],
      selectedAccount: null,
      accountQuery: '',
      createNewAccount: false,
      newAccountName: '',
      matchingAccountIds: [],

      // Asset catalog + existing holdings for sold-position detection
      allAssets: [],
      existingHoldings: [],

      // Loading/error
      loading: false,
      error: null,

      // Anchor els for portaled asset combobox dropdowns (escape table overflow)
      comboboxAnchors: {},
    };
  },
  computed: {
    todayDate() {
      return new Date().toISOString().split('T')[0];
    },
    parseButtonText() {
      if (this.loading) return 'Parsing...';
      return this.parseMode === 'local' ? 'Parse with Local LLM' : 'Parse with Cloud AI';
    },
    modalTitle() {
      if (this.step === 'match') return 'Select Account';
      return 'Upload Statement';
    },
    filteredAccounts() {
      const query = this.accountQuery.toLowerCase().trim();
      if (!query) return this.allAccounts;
      return this.allAccounts.filter(
        (a) => a.name.toLowerCase().includes(query) || (a.last4 && a.last4.includes(query)),
      );
    },
    sortedAccounts() {
      const matching = this.filteredAccounts.filter((a) => this.matchingAccountIds.includes(a.id));
      const others = this.filteredAccounts.filter((a) => !this.matchingAccountIds.includes(a.id));
      return [...matching, ...others];
    },
    resolvedAccount() {
      return this.matchedAccount;
    },
    duplicateAssetIds() {
      const counts = {};
      for (const h of this.holdings) {
        const id = this.resolvedAssetId(h);
        if (id == null) continue;
        counts[id] = (counts[id] || 0) + 1;
      }
      return Object.keys(counts)
        .filter((id) => counts[id] > 1)
        .map(Number);
    },
    canSave() {
      return this.holdings.length > 0 && this.duplicateAssetIds.length === 0;
    },
  },
  methods: {
    /**
     * LLM last4 is unreliable: omitted, null, "null", "not provided", etc.
     * Only accept exactly 4 digit characters; anything else is unset.
     */
    normalizeParsedLast4(value) {
      if (value == null) return null;
      const s = String(value).trim();
      if (s.length !== 4) return null;
      if (!/^\d{4}$/.test(s)) return null;
      return s;
    },

    displayAccount(account) {
      if (!account) return '';
      return account.last4 ? `${account.name} (****${account.last4})` : account.name;
    },

    displayAsset(asset) {
      if (!asset) return '';
      return asset.ticker ? `${asset.name} (${asset.ticker})` : asset.name;
    },

    setComboboxAnchor(index, el) {
      if (el) {
        this.comboboxAnchors[index] = el;
      } else {
        delete this.comboboxAnchors[index];
      }
    },

    comboboxDropdownStyle(index) {
      const el = this.comboboxAnchors[index];
      if (!el) return {};
      const rect = el.getBoundingClientRect();
      return {
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
      };
    },

    filteredAssetsFor(holding) {
      const query = (holding.assetQuery || '').toLowerCase().trim();
      if (!query) return this.allAssets;
      return this.allAssets.filter(
        (a) =>
          a.name.toLowerCase().includes(query) ||
          (a.ticker && a.ticker.toLowerCase().includes(query)),
      );
    },

    onFileChange(event) {
      this.file = event.target.files[0];
      this.error = null;
    },

    async parseFile() {
      if (!this.file) {
        this.error = 'Please select a file';
        return;
      }

      this.loading = true;
      this.error = null;

      try {
        const result =
          this.parseMode === 'local' ? await this.parseWithLocal() : await this.parseWithCloud();

        await this.handleParseResult(result);
      } catch (err) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },

    async parseWithCloud() {
      const pdfArrayBuffer = await this.file.arrayBuffer();
      const tsv = await pdfToQuantizedTsv(pdfArrayBuffer);
      const { data, error } = await supabase.functions.invoke('parse-pdf', {
        body: { tsv },
      });
      if (error) throw error;
      return data;
    },

    async parseWithLocal() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const profile = await getProfile(user.id);
      const llmConfig = profile?.preferences?.local_llm;

      if (!llmConfig || llmConfig.api === 'disabled') {
        throw new Error('Local LLM not configured. Go to Profile & Settings to set it up.');
      }

      const pdfArrayBuffer = await this.file.arrayBuffer();
      return parseWithLocalLlm({
        config: { provider: llmConfig.api, port: llmConfig.port },
        pdfArrayBuffer,
      });
    },

    async handleParseResult(result) {
      this.parsedHoldings = (result.holdings || []).map((h) => ({
        name: h.name,
        ticker: h.ticker?.trim() || null,
        quantity: h.quantity,
        total_value: h.total_value,
        price: h.price ?? null,
      }));
      this.effectiveDate = result.statement_date || this.todayDate;
      this.parsedLast4 = this.normalizeParsedLast4(result.last4);

      if (this.parsedLast4) {
        const matches = await findAccountByLast4(this.parsedLast4);
        this.matchingAccountIds = matches.map((a) => a.id);

        if (matches.length === 1) {
          this.matchedAccount = matches[0];
          listAccounts().then((accts) => (this.allAccounts = accts));
          await this.onAccountResolved();
          return;
        }

        if (matches.length > 1) {
          this.allAccounts = await listAccounts();
          this.step = 'match';
          return;
        }
      }

      this.allAccounts = await listAccounts();
      this.step = 'match';
    },

    async confirmAccountSelection() {
      this.error = null;

      if (this.createNewAccount) {
        if (!this.newAccountName.trim()) {
          this.error = 'Please enter an account name';
          return;
        }

        this.loading = true;
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) throw new Error('Not authenticated');

          const newAccount = await insertAccount({
            family_id: user.user_metadata.family_id,
            created_by: user.id,
            name: this.newAccountName.trim(),
            rebalancing: true, // uhh just hardcode 'true' for now I guess
            last4: this.parsedLast4,
          });
          this.matchedAccount = newAccount;
          this.matchingAccountIds = [];
          await this.onAccountResolved();
        } catch (err) {
          this.error = err.message;
          this.loading = false;
        }
        return;
      }

      if (!this.selectedAccount) {
        this.error = 'Please select an account';
        return;
      }

      this.loading = true;
      try {
        this.matchedAccount = this.selectedAccount;
        this.matchingAccountIds = [];
        await this.onAccountResolved();
      } catch (err) {
        this.error = err.message;
        this.loading = false;
      }
    },

    async rejectAutoMatch() {
      this.matchedAccount = null;
      this.selectedAccount = null;
      this.holdings = [];
      // might've already been loaded in prefetch
      if (this.allAccounts.length === 0) {
        this.allAccounts = await listAccounts();
      }
      this.step = 'match';
    },

    async onAccountResolved() {
      try {
        // Fetch assets, aliases, and existing holdings for sold-position detection
        const [holdingsData, assetsData, aliasesData] = await Promise.all([
          listHoldingUpdatesByAccount(this.matchedAccount.id, 'desc'),
          listAssets(),
          listAliasesByAccount(this.matchedAccount.id),
        ]);

        this.allAssets = assetsData;

        const assetsById = {};
        for (const a of assetsData) {
          assetsById[a.id] = a;
        }

        // Get latest holding per asset
        const latestByAsset = {};
        for (const h of holdingsData) {
          if (!latestByAsset[h.asset_id]) {
            latestByAsset[h.asset_id] = h;
          }
        }

        this.existingHoldings = Object.values(latestByAsset)
          .filter((h) => parseFloat(h.quantity) > 0)
          .map((h) => ({
            asset_id: h.asset_id,
            ticker: assetsById[h.asset_id]?.ticker || null,
            name: assetsById[h.asset_id]?.name || null,
          }));

        // Build alias lookup: normalized statement label -> asset_id
        const assetsByLabel = {};
        for (const alias of aliasesData) {
          assetsByLabel[alias.label] = alias.asset_id;
        }

        const assetsByTicker = {};
        for (const a of assetsData) {
          if (a.ticker) {
            assetsByTicker[a.ticker.toUpperCase()] = a;
          }
        }

        this.holdings = this.parsedHoldings.map((h) =>
          this.resolveHolding(h, assetsByTicker, assetsByLabel, assetsById),
        );
        this.addSoldPositions();
        this.step = 'preview';
      } catch (err) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },

    /** Classify a parsed holding into a ResolvedHolding using ticker, then alias. */
    resolveHolding(h, assetsByTicker, assetsByLabel, assetsById) {
      const base = {
        name: h.name,
        ticker: h.ticker,
        quantity: h.quantity,
        total_value: h.total_value,
        price: h.price,
        chosenAsset: null,
        assetQuery: '',
      };

      // Path 1: statement printed a ticker
      if (h.ticker) {
        const key = h.ticker.toUpperCase();
        const hit = assetsByTicker[key];
        if (hit) {
          return {
            ...base,
            ticker: key,
            kind: 'ticker',
            assetId: hit.id,
            display: this.displayAsset(hit),
          };
        }
        return {
          ...base,
          ticker: key,
          kind: 'new-ticker',
          assetId: null,
          display: this.displayAsset({ name: h.name, ticker: key }),
        };
      }

      // Path 2: no ticker, but we've mapped this label in this account before
      const assetId = assetsByLabel[normalizeLabel(h.name)];
      if (assetId && assetsById[assetId]) {
        const asset = assetsById[assetId];
        return {
          ...base,
          kind: 'alias',
          assetId: assetId,
          display: this.displayAsset(asset),
        };
      }

      // Path 3: nothing to go on — user picks or leaves blank to create
      return {
        ...base,
        kind: 'unresolved',
        assetId: null,
        display: h.name,
      };
    },

    /**
     * Asset id this holding currently resolves to, if known.
     * Used for sold-position detection and duplicate checks — does not create anything.
     * Returns null for new-ticker and for unresolved rows with no combobox selection yet.
     */
    resolvedAssetId(holding) {
      if (holding.kind === 'ticker' || holding.kind === 'alias' || holding.kind === 'sold') {
        return holding.assetId;
      }
      if (holding.kind === 'unresolved' && holding.chosenAsset) {
        return holding.chosenAsset.id;
      }
      return null;
    },

    removeHolding(index) {
      this.holdings.splice(index, 1);
      this.refreshSoldPositions();
    },

    onChosenAssetChange() {
      this.refreshSoldPositions();
    },

    refreshSoldPositions() {
      // Drop previous sold rows, then recompute from current resolutions
      this.holdings = this.holdings.filter((h) => h.kind !== 'sold');
      this.addSoldPositions();
    },

    addSoldPositions() {
      // Assets already represented by a resolved holding in this statement
      const present = new Set(
        this.holdings.map((h) => this.resolvedAssetId(h)).filter((id) => id != null),
      );

      // Check each existing holding to see if it's missing from the parsed results
      for (const existing of this.existingHoldings) {
        if (!present.has(existing.asset_id)) {
          // Asset not in statement - add as sold (quantity=0)
          this.holdings.push({
            name: existing.name,
            ticker: existing.ticker,
            quantity: 0,
            total_value: null,
            price: null,
            kind: 'sold',
            assetId: existing.asset_id,
            chosenAsset: null,
            assetQuery: '',
            display: this.displayAsset(existing),
          });
        }
      }
    },

    computePrice(holding) {
      if (holding.price) return holding.price;
      if (holding.quantity && holding.quantity !== 0) {
        return holding.total_value / holding.quantity;
      }
      return holding.total_value; // fallback for quantity=0 edge case
    },

    formatCurrency,
    formatNumber,

    /**
     * Turn a ResolvedHolding into a concrete assets.id, creating rows as needed.
     * - ticker / alias / sold: already have assetId, return it
     * - new-ticker: insert asset with that ticker (no alias — ticker match is stable)
     * - unresolved: use combobox selection, or insert a ticker-less asset; always write
     *   an asset_aliases row so this account's label maps here next time
     */
    async materializeAsset(holding, accountId, user) {
      if (holding.kind === 'ticker' || holding.kind === 'alias' || holding.kind === 'sold') {
        return holding.assetId;
      }

      if (holding.kind === 'new-ticker') {
        const asset = await insertAsset({
          family_id: user.user_metadata.family_id,
          created_by: user.id,
          ticker: holding.ticker,
          name: holding.name,
        });
        return asset.id;
      }

      // unresolved: chosen from combobox, or blank => create ticker-less asset
      const assetId =
        holding.chosenAsset?.id ??
        (
          await insertAsset({
            family_id: user.user_metadata.family_id,
            created_by: user.id,
            ticker: null,
            name: holding.name,
          })
        ).id;

      await insertAssetAlias({
        account_id: accountId,
        label: holding.name,
        asset_id: assetId,
      });
      return assetId;
    },

    async saveStatement() {
      if (this.holdings.length === 0) {
        this.error = 'No holdings to save';
        return;
      }

      if (!this.effectiveDate) {
        this.error = 'Please select a date';
        return;
      }

      if (this.duplicateAssetIds.length > 0) {
        this.error = 'Two holdings resolve to the same asset. Remove or remap one before saving.';
        return;
      }

      const account = this.resolvedAccount;
      if (!account) {
        this.error = 'No account selected';
        return;
      }

      this.step = 'saving';
      this.loading = true;
      this.error = null;

      let update = null;

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Backfill last4 if the account doesn't have one yet
        if (this.parsedLast4 && !account.last4) {
          await updateAccount(account.id, { last4: this.parsedLast4 });
        }

        // 1. Create the update record
        update = await insertUpdate({
          family_id: user.user_metadata.family_id,
          account_id: account.id,
          update_type: 'statement',
          effective_date: this.effectiveDate,
          created_by: user.id,
        });

        // 2. Process each holding
        for (const holding of this.holdings) {
          // Resolve / create the asset (and alias, when needed)
          let assetId;
          try {
            assetId = await this.materializeAsset(holding, account.id, user);
          } catch (createError) {
            // Rollback: delete the update
            await deleteUpdate(update.id);
            throw createError;
          }

          // Compute price (null for sold positions)
          const price = this.computePrice(holding);

          // Insert price (skip for sold positions where price is null)
          if (price != null) {
            try {
              await insertPriceUpdate({
                update_id: update.id,
                asset_id: assetId,
                price: price,
              });
            } catch (priceError) {
              await deleteUpdate(update.id);
              throw priceError;
            }
          }

          // Insert holding
          try {
            await insertHoldingUpdate({
              update_id: update.id,
              asset_id: assetId,
              quantity: holding.quantity,
            });
          } catch (holdingError) {
            await deleteUpdate(update.id);
            throw holdingError;
          }
        }

        // Success!
        this.$emit('uploaded');
      } catch (err) {
        this.error = err.message;
        this.step = 'preview';
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<template>
  <BaseModal v-bind:title="modalTitle" max-width="max-w-2xl" v-on:close="$emit('close')">
    <!-- Error display -->
    <div v-if="error" class="mb-4 p-3 bg-error text-error-text rounded-md text-sm">
      {{ error }}
    </div>

    <!-- Step 1: Upload -->
    <div v-if="step === 'upload'">
      <p class="text-sm text-muted-text mb-4">
        Select a PDF statement to upload. It will be parsed using AI to extract holdings.
      </p>

      <Disclosure
        v-slot:default="{ open }"
        as="div"
        class="mb-5 p-4 bg-info border border-info-border rounded-lg"
      >
        <DisclosureButton class="w-full flex items-center justify-between text-left">
          <h4 class="text-sm font-medium text-info-text">Privacy Notice</h4>
          <svg
            class="w-4 h-4 text-info-text transition-transform duration-200"
            v-bind:class="{ '-rotate-90': !open }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </DisclosureButton>
        <div
          class="grid transition-all duration-200 ease-out"
          v-bind:class="open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'"
        >
          <DisclosurePanel static class="overflow-hidden">
            <div class="mt-2">
              <p class="text-sm text-info-text mb-2">
                Cheapskate extracts and stores only ticker symbols, share quantities, and account
                last-4 digits from your statement -- no full account numbers, addresses, or other
                personal information.
              </p>
              <!-- prettier-ignore -->
              <p class="text-sm text-info-text">
                The AI provider is configured with <a href="https://openrouter.ai/docs/guides/features/zdr" class="font-semibold underline hover:text-info-text">zero data retention</a>, so your document is not stored or used for training after parsing.
              </p>
            </div>
          </DisclosurePanel>
        </div>
      </Disclosure>

      <input
        type="file"
        accept=".pdf"
        class="block w-full text-sm text-muted-text file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-info file:text-info-text hover:file:brightness-90"
        v-on:change="onFileChange"
      />
    </div>

    <!-- Step 2: Account matching (only shown when no auto-match) -->
    <div v-if="step === 'match'">
      <p class="text-sm text-muted-text mb-2">
        <!-- prettier-ignore -->
        <template v-if="matchingAccountIds.length > 1">
          Multiple accounts match account number ending in <strong>{{ parsedLast4 }}</strong>.
        </template>
        <!-- prettier-ignore -->
        <template v-else-if="parsedLast4">
          No account found matching account number ending in <strong>{{ parsedLast4 }}</strong>.
        </template>
        <template v-else> Could not detect an account number in the statement. </template>
      </p>
      <p class="text-sm text-muted-text mb-4">
        <template v-if="matchingAccountIds.length > 1"> Please select the correct one. </template>
        <template v-else> Please select an existing account or create a new one. </template>
      </p>

      <div class="space-y-4">
        <!-- Account combobox -->
        <div>
          <Combobox
            v-model="selectedAccount"
            as="div"
            class="relative"
            v-on:update:model-value="createNewAccount = false"
          >
            <div class="relative">
              <ComboboxInput
                v-bind:display-value="displayAccount"
                placeholder="Search accounts..."
                class="w-full px-3 py-2 pr-8 text-sm border border-surface-border-strong rounded-md bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                v-on:change="accountQuery = $event.target.value"
                v-on:focus="$refs.comboboxButton.$el.click()"
              />
              <ComboboxButton
                ref="comboboxButton"
                class="absolute inset-y-0 right-0 flex items-center pr-2"
              >
                <ChevronUpDownIcon class="w-4 h-4 text-placeholder-text" />
              </ComboboxButton>
            </div>
            <ComboboxOptions
              class="absolute z-10 mt-1 w-full max-h-60 overflow-auto bg-surface border border-surface-border rounded-lg shadow-lg focus:outline-none"
            >
              <div v-if="sortedAccounts.length === 0" class="px-3 py-2 text-sm text-muted-text">
                No accounts found
              </div>
              <ComboboxOption
                v-for="acct in sortedAccounts"
                v-bind:key="acct.id"
                v-slot:default="{ active, selected }"
                v-bind:value="acct"
              >
                <div
                  v-bind:class="[
                    'flex items-center justify-between px-3 py-2 text-sm cursor-pointer',
                    active ? 'bg-surface-recessed-deep' : '',
                    selected ? 'text-blue-600 font-medium' : 'text-secondary-text',
                  ]"
                >
                  <span class="flex items-center gap-2">
                    {{ acct.last4 ? `${acct.name} (****${acct.last4})` : acct.name }}
                    <!-- prettier-ignore -->
                    <span v-if="matchingAccountIds.includes(acct.id)" class="text-xs bg-info text-info-text px-1.5 py-0.5 rounded">Matches</span>
                  </span>
                  <CheckIcon v-if="selected" class="w-4 h-4 flex-shrink-0" />
                </div>
              </ComboboxOption>
            </ComboboxOptions>
          </Combobox>
        </div>

        <!-- Create new account option -->
        <label class="flex items-start gap-3 cursor-pointer">
          <input
            v-model="createNewAccount"
            type="checkbox"
            class="rounded border-surface-border-strong text-blue-600 mt-0.5"
            v-on:change="createNewAccount ? (selectedAccount = null) : null"
          />
          <div class="flex-1">
            <div class="text-sm font-medium text-secondary-text">Create new account instead</div>
            <input
              v-if="createNewAccount"
              v-model="newAccountName"
              type="text"
              placeholder="Account name (e.g., Fidelity 401k)"
              class="mt-2 w-full px-3 py-2 text-sm border border-surface-border-strong rounded-md bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </label>
      </div>
    </div>

    <!-- Step 3: Preview -->
    <div v-if="step === 'preview'">
      <p class="text-sm text-muted-text mb-2">
        <template v-if="resolvedAccount">
          <!-- prettier-ignore -->
          <template v-if="matchingAccountIds.length === 1">
            Auto-matched to <strong>{{ resolvedAccount.name }}</strong><template v-if="resolvedAccount.last4 || parsedLast4"> (****{{ resolvedAccount.last4 || parsedLast4 }})</template>.
            <button
              class="text-blue-600 hover:text-blue-800 underline"
              v-on:click="rejectAutoMatch"
            >
              Not the right account?
            </button>
          </template>
          <!-- prettier-ignore -->
          <template v-else>
            Uploading to <strong>{{ resolvedAccount.name }}</strong><template v-if="resolvedAccount.last4 || parsedLast4"> (****{{ resolvedAccount.last4 || parsedLast4 }})</template>.
          </template>
        </template>
      </p>
      <p class="text-sm text-muted-text mb-4">
        Review the parsed holdings below. Holdings without a ticker need an asset chosen (or leave
        blank to create a new one).
      </p>

      <div
        v-if="duplicateAssetIds.length > 0"
        class="mb-4 p-3 bg-error text-error-text rounded-md text-sm"
      >
        Two holdings resolve to the same asset. Remove or remap one before saving.
      </div>

      <!-- As of date -->
      <div class="mb-4">
        <label class="block text-sm font-medium text-secondary-text mb-1"> As Of </label>
        <input
          v-model="effectiveDate"
          type="date"
          class="px-3 py-2 border border-surface-border-strong rounded-md bg-surface text-primary-text focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <!-- Holdings table -->
      <div
        class="border border-surface-border-strong rounded-md max-h-80 overflow-x-auto overflow-y-auto"
      >
        <table class="min-w-full divide-y divide-surface-border">
          <thead class="bg-surface-recessed sticky top-0">
            <tr>
              <th
                class="px-4 py-2 text-left text-xs font-medium text-muted-text uppercase whitespace-nowrap"
              >
                Name
              </th>
              <th
                class="px-4 py-2 text-right text-xs font-medium text-muted-text uppercase whitespace-nowrap"
              >
                Qty
              </th>
              <th
                class="px-4 py-2 text-right text-xs font-medium text-muted-text uppercase whitespace-nowrap"
              >
                Value
              </th>
              <th
                class="px-4 py-2 text-right text-xs font-medium text-muted-text uppercase whitespace-nowrap"
              >
                Price
              </th>
              <th class="px-4 py-2 text-right text-xs font-medium text-muted-text uppercase"></th>
            </tr>
          </thead>
          <tbody class="bg-surface">
            <template v-for="(holding, index) in holdings" v-bind:key="index">
              <tr
                v-bind:class="
                  holding.kind === 'unresolved' && !holding.chosenAsset
                    ? ''
                    : 'border-b border-surface-border'
                "
              >
                <td class="px-4 py-2 text-sm whitespace-nowrap min-w-[16rem]">
                  <!-- Resolved: same chrome as the combobox, but disabled -->
                  <div v-if="holding.kind !== 'unresolved'" class="relative">
                    <input
                      type="text"
                      disabled
                      v-bind:value="holding.display"
                      class="w-full px-3 py-1.5 pr-8 text-sm border border-surface-border-strong rounded-md bg-surface-recessed text-secondary-text cursor-default"
                    />
                  </div>
                  <!-- Unresolved: pick an existing asset, or leave blank to create + alias -->
                  <Combobox
                    v-else
                    v-slot:default="{ open }"
                    v-model="holding.chosenAsset"
                    nullable
                    as="div"
                    class="relative"
                    v-on:update:model-value="onChosenAssetChange(holding)"
                  >
                    <div v-bind:ref="(el) => setComboboxAnchor(index, el)" class="relative">
                      <ComboboxInput
                        v-bind:display-value="
                          (asset) => (asset ? displayAsset(asset) : holding.name)
                        "
                        placeholder="Search assets…"
                        v-bind:class="[
                          'w-full px-3 py-1.5 pr-8 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500',
                          holding.chosenAsset
                            ? 'border border-surface-border-strong bg-surface text-primary-text'
                            : 'border border-dashed border-surface-border-strong bg-surface text-muted-text',
                        ]"
                        v-on:change="holding.assetQuery = $event.target.value"
                      />
                      <ComboboxButton class="absolute inset-y-0 right-0 flex items-center pr-2">
                        <ChevronUpDownIcon class="w-4 h-4 text-placeholder-text" />
                      </ComboboxButton>
                    </div>
                    <!-- Portal out of the table: overflow clips absolute dropdowns -->
                    <Teleport to="body">
                      <ComboboxOptions
                        v-bind:style="open ? comboboxDropdownStyle(index) : undefined"
                        class="fixed z-50 max-h-48 overflow-auto bg-surface border border-surface-border rounded-lg shadow-lg focus:outline-none"
                      >
                        <ComboboxOption v-slot:default="{ active, selected }" v-bind:value="null">
                          <div
                            v-bind:class="[
                              'flex items-center justify-between px-3 py-2 text-sm cursor-pointer',
                              active ? 'bg-surface-recessed-deep' : '',
                              selected ? 'text-blue-600 font-medium' : 'text-muted-text',
                            ]"
                          >
                            <span>Create new asset</span>
                            <CheckIcon v-if="selected" class="w-4 h-4 flex-shrink-0" />
                          </div>
                        </ComboboxOption>
                        <div
                          v-if="filteredAssetsFor(holding).length === 0"
                          class="px-3 py-2 text-sm text-muted-text"
                        >
                          No matching assets
                        </div>
                        <ComboboxOption
                          v-for="asset in filteredAssetsFor(holding)"
                          v-bind:key="asset.id"
                          v-slot:default="{ active, selected }"
                          v-bind:value="asset"
                        >
                          <div
                            v-bind:class="[
                              'flex items-center justify-between px-3 py-2 text-sm cursor-pointer',
                              active ? 'bg-surface-recessed-deep' : '',
                              selected ? 'text-blue-600 font-medium' : 'text-secondary-text',
                            ]"
                          >
                            <span>{{ displayAsset(asset) }}</span>
                            <CheckIcon v-if="selected" class="w-4 h-4 flex-shrink-0" />
                          </div>
                        </ComboboxOption>
                      </ComboboxOptions>
                    </Teleport>
                  </Combobox>
                </td>
                <td class="px-4 py-2 text-sm text-primary-text text-right whitespace-nowrap">
                  {{ formatNumber(holding.quantity) }}
                </td>
                <td class="px-4 py-2 text-sm text-primary-text text-right whitespace-nowrap">
                  {{ formatCurrency(holding.total_value) }}
                </td>
                <td class="px-4 py-2 text-sm text-primary-text text-right whitespace-nowrap">
                  {{ formatCurrency(computePrice(holding)) }}
                </td>
                <td class="px-4 py-2 text-right whitespace-nowrap">
                  <button
                    class="w-7 h-7 inline-flex items-center justify-center text-placeholder-text hover:text-error-text hover:bg-error rounded cursor-pointer"
                    title="Remove holding"
                    v-on:click="removeHolding(index)"
                  >
                    <TrashIcon class="w-4 h-4" />
                  </button>
                </td>
              </tr>
              <tr
                v-if="holding.kind === 'unresolved' && !holding.chosenAsset"
                class="border-b border-surface-border"
              >
                <td colspan="5" class="px-4 pt-0 pb-2">
                  <p class="pl-2 text-xs text-muted-text">
                    ↳ New asset — will be created when the statement is saved
                  </p>
                </td>
              </tr>
            </template>
            <tr v-if="holdings.length === 0">
              <td colspan="5" class="px-4 py-4 text-sm text-muted-text text-center">
                No holdings found
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Step 4: Saving -->
    <div v-if="step === 'saving'" class="text-center py-8">
      <p class="text-muted-text">Saving statement...</p>
    </div>

    <template v-if="step !== 'saving'" v-slot:secondary>
      <!-- Step 1: Upload -->
      <button
        v-if="step === 'upload'"
        class="px-4 py-2 text-secondary-text hover:text-primary-text"
        v-on:click="$emit('close')"
      >
        Cancel
      </button>
      <!-- Step 2: Account matching / Step 3: Preview -->
      <button
        v-else
        class="px-4 py-2 text-secondary-text hover:text-primary-text"
        v-on:click="step = 'upload'"
      >
        Back
      </button>
    </template>

    <template v-if="step !== 'saving'" v-slot:primary>
      <!-- Step 1: Upload -->
      <div v-if="step === 'upload'" class="inline-flex rounded-md">
        <button
          v-bind:disabled="!file || loading"
          class="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white rounded-l-md hover:bg-blue-700 disabled:opacity-50"
          v-on:click="parseFile"
        >
          {{ parseButtonText }}
        </button>
        <Menu as="div" class="relative flex">
          <MenuButton
            v-bind:disabled="!file || loading"
            class="px-2 bg-blue-600 text-white border-l border-blue-500 rounded-r-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            <ChevronUpIcon class="w-4 h-4" />
          </MenuButton>
          <MenuItems
            class="absolute right-0 bottom-full mb-1 w-48 bg-surface border border-surface-border rounded-md shadow-lg z-50 py-1"
          >
            <MenuItem v-slot:default="{ active }">
              <button
                v-bind:class="[
                  'w-full text-left px-4 py-2 text-sm',
                  active ? 'bg-surface-recessed-deep text-primary-text' : 'text-secondary-text',
                ]"
                v-on:click="parseMode = 'cloud'"
              >
                Parse with Cloud AI
              </button>
            </MenuItem>
            <MenuItem v-slot:default="{ active }">
              <button
                v-bind:class="[
                  'w-full text-left px-4 py-2 text-sm',
                  active ? 'bg-surface-recessed-deep text-primary-text' : 'text-secondary-text',
                ]"
                v-on:click="parseMode = 'local'"
              >
                Parse with Local LLM
              </button>
            </MenuItem>
          </MenuItems>
        </Menu>
      </div>
      <!-- Step 2: Account matching -->
      <button
        v-else-if="step === 'match'"
        v-bind:disabled="loading || (!selectedAccount && !createNewAccount)"
        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        v-on:click="confirmAccountSelection"
      >
        {{ loading ? 'Loading...' : 'Continue' }}
      </button>
      <!-- Step 3: Preview -->
      <button
        v-else-if="step === 'preview'"
        v-bind:disabled="!canSave"
        class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
        v-on:click="saveStatement"
      >
        Save Statement
      </button>
    </template>
  </BaseModal>
</template>
