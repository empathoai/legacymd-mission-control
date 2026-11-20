-- C10: the closed expense month still has its guard trigger enabled.
-- A behavior enforced by a trigger is referenced here, not re-tested.
select
  'expense_entries_guard' as expected_trigger,
  'missing or disabled' as problem
where not exists (
  select 1
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'expense_entries'
    and t.tgname = 'expense_entries_guard'
    and t.tgenabled = 'O'
);
