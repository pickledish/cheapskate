-- Replace accounts.archived_at (date) with is_archived (boolean).
-- Close date lives on updates.effective_date for mark_as_closed rows.

alter table accounts add column is_archived boolean not null default false;

update accounts set is_archived = true where archived_at is not null;

alter table accounts drop column archived_at;
