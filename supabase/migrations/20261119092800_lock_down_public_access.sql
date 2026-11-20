-- 20261119092800_lock_down_public_access.sql
-- Before this file the publishable key could read everything: RLS was enabled on
-- all 18 tables with zero policies, but every view is owned by postgres and was
-- therefore SECURITY DEFINER, and anon/authenticated held ALL on all 18 tables
-- and all 15 views. Anyone with the publishable key could read every customer and
-- the whole revenue through /rest/v1/*.
--
-- Access model: server-only. The Next.js server talks to Postgres with the secret
-- key (service_role, which bypasses RLS); the browser never talks to the Data API.
-- With no grants for anon/authenticated, there is no policy to forget, and the
-- schema is not exposed at all. Login and sessions are unaffected: they live in
-- the auth schema, not in public.
--
-- RLS stays enabled with zero policies on purpose: if a grant is ever restored by
-- mistake, the tables still return nothing.

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;

alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated, public;

-- Views must follow RLS as well, so restoring a grant cannot reopen the hole.
alter view public.cash_forecast             set (security_invoker = true);
alter view public.customer_balances         set (security_invoker = true);
alter view public.discount_by_month         set (security_invoker = true);
alter view public.expense_by_category       set (security_invoker = true);
alter view public.item_profitability        set (security_invoker = true);
alter view public.marketing_performance     set (security_invoker = true);
alter view public.monthly_balance           set (security_invoker = true);
alter view public.monthly_pl                set (security_invoker = true);
alter view public.product_performance       set (security_invoker = true);
alter view public.profitability_by_category set (security_invoker = true);
alter view public.profitability_by_kind     set (security_invoker = true);
alter view public.revenue_by_category       set (security_invoker = true);
alter view public.sales_with_totals         set (security_invoker = true);
alter view public.services_performance      set (security_invoker = true);
alter view public.treatment_performance     set (security_invoker = true);

comment on schema public is
  'Private data. No grants for anon/authenticated; the app reaches it only from the server with the secret key.';
