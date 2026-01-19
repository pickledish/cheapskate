-- ============================================================================
-- Seed Data for Personal Investment Tracker
-- Shows history of 5 accounts:
-- 1. Acme Corp 401k,
--   * invested all in VTTSX
--   * user contributes about $1000 per month
--   * new statement row for each month -> price and shares rows with FK
-- 2. Roth IRA
--   * invested also all in VTTSX
--   * user contributes about $200 per month
--   * new statement row for each month -> price and shares rows with FK
-- 3. Brokerage
--   * invested all in VTI
--   * sporadic contributions -- Jan, March, June, October, so statements for THOSE, with price and share rows
--   * otherwise, NO statement, so NO shares update, and manual price update (new row, no FK to statement)
-- 4. Primary Residence
--   * No statements ever! All manual updates with null FK to statement
--   * Purchased in July, so set shares to 1 then, and no more shares updates
--   * Price is set to $80k in july at purchase, and 1 update to $90k in Dec (appraisal)
-- 5. Acme Corp Equity
--   * No statements ever! All manual updates with null FK to statement
--   * User starts with 1000 shares priced at $20 per share
--   * Manual share update in April to 1500 shares (RSU grant or something), no new row for price
--   * Manual price update in Septmeber to $30 per share (409a or something), no new row for shares
--
-- Starting balances (Jan 1, 2025):
--
-- - Acme Corp 401k: ~3,333 shares VTTSX @ $45 = ~$150k
-- - Roth IRA: ~667 shares VTTSX @ $45 = ~$30k
-- - Brokerage: ~667 shares VTI @ $270 = ~$180k
-- - Acme Corp Equity: 1,000 shares @ $20 = $20k
-- - Total: ~$380k
--
-- Key events:
--
-- - Jan-Dec: Monthly 401k contributions (~$1k/month)
-- - Jan-Dec: Monthly Roth contributions (~$200/month)
-- - Jan: Brokerage contribution ($5k VTI)
-- - Mar: Start selling VTI for cash ($25k → VMFXX)
-- - Jun: More VTI → VMFXX ($55k, now ~$80k cash)
-- - Jul: Home purchase ($80k equity, VMFXX → 0)
-- - Apr: Acme RSU grant (1000 → 1500 shares)
-- - Sep: Acme 409A valuation ($20 → $30/share)
-- - Oct: Brokerage contribution ($5k VTI)
-- - Dec: Home appraisal ($80k → $90k equity)

-- ============================================================================

-- To change the user/family, find and replace these UUIDs:
-- Family ID: 11111111-1111-1111-1111-111111111111
-- User ID (created_by): 6c6168b8-64df-4f6a-a5b4-b635b55c957b

-- Clean existing data for this family (if re-seeding)
delete from asset_allocations where asset_id in (select id from assets where family_id = '11111111-1111-1111-1111-111111111111');
delete from asset_holdings where asset_id in (select id from assets where family_id = '11111111-1111-1111-1111-111111111111');
delete from asset_prices where asset_id in (select id from assets where family_id = '11111111-1111-1111-1111-111111111111');
delete from statements where account_id in (select id from accounts where family_id = '11111111-1111-1111-1111-111111111111');
delete from assets where family_id = '11111111-1111-1111-1111-111111111111';
delete from accounts where family_id = '11111111-1111-1111-1111-111111111111';
delete from asset_classes where family_id = '11111111-1111-1111-1111-111111111111';
delete from profiles where family_id = '11111111-1111-1111-1111-111111111111';
delete from families where id = '11111111-1111-1111-1111-111111111111';

-- ============================================================================
-- FAMILY
-- ============================================================================

insert into families (id) values ('11111111-1111-1111-1111-111111111111');

-- ============================================================================
-- PROFILES
-- ============================================================================

-- Note: Profile requires a real user in auth.users. When testing manually,
-- create a user first, then update this ID and run the insert.
-- insert into profiles (id, family_id, name) values
--     ('6c6168b8-64df-4f6a-a5b4-b635b55c957b', '11111111-1111-1111-1111-111111111111', 'Test User');

-- ============================================================================
-- ASSET CLASSES
-- ============================================================================

insert into asset_classes (family_id, created_by, name, goal, sort_order) values
    ('11111111-1111-1111-1111-111111111111', '6c6168b8-64df-4f6a-a5b4-b635b55c957b', 'US Stocks', 0.50, 1),
    ('11111111-1111-1111-1111-111111111111', '6c6168b8-64df-4f6a-a5b4-b635b55c957b', 'Int''l Stocks', 0.20, 2),
    ('11111111-1111-1111-1111-111111111111', '6c6168b8-64df-4f6a-a5b4-b635b55c957b', 'Bonds', 0.20, 3),
    ('11111111-1111-1111-1111-111111111111', '6c6168b8-64df-4f6a-a5b4-b635b55c957b', 'Real Estate', 0.10, 4);

-- ============================================================================
-- ACCOUNTS
-- ============================================================================

insert into accounts (family_id, created_by, name, tags, rebalancing) values
    ('11111111-1111-1111-1111-111111111111', '6c6168b8-64df-4f6a-a5b4-b635b55c957b', 'Acme Corp 401k', '{"type": "retirement"}', true),
    ('11111111-1111-1111-1111-111111111111', '6c6168b8-64df-4f6a-a5b4-b635b55c957b', 'Roth IRA', '{"type": "retirement"}', true),
    ('11111111-1111-1111-1111-111111111111', '6c6168b8-64df-4f6a-a5b4-b635b55c957b', 'Brokerage', '{"type": "taxable"}', true),
    ('11111111-1111-1111-1111-111111111111', '6c6168b8-64df-4f6a-a5b4-b635b55c957b', 'Primary Residence', '{"type": "real_estate"}', false),
    ('11111111-1111-1111-1111-111111111111', '6c6168b8-64df-4f6a-a5b4-b635b55c957b', 'Acme Corp Equity', '{"type": "private"}', false);

-- ============================================================================
-- ASSETS
-- ============================================================================

insert into assets (family_id, created_by, ticker, name) values
    ('11111111-1111-1111-1111-111111111111', '6c6168b8-64df-4f6a-a5b4-b635b55c957b', 'VTI', 'Vanguard Total Stock Market ETF'),
    ('11111111-1111-1111-1111-111111111111', '6c6168b8-64df-4f6a-a5b4-b635b55c957b', 'VTTSX', 'Vanguard Target Retirement 2060'),
    ('11111111-1111-1111-1111-111111111111', '6c6168b8-64df-4f6a-a5b4-b635b55c957b', 'VMFXX', 'Vanguard Federal Money Market'),
    ('11111111-1111-1111-1111-111111111111', '6c6168b8-64df-4f6a-a5b4-b635b55c957b', null, 'Home Equity'),
    ('11111111-1111-1111-1111-111111111111', '6c6168b8-64df-4f6a-a5b4-b635b55c957b', null, 'Acme Corp Stock');

-- ============================================================================
-- ASSET ALLOCATIONS (linking assets to asset classes)
-- ============================================================================

-- VTI -> 100% US Stocks
insert into asset_allocations (asset_id, asset_class_id, percentage)
select a.id, ac.id, 1.0
from assets a, asset_classes ac
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTI'
  and ac.family_id = '11111111-1111-1111-1111-111111111111' and ac.name = 'US Stocks';

-- VTTSX -> 50% US stocks, 30% international stocks, 20% bonds
insert into asset_allocations (asset_id, asset_class_id, percentage)
select a.id, ac.id, 0.5
from assets a, asset_classes ac
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and ac.family_id = '11111111-1111-1111-1111-111111111111' and ac.name = 'US Stocks';

insert into asset_allocations (asset_id, asset_class_id, percentage)
select a.id, ac.id, 0.3
from assets a, asset_classes ac
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and ac.family_id = '11111111-1111-1111-1111-111111111111' and ac.name = 'Int''l Stocks';

insert into asset_allocations (asset_id, asset_class_id, percentage)
select a.id, ac.id, 0.2
from assets a, asset_classes ac
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and ac.family_id = '11111111-1111-1111-1111-111111111111' and ac.name = 'Bonds';

-- VMFXX -> 100% Bonds (cash/money market treated as bonds)
insert into asset_allocations (asset_id, asset_class_id, percentage)
select a.id, ac.id, 1.0
from assets a, asset_classes ac
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VMFXX'
  and ac.family_id = '11111111-1111-1111-1111-111111111111' and ac.name = 'Bonds';

-- Home Equity -> 100% Real Estate
insert into asset_allocations (asset_id, asset_class_id, percentage)
select a.id, ac.id, 1.0
from assets a, asset_classes ac
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.name = 'Home Equity'
  and ac.family_id = '11111111-1111-1111-1111-111111111111' and ac.name = 'Real Estate';

-- Acme Corp Stock -> 100% US Stocks
insert into asset_allocations (asset_id, asset_class_id, percentage)
select a.id, ac.id, 1.0
from assets a, asset_classes ac
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.name = 'Acme Corp Stock'
  and ac.family_id = '11111111-1111-1111-1111-111111111111' and ac.name = 'US Stocks';

-- ============================================================================
-- STATEMENTS
-- Monthly statements for 401k and Roth IRA (Jan-Dec)
-- Sporadic statements for Brokerage (Jan, Mar, Jun, Oct)
-- No statements for Primary Residence or Acme Corp Equity
-- ============================================================================

-- Acme Corp 401k statements (monthly)
-- created_at is 2-12 days after statement_date (realistic upload delays)
insert into statements (account_id, statement_date, created_at)
select id, '2025-01-31', '2025-02-03 10:15:00' from accounts where family_id = '11111111-1111-1111-1111-111111111111' and name = 'Acme Corp 401k';
insert into statements (account_id, statement_date, created_at)
select id, '2025-02-28', '2025-03-05 19:30:00' from accounts where family_id = '11111111-1111-1111-1111-111111111111' and name = 'Acme Corp 401k';
insert into statements (account_id, statement_date, created_at)
select id, '2025-03-31', '2025-04-02 08:45:00' from accounts where family_id = '11111111-1111-1111-1111-111111111111' and name = 'Acme Corp 401k';
insert into statements (account_id, statement_date, created_at)
select id, '2025-04-30', '2025-05-08 21:00:00' from accounts where family_id = '11111111-1111-1111-1111-111111111111' and name = 'Acme Corp 401k';
insert into statements (account_id, statement_date, created_at)
select id, '2025-05-31', '2025-06-04 14:20:00' from accounts where family_id = '11111111-1111-1111-1111-111111111111' and name = 'Acme Corp 401k';
insert into statements (account_id, statement_date, created_at)
select id, '2025-06-30', '2025-07-03 09:10:00' from accounts where family_id = '11111111-1111-1111-1111-111111111111' and name = 'Acme Corp 401k';
insert into statements (account_id, statement_date, created_at)
select id, '2025-07-31', '2025-08-12 16:45:00' from accounts where family_id = '11111111-1111-1111-1111-111111111111' and name = 'Acme Corp 401k';
insert into statements (account_id, statement_date, created_at)
select id, '2025-08-31', '2025-09-02 11:30:00' from accounts where family_id = '11111111-1111-1111-1111-111111111111' and name = 'Acme Corp 401k';
insert into statements (account_id, statement_date, created_at)
select id, '2025-09-30', '2025-10-06 20:15:00' from accounts where family_id = '11111111-1111-1111-1111-111111111111' and name = 'Acme Corp 401k';
insert into statements (account_id, statement_date, created_at)
select id, '2025-10-31', '2025-11-03 07:45:00' from accounts where family_id = '11111111-1111-1111-1111-111111111111' and name = 'Acme Corp 401k';
insert into statements (account_id, statement_date, created_at)
select id, '2025-11-30', '2025-12-04 18:00:00' from accounts where family_id = '11111111-1111-1111-1111-111111111111' and name = 'Acme Corp 401k';
insert into statements (account_id, statement_date, created_at)
select id, '2025-12-31', '2026-01-05 10:30:00' from accounts where family_id = '11111111-1111-1111-1111-111111111111' and name = 'Acme Corp 401k';

-- Roth IRA statements (monthly)
-- Uploaded same day as 401k statements (user does them together)
insert into statements (account_id, statement_date, created_at)
select id, '2025-01-31', '2025-02-03 10:25:00' from accounts where family_id = '11111111-1111-1111-1111-111111111111' and name = 'Roth IRA';
insert into statements (account_id, statement_date, created_at)
select id, '2025-02-28', '2025-03-05 19:40:00' from accounts where family_id = '11111111-1111-1111-1111-111111111111' and name = 'Roth IRA';
insert into statements (account_id, statement_date, created_at)
select id, '2025-03-31', '2025-04-02 08:55:00' from accounts where family_id = '11111111-1111-1111-1111-111111111111' and name = 'Roth IRA';
insert into statements (account_id, statement_date, created_at)
select id, '2025-04-30', '2025-05-08 21:10:00' from accounts where family_id = '11111111-1111-1111-1111-111111111111' and name = 'Roth IRA';
insert into statements (account_id, statement_date, created_at)
select id, '2025-05-31', '2025-06-04 14:30:00' from accounts where family_id = '11111111-1111-1111-1111-111111111111' and name = 'Roth IRA';
insert into statements (account_id, statement_date, created_at)
select id, '2025-06-30', '2025-07-03 09:20:00' from accounts where family_id = '11111111-1111-1111-1111-111111111111' and name = 'Roth IRA';
insert into statements (account_id, statement_date, created_at)
select id, '2025-07-31', '2025-08-12 16:55:00' from accounts where family_id = '11111111-1111-1111-1111-111111111111' and name = 'Roth IRA';
insert into statements (account_id, statement_date, created_at)
select id, '2025-08-31', '2025-09-02 11:40:00' from accounts where family_id = '11111111-1111-1111-1111-111111111111' and name = 'Roth IRA';
insert into statements (account_id, statement_date, created_at)
select id, '2025-09-30', '2025-10-06 20:25:00' from accounts where family_id = '11111111-1111-1111-1111-111111111111' and name = 'Roth IRA';
insert into statements (account_id, statement_date, created_at)
select id, '2025-10-31', '2025-11-03 07:55:00' from accounts where family_id = '11111111-1111-1111-1111-111111111111' and name = 'Roth IRA';
insert into statements (account_id, statement_date, created_at)
select id, '2025-11-30', '2025-12-04 18:10:00' from accounts where family_id = '11111111-1111-1111-1111-111111111111' and name = 'Roth IRA';
insert into statements (account_id, statement_date, created_at)
select id, '2025-12-31', '2026-01-05 10:40:00' from accounts where family_id = '11111111-1111-1111-1111-111111111111' and name = 'Roth IRA';

-- Brokerage statements (sporadic: Jan, Mar, Jun, Oct)
insert into statements (account_id, statement_date, created_at)
select id, '2025-01-31', '2025-02-03 10:35:00' from accounts where family_id = '11111111-1111-1111-1111-111111111111' and name = 'Brokerage';
insert into statements (account_id, statement_date, created_at)
select id, '2025-03-31', '2025-04-02 09:05:00' from accounts where family_id = '11111111-1111-1111-1111-111111111111' and name = 'Brokerage';
insert into statements (account_id, statement_date, created_at)
select id, '2025-06-30', '2025-07-03 09:30:00' from accounts where family_id = '11111111-1111-1111-1111-111111111111' and name = 'Brokerage';
insert into statements (account_id, statement_date, created_at)
select id, '2025-10-31', '2025-11-03 08:05:00' from accounts where family_id = '11111111-1111-1111-1111-111111111111' and name = 'Brokerage';

-- ============================================================================
-- ASSET PRICES
-- VTTSX: Monthly prices from statements (401k/Roth)
-- VTI: Monthly prices (from statements when available, manual otherwise)
-- VMFXX: $1.00 always (money market)
-- Home Equity: Jul purchase $80k, Dec appraisal $90k
-- Acme Corp Stock: Jan $20, Sep 409A update $30
-- ============================================================================

-- VTTSX prices (from 401k statements - same asset used by both 401k and Roth)
-- created_at matches the statement's created_at
insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-01-31', 45.20, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-02-03 10:15:00'
from assets a, statements s, accounts acc
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Acme Corp 401k'
  and s.account_id = acc.id and s.statement_date = '2025-01-31';

insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-02-28', 45.50, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-03-05 19:30:00'
from assets a, statements s, accounts acc
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Acme Corp 401k'
  and s.account_id = acc.id and s.statement_date = '2025-02-28';

insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-03-31', 44.80, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-04-02 08:45:00'
from assets a, statements s, accounts acc
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Acme Corp 401k'
  and s.account_id = acc.id and s.statement_date = '2025-03-31';

insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-04-30', 46.10, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-05-08 21:00:00'
from assets a, statements s, accounts acc
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Acme Corp 401k'
  and s.account_id = acc.id and s.statement_date = '2025-04-30';

insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-05-31', 46.50, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-06-04 14:20:00'
from assets a, statements s, accounts acc
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Acme Corp 401k'
  and s.account_id = acc.id and s.statement_date = '2025-05-31';

insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-06-30', 45.90, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-07-03 09:10:00'
from assets a, statements s, accounts acc
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Acme Corp 401k'
  and s.account_id = acc.id and s.statement_date = '2025-06-30';

insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-07-31', 47.20, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-08-12 16:45:00'
from assets a, statements s, accounts acc
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Acme Corp 401k'
  and s.account_id = acc.id and s.statement_date = '2025-07-31';

insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-08-31', 46.80, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-09-02 11:30:00'
from assets a, statements s, accounts acc
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Acme Corp 401k'
  and s.account_id = acc.id and s.statement_date = '2025-08-31';

insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-09-30', 45.60, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-10-06 20:15:00'
from assets a, statements s, accounts acc
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Acme Corp 401k'
  and s.account_id = acc.id and s.statement_date = '2025-09-30';

insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-10-31', 46.40, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-11-03 07:45:00'
from assets a, statements s, accounts acc
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Acme Corp 401k'
  and s.account_id = acc.id and s.statement_date = '2025-10-31';

insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-11-30', 47.50, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-12-04 18:00:00'
from assets a, statements s, accounts acc
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Acme Corp 401k'
  and s.account_id = acc.id and s.statement_date = '2025-11-30';

insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-12-31', 48.20, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2026-01-05 10:30:00'
from assets a, statements s, accounts acc
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Acme Corp 401k'
  and s.account_id = acc.id and s.statement_date = '2025-12-31';

-- VTI prices (from Brokerage statements when available, manual otherwise)
-- Jan, Mar, Jun, Oct have statements; others are manual updates
insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-01-31', 271.50, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-02-03 10:35:00'
from assets a, statements s, accounts acc
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTI'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Brokerage'
  and s.account_id = acc.id and s.statement_date = '2025-01-31';

insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-02-28', 274.20, null, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-03-03 12:15:00'
from assets a
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTI';

insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-03-31', 268.80, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-04-02 09:05:00'
from assets a, statements s, accounts acc
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTI'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Brokerage'
  and s.account_id = acc.id and s.statement_date = '2025-03-31';

insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-04-30', 276.40, null, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-05-02 08:30:00'
from assets a
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTI';

insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-05-31', 280.10, null, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-06-03 17:45:00'
from assets a
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTI';

insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-06-30', 278.50, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-07-03 09:30:00'
from assets a, statements s, accounts acc
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTI'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Brokerage'
  and s.account_id = acc.id and s.statement_date = '2025-06-30';

insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-07-31', 285.30, null, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-08-05 19:20:00'
from assets a
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTI';

insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-08-31', 282.70, null, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-09-04 10:10:00'
from assets a
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTI';

insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-09-30', 275.90, null, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-10-03 14:30:00'
from assets a
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTI';

insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-10-31', 281.20, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-11-03 08:05:00'
from assets a, statements s, accounts acc
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTI'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Brokerage'
  and s.account_id = acc.id and s.statement_date = '2025-10-31';

insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-11-30', 289.60, null, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-12-06 11:45:00'
from assets a
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTI';

insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-12-31', 295.40, null, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2026-01-04 09:15:00'
from assets a
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTI';

-- VMFXX prices (money market, always $1.00)
-- Only need prices for months where there are holdings (Mar-Jul)
insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-03-31', 1.00, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-04-02 09:05:00'
from assets a, statements s, accounts acc
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VMFXX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Brokerage'
  and s.account_id = acc.id and s.statement_date = '2025-03-31';

insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-06-30', 1.00, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-07-03 09:30:00'
from assets a, statements s, accounts acc
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VMFXX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Brokerage'
  and s.account_id = acc.id and s.statement_date = '2025-06-30';

insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-07-31', 1.00, null, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-08-05 19:25:00'
from assets a
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VMFXX';

-- Home Equity prices (manual updates only)
-- Jul: Purchased at $80k equity
-- Dec: Appraisal shows $90k equity
insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-07-31', 80000.00, null, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-08-03 14:00:00'
from assets a
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.name = 'Home Equity';

insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-12-31', 90000.00, null, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2026-01-08 16:30:00'
from assets a
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.name = 'Home Equity';

-- Acme Corp Stock prices (manual updates only)
-- Jan: Initial price $20/share
-- Sep: 409A valuation update to $30/share
insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-01-31', 20.00, null, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-02-05 11:00:00'
from assets a
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.name = 'Acme Corp Stock';

insert into asset_prices (asset_id, price_date, price, statement_id, created_by, created_at)
select a.id, '2025-09-30', 30.00, null, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-10-10 15:45:00'
from assets a
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.name = 'Acme Corp Stock';

-- ============================================================================
-- ASSET HOLDINGS
-- Tracks quantity of each asset in each account over time
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Acme Corp 401k - VTTSX holdings (monthly, ~$1000 contributions)
-- Starting: ~$150k / $45 = 3,333 shares
-- Each month adds ~$1000 / price worth of shares
-- created_at matches the statement's created_at
-- ----------------------------------------------------------------------------
insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-01-31', 3355.55, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-02-03 10:15:00'
from assets a, accounts acc, statements s
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Acme Corp 401k'
  and s.account_id = acc.id and s.statement_date = '2025-01-31';

insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-02-28', 3377.54, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-03-05 19:30:00'
from assets a, accounts acc, statements s
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Acme Corp 401k'
  and s.account_id = acc.id and s.statement_date = '2025-02-28';

insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-03-31', 3399.86, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-04-02 08:45:00'
from assets a, accounts acc, statements s
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Acme Corp 401k'
  and s.account_id = acc.id and s.statement_date = '2025-03-31';

insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-04-30', 3421.55, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-05-08 21:00:00'
from assets a, accounts acc, statements s
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Acme Corp 401k'
  and s.account_id = acc.id and s.statement_date = '2025-04-30';

insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-05-31', 3443.06, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-06-04 14:20:00'
from assets a, accounts acc, statements s
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Acme Corp 401k'
  and s.account_id = acc.id and s.statement_date = '2025-05-31';

insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-06-30', 3464.85, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-07-03 09:10:00'
from assets a, accounts acc, statements s
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Acme Corp 401k'
  and s.account_id = acc.id and s.statement_date = '2025-06-30';

insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-07-31', 3486.04, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-08-12 16:45:00'
from assets a, accounts acc, statements s
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Acme Corp 401k'
  and s.account_id = acc.id and s.statement_date = '2025-07-31';

insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-08-31', 3507.41, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-09-02 11:30:00'
from assets a, accounts acc, statements s
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Acme Corp 401k'
  and s.account_id = acc.id and s.statement_date = '2025-08-31';

insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-09-30', 3529.34, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-10-06 20:15:00'
from assets a, accounts acc, statements s
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Acme Corp 401k'
  and s.account_id = acc.id and s.statement_date = '2025-09-30';

insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-10-31', 3550.90, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-11-03 07:45:00'
from assets a, accounts acc, statements s
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Acme Corp 401k'
  and s.account_id = acc.id and s.statement_date = '2025-10-31';

insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-11-30', 3571.95, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-12-04 18:00:00'
from assets a, accounts acc, statements s
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Acme Corp 401k'
  and s.account_id = acc.id and s.statement_date = '2025-11-30';

insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-12-31', 3592.70, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2026-01-05 10:30:00'
from assets a, accounts acc, statements s
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Acme Corp 401k'
  and s.account_id = acc.id and s.statement_date = '2025-12-31';

-- ----------------------------------------------------------------------------
-- Roth IRA - VTTSX holdings (monthly, ~$200 contributions)
-- Starting: ~$30k / $45 = 667 shares
-- Each month adds ~$200 / price worth of shares
-- created_at matches the Roth IRA statement's created_at
-- ----------------------------------------------------------------------------
insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-01-31', 671.09, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-02-03 10:25:00'
from assets a, accounts acc, statements s
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Roth IRA'
  and s.account_id = acc.id and s.statement_date = '2025-01-31';

insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-02-28', 675.49, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-03-05 19:40:00'
from assets a, accounts acc, statements s
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Roth IRA'
  and s.account_id = acc.id and s.statement_date = '2025-02-28';

insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-03-31', 679.95, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-04-02 08:55:00'
from assets a, accounts acc, statements s
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Roth IRA'
  and s.account_id = acc.id and s.statement_date = '2025-03-31';

insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-04-30', 684.29, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-05-08 21:10:00'
from assets a, accounts acc, statements s
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Roth IRA'
  and s.account_id = acc.id and s.statement_date = '2025-04-30';

insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-05-31', 688.59, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-06-04 14:30:00'
from assets a, accounts acc, statements s
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Roth IRA'
  and s.account_id = acc.id and s.statement_date = '2025-05-31';

insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-06-30', 692.95, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-07-03 09:20:00'
from assets a, accounts acc, statements s
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Roth IRA'
  and s.account_id = acc.id and s.statement_date = '2025-06-30';

insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-07-31', 697.19, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-08-12 16:55:00'
from assets a, accounts acc, statements s
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Roth IRA'
  and s.account_id = acc.id and s.statement_date = '2025-07-31';

insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-08-31', 701.46, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-09-02 11:40:00'
from assets a, accounts acc, statements s
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Roth IRA'
  and s.account_id = acc.id and s.statement_date = '2025-08-31';

insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-09-30', 705.85, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-10-06 20:25:00'
from assets a, accounts acc, statements s
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Roth IRA'
  and s.account_id = acc.id and s.statement_date = '2025-09-30';

insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-10-31', 710.16, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-11-03 07:55:00'
from assets a, accounts acc, statements s
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Roth IRA'
  and s.account_id = acc.id and s.statement_date = '2025-10-31';

insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-11-30', 714.37, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-12-04 18:10:00'
from assets a, accounts acc, statements s
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Roth IRA'
  and s.account_id = acc.id and s.statement_date = '2025-11-30';

insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-12-31', 718.52, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2026-01-05 10:40:00'
from assets a, accounts acc, statements s
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTTSX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Roth IRA'
  and s.account_id = acc.id and s.statement_date = '2025-12-31';

-- ----------------------------------------------------------------------------
-- Brokerage - VTI holdings
-- Starting: ~$180k / $270 = 667 shares
-- Jan: +$5k contribution = +18.4 shares
-- Mar: Sell $25k for down payment = -93 shares
-- Jun: Sell $55k for down payment = -198 shares
-- Oct: +$5k contribution = +17.8 shares
-- ----------------------------------------------------------------------------
insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-01-31', 685.07, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-02-03 10:35:00'
from assets a, accounts acc, statements s
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTI'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Brokerage'
  and s.account_id = acc.id and s.statement_date = '2025-01-31';

insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-03-31', 592.08, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-04-02 09:05:00'
from assets a, accounts acc, statements s
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTI'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Brokerage'
  and s.account_id = acc.id and s.statement_date = '2025-03-31';

insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-06-30', 394.60, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-07-03 09:30:00'
from assets a, accounts acc, statements s
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTI'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Brokerage'
  and s.account_id = acc.id and s.statement_date = '2025-06-30';

insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-10-31', 412.38, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-11-03 08:05:00'
from assets a, accounts acc, statements s
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VTI'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Brokerage'
  and s.account_id = acc.id and s.statement_date = '2025-10-31';

-- ----------------------------------------------------------------------------
-- Brokerage - VMFXX holdings (cash for down payment)
-- Mar: Sell VTI, buy $25k VMFXX
-- Jun: Sell more VTI, now $80k VMFXX total
-- Jul: Used for down payment, back to 0 (manual update)
-- ----------------------------------------------------------------------------
insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-03-31', 25000.00, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-04-02 09:05:00'
from assets a, accounts acc, statements s
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VMFXX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Brokerage'
  and s.account_id = acc.id and s.statement_date = '2025-03-31';

insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-06-30', 80000.00, s.id, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-07-03 09:30:00'
from assets a, accounts acc, statements s
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VMFXX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Brokerage'
  and s.account_id = acc.id and s.statement_date = '2025-06-30';

insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-07-31', 0.00, null, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-08-05 19:25:00'
from assets a, accounts acc
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.ticker = 'VMFXX'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Brokerage';

-- ----------------------------------------------------------------------------
-- Primary Residence - Home Equity holdings
-- Jul: Purchased (1 "share" representing ownership)
-- No changes after - just tracks that you own it
-- ----------------------------------------------------------------------------
insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-07-31', 1.00, null, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-08-03 14:00:00'
from assets a, accounts acc
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.name = 'Home Equity'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Primary Residence';

-- ----------------------------------------------------------------------------
-- Acme Corp Equity - Private stock holdings
-- Jan: Initial grant of 1000 shares
-- Apr: RSU vesting, now 1500 shares (manual update)
-- ----------------------------------------------------------------------------
insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-01-31', 1000.00, null, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-02-05 11:00:00'
from assets a, accounts acc
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.name = 'Acme Corp Stock'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Acme Corp Equity';

insert into asset_holdings (asset_id, account_id, holding_date, quantity, statement_id, created_by, created_at)
select a.id, acc.id, '2025-04-30', 1500.00, null, '6c6168b8-64df-4f6a-a5b4-b635b55c957b', '2025-05-06 09:30:00'
from assets a, accounts acc
where a.family_id = '11111111-1111-1111-1111-111111111111' and a.name = 'Acme Corp Stock'
  and acc.family_id = '11111111-1111-1111-1111-111111111111' and acc.name = 'Acme Corp Equity';
