-- C11: no view is SECURITY DEFINER, no API role regained a grant, every table has RLS.
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
