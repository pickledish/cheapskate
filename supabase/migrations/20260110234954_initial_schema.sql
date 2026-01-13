-- ============================================================================
-- Initial Schema for Personal Investment Tracker
-- Unified per-user model with clean naming
-- ============================================================================

-- ----------------------------------------------------------------------------
-- CORE USER TABLES
-- ----------------------------------------------------------------------------

-- Accounts: Investment accounts (401k, IRA, Brokerage, etc.)
create table accounts (
    id bigint generated always as identity primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    tags jsonb not null default '{}'::jsonb,
    rebalancing boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table accounts enable row level security;

create policy "Users can view their own accounts"
    on accounts for select
    using (auth.uid() = user_id);

create policy "Users can insert their own accounts"
    on accounts for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own accounts"
    on accounts for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can delete their own accounts"
    on accounts for delete
    using (auth.uid() = user_id);

-- Goals: Rebalancing target allocations
create table goals (
    user_id uuid primary key references auth.users(id) on delete cascade,
    target_allocation jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table goals enable row level security;

create policy "Users can view their own goals"
    on goals for select
    using (auth.uid() = user_id);

create policy "Users can insert their own goals"
    on goals for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own goals"
    on goals for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can delete their own goals"
    on goals for delete
    using (auth.uid() = user_id);

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

create policy "Users can view statements for their accounts"
    on statements for select
    using (
        account_id in (
            select id from accounts where user_id = auth.uid()
        )
    );

create policy "Users can insert statements for their accounts"
    on statements for insert
    with check (
        account_id in (
            select id from accounts where user_id = auth.uid()
        )
    );

create policy "Users can update statements for their accounts"
    on statements for update
    using (
        account_id in (
            select id from accounts where user_id = auth.uid()
        )
    )
    with check (
        account_id in (
            select id from accounts where user_id = auth.uid()
        )
    );

create policy "Users can delete statements for their accounts"
    on statements for delete
    using (
        account_id in (
            select id from accounts where user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- ASSETS (Per-user, replaces global securities + private assets)
-- ----------------------------------------------------------------------------

-- Assets: All assets owned by a user (public tickers and private assets)
create table assets (
    id bigint generated always as identity primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    ticker text,  -- nullable for private assets without tickers
    name text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, ticker)
);

alter table assets enable row level security;

create policy "Users can view their own assets"
    on assets for select
    using (auth.uid() = user_id);

create policy "Users can insert their own assets"
    on assets for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own assets"
    on assets for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can delete their own assets"
    on assets for delete
    using (auth.uid() = user_id);

-- Asset Prices: Price history for all assets
create table asset_prices (
    asset_id bigint not null references assets(id) on delete cascade,
    price_date date not null,
    price numeric not null,
    statement_id bigint references statements(id) on delete set null,
    created_at timestamptz not null default now(),
    primary key (asset_id, price_date)
);

alter table asset_prices enable row level security;

create policy "Users can view prices for their assets"
    on asset_prices for select
    using (
        asset_id in (
            select id from assets where user_id = auth.uid()
        )
    );

create policy "Users can insert prices for their assets"
    on asset_prices for insert
    with check (
        asset_id in (
            select id from assets where user_id = auth.uid()
        )
    );

create policy "Users can update prices for their assets"
    on asset_prices for update
    using (
        asset_id in (
            select id from assets where user_id = auth.uid()
        )
    )
    with check (
        asset_id in (
            select id from assets where user_id = auth.uid()
        )
    );

create policy "Users can delete prices for their assets"
    on asset_prices for delete
    using (
        asset_id in (
            select id from assets where user_id = auth.uid()
        )
    );

-- Asset Holdings: Quantity/share history for all assets
create table asset_holdings (
    asset_id bigint not null references assets(id) on delete cascade,
    account_id bigint not null references accounts(id) on delete cascade,
    holding_date date not null,
    quantity numeric not null,
    statement_id bigint references statements(id) on delete set null,
    created_at timestamptz not null default now(),
    primary key (asset_id, account_id, holding_date)
);

alter table asset_holdings enable row level security;

create policy "Users can view their own holdings"
    on asset_holdings for select
    using (
        asset_id in (
            select id from assets where user_id = auth.uid()
        )
    );

create policy "Users can insert their own holdings"
    on asset_holdings for insert
    with check (
        asset_id in (
            select id from assets where user_id = auth.uid()
        )
    );

create policy "Users can update their own holdings"
    on asset_holdings for update
    using (
        asset_id in (
            select id from assets where user_id = auth.uid()
        )
    )
    with check (
        asset_id in (
            select id from assets where user_id = auth.uid()
        )
    );

create policy "Users can delete their own holdings"
    on asset_holdings for delete
    using (
        asset_id in (
            select id from assets where user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- ASSET CLASSES (Per-user, for portfolio allocation tracking)
-- ----------------------------------------------------------------------------

-- Asset Classes: User-defined asset classes (stock, bond, cash, etc.)
create table asset_classes (
    id bigint generated always as identity primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    created_at timestamptz not null default now(),
    unique (user_id, name)
);

alter table asset_classes enable row level security;

create policy "Users can view their own asset classes"
    on asset_classes for select
    using (auth.uid() = user_id);

create policy "Users can insert their own asset classes"
    on asset_classes for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own asset classes"
    on asset_classes for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can delete their own asset classes"
    on asset_classes for delete
    using (auth.uid() = user_id);

-- Asset Allocations: Junction table linking assets to asset classes
create table asset_allocations (
    asset_id bigint not null references assets(id) on delete cascade,
    asset_class_id bigint not null references asset_classes(id) on delete cascade,
    percentage numeric not null check (percentage >= 0 and percentage <= 1),
    primary key (asset_id, asset_class_id)
);

alter table asset_allocations enable row level security;

-- RLS via asset ownership
create policy "Users can view allocations for their assets"
    on asset_allocations for select
    using (
        asset_id in (
            select id from assets where user_id = auth.uid()
        )
    );

create policy "Users can insert allocations for their assets"
    on asset_allocations for insert
    with check (
        asset_id in (
            select id from assets where user_id = auth.uid()
        )
    );

create policy "Users can update allocations for their assets"
    on asset_allocations for update
    using (
        asset_id in (
            select id from assets where user_id = auth.uid()
        )
    )
    with check (
        asset_id in (
            select id from assets where user_id = auth.uid()
        )
    );

create policy "Users can delete allocations for their assets"
    on asset_allocations for delete
    using (
        asset_id in (
            select id from assets where user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- INDEXES
-- ----------------------------------------------------------------------------

create index idx_accounts_user_id on accounts(user_id);
create index idx_statements_account_id on statements(account_id);
create index idx_statements_date on statements(statement_date);
create index idx_assets_user_id on assets(user_id);
create index idx_assets_ticker on assets(user_id, ticker);
create index idx_asset_prices_date on asset_prices(price_date);
create index idx_asset_prices_statement on asset_prices(statement_id);
create index idx_asset_holdings_date on asset_holdings(holding_date);
create index idx_asset_holdings_account on asset_holdings(account_id);
create index idx_asset_holdings_statement on asset_holdings(statement_id);
create index idx_asset_classes_user_id on asset_classes(user_id);
create index idx_asset_allocations_class on asset_allocations(asset_class_id);
