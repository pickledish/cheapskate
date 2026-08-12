-- Allow include_in_portfolio update events (illiquid → liquid as of effective_date).

alter table updates drop constraint updates_update_type_check;

alter table updates add constraint updates_update_type_check
  check (update_type in (
    'statement',
    'manual_price',
    'manual_holdings',
    'mark_as_closed',
    'include_in_portfolio'
  ));
