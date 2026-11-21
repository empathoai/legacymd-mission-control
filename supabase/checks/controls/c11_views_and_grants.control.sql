-- Control for C11: a grant for anon and a table without RLS must both be reported.
-- `ensure_rls` turns RLS on at CREATE TABLE, so the control disables it inside this
-- transaction; otherwise the RLS branch of the check is never exercised. Rolls back.
begin;

alter event trigger ensure_rls disable;

grant select on public.customers to anon;
create table public.control_no_rls (id int);

select
  c.relname as object_name,
  'view without security_invoker' as problem
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'v'
  and not ('security_invoker=true' = any(coalesce(c.reloptions, '{}')))
union all
select
  g.table_name,
  'grant for ' || g.grantee || ' (' || g.privilege_type || ')'
from information_schema.role_table_grants g
where g.table_schema = 'public'
  and g.grantee in ('anon', 'authenticated')
union all
select
  c.relname,
  'table without row level security'
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and not c.relrowsecurity
order by 1, 2;

rollback;
