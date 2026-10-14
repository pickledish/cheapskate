/**
 * Seed demo users and portfolio data for local / hosted Supabase.
 *
 * Alex & Jordan story (~12 months):
 *   1. Start badly allocated: almost everything in VTSAX/VTI + cash
 *      (Jordan's 403(b) still has a leftover target-date fund)
 *   2. Use Cheapskate to steer new contributions — and one 401(k) reallocation —
 *      toward international and bonds. They never quite reach 60/20/20.
 *   3. Buy a home (cash → equity plus closing-cost dip; house value wobbles)
 *   4. Roll Alex's old 401(k) into Fidelity toward the remaining gap
 *   5. MegaCorp RSUs vest, then come off lockup and enter the portfolio
 *      (US overweight; intl & bonds ~2/3 of their 20% targets)
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> npm run seed:local
 *   SUPABASE_SERVICE_ROLE_KEY=<key> npm run seed:cloud
 *   SUPABASE_SERVICE_ROLE_KEY=<key> npm run seed:local -- --skip-creation
 *   SUPABASE_SERVICE_ROLE_KEY=<key> npm run seed:local -- --skip-cleanup
 *   SUPABASE_SERVICE_ROLE_KEY=<key> npm run seed:local -- --create-newbie
 */
import { createClient, type User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  insertFamily,
  insertProfile,
  insertAssetClass,
  insertAsset,
  insertAssetAllocation,
  insertAccount,
  insertAssetAlias,
  insertUpdate,
  insertPriceUpdate,
  insertHoldingUpdate,
  updateAccount,
  DEMO_FAMILY_ID,
  DEMO_EMAIL,
  DEMO_PASSWORD,
  type Account,
} from '@/lib/data';
import type { AssetId } from '@/lib/data/assets';
import type { AssetClassId } from '@/lib/data/asset-classes';
import { lastNMonths, monthEnd } from '@/lib/util/date';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FAMILY_ID = DEMO_FAMILY_ID;
const PASSWORD = DEMO_PASSWORD;

const ALEX_EMAIL = DEMO_EMAIL;
const JORDAN_EMAIL = 'jordan@skate.cheap';
const NEWBIE_EMAIL = 'newbie@skate.cheap';
const DEMO_EMAILS = [ALEX_EMAIL, JORDAN_EMAIL, NEWBIE_EMAIL] as const;

const FLAGS = ['--skip-cleanup', '--skip-creation', '--create-newbie'] as const;

type AssetKey =
  | 'VTI'
  | 'VXUS'
  | 'BND'
  | 'VTSAX'
  | 'VTIAX'
  | 'VBTLX'
  | 'VTHRX'
  | 'STABLE'
  | 'CASH'
  | 'HOME'
  | 'DEBT'
  | 'MEGA';

type ClassKey = 'us' | 'intl' | 'bond' | 'cash' | 're' | 'debt';

const N_MONTHS = 12;

const RETURNS = {
  us: [0.018, -0.092, 0.041, 0.015, -0.031, 0.067, 0.008, -0.054, 0.038, 0.022, -0.011, 0.045],
  intl: [0.012, -0.078, 0.028, 0.008, -0.022, 0.048, 0.014, -0.041, 0.031, 0.009, 0.016, 0.027],
  bond: [0.004, 0.018, -0.006, 0.005, 0.002, -0.008, 0.003, 0.012, -0.004, 0.003, 0.001, 0.004],
} as const;

/** MegaCorp is a single name: bigger swings than the US index. */
const MEGA_RETURNS = [
  0.042, -0.155, 0.088, -0.028, 0.015, 0.112, -0.048, -0.095, 0.061, 0.033, 0.148, -0.037,
] as const;

/** Demo house purchase: wobbling property value + amortizing $DEBT mortgage. */
const HOME_VALUE = 450_000;
const DOWN_PAYMENT = 90_000; // 20%
const CLOSING_COSTS = 12_000;
const FROM_EMERGENCY = 70_000;
const FROM_JOINT = DOWN_PAYMENT - FROM_EMERGENCY + CLOSING_COSTS; // 32_000
const MORTGAGE_START = HOME_VALUE - DOWN_PAYMENT; // 360_000
const MORTGAGE_PAYDOWN_PER_MONTH = 1_500;

/** 0-based indexes into lastNMonths(N_MONTHS). */
const BUY_MONTH = 6;
const REALLOC_MONTH = 3; // Alex 401(k): VTSAX → VTIAX
const BONUS_MONTH = 8; // emergency-fund lump (out of portfolio)
const DEPLOY_MONTH = 8; // leftover joint cash → VXUS / BND
const SKIP_ROTH_MONTH = 9; // vacation; skip IRA contributions
const VEST_MONTH = 10; // MegaCorp RSU vest
const CLOSE_MONTH = 10; // roll old 401(k) into Fidelity

/** Property value by month. Unused before BUY_MONTH; then dips and recovers. */
const HOME_PRICES = [
  HOME_VALUE,
  HOME_VALUE,
  HOME_VALUE,
  HOME_VALUE,
  HOME_VALUE,
  HOME_VALUE,
  HOME_VALUE,
  438_000,
  440_000,
  439_000,
  452_000,
  458_000,
] as const;

const BASE_PRICES: Record<AssetKey, number> = {
  VTI: 250,
  VXUS: 62,
  BND: 73,
  VTSAX: 112,
  VTIAX: 34,
  VBTLX: 9.6,
  VTHRX: 42,
  STABLE: 10,
  CASH: 1,
  HOME: HOME_VALUE,
  DEBT: -1, // $DEBT: qty = principal owed → value = -principal
  MEGA: 96,
};

const ASSET_CLASS_MAP: Record<AssetKey, ClassKey> = {
  VTI: 'us',
  VXUS: 'intl',
  BND: 'bond',
  VTSAX: 'us',
  VTIAX: 'intl',
  VBTLX: 'bond',
  VTHRX: 'us', // multi-class handled separately for allocations; returns use a 40/20/40 blend
  STABLE: 'bond',
  CASH: 'cash',
  HOME: 're',
  DEBT: 'debt',
  MEGA: 'us',
};

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

function parseFlags(): { doCleanup: boolean; doCreation: boolean; createNewbie: boolean } {
  const args = process.argv.slice(2);
  const unknown = args.filter((a) => !FLAGS.includes(a as (typeof FLAGS)[number]));
  if (unknown.length > 0) {
    console.error(
      `Unknown argument(s): ${unknown.join(', ')}\nUsage: vite-node scripts/seed-demo.ts [${FLAGS.join('] [')}]`,
    );
    process.exit(1);
  }
  return {
    doCleanup: !args.includes('--skip-cleanup'),
    doCreation: !args.includes('--skip-creation'),
    createNewbie: args.includes('--create-newbie'),
  };
}

// ---------------------------------------------------------------------------
// Admin client + session helper
// ---------------------------------------------------------------------------

function requireServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required. Locally, use the service_role key from `supabase status`.',
    );
  }
  return key;
}

function createAdminClient() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url)
    throw new Error('VITE_SUPABASE_URL is missing (expected from frontend/.env via vite-node)');
  return createClient(url, requireServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function asUser<T>(email: string, fn: () => Promise<T>): Promise<T> {
  const { error } = await supabase.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  try {
    return await fn();
  } finally {
    await supabase.auth.signOut();
  }
}

function uploadedAt(effectiveDate: string): string {
  // Use the statement's own calendar day so HistoryView's created_at month
  // paging matches the effective month (month-end + N days would spill over).
  return `${effectiveDate}T17:00:00.000Z`;
}

// ---------------------------------------------------------------------------
// Price / quantity model
// ---------------------------------------------------------------------------

function buildPrices(nMonths: number): Record<AssetKey, number[]> {
  const prices = {} as Record<AssetKey, number[]>;

  for (const key of Object.keys(BASE_PRICES) as AssetKey[]) {
    prices[key] = [];
    for (let i = 0; i < nMonths; i++) {
      if (key === 'CASH') {
        prices[key].push(1);
        continue;
      }
      if (key === 'DEBT') {
        prices[key].push(-1);
        continue;
      }
      if (key === 'HOME') {
        prices[key].push(HOME_PRICES[i] ?? HOME_VALUE);
        continue;
      }
      if (key === 'MEGA') {
        let p = BASE_PRICES.MEGA;
        for (let j = 0; j <= i; j++) p *= 1 + MEGA_RETURNS[j]!;
        prices[key].push(p);
        continue;
      }
      if (key === 'STABLE') {
        // Stable value: small bond-like drift
        let p = BASE_PRICES.STABLE;
        for (let j = 0; j <= i; j++) p *= 1 + RETURNS.bond[j]!;
        prices[key].push(p);
        continue;
      }
      if (key === 'VTHRX') {
        // Blended target-date returns (rough 40/20/40)
        let p = BASE_PRICES.VTHRX;
        for (let j = 0; j <= i; j++) {
          const r = 0.4 * RETURNS.us[j]! + 0.2 * RETURNS.intl[j]! + 0.4 * RETURNS.bond[j]!;
          p *= 1 + r;
        }
        prices[key].push(p);
        continue;
      }

      const cls = ASSET_CLASS_MAP[key];
      const series = cls === 'us' ? RETURNS.us : cls === 'intl' ? RETURNS.intl : RETURNS.bond;
      let p = BASE_PRICES[key];
      for (let j = 0; j <= i; j++) p *= 1 + series[j]!;
      prices[key].push(p);
    }
  }

  return prices;
}

function qtyPath(
  startQty: number,
  prices: number[],
  dollarsAt: (monthIndex: number) => number,
  extraQtyAt: (monthIndex: number) => number = () => 0,
): number[] {
  const qtys: number[] = [];
  let qty = startQty;
  for (let i = 0; i < prices.length; i++) {
    if (i > 0) {
      qty += dollarsAt(i) / prices[i]! + extraQtyAt(i);
    }
    qtys.push(qty);
  }
  return qtys;
}

function aroundHouse(monthIndex: number): boolean {
  return monthIndex === BUY_MONTH || monthIndex === BUY_MONTH + 1;
}

function skipRoth(monthIndex: number): boolean {
  return aroundHouse(monthIndex) || monthIndex === SKIP_ROTH_MONTH;
}

/**
 * Emergency savings: pile up a down payment, cliff at closing, bonus later, then drip back.
 * Closing costs come from joint cash, not here.
 */
function emergencyCashQtys(nMonths: number): number[] {
  const qtys: number[] = [];
  let bal = 60_000;
  for (let i = 0; i < nMonths; i++) {
    if (i > 0 && i < BUY_MONTH) bal += 8_000;
    if (i === BUY_MONTH) bal -= FROM_EMERGENCY;
    if (i === BONUS_MONTH) bal += 12_000;
    if (i > BUY_MONTH && i !== BONUS_MONTH) bal += 700;
    qtys.push(bal);
  }
  return qtys;
}

/** Joint brokerage cash: the rest of the down payment + closing, then deploy leftovers. */
function jointCashQtys(nMonths: number): number[] {
  const qtys: number[] = [];
  let bal = 32_000;
  for (let i = 0; i < nMonths; i++) {
    if (i > 0 && i < BUY_MONTH) bal += 3_500;
    if (i === BUY_MONTH) bal -= FROM_JOINT;
    if (i === DEPLOY_MONTH) bal -= 8_000;
    if (i > BUY_MONTH && i !== DEPLOY_MONTH && !aroundHouse(i)) bal += 200;
    qtys.push(bal);
  }
  return qtys;
}

/** Mortgage principal ($DEBT qty). Zero before BUY_MONTH; unused until residence holdings start. */
function mortgagePrincipalQtys(nMonths: number): number[] {
  const qtys: number[] = [];
  let principal = MORTGAGE_START;
  for (let i = 0; i < nMonths; i++) {
    if (i < BUY_MONTH) {
      qtys.push(0);
      continue;
    }
    if (i > BUY_MONTH) principal -= MORTGAGE_PAYDOWN_PER_MONTH;
    qtys.push(principal);
  }
  return qtys;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

async function listAllUsers(admin: ReturnType<typeof createAdminClient>): Promise<User[]> {
  const users: User[] = [];
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < perPage) break;
    page += 1;
  }
  return users;
}

async function cleanup(admin: ReturnType<typeof createAdminClient>): Promise<void> {
  console.log('Cleaning up demo users...');
  const users = await listAllUsers(admin);
  const demoUsers = users.filter(
    (u) => u.email && DEMO_EMAILS.includes(u.email as (typeof DEMO_EMAILS)[number]),
  );

  for (const user of demoUsers) {
    console.log(`  Deleting user ${user.email} (${user.id})`);
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
  }

  // Family rows are removed by cleanup_empty_family() when the last profile
  // cascades away. No explicit families.delete — if that trigger breaks, the
  // next create (insertFamily with the fixed FAMILY_ID) should fail loudly.
  if (demoUsers.length === 0) {
    console.log('  No demo users found');
  }
}

// ---------------------------------------------------------------------------
// Create users
// ---------------------------------------------------------------------------

async function createDemoUsers(
  admin: ReturnType<typeof createAdminClient>,
  createNewbie: boolean,
): Promise<{ alex: User; jordan: User }> {
  console.log('Creating demo auth users...');

  const onboardingMeta = {
    family_id: FAMILY_ID,
    goals_completed: true,
    accounts_completed: true,
    assets_completed: true,
  };

  const { data: alexData, error: alexErr } = await admin.auth.admin.createUser({
    email: ALEX_EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'Alex Sample', ...onboardingMeta },
  });
  if (alexErr) throw alexErr;

  const { data: jordanData, error: jordanErr } = await admin.auth.admin.createUser({
    email: JORDAN_EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'Jordan Sample', ...onboardingMeta },
  });
  if (jordanErr) throw jordanErr;

  console.log(`  Alex:   ${alexData.user.id}`);
  console.log(`  Jordan: ${jordanData.user.id}`);

  if (createNewbie) {
    const { data: newbieData, error: newbieErr } = await admin.auth.admin.createUser({
      email: NEWBIE_EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: {},
    });
    if (newbieErr) throw newbieErr;
    console.log(`  Newbie: ${newbieData.user.id}`);
  }

  return { alex: alexData.user, jordan: jordanData.user };
}

/** Set after seeding: the script writes as these users, so the flag cannot go on createUser. */
async function lockReadOnlyUsers(
  admin: ReturnType<typeof createAdminClient>,
  users: User[],
): Promise<void> {
  console.log('Marking demo family users as read-only...');
  for (const user of users) {
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { read_only: true },
    });
    if (error) throw error;
    console.log(`  ${user.email}`);
  }
}

// ---------------------------------------------------------------------------
// Static data + history
// ---------------------------------------------------------------------------

interface AlexAccounts {
  alex401k: Account;
  alexRoth: Account;
  alexOld401k: Account;
  alexMegaStock: Account;
}

interface JordanAccounts {
  jordan403b: Account;
  jordanRoth: Account;
  jointBrokerage: Account;
  emergency: Account;
  residence: Account;
}

async function seedStaticAsAlex(
  alexId: string,
): Promise<{ assets: Record<AssetKey, AssetId>; alexAccounts: AlexAccounts }> {
  console.log('Seeding family, goals, assets, Alex accounts...');

  await insertFamily(FAMILY_ID);
  await insertProfile({ id: alexId, family_id: FAMILY_ID, name: 'Alex Sample' });

  const us = await insertAssetClass({
    name: 'US Stocks',
    color: 'blue',
    goal: 0.6,
    sort_order: 0,
    created_by: alexId,
    family_id: FAMILY_ID,
  });
  const intl = await insertAssetClass({
    name: "Int'l Stocks",
    color: 'teal',
    goal: 0.2,
    sort_order: 1,
    created_by: alexId,
    family_id: FAMILY_ID,
  });
  const bond = await insertAssetClass({
    name: 'Bonds',
    color: 'amber',
    goal: 0.2,
    sort_order: 2,
    created_by: alexId,
    family_id: FAMILY_ID,
  });
  const cash = await insertAssetClass({
    name: 'Cash',
    color: 'green',
    goal: 0,
    sort_order: 3,
    created_by: alexId,
    family_id: FAMILY_ID,
  });
  const re = await insertAssetClass({
    name: 'Real Estate',
    color: 'purple',
    goal: 0,
    sort_order: 4,
    created_by: alexId,
    family_id: FAMILY_ID,
  });
  const debt = await insertAssetClass({
    name: 'Debt',
    color: 'red',
    goal: 0,
    sort_order: 5,
    created_by: alexId,
    family_id: FAMILY_ID,
  });

  const classes: Record<ClassKey, AssetClassId> = {
    us: us.id,
    intl: intl.id,
    bond: bond.id,
    cash: cash.id,
    re: re.id,
    debt: debt.id,
  };

  async function makeAsset(
    ticker: string | null,
    name: string,
    allocations: { classKey: ClassKey; pct: number }[],
  ): Promise<AssetId> {
    const asset = await insertAsset({
      ticker,
      name,
      created_by: alexId,
      family_id: FAMILY_ID,
    });
    for (const a of allocations) {
      await insertAssetAllocation({
        asset_id: asset.id,
        asset_class_id: classes[a.classKey],
        percentage: a.pct,
      });
    }
    return asset.id;
  }

  const assets: Record<AssetKey, AssetId> = {
    VTI: await makeAsset('VTI', 'Vanguard Total Stock Market ETF', [{ classKey: 'us', pct: 1 }]),
    VXUS: await makeAsset('VXUS', 'Vanguard Total International Stock ETF', [
      { classKey: 'intl', pct: 1 },
    ]),
    BND: await makeAsset('BND', 'Vanguard Total Bond Market ETF', [{ classKey: 'bond', pct: 1 }]),
    VTSAX: await makeAsset('VTSAX', 'Vanguard Total Stock Market Admiral', [
      { classKey: 'us', pct: 1 },
    ]),
    VTIAX: await makeAsset('VTIAX', 'Vanguard Total Intl Stock Admiral', [
      { classKey: 'intl', pct: 1 },
    ]),
    VBTLX: await makeAsset('VBTLX', 'Vanguard Total Bond Admiral', [{ classKey: 'bond', pct: 1 }]),
    VTHRX: await makeAsset('VTHRX', 'Vanguard Target Retirement 2030', [
      { classKey: 'us', pct: 0.4 },
      { classKey: 'intl', pct: 0.2 },
      { classKey: 'bond', pct: 0.4 },
    ]),
    STABLE: await makeAsset(null, 'Stable Value Fund', [{ classKey: 'bond', pct: 1 }]),
    CASH: await makeAsset(null, 'Cash', [{ classKey: 'cash', pct: 1 }]),
    HOME: await makeAsset(null, 'Primary residence (property)', [{ classKey: 're', pct: 1 }]),
    DEBT: await makeAsset('$DEBT', 'Mortgage', [{ classKey: 'debt', pct: 1 }]),
    MEGA: await makeAsset(null, 'MegaCorp Common Stock', [{ classKey: 'us', pct: 1 }]),
  };

  const alex401k = await insertAccount({
    name: 'Alex 401(k)',
    in_portfolio: true,
    created_by: alexId,
    family_id: FAMILY_ID,
    last4: '4021',
    institution: 'Fidelity',
  });
  const alexRoth = await insertAccount({
    name: 'Alex Roth IRA',
    in_portfolio: true,
    created_by: alexId,
    family_id: FAMILY_ID,
    last4: '8830',
    institution: 'Vanguard',
  });
  const alexOld401k = await insertAccount({
    name: 'Alex Old 401(k)',
    in_portfolio: true,
    created_by: alexId,
    family_id: FAMILY_ID,
    last4: '1177',
    institution: 'MegaCorp',
  });
  const alexMegaStock = await insertAccount({
    name: 'Alex MegaCorp Stock Plan',
    in_portfolio: false,
    created_by: alexId,
    family_id: FAMILY_ID,
    last4: '2294',
    institution: 'MegaCorp',
  });

  await insertAssetAlias({
    account_id: alex401k.id,
    label: 'VANG TOT STK MKT IDX ADM',
    asset_id: assets.VTSAX,
  });
  await insertAssetAlias({
    account_id: alex401k.id,
    label: 'VANG TOT INTL STK IDX ADM',
    asset_id: assets.VTIAX,
  });
  await insertAssetAlias({
    account_id: alex401k.id,
    label: 'STABLE VALUE FUND',
    asset_id: assets.STABLE,
  });

  return {
    assets,
    alexAccounts: { alex401k, alexRoth, alexOld401k, alexMegaStock },
  };
}

async function seedJordanAccounts(jordanId: string): Promise<JordanAccounts> {
  console.log('Seeding Jordan profile and accounts...');

  await insertProfile({ id: jordanId, family_id: FAMILY_ID, name: 'Jordan Sample' });

  const jordan403b = await insertAccount({
    name: 'Jordan 403(b)',
    in_portfolio: true,
    created_by: jordanId,
    family_id: FAMILY_ID,
    last4: '5510',
    institution: 'TIAA',
  });
  const jordanRoth = await insertAccount({
    name: 'Jordan Roth IRA',
    in_portfolio: true,
    created_by: jordanId,
    family_id: FAMILY_ID,
    last4: '6621',
    institution: 'Fidelity',
  });
  const jointBrokerage = await insertAccount({
    name: 'Joint Taxable Brokerage',
    in_portfolio: true,
    created_by: jordanId,
    family_id: FAMILY_ID,
    last4: '3388',
    institution: 'Schwab',
  });
  const emergency = await insertAccount({
    name: 'Emergency Savings',
    in_portfolio: false,
    created_by: jordanId,
    family_id: FAMILY_ID,
    last4: '7712',
    institution: 'Ally',
  });
  const residence = await insertAccount({
    name: 'Primary Residence',
    in_portfolio: false,
    created_by: jordanId,
    family_id: FAMILY_ID,
    last4: null,
  });

  return { jordan403b, jordanRoth, jointBrokerage, emergency, residence };
}

async function seedStatement(
  account: Account,
  userId: string,
  effectiveDate: string,
  holdings: { assetId: AssetId; assetKey: AssetKey; qty: number }[],
  prices: Record<AssetKey, number[]>,
  monthIndex: number,
): Promise<void> {
  const held = holdings.filter((h) => h.qty > 0);
  if (held.length === 0) return;

  const update = await insertUpdate({
    family_id: FAMILY_ID,
    account_id: account.id,
    update_type: 'statement',
    effective_date: effectiveDate,
    created_by: userId,
    created_at: uploadedAt(effectiveDate),
  });
  for (const h of held) {
    await insertPriceUpdate({
      update_id: update.id,
      asset_id: h.assetId,
      price: prices[h.assetKey][monthIndex]!,
    });
    await insertHoldingUpdate({
      update_id: update.id,
      asset_id: h.assetId,
      quantity: h.qty,
    });
  }
}

async function seedManualHoldings(
  account: Account,
  userId: string,
  effectiveDate: string,
  holdings: { assetId: AssetId; qty: number }[],
): Promise<void> {
  const update = await insertUpdate({
    family_id: FAMILY_ID,
    account_id: account.id,
    update_type: 'manual_holdings',
    effective_date: effectiveDate,
    created_by: userId,
    created_at: uploadedAt(effectiveDate),
  });
  for (const h of holdings) {
    await insertHoldingUpdate({
      update_id: update.id,
      asset_id: h.assetId,
      quantity: h.qty,
    });
  }
}

async function seedManualPrice(
  userId: string,
  effectiveDate: string,
  assetId: AssetId,
  price: number,
): Promise<void> {
  const update = await insertUpdate({
    family_id: FAMILY_ID,
    account_id: null,
    update_type: 'manual_price',
    effective_date: effectiveDate,
    created_by: userId,
    created_at: uploadedAt(effectiveDate),
  });
  await insertPriceUpdate({ update_id: update.id, asset_id: assetId, price });
}

async function seedIncludeInPortfolio(
  account: Account,
  userId: string,
  effectiveDate: string,
): Promise<void> {
  await insertUpdate({
    family_id: FAMILY_ID,
    account_id: account.id,
    update_type: 'include_in_portfolio',
    effective_date: effectiveDate,
    created_by: userId,
    created_at: uploadedAt(effectiveDate),
  });
  await updateAccount(account.id, { in_portfolio: true });
}

async function seedHistory(
  alexId: string,
  jordanId: string,
  assets: Record<AssetKey, AssetId>,
  accounts: AlexAccounts & JordanAccounts,
): Promise<void> {
  console.log(`Seeding ~${N_MONTHS} months of portfolio history...`);
  console.log(
    `  Story: VTSAX+cash start → cheapskate rebalance → house at month ${BUY_MONTH} → old 401(k) rollover → MegaCorp lockup ends`,
  );

  const months = lastNMonths(N_MONTHS).map(monthEnd);
  const n = months.length;
  const prices = buildPrices(n);
  const liquidMonth = n - 1;

  const reallocDollars = 10_000;

  // Alex 401(k): start 100% VTSAX; after looking at Cheapskate, new money + one reallocation go to intl/bonds
  const alex401kVtsax = qtyPath(
    620,
    prices.VTSAX,
    (i) => (i <= 2 ? 1_400 : 500),
    (i) => (i === REALLOC_MONTH ? -reallocDollars / prices.VTSAX[i]! : 0),
  );
  const alex401kVtiax = qtyPath(
    0,
    prices.VTIAX,
    (i) => (i <= 2 ? 0 : 450),
    (i) => (i === REALLOC_MONTH ? reallocDollars / prices.VTIAX[i]! : 0),
  );
  const alex401kStable = qtyPath(0, prices.STABLE, (i) => (i <= 2 ? 0 : 300));

  // Roths: US first, then 100% international once they see the underweight
  const alexRothVti = qtyPath(48, prices.VTI, (i) => (skipRoth(i) ? 0 : i <= 2 ? 500 : 0));
  const alexRothVxus = qtyPath(0, prices.VXUS, (i) => (skipRoth(i) ? 0 : i <= 2 ? 0 : 350));

  // Old MegaCorp 401(k): leftover VTSAX, rolled into Fidelity toward the remaining gap
  const old401kVtsax = Array.from({ length: n }, () => 200);
  const megaQty = Array.from({ length: n }, (_, i) => (i >= VEST_MONTH ? 480 : 400));

  // Jordan 403(b): target-date stays for the whole window; VTSAX leftover + later VBTLX
  const jordan403bVthrx = qtyPath(720, prices.VTHRX, () => 800);
  const jordan403bVtsax = qtyPath(200, prices.VTSAX, (i) => (i <= 2 ? 250 : 0));
  const jordan403bVbtlx = qtyPath(0, prices.VBTLX, (i) => (i <= 2 ? 0 : 200));

  const jordanRothVti = qtyPath(32, prices.VTI, (i) => (skipRoth(i) ? 0 : i <= 2 ? 400 : 0));
  const jordanRothVxus = qtyPath(0, prices.VXUS, (i) => (skipRoth(i) ? 0 : i <= 2 ? 0 : 250));

  const jointVti = qtyPath(80, prices.VTI, (i) => (aroundHouse(i) ? 0 : i <= 3 ? 400 : 0));
  const jointVxus = qtyPath(
    0,
    prices.VXUS,
    (i) => (aroundHouse(i) ? 0 : i <= 3 ? 0 : 250),
    (i) => (i === DEPLOY_MONTH ? 4_000 / prices.VXUS[i]! : 0),
  );
  const jointBnd = qtyPath(
    0,
    prices.BND,
    (i) => (aroundHouse(i) ? 0 : i <= 3 ? 0 : 350),
    (i) => (i === DEPLOY_MONTH ? 4_000 / prices.BND[i]! : 0),
  );
  const jointCash = jointCashQtys(n);
  const emergencyQtys = emergencyCashQtys(n);
  const mortgageQtys = mortgagePrincipalQtys(n);

  // Rollover: old 401(k) VTSAX → 30% VTIAX / 50% STABLE / 20% VTSAX
  const rolloverValue = 200 * prices.VTSAX[CLOSE_MONTH]!;
  const rolloverVtiaxQty = (rolloverValue * 0.3) / prices.VTIAX[CLOSE_MONTH]!;
  const rolloverStableQty = (rolloverValue * 0.5) / prices.STABLE[CLOSE_MONTH]!;
  const rolloverVtsaxQty = (rolloverValue * 0.2) / prices.VTSAX[CLOSE_MONTH]!;

  const dollars = (key: AssetKey, qty: number, i: number) => qty * prices[key][i]!;
  const mixAt = (i: number) => {
    let us = 0;
    let intl = 0;
    let bond = 0;
    const vthrx = dollars('VTHRX', jordan403bVthrx[i]!, i);
    us += dollars(
      'VTSAX',
      alex401kVtsax[i]! + jordan403bVtsax[i]! + (i >= CLOSE_MONTH ? rolloverVtsaxQty : 0),
      i,
    );
    us += dollars('VTI', alexRothVti[i]! + jordanRothVti[i]! + jointVti[i]!, i);
    intl += dollars('VTIAX', alex401kVtiax[i]! + (i >= CLOSE_MONTH ? rolloverVtiaxQty : 0), i);
    intl += dollars('VXUS', alexRothVxus[i]! + jordanRothVxus[i]! + jointVxus[i]!, i);
    bond += dollars('STABLE', alex401kStable[i]! + (i >= CLOSE_MONTH ? rolloverStableQty : 0), i);
    bond += dollars('VBTLX', jordan403bVbtlx[i]!, i);
    bond += dollars('BND', jointBnd[i]!, i);
    us += vthrx * 0.4;
    intl += vthrx * 0.2;
    bond += vthrx * 0.4;
    if (i < CLOSE_MONTH) us += dollars('VTSAX', old401kVtsax[i]!, i);
    if (i >= liquidMonth) us += dollars('MEGA', megaQty[i]!, i);
    const cash = jointCash[i]!;
    const total = us + intl + bond + cash;
    return { us, intl, bond, cash, total };
  };
  const fmtMix = (label: string, i: number) => {
    const m = mixAt(i);
    const p = (n: number) => `${((100 * n) / m.total).toFixed(0)}%`;
    console.log(
      `  ${label}: US ${p(m.us)} / Intl ${p(m.intl)} / Bond ${p(m.bond)} / Cash ${p(m.cash)}  ($${Math.round(m.total).toLocaleString()})`,
    );
  };
  fmtMix('Start allocation', 0);
  fmtMix('End allocation  ', n - 1);

  await asUser(ALEX_EMAIL, async () => {
    await seedManualPrice(alexId, months[0]!, assets.CASH, 1);
    await seedManualPrice(alexId, months[0]!, assets.DEBT, -1);
    for (let i = BUY_MONTH; i < n; i++) {
      await seedManualPrice(alexId, months[i]!, assets.HOME, HOME_PRICES[i] ?? HOME_VALUE);
    }

    for (let i = 0; i < n; i++) {
      const date = months[i]!;

      await seedStatement(
        accounts.alex401k,
        alexId,
        date,
        [
          {
            assetId: assets.VTSAX,
            assetKey: 'VTSAX',
            qty: alex401kVtsax[i]! + (i >= CLOSE_MONTH ? rolloverVtsaxQty : 0),
          },
          {
            assetId: assets.VTIAX,
            assetKey: 'VTIAX',
            qty: alex401kVtiax[i]! + (i >= CLOSE_MONTH ? rolloverVtiaxQty : 0),
          },
          {
            assetId: assets.STABLE,
            assetKey: 'STABLE',
            qty: alex401kStable[i]! + (i >= CLOSE_MONTH ? rolloverStableQty : 0),
          },
        ],
        prices,
        i,
      );

      await seedStatement(
        accounts.alexRoth,
        alexId,
        date,
        [
          { assetId: assets.VTI, assetKey: 'VTI', qty: alexRothVti[i]! },
          { assetId: assets.VXUS, assetKey: 'VXUS', qty: alexRothVxus[i]! },
        ],
        prices,
        i,
      );

      if (i < CLOSE_MONTH) {
        await seedStatement(
          accounts.alexOld401k,
          alexId,
          date,
          [{ assetId: assets.VTSAX, assetKey: 'VTSAX', qty: old401kVtsax[i]! }],
          prices,
          i,
        );
      } else if (i === CLOSE_MONTH) {
        const closeUpdate = await insertUpdate({
          family_id: FAMILY_ID,
          account_id: accounts.alexOld401k.id,
          update_type: 'mark_as_closed',
          effective_date: date,
          created_by: alexId,
          created_at: uploadedAt(date),
        });
        await insertHoldingUpdate({
          update_id: closeUpdate.id,
          asset_id: assets.VTSAX,
          quantity: 0,
        });
        await updateAccount(accounts.alexOld401k.id, { is_archived: true });
      }

      await seedStatement(
        accounts.alexMegaStock,
        alexId,
        date,
        [{ assetId: assets.MEGA, assetKey: 'MEGA', qty: megaQty[i]! }],
        prices,
        i,
      );
      if (i === liquidMonth) {
        await seedIncludeInPortfolio(accounts.alexMegaStock, alexId, date);
      }
    }
  });

  await asUser(JORDAN_EMAIL, async () => {
    await insertAssetAlias({
      account_id: accounts.jordan403b.id,
      label: 'VANG TARGET RET 2030',
      asset_id: assets.VTHRX,
    });
    await insertAssetAlias({
      account_id: accounts.residence.id,
      label: 'MORTGAGE PRINCIPAL',
      asset_id: assets.DEBT,
    });

    for (let i = 0; i < n; i++) {
      const date = months[i]!;

      await seedStatement(
        accounts.jordan403b,
        jordanId,
        date,
        [
          { assetId: assets.VTHRX, assetKey: 'VTHRX', qty: jordan403bVthrx[i]! },
          { assetId: assets.VTSAX, assetKey: 'VTSAX', qty: jordan403bVtsax[i]! },
          { assetId: assets.VBTLX, assetKey: 'VBTLX', qty: jordan403bVbtlx[i]! },
        ],
        prices,
        i,
      );

      await seedStatement(
        accounts.jordanRoth,
        jordanId,
        date,
        [
          { assetId: assets.VTI, assetKey: 'VTI', qty: jordanRothVti[i]! },
          { assetId: assets.VXUS, assetKey: 'VXUS', qty: jordanRothVxus[i]! },
        ],
        prices,
        i,
      );

      await seedStatement(
        accounts.jointBrokerage,
        jordanId,
        date,
        [
          { assetId: assets.VTI, assetKey: 'VTI', qty: jointVti[i]! },
          { assetId: assets.VXUS, assetKey: 'VXUS', qty: jointVxus[i]! },
          { assetId: assets.BND, assetKey: 'BND', qty: jointBnd[i]! },
          { assetId: assets.CASH, assetKey: 'CASH', qty: jointCash[i]! },
        ],
        prices,
        i,
      );

      await seedManualHoldings(accounts.emergency, jordanId, date, [
        { assetId: assets.CASH, qty: emergencyQtys[i]! },
      ]);

      if (i >= BUY_MONTH) {
        await seedManualHoldings(accounts.residence, jordanId, date, [
          { assetId: assets.HOME, qty: 1 },
          { assetId: assets.DEBT, qty: mortgageQtys[i]! },
        ]);
      }
    }
  });

  console.log(`  Seeded history for months ${months[0]} .. ${months[n - 1]}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { doCleanup, doCreation, createNewbie } = parseFlags();

  if (!doCleanup && !doCreation) {
    console.log('Both --skip-cleanup and --skip-creation set; nothing to do.');
    return;
  }

  const admin = createAdminClient();

  if (doCleanup) {
    await cleanup(admin);
  } else {
    console.log('Skipping cleanup (--skip-cleanup)');
  }

  if (!doCreation) {
    console.log('Skipping creation (--skip-creation)');
    console.log('Done.');
    return;
  }

  const { alex, jordan } = await createDemoUsers(admin, createNewbie);

  const { assets, alexAccounts } = await asUser(ALEX_EMAIL, () => seedStaticAsAlex(alex.id));
  const jordanAccounts = await asUser(JORDAN_EMAIL, () => seedJordanAccounts(jordan.id));
  await seedHistory(alex.id, jordan.id, assets, { ...alexAccounts, ...jordanAccounts });

  await lockReadOnlyUsers(admin, [alex, jordan]);

  console.log('\nDemo seed complete.\n');
  console.log('Log in with password:', PASSWORD);
  console.log(`  Alex (full demo, read-only):  ${ALEX_EMAIL}`);
  console.log(`  Jordan (spouse, read-only):   ${JORDAN_EMAIL}`);
  if (createNewbie) {
    console.log(`  Newbie (empty, writable):     ${NEWBIE_EMAIL}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
