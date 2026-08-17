-- ============================================================================
-- Read-only accounts (app_metadata.read_only)
--
-- When the JWT has app_metadata.read_only = true, all writes to public tables
-- are rejected with a clear error. Identity changes on auth.users (email,
-- password, phone, user_metadata) are also rejected.
--
-- Not blocked, by design:
--   - SELECT
--   - login / token refresh (last_sign_in_at, recovery tokens, etc.)
--   - admin/service-role writes (no user JWT, or JWT without the flag)
--   - auth.users DELETE (seed cleanup + delete-account use the admin API;
--     delete-account rejects read-only users in the edge function instead)
--
-- New public tables: after enable RLS / policies, also
--   select public.attach_read_only_write_guard('public.<table>');
-- ============================================================================

create or replace function public.reject_read_only_writes()
returns trigger
language plpgsql
as $$
begin
  if coalesce((auth.jwt() -> 'app_metadata' ->> 'read_only')::boolean, false) then
    raise exception 'This account is read-only'
      using errcode = 'P0001',
            hint = 'Read-only accounts cannot create, update, or delete data.';
  end if;
  return null; -- statement-level; return value is ignored
end;
$$;

comment on function public.reject_read_only_writes() is
  'BEFORE INSERT/UPDATE/DELETE statement trigger: abort if JWT app_metadata.read_only is true';

-- Idempotent helper: call once per table, alongside that table's RLS policies.
create or replace function public.attach_read_only_write_guard(tbl regclass)
returns void
language plpgsql
as $$
begin
  execute format('drop trigger if exists reject_read_only_writes on %s', tbl);
  execute format(
    'create trigger reject_read_only_writes
       before insert or update or delete on %s
       for each statement
       execute function public.reject_read_only_writes()',
    tbl
  );
end;
$$;

comment on function public.attach_read_only_write_guard(regclass) is
  'Attach reject_read_only_writes to a single table. Call from that table''s migration.';

select public.attach_read_only_write_guard('public.families');
select public.attach_read_only_write_guard('public.profiles');
select public.attach_read_only_write_guard('public.accounts');
select public.attach_read_only_write_guard('public.assets');
select public.attach_read_only_write_guard('public.asset_classes');
select public.attach_read_only_write_guard('public.asset_allocations');
select public.attach_read_only_write_guard('public.asset_aliases');
select public.attach_read_only_write_guard('public.updates');
select public.attach_read_only_write_guard('public.price_updates');
select public.attach_read_only_write_guard('public.holding_updates');

-- ----------------------------------------------------------------------------
-- auth.users: block identity edits for read-only rows.
-- GoTrue writes as supabase_auth_admin without a PostgREST JWT, so we key off
-- the row's raw_app_meta_data, not auth.jwt(). Login must still be allowed.
-- ----------------------------------------------------------------------------

create or replace function public.reject_read_only_auth_user_changes()
returns trigger
language plpgsql
as $$
begin
  if not coalesce((old.raw_app_meta_data ->> 'read_only')::boolean, false) then
    return new;
  end if;

  if new.email is distinct from old.email
     or new.encrypted_password is distinct from old.encrypted_password
     or new.phone is distinct from old.phone
     or new.raw_user_meta_data is distinct from old.raw_user_meta_data
     or new.email_change is distinct from old.email_change
     or new.phone_change is distinct from old.phone_change
  then
    raise exception 'This account is read-only'
      using errcode = 'P0001',
            hint = 'Read-only accounts cannot change email, password, phone, or profile metadata.';
  end if;

  return new;
end;
$$;

comment on function public.reject_read_only_auth_user_changes() is
  'BEFORE UPDATE on auth.users: block identity changes when raw_app_meta_data.read_only is true';

create trigger reject_read_only_auth_user_changes
  before update on auth.users
  for each row
  execute function public.reject_read_only_auth_user_changes();
