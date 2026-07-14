-- QuickBooks Expenses export has no status column; only in-app bills use status.

alter table public.expense_transactions
  alter column status drop not null,
  alter column status drop default;

update public.expense_transactions
set status = null
where source_row_number is not null;
