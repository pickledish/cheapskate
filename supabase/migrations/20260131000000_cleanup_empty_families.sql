-- ============================================================================
-- Cleanup Empty Families Trigger
-- Automatically deletes families when no profiles remain
-- Handles both: user deletes account, user changes to different family
-- ============================================================================

-- Function that checks if the old family is now empty and deletes it
create or replace function cleanup_empty_family()
returns trigger
language plpgsql
security definer  -- Run as owner to bypass RLS
as $$
begin
  -- For UPDATE, only act if family_id actually changed
  if TG_OP = 'UPDATE' and OLD.family_id = NEW.family_id then
    return null;
  end if;

  -- Delete old family if no profiles remain (CASCADE cleans up all data)
  if not exists (select 1 from profiles where family_id = OLD.family_id) then
    delete from families where id = OLD.family_id;
  end if;

  return null;  -- Return value is ignored for AFTER triggers
end;
$$;

-- Trigger fires AFTER DELETE or UPDATE of family_id on profiles
create trigger trigger_cleanup_empty_family
  after delete or update of family_id on profiles
  for each row
  execute function cleanup_empty_family();

comment on function cleanup_empty_family() is
  'Automatically deletes families when the last member leaves or deletes their account';
