-- asset_prices: change statement_id FK from set null to cascade
alter table asset_prices drop constraint asset_prices_statement_id_fkey;
alter table asset_prices add constraint asset_prices_statement_id_fkey
  foreign key (statement_id) references statements(id) on delete cascade;

-- asset_holdings: change statement_id FK from set null to cascade
alter table asset_holdings drop constraint asset_holdings_statement_id_fkey;
alter table asset_holdings add constraint asset_holdings_statement_id_fkey
  foreign key (statement_id) references statements(id) on delete cascade;
