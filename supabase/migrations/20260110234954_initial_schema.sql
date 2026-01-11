-- ============================================================================
-- Initial Schema for Personal Investment Tracker
-- ============================================================================

-- ----------------------------------------------------------------------------
-- GLOBAL TABLES (Public Data)
-- ----------------------------------------------------------------------------

-- Securities: Definitions of public assets (Stocks, ETFs, Funds)
create table securities (
    id bigint generated always as identity primary key,
    ticker text not null unique,
    name text not null,
    -- Asset allocation breakdown, e.g. {"stock": 0.6, "bond": 0.4}
    allocation jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Enable RLS but allow public read access
alter table securities enable row level security;

create policy "Securities are viewable by everyone"
    on securities for select
    using (true);

-- Security Prices: End-of-month price history
create table security_prices (
    security_id bigint not null references securities(id) on delete cascade,
    price_date date not null,
    price numeric not null,
    created_at timestamptz not null default now(),
    primary key (security_id, price_date)
);

-- Enable RLS but allow public read access
alter table security_prices enable row level security;

create policy "Security prices are viewable by everyone"
    on security_prices for select
    using (true);

-- ----------------------------------------------------------------------------
-- USER TABLES (Private Data, protected by RLS)
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

-- User Statement Positions: Holdings found in a statement
create table user_statement_positions (
    statement_id bigint not null references user_statements(id) on delete cascade,
    security_id bigint not null references securities(id) on delete cascade,
    quantity numeric not null,
    created_at timestamptz not null default now(),
    primary key (statement_id, security_id)
);

alter table user_statement_positions enable row level security;

-- RLS via statement -> account -> user ownership
create policy "Users can view positions for their statements"
    on user_statement_positions for select
    using (
        statement_id in (
            select s.id from user_statements s
            join user_accounts a on s.account_id = a.id
            where a.user_id = auth.uid()
        )
    );

create policy "Users can insert positions for their statements"
    on user_statement_positions for insert
    with check (
        statement_id in (
            select s.id from user_statements s
            join user_accounts a on s.account_id = a.id
            where a.user_id = auth.uid()
        )
    );

create policy "Users can update positions for their statements"
    on user_statement_positions for update
    using (
        statement_id in (
            select s.id from user_statements s
            join user_accounts a on s.account_id = a.id
            where a.user_id = auth.uid()
        )
    )
    with check (
        statement_id in (
            select s.id from user_statements s
            join user_accounts a on s.account_id = a.id
            where a.user_id = auth.uid()
        )
    );

create policy "Users can delete positions for their statements"
    on user_statement_positions for delete
    using (
        statement_id in (
            select s.id from user_statements s
            join user_accounts a on s.account_id = a.id
            where a.user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- USER PRIVATE ASSETS (Manual tracking for illiquid assets)
-- ----------------------------------------------------------------------------

-- User Private Securities: Custom assets without public tickers
create table user_private_securities (
    id bigint generated always as identity primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    -- Asset allocation breakdown
    allocation jsonb not null default '{}'::jsonb,
    -- Whether this counts toward "Investable Portfolio" or just "Net Worth"
    is_liquid boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table user_private_securities enable row level security;

create policy "Users can view their own private securities"
    on user_private_securities for select
    using (auth.uid() = user_id);

create policy "Users can insert their own private securities"
    on user_private_securities for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own private securities"
    on user_private_securities for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can delete their own private securities"
    on user_private_securities for delete
    using (auth.uid() = user_id);

-- User Private Prices: Manual valuation history for private assets
create table user_private_prices (
    security_id bigint not null references user_private_securities(id) on delete cascade,
    price_date date not null,
    price numeric not null,
    created_at timestamptz not null default now(),
    primary key (security_id, price_date)
);

alter table user_private_prices enable row level security;

-- RLS via security ownership
create policy "Users can view prices for their private securities"
    on user_private_prices for select
    using (
        security_id in (
            select id from user_private_securities where user_id = auth.uid()
        )
    );

create policy "Users can insert prices for their private securities"
    on user_private_prices for insert
    with check (
        security_id in (
            select id from user_private_securities where user_id = auth.uid()
        )
    );

create policy "Users can update prices for their private securities"
    on user_private_prices for update
    using (
        security_id in (
            select id from user_private_securities where user_id = auth.uid()
        )
    )
    with check (
        security_id in (
            select id from user_private_securities where user_id = auth.uid()
        )
    );

create policy "Users can delete prices for their private securities"
    on user_private_prices for delete
    using (
        security_id in (
            select id from user_private_securities where user_id = auth.uid()
        )
    );

-- User Private Positions: Point-in-time holdings for private assets
create table user_private_positions (
    security_id bigint not null references user_private_securities(id) on delete cascade,
    position_date date not null,
    quantity numeric not null default 1.0,
    created_at timestamptz not null default now(),
    primary key (security_id, position_date)
);

alter table user_private_positions enable row level security;

-- RLS via security ownership
create policy "Users can view their own private positions"
    on user_private_positions for select
    using (
        security_id in (
            select id from user_private_securities where user_id = auth.uid()
        )
    );

create policy "Users can insert their own private positions"
    on user_private_positions for insert
    with check (
        security_id in (
            select id from user_private_securities where user_id = auth.uid()
        )
    );

create policy "Users can update their own private positions"
    on user_private_positions for update
    using (
        security_id in (
            select id from user_private_securities where user_id = auth.uid()
        )
    )
    with check (
        security_id in (
            select id from user_private_securities where user_id = auth.uid()
        )
    );

create policy "Users can delete their own private positions"
    on user_private_positions for delete
    using (
        security_id in (
            select id from user_private_securities where user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- SEED DATA
-- ----------------------------------------------------------------------------

-- $CASH: Special ticker for cash holdings (price is always $1.00)
insert into securities (ticker, name, allocation)
values ('$CASH', 'Cash', '{"cash": 1.0}'::jsonb);

-- Insert a perpetual $1.00 price for $CASH
-- (We use a far-past date; forward-fill logic will carry it forward)
insert into security_prices (security_id, price_date, price)
select id, '1970-01-01'::date, 1.00
from securities where ticker = '$CASH';

-- ----------------------------------------------------------------------------
-- INDEXES
-- ----------------------------------------------------------------------------

create index idx_user_accounts_user_id on user_accounts(user_id);
create index idx_user_statements_account_id on user_statements(account_id);
create index idx_user_statements_date on user_statements(statement_date);
create index idx_user_statement_positions_security on user_statement_positions(security_id);
create index idx_user_private_securities_user_id on user_private_securities(user_id);
create index idx_user_private_positions_date on user_private_positions(position_date);
create index idx_user_private_prices_date on user_private_prices(price_date);
create index idx_security_prices_date on security_prices(price_date);
