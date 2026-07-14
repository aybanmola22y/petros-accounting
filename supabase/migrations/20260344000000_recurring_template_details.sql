-- Store the full recurring transaction editor payload (category lines, item
-- lines, payment account, memo, tags, and the recurring schedule) so that
-- opening a saved template restores every field, not just the summary columns.
alter table public.recurring_templates
  add column if not exists details jsonb;

-- Refresh PostgREST schema cache so the API sees the new column immediately.
notify pgrst, 'reload schema';
