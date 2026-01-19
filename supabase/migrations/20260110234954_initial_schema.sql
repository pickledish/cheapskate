-- ============================================================================
-- Initial Schema for Personal Investment Tracker
-- Family sharing model: multiple users can share data via family_id
-- ============================================================================

-- ----------------------------------------------------------------------------
-- FAMILIES (for FK integrity and validating family UUIDs)
-- ----------------------------------------------------------------------------

create table families (
    id uuid primary key,
    created_at timestamptz not null default now()
);

alter table families enable row level security;

-- Only allow INSERT, not SELECT (prevents enumeration of family IDs)
create policy "Authenticated users can create a family"
    on families for insert
    to authenticated
    with check (true);

-- ----------------------------------------------------------------------------
-- PROFILES (user info visible to family members)
-- ----------------------------------------------------------------------------

create table profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    family_id uuid not null references families(id) on delete cascade,
    name text not null,
    created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users can insert their own profile"
    on profiles for insert
    to authenticated
    with check (id = auth.uid());

create policy "Family members can view profiles"
    on profiles for select
    using (family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid);

create policy "Users can update their own profile"
    on profiles for update
    using (id = auth.uid())
    with check (id = auth.uid());

create index idx_profiles_family_id on profiles(family_id);

-- ----------------------------------------------------------------------------
-- CORE TABLES
-- ----------------------------------------------------------------------------

-- Accounts: Investment accounts (401k, IRA, Brokerage, etc.)
create table accounts (
    id bigint generated always as identity primary key,
    family_id uuid not null references families(id) on delete cascade,
    created_by uuid not null references auth.users(id) on delete cascade,
    name text not null,
    tags jsonb not null default '{}'::jsonb,
    rebalancing boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table accounts enable row level security;

create policy "Family members can view their accounts"
    on accounts for select
    using (family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid);

create policy "Family members can insert accounts"
    on accounts for insert
    with check (family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid);

create policy "Family members can update their accounts"
    on accounts for update
    using (family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid)
    with check (family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid);

create policy "Family members can delete their accounts"
    on accounts for delete
    using (family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid);

-- Statements: Uploaded PDF statements
create table statements (
    id bigint generated always as identity primary key,
    account_id bigint not null references accounts(id) on delete cascade,
    statement_date date not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (account_id, statement_date)
);

alter table statements enable row level security;

create policy "Family members can view statements for their accounts"
    on statements for select
    using (
        account_id in (
            select id from accounts where family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid
        )
    );

create policy "Family members can insert statements for their accounts"
    on statements for insert
    with check (
        account_id in (
            select id from accounts where family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid
        )
    );

create policy "Family members can update statements for their accounts"
    on statements for update
    using (
        account_id in (
            select id from accounts where family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid
        )
    )
    with check (
        account_id in (
            select id from accounts where family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid
        )
    );

create policy "Family members can delete statements for their accounts"
    on statements for delete
    using (
        account_id in (
            select id from accounts where family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid
        )
    );

-- ----------------------------------------------------------------------------
-- ASSETS (Per-family)
-- ----------------------------------------------------------------------------

-- Assets: All assets owned by a family (public tickers and private assets)
create table assets (
    id bigint generated always as identity primary key,
    family_id uuid not null references families(id) on delete cascade,
    created_by uuid not null references auth.users(id) on delete cascade,
    ticker text,  -- nullable for private assets without tickers
    name text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (family_id, ticker)
);

alter table assets enable row level security;

create policy "Family members can view their assets"
    on assets for select
    using (family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid);

create policy "Family members can insert assets"
    on assets for insert
    with check (family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid);

create policy "Family members can update their assets"
    on assets for update
    using (family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid)
    with check (family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid);

create policy "Family members can delete their assets"
    on assets for delete
    using (family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid);

-- Asset Prices: Price history for all assets
create table asset_prices (
    asset_id bigint not null references assets(id) on delete cascade,
    price_date date not null,
    price numeric not null,
    statement_id bigint references statements(id) on delete set null,
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    primary key (asset_id, price_date)
);

alter table asset_prices enable row level security;

create policy "Family members can view prices for their assets"
    on asset_prices for select
    using (
        asset_id in (
            select id from assets where family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid
        )
    );

create policy "Family members can insert prices for their assets"
    on asset_prices for insert
    with check (
        asset_id in (
            select id from assets where family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid
        )
    );

create policy "Family members can update prices for their assets"
    on asset_prices for update
    using (
        asset_id in (
            select id from assets where family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid
        )
    )
    with check (
        asset_id in (
            select id from assets where family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid
        )
    );

create policy "Family members can delete prices for their assets"
    on asset_prices for delete
    using (
        asset_id in (
            select id from assets where family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid
        )
    );

-- Asset Holdings: Quantity/share history for all assets
create table asset_holdings (
    asset_id bigint not null references assets(id) on delete cascade,
    account_id bigint not null references accounts(id) on delete cascade,
    holding_date date not null,
    quantity numeric not null,
    statement_id bigint references statements(id) on delete set null,
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    primary key (asset_id, account_id, holding_date)
);

alter table asset_holdings enable row level security;

create policy "Family members can view their holdings"
    on asset_holdings for select
    using (
        asset_id in (
            select id from assets where family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid
        )
    );

create policy "Family members can insert their holdings"
    on asset_holdings for insert
    with check (
        asset_id in (
            select id from assets where family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid
        )
    );

create policy "Family members can update their holdings"
    on asset_holdings for update
    using (
        asset_id in (
            select id from assets where family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid
        )
    )
    with check (
        asset_id in (
            select id from assets where family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid
        )
    );

create policy "Family members can delete their holdings"
    on asset_holdings for delete
    using (
        asset_id in (
            select id from assets where family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid
        )
    );

-- ----------------------------------------------------------------------------
-- ASSET CLASSES (Per-family, for portfolio allocation tracking)
-- ----------------------------------------------------------------------------

-- Asset Classes: Family-defined asset classes (stock, bond, cash, etc.)
create table asset_classes (
    id bigint generated always as identity primary key,
    family_id uuid not null references families(id) on delete cascade,
    created_by uuid not null references auth.users(id) on delete cascade,
    name text not null,
    goal numeric not null default 0 check (goal >= 0 and goal <= 1),
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    unique (family_id, name)
);

alter table asset_classes enable row level security;

create policy "Family members can view their asset classes"
    on asset_classes for select
    using (family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid);

create policy "Family members can insert asset classes"
    on asset_classes for insert
    with check (family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid);

create policy "Family members can update their asset classes"
    on asset_classes for update
    using (family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid)
    with check (family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid);

create policy "Family members can delete their asset classes"
    on asset_classes for delete
    using (family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid);

-- Asset Allocations: Junction table linking assets to asset classes
create table asset_allocations (
    asset_id bigint not null references assets(id) on delete cascade,
    asset_class_id bigint not null references asset_classes(id) on delete cascade,
    percentage numeric not null check (percentage >= 0 and percentage <= 1),
    primary key (asset_id, asset_class_id)
);

alter table asset_allocations enable row level security;

-- RLS via asset ownership
create policy "Family members can view allocations for their assets"
    on asset_allocations for select
    using (
        asset_id in (
            select id from assets where family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid
        )
    );

create policy "Family members can insert allocations for their assets"
    on asset_allocations for insert
    with check (
        asset_id in (
            select id from assets where family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid
        )
    );

create policy "Family members can update allocations for their assets"
    on asset_allocations for update
    using (
        asset_id in (
            select id from assets where family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid
        )
    )
    with check (
        asset_id in (
            select id from assets where family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid
        )
    );

create policy "Family members can delete allocations for their assets"
    on asset_allocations for delete
    using (
        asset_id in (
            select id from assets where family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid
        )
    );

-- ----------------------------------------------------------------------------
-- INDEXES
-- ----------------------------------------------------------------------------

create index idx_accounts_family_id on accounts(family_id);
create index idx_statements_account_id on statements(account_id);
create index idx_statements_date on statements(statement_date);
create index idx_assets_family_id on assets(family_id);
create index idx_assets_ticker on assets(family_id, ticker);
create index idx_asset_prices_date on asset_prices(price_date);
create index idx_asset_prices_statement on asset_prices(statement_id);
create index idx_asset_holdings_date on asset_holdings(holding_date);
create index idx_asset_holdings_account on asset_holdings(account_id);
create index idx_asset_holdings_statement on asset_holdings(statement_id);
create index idx_asset_classes_family_id on asset_classes(family_id);
create index idx_asset_allocations_class on asset_allocations(asset_class_id);
