-- Rename accounts.rebalancing to in_portfolio (current-state cache).
-- Transition dates live on updates.effective_date.

alter table accounts rename column rebalancing to in_portfolio;
