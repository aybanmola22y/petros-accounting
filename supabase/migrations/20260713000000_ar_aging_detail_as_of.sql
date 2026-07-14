-- Persist the QuickBooks "as of" date on A/R Ageing Detail imports.

alter table public.ar_aging_detail_lines
  add column if not exists as_of text;
