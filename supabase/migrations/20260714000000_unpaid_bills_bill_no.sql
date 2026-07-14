-- Add bill / reference number for A/P Ageing Detail "No." column
alter table public.unpaid_bills
  add column if not exists bill_no text;

create index if not exists idx_unpaid_bills_bill_no
  on public.unpaid_bills (bill_no)
  where bill_no is not null and bill_no <> '';
