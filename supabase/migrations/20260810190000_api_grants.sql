-- ============================================================================
-- Explicit Data API grants (post May 2026 default: no auto-expose)
--
-- anon: no public table access — the app only uses public tables when signed in.
-- authenticated + service_role: full CRUD; RLS still decides which rows.
-- ============================================================================

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on all tables in schema public
  to authenticated, service_role;

grant usage, select on all sequences in schema public
  to authenticated, service_role;

-- Future tables / sequences created by postgres in public
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;

alter default privileges for role postgres in schema public
  grant usage, select on sequences to authenticated, service_role;
