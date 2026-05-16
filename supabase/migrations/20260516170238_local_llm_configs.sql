-- Add preferences JSON column to profiles for per-user settings
alter table profiles
    add column preferences jsonb not null default '{}';
