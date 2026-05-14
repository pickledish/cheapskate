-- ============================================================================
-- Unified Updates Schema
-- Replaces statements/asset_prices/asset_holdings with a unified model
-- ============================================================================

-- ----------------------------------------------------------------------------
-- NEW TABLES
-- ----------------------------------------------------------------------------

-- Updates: Parent record for all update events
create table updates (
    id bigint generated always as identity primary key,
    family_id uuid not null references families(id) on delete cascade,
    account_id bigint references accounts(id) on delete cascade,
    update_type text not null check (update_type in ('statement', 'manual_price', 'manual_holdings', 'mark_as_closed')),
    effective_date date not null,
    created_by uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);

alter table updates enable row level security;

create policy "Family members can view their updates"
    on updates for select
    using (family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid);

create policy "Family members can insert updates"
    on updates for insert
    with check (family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid);

create policy "Family members can delete their updates"
    on updates for delete
    using (family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid);

create index idx_updates_family_id on updates(family_id);
create index idx_updates_account_id on updates(account_id);
create index idx_updates_effective_date on updates(effective_date);
create index idx_updates_created_at on updates(created_at);

-- Price Updates: Price records linked to an update
create table price_updates (
    update_id bigint not null references updates(id) on delete cascade,
    asset_id bigint not null references assets(id) on delete cascade,
    price numeric not null,
    primary key (update_id, asset_id)
);

alter table price_updates enable row level security;

create policy "Family members can view their price updates"
    on price_updates for select
    using (
        update_id in (
            select id from updates where family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid
        )
    );

create policy "Family members can insert price updates"
    on price_updates for insert
    with check (
        update_id in (
            select id from updates where family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid
        )
    );

create policy "Family members can delete their price updates"
    on price_updates for delete
    using (
        update_id in (
            select id from updates where family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid
        )
    );

create index idx_price_updates_asset_id on price_updates(asset_id);

-- Holding Updates: Holdings records linked to an update
create table holding_updates (
    update_id bigint not null references updates(id) on delete cascade,
    asset_id bigint not null references assets(id) on delete cascade,
    quantity numeric not null,
    primary key (update_id, asset_id)
);

alter table holding_updates enable row level security;

create policy "Family members can view their holding updates"
    on holding_updates for select
    using (
        update_id in (
            select id from updates where family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid
        )
    );

create policy "Family members can insert holding updates"
    on holding_updates for insert
    with check (
        update_id in (
            select id from updates where family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid
        )
    );

create policy "Family members can delete their holding updates"
    on holding_updates for delete
    using (
        update_id in (
            select id from updates where family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid
        )
    );

create index idx_holding_updates_asset_id on holding_updates(asset_id);

-- ----------------------------------------------------------------------------
-- DATA MIGRATION
-- ----------------------------------------------------------------------------

-- 1. Migrate statements to updates (type='statement')
insert into updates (family_id, account_id, update_type, effective_date, created_by, created_at)
select 
    a.family_id,
    s.account_id,
    'statement',
    s.statement_date,
    a.created_by,
    s.created_at
from statements s
join accounts a on a.id = s.account_id;

-- 2. Migrate asset_prices with statement_id to price_updates
insert into price_updates (update_id, asset_id, price)
select 
    u.id,
    ap.asset_id,
    ap.price
from asset_prices ap
join statements s on s.id = ap.statement_id
join updates u on u.account_id = s.account_id 
    and u.effective_date = s.statement_date 
    and u.update_type = 'statement';

-- 3. Migrate orphan asset_prices (manual price updates) to individual updates
-- First create the update records
insert into updates (family_id, account_id, update_type, effective_date, created_by, created_at)
select 
    ast.family_id,
    null,
    'manual_price',
    ap.price_date,
    ap.created_by,
    ap.created_at
from asset_prices ap
join assets ast on ast.id = ap.asset_id
where ap.statement_id is null;

-- Then link the prices to those updates
insert into price_updates (update_id, asset_id, price)
select 
    u.id,
    ap.asset_id,
    ap.price
from asset_prices ap
join assets ast on ast.id = ap.asset_id
join updates u on u.family_id = ast.family_id
    and u.effective_date = ap.price_date
    and u.created_at = ap.created_at
    and u.update_type = 'manual_price'
where ap.statement_id is null;

-- 4. Migrate asset_holdings with statement_id to holding_updates
insert into holding_updates (update_id, asset_id, quantity)
select 
    u.id,
    ah.asset_id,
    ah.quantity
from asset_holdings ah
join statements s on s.id = ah.statement_id
join updates u on u.account_id = s.account_id 
    and u.effective_date = s.statement_date 
    and u.update_type = 'statement';

-- 5. Migrate orphan asset_holdings (manual holdings updates) to individual updates
-- First create the update records
insert into updates (family_id, account_id, update_type, effective_date, created_by, created_at)
select 
    ast.family_id,
    ah.account_id,
    'manual_holdings',
    ah.holding_date,
    ah.created_by,
    ah.created_at
from asset_holdings ah
join assets ast on ast.id = ah.asset_id
where ah.statement_id is null;

-- Then link the holdings to those updates
insert into holding_updates (update_id, asset_id, quantity)
select 
    u.id,
    ah.asset_id,
    ah.quantity
from asset_holdings ah
join assets ast on ast.id = ah.asset_id
join updates u on u.family_id = ast.family_id
    and u.account_id = ah.account_id
    and u.effective_date = ah.holding_date
    and u.created_at = ah.created_at
    and u.update_type = 'manual_holdings'
where ah.statement_id is null;

-- 6. Convert statement-based close events to type='mark_as_closed'
-- A close event is a statement where all holdings are zero and account.archived_at matches
update updates u
set update_type = 'mark_as_closed'
where u.update_type = 'statement'
and exists (
    select 1 from accounts a
    where a.id = u.account_id
    and a.archived_at = u.effective_date
)
and not exists (
    select 1 from holding_updates hu
    where hu.update_id = u.id
    and hu.quantity != 0
);

-- ----------------------------------------------------------------------------
-- DROP OLD TABLES (do this after validating migration worked)
-- ----------------------------------------------------------------------------

-- drop table asset_holdings;
-- drop table asset_prices;
-- drop table statements;
