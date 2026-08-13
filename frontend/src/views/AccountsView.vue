<script lang="ts">
import { defineComponent } from 'vue';
import AppLayout from '@/components/AppLayout.vue';
import PageHeader from '@/components/PageHeader.vue';
import AddAccountModal from '@/components/modals/AddAccountModal.vue';
import UploadStatementModal from '@/components/modals/UploadStatementModal.vue';
import OnboardingModal from '@/components/modals/OnboardingModal.vue';
import OnboardingContinueCard from '@/components/OnboardingContinueCard.vue';
import InstitutionIcon from '@/components/InstitutionIcon.vue';
import { supabase } from '@/lib/supabase';
import {
  listAccounts,
  listUpdates,
  listHoldingUpdatesWithContext,
  listPriceUpdatesWithContext,
  listAssetsWithAllocations,
  listAssetClasses,
  type Account,
  type AssetClass,
  type HoldingUpdateWithContext,
} from '@/lib/data';
import { getLatestPrices, getLatestHoldings, getValueByClass } from '@/lib/derived/derived';
import { getColorClasses } from '@/lib/tagColors';
import { relativeDate } from '@/lib/util/date';
import { accountIdToString, type AccountId } from '@/lib/data/accounts';
import { assetClassIdToString } from '@/lib/data/asset-classes';

export default defineComponent({
  name: 'AccountsView',
  components: {
    AppLayout,
    PageHeader,
    AddAccountModal,
    UploadStatementModal,
    OnboardingModal,
    OnboardingContinueCard,
    InstitutionIcon,
  },
  data(): {
    accounts: Account[];
    latestEffectiveByAccount: Map<AccountId, string>;
    assetClassesByAccount: Map<AccountId, AssetClass[]>;
    unclassifiedByAccount: Set<AccountId>;
    hasAnyStatements: boolean;
    loading: boolean;
    error: string | null;
    showAddAccountModal: boolean;
    showUploadStatementModal: boolean;
    showOnboardingModal: boolean;
    accountsCompleted: boolean;
  } {
    return {
      accounts: [],
      latestEffectiveByAccount: new Map(),
      assetClassesByAccount: new Map(),
      unclassifiedByAccount: new Set(),
      hasAnyStatements: false,
      loading: true,
      error: null,

      showAddAccountModal: false,
      showUploadStatementModal: false,

      // Onboarding state
      showOnboardingModal: false,
      accountsCompleted: false,
    };
  },
  computed: {
    filteredAccounts(): Account[] {
      return this.accounts.filter((account) => !account.is_archived);
    },
    showContinueCard(): boolean {
      // Show continue card if: has at least 1 account, has at least 1 statement, and not yet completed
      return this.accounts.length > 0 && this.hasAnyStatements && !this.accountsCompleted;
    },
  },
  async mounted() {
    // Check onboarding state
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      this.accountsCompleted = session.user.user_metadata?.accounts_completed ?? false;
      // Show onboarding modal if accounts not yet completed
      this.showOnboardingModal = !this.accountsCompleted;
    }
    await this.loadData();
  },
  methods: {
    async loadData() {
      this.loading = true;
      this.error = null;
      try {
        // Load all data in parallel
        const [accountsData, updatesData, holdingsData, pricesData, assetsData, assetClasses] =
          await Promise.all([
            listAccounts(),
            listUpdates(),
            listHoldingUpdatesWithContext('desc'),
            listPriceUpdatesWithContext('desc'),
            listAssetsWithAllocations(),
            listAssetClasses(),
          ]);

        // Track if any updates exist (for onboarding continue card)
        this.hasAnyStatements = updatesData.length > 0;

        // Build map of account_id -> most recent effective date
        // todo -- we want this more robust, ie only counts holdings, DOES count assets if
        // asset is held in the account?
        const latestEffectiveByAccount: Map<AccountId, string> = new Map();
        for (const update of updatesData) {
          if (update.account_id && !latestEffectiveByAccount.has(update.account_id)) {
            latestEffectiveByAccount.set(update.account_id, update.effective_date);
          }
        }

        const latestPriceByAsset = getLatestPrices(pricesData);
        const latestHoldingByAccountAsset = getLatestHoldings(holdingsData);

        // Calculate total exposure per account and group holdings by account.
        // Absolute values so the 10% tag threshold works for accounts with
        // both long and short positions.
        const accountValues: Map<AccountId, number> = new Map();
        const holdingsByAccount: Map<AccountId, HoldingUpdateWithContext[]> = new Map();
        for (const key in latestHoldingByAccountAsset) {
          const holding = latestHoldingByAccountAsset[key];
          if (!holding || holding.quantity === 0) continue;

          const value = holding.quantity * (latestPriceByAsset.get(holding.asset_id)?.price ?? 0);
          accountValues.set(
            holding.account_id,
            (accountValues.get(holding.account_id) || 0) + Math.abs(value),
          );

          let accountHoldings = holdingsByAccount.get(holding.account_id);
          if (!accountHoldings) {
            accountHoldings = [];
            holdingsByAccount.set(holding.account_id, accountHoldings);
          }
          accountHoldings.push(holding);
        }

        // Calculate asset classes per account
        const assetClassesByAccount: Map<AccountId, AssetClass[]> = new Map();
        const unclassifiedByAccount: Set<AccountId> = new Set();
        for (const [accountId, holdings] of holdingsByAccount) {
          const totalValue = accountValues.get(accountId) || 0;
          const { byClass, unclassified } = getValueByClass(
            holdings,
            latestPriceByAsset,
            assetsData,
          );

          // Filter out classes <10% of account exposure, sort by sort_order
          // Use Math.abs since class values can be negative (from short positions)
          const classes = assetClasses
            .filter((ac) => totalValue > 0 && Math.abs(byClass.get(ac.id) || 0) / totalValue >= 0.1)
            .sort((a, b) => a.sort_order - b.sort_order);

          assetClassesByAccount.set(accountId, classes);

          // Mark unclassified if >= 10% of account exposure
          if (totalValue > 0 && Math.abs(unclassified) / totalValue >= 0.1) {
            unclassifiedByAccount.add(accountId);
          }
        }

        this.accounts = accountsData;
        this.latestEffectiveByAccount = latestEffectiveByAccount;
        this.assetClassesByAccount = assetClassesByAccount;
        this.unclassifiedByAccount = unclassifiedByAccount;
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err);
      } finally {
        this.loading = false;
      }
    },

    async onAccountCreated() {
      this.showAddAccountModal = false;
      await this.loadData();
    },

    async onStatementUploaded() {
      this.showUploadStatementModal = false;
      await this.loadData();
    },

    relativeDate,
    accountIdToString,
    assetClassIdToString,

    latestEffectiveDate(accountId: AccountId): string | null {
      return this.latestEffectiveByAccount.get(accountId) ?? null;
    },

    accountAssetClasses(accountId: AccountId): AssetClass[] {
      return this.assetClassesByAccount.get(accountId) || [];
    },

    accountHasUnclassified(accountId: AccountId): boolean {
      return this.unclassifiedByAccount.has(accountId);
    },

    getClassColor(colorName: string) {
      return getColorClasses(colorName);
    },
  },
});
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <PageHeader
        title="Accounts"
        description="Create and manage accounts. Update holdings manually, or upload statements to be parsed automatically."
      >
        <template v-slot:actions>
          <button
            class="shrink-0 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            v-on:click="showUploadStatementModal = true"
          >
            Upload Statement
          </button>
        </template>
      </PageHeader>

      <!-- Error display -->
      <div v-if="error" class="p-4 bg-error text-error-text rounded-md">
        {{ error }}
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="text-muted-text">Loading...</div>

      <!-- Investment Accounts Section -->
      <section v-if="!loading" class="space-y-6">
        <!-- Card grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Account cards -->
          <router-link
            v-for="account in filteredAccounts"
            v-bind:key="accountIdToString(account.id)"
            v-bind:to="'/accounts/' + accountIdToString(account.id)"
            class="bg-surface rounded-lg shadow p-4 flex flex-col hover:shadow-md transition-shadow"
          >
            <div class="flex items-center justify-between gap-2">
              <h3 class="font-semibold text-primary-text min-w-0 truncate">{{ account.name }}</h3>
              <InstitutionIcon v-bind:name="account.institution" />
            </div>
            <!-- Asset class tags -->
            <div
              v-if="accountAssetClasses(account.id).length || accountHasUnclassified(account.id)"
              class="flex flex-wrap gap-1 mt-3"
            >
              <span
                v-for="ac in accountAssetClasses(account.id)"
                v-bind:key="assetClassIdToString(ac.id)"
                class="inline-block px-2 py-0.5 text-xs font-medium rounded"
                v-bind:class="[getClassColor(ac.color).bg, getClassColor(ac.color).text]"
              >
                {{ ac.name }}
              </span>
              <span
                v-if="accountHasUnclassified(account.id)"
                class="inline-block px-2 py-0.5 text-xs font-medium rounded"
                v-bind:class="[getClassColor('gray').bg, getClassColor('gray').text]"
              >
                Unclassified
              </span>
            </div>
            <!-- As of date -->
            <p class="mt-3 text-xs text-placeholder-text">
              <span v-if="latestEffectiveDate(account.id)">
                Current as of {{ relativeDate(latestEffectiveDate(account.id)) }}
              </span>
              <span v-else class="italic">No data yet</span>
            </p>
          </router-link>

          <!-- Add account card -->
          <button
            class="bg-page border-2 border-dashed border-page-border rounded-lg p-4 flex flex-col items-center justify-center text-muted-text hover:border-blue-400 hover:text-blue-600 transition-colors min-h-[100px]"
            v-on:click="showAddAccountModal = true"
          >
            <span class="text-3xl mb-2">+</span>
            <span class="text-sm font-medium">Add Account</span>
          </button>
        </div>

        <!-- Onboarding continue card -->
        <OnboardingContinueCard
          v-if="showContinueCard"
          step="accounts"
          message="You've added an account and uploaded a statement. Now let's categorize your assets!"
          next-step-label="Continue to Assets"
          next-route="/assets"
        />
      </section>
    </div>

    <!-- Modals -->
    <AddAccountModal
      v-if="showAddAccountModal"
      v-on:close="showAddAccountModal = false"
      v-on:created="onAccountCreated"
    />

    <UploadStatementModal
      v-if="showUploadStatementModal"
      v-on:close="showUploadStatementModal = false"
      v-on:uploaded="onStatementUploaded"
    />

    <!-- Onboarding modal -->
    <OnboardingModal
      v-if="showOnboardingModal"
      title="Add Your Investment Accounts"
      v-bind:step-number="2"
      v-on:close="showOnboardingModal = false"
    >
      <div class="space-y-4 text-muted-text">
        <p>Now let's add your <strong>investment accounts</strong>.</p>
        <p>
          Create at least one account (for example "401k" or "Brokerage") and upload a statement to
          import your holdings.
        </p>
        <p>
          The statement will be automatically parsed to extract your assets and their current
          values.
        </p>
      </div>
    </OnboardingModal>
  </AppLayout>
</template>
