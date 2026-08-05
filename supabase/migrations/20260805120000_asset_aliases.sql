-- ============================================================================
-- Per-account asset aliases
-- Maps statement fund labels (ticker-less holdings) to assets within an account
-- ============================================================================

create table asset_aliases (
    account_id bigint not null references accounts(id) on delete cascade,
    label text not null,
    asset_id bigint not null references assets(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (account_id, label)
);

alter table asset_aliases enable row level security;

create policy "Family members can view aliases for their accounts"
    on asset_aliases for select
    using (
        account_id in (
            select id from accounts where family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid
        )
    );

create policy "Family members can insert aliases for their accounts"
    on asset_aliases for insert
    with check (
        account_id in (
            select id from accounts where family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid
        )
    );

create policy "Family members can delete aliases for their accounts"
    on asset_aliases for delete
    using (
        account_id in (
            select id from accounts where family_id = (auth.jwt() -> 'user_metadata' ->> 'family_id')::uuid
        )
    );

create index idx_asset_aliases_asset_id on asset_aliases(asset_id);
