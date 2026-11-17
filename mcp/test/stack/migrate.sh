#!/bin/sh
# Apply each file in /migrations once, in name order, each in one transaction.
set -eu
psql -v ON_ERROR_STOP=1 -q <<'SQL'
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
    version text primary key,
    name text not null,
    applied_at timestamptz not null default now()
);
SQL
for f in /migrations/*.sql; do
    base=$(basename "$f" .sql)
    version=${base%%_*}
    name=${base#*_}
    applied=$(psql -v ON_ERROR_STOP=1 -Atc \
        "select 1 from supabase_migrations.schema_migrations where version = '$version'")
    [ "$applied" = 1 ] && continue
    echo "applying $base"
    psql -v ON_ERROR_STOP=1 -q -1 -f "$f" \
        -c "insert into supabase_migrations.schema_migrations (version, name) values ('$version', '$name')"
done
psql -v ON_ERROR_STOP=1 -q -c "notify pgrst, 'reload schema'"
echo "migrations applied in total: $(psql -Atc 'select count(*) from supabase_migrations.schema_migrations')"
