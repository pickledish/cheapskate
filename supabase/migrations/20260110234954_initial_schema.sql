-- ============================================================================
-- Initial Schema for Personal Investment Tracker
-- Unified per-user securities model
-- ============================================================================

-- ----------------------------------------------------------------------------
-- USER TABLES (All data is per-user, protected by RLS)
-- ----------------------------------------------------------------------------

-- User Accounts: Investment accounts (401k, IRA, Brokerage, etc.)
create table user_accounts (
    id bigint generated always as identity primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    account_type text not null default 'other',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table user_accounts enable row level security;

create policy "Users can view their own accounts"
    on user_accounts for select
    using (auth.uid() = user_id);

create policy "Users can insert their own accounts"
    on user_accounts for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own accounts"
    on user_accounts for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can delete their own accounts"
    on user_accounts for delete
    using (auth.uid() = user_id);

-- User Goals: Rebalancing target allocations
create table user_goals (
    user_id uuid primary key references auth.users(id) on delete cascade,
    -- Target allocation, e.g. {"stock": 0.7, "bond": 0.2, "cash": 0.1}
    target_allocation jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table user_goals enable row level security;

create policy "Users can view their own goals"
    on user_goals for select
    using (auth.uid() = user_id);

create policy "Users can insert their own goals"
    on user_goals for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own goals"
    on user_goals for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can delete their own goals"
    on user_goals for delete
    using (auth.uid() = user_id);

-- User Statements: Represents uploaded PDF statements
create table user_statements (
    id bigint generated always as identity primary key,
    account_id bigint not null references user_accounts(id) on delete cascade,
    statement_date date not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    -- Prevent duplicate statements for same account/date
    unique (account_id, statement_date)
);

alter table user_statements enable row level security;

-- RLS via account ownership
create policy "Users can view statements for their accounts"
    on user_statements for select
    using (
        account_id in (
            select id from user_accounts where user_id = auth.uid()
        )
    );

create policy "Users can insert statements for their accounts"
    on user_statements for insert
    with check (
        account_id in (
            select id from user_accounts where user_id = auth.uid()
        )
    );

create policy "Users can update statements for their accounts"
    on user_statements for update
    using (
        account_id in (
            select id from user_accounts where user_id = auth.uid()
        )
    )
    with check (
        account_id in (
            select id from user_accounts where user_id = auth.uid()
        )
    );

create policy "Users can delete statements for their accounts"
    on user_statements for delete
    using (
        account_id in (
            select id from user_accounts where user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- UNIFIED SECURITIES (Per-user, replaces global securities + private assets)
-- ----------------------------------------------------------------------------

-- User Securities: All assets owned by a user (public tickers and private assets)
create table user_securities (
    id bigint generated always as identity primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    ticker text,  -- nullable for private assets without tickers (e.g., "My House")
    name text not null,
    -- Asset allocation breakdown, e.g. {"stock": 0.6, "bond": 0.4}
    allocation jsonb not null default '{}'::jsonb,
    -- Whether this counts toward "Investable Portfolio" or just "Net Worth"
    is_liquid boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    -- Each user can only have one security per ticker (when ticker is not null)
    unique nulls not distinct (user_id, ticker)
);

alter table user_securities enable row level security;

create policy "Users can view their own securities"
    on user_securities for select
    using (auth.uid() = user_id);

create policy "Users can insert their own securities"
    on user_securities for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own securities"
    on user_securities for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can delete their own securities"
    on user_securities for delete
    using (auth.uid() = user_id);

-- User Security Prices: Price history for all securities
-- Can be created manually or via statement upload (statement_id nullable)
create table user_security_prices (
    security_id bigint not null references user_securities(id) on delete cascade,
    price_date date not null,
    price numeric not null,
    -- Nullable: set when price comes from a statement, null for manual entries
    statement_id bigint references user_statements(id) on delete set null,
    created_at timestamptz not null default now(),
    primary key (security_id, price_date)
);

alter table user_security_prices enable row level security;

-- RLS via security ownership
create policy "Users can view prices for their securities"
    on user_security_prices for select
    using (
        security_id in (
            select id from user_securities where user_id = auth.uid()
        )
    );

create policy "Users can insert prices for their securities"
    on user_security_prices for insert
    with check (
        security_id in (
            select id from user_securities where user_id = auth.uid()
        )
    );

create policy "Users can update prices for their securities"
    on user_security_prices for update
    using (
        security_id in (
            select id from user_securities where user_id = auth.uid()
        )
    )
    with check (
        security_id in (
            select id from user_securities where user_id = auth.uid()
        )
    );

create policy "Users can delete prices for their securities"
    on user_security_prices for delete
    using (
        security_id in (
            select id from user_securities where user_id = auth.uid()
        )
    );

-- User Security Positions: Quantity/share history for all securities
-- Can be created manually or via statement upload (statement_id nullable)
create table user_security_positions (
    security_id bigint not null references user_securities(id) on delete cascade,
    account_id bigint not null references user_accounts(id) on delete cascade,
    position_date date not null,
    quantity numeric not null,
    -- Nullable: set when position comes from a statement, null for manual entries
    statement_id bigint references user_statements(id) on delete set null,
    created_at timestamptz not null default now(),
    primary key (security_id, account_id, position_date)
);

alter table user_security_positions enable row level security;

-- RLS via security ownership (account ownership is redundant since same user owns both)
create policy "Users can view their own positions"
    on user_security_positions for select
    using (
        security_id in (
            select id from user_securities where user_id = auth.uid()
        )
    );

create policy "Users can insert their own positions"
    on user_security_positions for insert
    with check (
        security_id in (
            select id from user_securities where user_id = auth.uid()
        )
    );

create policy "Users can update their own positions"
    on user_security_positions for update
    using (
        security_id in (
            select id from user_securities where user_id = auth.uid()
        )
    )
    with check (
        security_id in (
            select id from user_securities where user_id = auth.uid()
        )
    );

create policy "Users can delete their own positions"
    on user_security_positions for delete
    using (
        security_id in (
            select id from user_securities where user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- INDEXES
-- ----------------------------------------------------------------------------

create index idx_user_accounts_user_id on user_accounts(user_id);
create index idx_user_statements_account_id on user_statements(account_id);
create index idx_user_statements_date on user_statements(statement_date);
create index idx_user_securities_user_id on user_securities(user_id);
create index idx_user_securities_ticker on user_securities(user_id, ticker);
create index idx_user_security_prices_date on user_security_prices(price_date);
create index idx_user_security_prices_statement on user_security_prices(statement_id);
create index idx_user_security_positions_date on user_security_positions(position_date);
create index idx_user_security_positions_account on user_security_positions(account_id);
create index idx_user_security_positions_statement on user_security_positions(statement_id);
