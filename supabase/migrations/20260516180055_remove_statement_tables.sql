-- Drop legacy tables that were replaced by the unified updates schema
-- (data was migrated in 20260512000000_unified_updates.sql)

-- Drop in order: child tables first (they reference statements via FK)
drop table if exists asset_holdings;
drop table if exists asset_prices;
drop table if exists statements;
