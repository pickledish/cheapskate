/**
 * Seed demo users and portfolio data for local / hosted Supabase.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> npm run seed:local
 *   SUPABASE_SERVICE_ROLE_KEY=<key> npm run seed:cloud
 *   SUPABASE_SERVICE_ROLE_KEY=<key> npm run seed:local -- --skip-creation
 *   SUPABASE_SERVICE_ROLE_KEY=<key> npm run seed:local -- --skip-cleanup
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
  type Account,
} from '@/lib/data';
import type { AssetId } from '@/lib/data/assets';
import type { AssetClassId } from '@/lib/data/asset-classes';
import { lastNMonths, monthEnd } from '@/lib/util/date';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FAMILY_ID = '11111111-1111-4111-8111-111111111111';
const PASSWORD = 'demo-password-123';

const ALEX_EMAIL = 'alex@skate.cheap';
const JORDAN_EMAIL = 'jordan@skate.cheap';
const NEWBIE_EMAIL = 'newbie@skate.cheap';
const DEMO_EMAILS = [ALEX_EMAIL, JORDAN_EMAIL, NEWBIE_EMAIL] as const;

const FLAGS = ['--skip-cleanup', '--skip-creation'] as const;

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
  | 'HOME';

type ClassKey = 'us' | 'intl' | 'bond' | 'cash' | 're';

const RETURNS = {
  us: [0.021, -0.014, 0.033, 0.012, -0.026, 0.041, 0.008, 0.019, -0.007, 0.024],
  intl: [0.013, -0.008, 0.022, 0.005, -0.019, 0.028, 0.011, 0.006, 0.014, 0.009],
  bond: [0.004, 0.002, -0.003, 0.006, 0.001, -0.002, 0.005, 0.003, 0.002, 0.004],
} as const;

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
  HOME: 210000,
};

const ASSET_CLASS_MAP: Record<AssetKey, ClassKey> = {
  VTI: 'us',
  VXUS: 'intl',
  BND: 'bond',
  VTSAX: 'us',
  VTIAX: 'intl',
  VBTLX: 'bond',
  VTHRX: 'us', // multi-class handled separately for allocations; returns use US-ish blend via VTHRX price path
  STABLE: 'bond',
  CASH: 'cash',
  HOME: 're',
};

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

function parseFlags(): { doCleanup: boolean; doCreation: boolean } {
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
  if (!url) throw new Error('VITE_SUPABASE_URL is missing (expected from frontend/.env via vite-node)');
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
      if (key === 'HOME') {
        prices[key].push(210000 * Math.pow(1.004, i) + 800 * i);
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
          const r =
            0.4 * RETURNS.us[j]! + 0.2 * RETURNS.intl[j]! + 0.4 * RETURNS.bond[j]!;
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

function growQty(startQty: number, monthlyDollars: number[], prices: number[]): number[] {
  const qtys: number[] = [];
  let qty = startQty;
  for (let i = 0; i < prices.length; i++) {
    if (i > 0) {
      qty += monthlyDollars[i]! / prices[i]!;
    }
    qtys.push(qty);
  }
  return qtys;
}

function cashQtys(nMonths: number): number[] {
  // Emergency savings: start 18000, +300/mo, minus 2200 at month 5
  const qtys: number[] = [];
  let bal = 18000;
  for (let i = 0; i < nMonths; i++) {
    if (i > 0) bal += 300;
    if (i === 5) bal -= 2200;
    qtys.push(bal);
  }
  return qtys;
}

function jointCashQtys(nMonths: number): number[] {
  return Array.from({ length: nMonths }, () => 2500);
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
  const demoUsers = users.filter((u) => u.email && DEMO_EMAILS.includes(u.email as (typeof DEMO_EMAILS)[number]));

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

async function createDemoUsers(admin: ReturnType<typeof createAdminClient>): Promise<{
  alex: User;
  jordan: User;
  newbie: User;
}> {
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

  const { data: newbieData, error: newbieErr } = await admin.auth.admin.createUser({
    email: NEWBIE_EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {},
  });
  if (newbieErr) throw newbieErr;

  console.log(`  Alex:   ${alexData.user.id}`);
  console.log(`  Jordan: ${jordanData.user.id}`);
  console.log(`  Newbie: ${newbieData.user.id}`);

  return { alex: alexData.user, jordan: jordanData.user, newbie: newbieData.user };
}

// ---------------------------------------------------------------------------
// Static data + history
// ---------------------------------------------------------------------------

interface AlexAccounts {
  alex401k: Account;
  alexRoth: Account;
  alexOld401k: Account;
  alexTradIra: Account;
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
    name: 'International Stocks',
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

  const classes: Record<ClassKey, AssetClassId> = {
    us: us.id,
    intl: intl.id,
    bond: bond.id,
    cash: cash.id,
    re: re.id,
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
    HOME: await makeAsset(null, 'Home Equity', [{ classKey: 're', pct: 1 }]),
  };

  const alex401k = await insertAccount({
    name: 'Alex 401(k) - Fidelity',
    rebalancing: true,
    created_by: alexId,
    family_id: FAMILY_ID,
    last4: '4021',
  });
  const alexRoth = await insertAccount({
    name: 'Alex Roth IRA - Vanguard',
    rebalancing: true,
    created_by: alexId,
    family_id: FAMILY_ID,
    last4: '8830',
  });
  const alexOld401k = await insertAccount({
    name: 'Alex Old 401(k) - MegaCorp',
    rebalancing: true,
    created_by: alexId,
    family_id: FAMILY_ID,
    last4: '1177',
  });
  const alexTradIra = await insertAccount({
    name: 'Alex Traditional IRA - Vanguard',
    rebalancing: true,
    created_by: alexId,
    family_id: FAMILY_ID,
    last4: '9042',
  });

  await insertAssetAlias({
    account_id: alex401k.id,
    label: 'VANG TOT STK MKT IDX ADM',
    asset_id: assets.VTSAX,
  });
  await insertAssetAlias({
    account_id: alex401k.id,
    label: 'STABLE VALUE FUND',
    asset_id: assets.STABLE,
  });

  return {
    assets,
    alexAccounts: { alex401k, alexRoth, alexOld401k, alexTradIra },
  };
}

async function seedJordanAccounts(jordanId: string): Promise<JordanAccounts> {
  console.log('Seeding Jordan profile and accounts...');

  await insertProfile({ id: jordanId, family_id: FAMILY_ID, name: 'Jordan Sample' });

  const jordan403b = await insertAccount({
    name: 'Jordan 403(b) - TIAA',
    rebalancing: true,
    created_by: jordanId,
    family_id: FAMILY_ID,
    last4: '5510',
  });
  const jordanRoth = await insertAccount({
    name: 'Jordan Roth IRA - Fidelity',
    rebalancing: true,
    created_by: jordanId,
    family_id: FAMILY_ID,
    last4: '6621',
  });
  const jointBrokerage = await insertAccount({
    name: 'Joint Taxable Brokerage - Schwab',
    rebalancing: true,
    created_by: jordanId,
    family_id: FAMILY_ID,
    last4: '3388',
  });
  const emergency = await insertAccount({
    name: 'Emergency Savings - Ally',
    rebalancing: false,
    created_by: jordanId,
    family_id: FAMILY_ID,
    last4: '7712',
  });
  const residence = await insertAccount({
    name: 'Primary Residence',
    rebalancing: false,
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
  const update = await insertUpdate({
    family_id: FAMILY_ID,
    account_id: account.id,
    update_type: 'statement',
    effective_date: effectiveDate,
    created_by: userId,
    created_at: uploadedAt(effectiveDate),
  });
  for (const h of holdings) {
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

async function seedHistory(
  alexId: string,
  jordanId: string,
  assets: Record<AssetKey, AssetId>,
  accounts: AlexAccounts & JordanAccounts,
): Promise<void> {
  console.log('Seeding ~10 months of portfolio history...');

  const months = lastNMonths(10).map(monthEnd);
  const n = months.length;
  const prices = buildPrices(n);
  const closeMonth = 6;

  // Quantity schedules
  const alex401kVtsax = growQty(
    480,
    Array.from({ length: n }, (_, i) => (i === 0 ? 0 : 900)),
    prices.VTSAX,
  );
  const alex401kVtiax = growQty(
    900,
    Array.from({ length: n }, (_, i) => (i === 0 ? 0 : 300)),
    prices.VTIAX,
  );
  const alex401kStable = growQty(
    1200,
    Array.from({ length: n }, (_, i) => (i === 0 ? 0 : 200)),
    prices.STABLE,
  );

  const alexRothVti = growQty(
    62,
    Array.from({ length: n }, (_, i) => (i === 0 ? 0 : 250)),
    prices.VTI,
  );
  const alexRothVxus = growQty(
    90,
    Array.from({ length: n }, (_, i) => (i === 0 ? 0 : 100)),
    prices.VXUS,
  );

  const old401kVthrx = Array.from({ length: n }, () => 610);

  const jordan403bVtsax = growQty(
    300,
    Array.from({ length: n }, (_, i) => (i === 0 ? 0 : 800)),
    prices.VTSAX,
  );
  const jordan403bVbtlx = growQty(
    1400,
    Array.from({ length: n }, (_, i) => (i === 0 ? 0 : 300)),
    prices.VBTLX,
  );

  const jordanRothVti = growQty(
    40,
    Array.from({ length: n }, (_, i) => (i === 0 ? 0 : 250)),
    prices.VTI,
  );
  const jordanRothVxus = growQty(
    70,
    Array.from({ length: n }, (_, i) => (i === 0 ? 0 : 120)),
    prices.VXUS,
  );

  const jointVti = growQty(
    150,
    Array.from({ length: n }, (_, i) => (i === 0 ? 0 : 600)),
    prices.VTI,
  );
  const jointVxus = growQty(
    210,
    Array.from({ length: n }, (_, i) => (i === 0 ? 0 : 200)),
    prices.VXUS,
  );
  const jointBnd = Array.from({ length: n }, () => 120);
  const jointCash = jointCashQtys(n);
  const emergencyQtys = cashQtys(n);

  // Rollover: Old 401(k) VTHRX value at closeMonth into VTI + BND (~60/40 of value)
  const rolloverValue = 610 * prices.VTHRX[closeMonth]!;
  const rolloverVtiQty = (rolloverValue * 0.6) / prices.VTI[closeMonth]!;
  const rolloverBndQty = (rolloverValue * 0.4) / prices.BND[closeMonth]!;

  // Cash price once; home equity quarterly
  await asUser(ALEX_EMAIL, async () => {
    await seedManualPrice(alexId, months[0]!, assets.CASH, 1);

    for (let i = 0; i < n; i++) {
      const date = months[i]!;

      // Alex 401(k)
      await seedStatement(
        accounts.alex401k,
        alexId,
        date,
        [
          { assetId: assets.VTSAX, assetKey: 'VTSAX', qty: alex401kVtsax[i]! },
          { assetId: assets.VTIAX, assetKey: 'VTIAX', qty: alex401kVtiax[i]! },
          { assetId: assets.STABLE, assetKey: 'STABLE', qty: alex401kStable[i]! },
        ],
        prices,
        i,
      );

      // Alex Roth
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

      // Old 401(k) until closed
      if (i < closeMonth) {
        await seedStatement(
          accounts.alexOld401k,
          alexId,
          date,
          [{ assetId: assets.VTHRX, assetKey: 'VTHRX', qty: old401kVthrx[i]! }],
          prices,
          i,
        );
      } else if (i === closeMonth) {
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
          asset_id: assets.VTHRX,
          quantity: 0,
        });
        await updateAccount(accounts.alexOld401k.id, { archived_at: date });

        // Rollover into Traditional IRA (prices for VTI/BND already come from other statements)
        await seedManualHoldings(accounts.alexTradIra, alexId, date, [
          { assetId: assets.VTI, qty: rolloverVtiQty },
          { assetId: assets.BND, qty: rolloverBndQty },
        ]);
      }

      // Home equity prices quarterly
      if (i === 0 || i === 3 || i === 6 || i === 9) {
        await seedManualPrice(alexId, date, assets.HOME, prices.HOME[i]!);
      }
    }
  });

  await asUser(JORDAN_EMAIL, async () => {
    for (let i = 0; i < n; i++) {
      const date = months[i]!;

      await seedStatement(
        accounts.jordan403b,
        jordanId,
        date,
        [
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

      // Residence holding once at start; price updated by Alex's manual_price events
      if (i === 0) {
        await seedManualHoldings(accounts.residence, jordanId, date, [
          { assetId: assets.HOME, qty: 1 },
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
  const { doCleanup, doCreation } = parseFlags();

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

  const { alex, jordan } = await createDemoUsers(admin);

  const { assets, alexAccounts } = await asUser(ALEX_EMAIL, () => seedStaticAsAlex(alex.id));
  const jordanAccounts = await asUser(JORDAN_EMAIL, () => seedJordanAccounts(jordan.id));
  await seedHistory(alex.id, jordan.id, assets, { ...alexAccounts, ...jordanAccounts });

  console.log('\nDemo seed complete.\n');
  console.log('Log in with password:', PASSWORD);
  console.log(`  Alex (full demo):  ${ALEX_EMAIL}`);
  console.log(`  Jordan (spouse):   ${JORDAN_EMAIL}`);
  console.log(`  Newbie (empty):    ${NEWBIE_EMAIL}`);
  console.log(`Family secret (join): ${FAMILY_ID}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
