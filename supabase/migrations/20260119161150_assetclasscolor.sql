-- Add user-selectable color to asset classes
alter table asset_classes add column color text not null default 'red';
