-- 093700_sale_void.sql
-- A sale with no money collected can be voided: it never happened. A sale with receipts or
-- returns cannot be voided, only returned. Everything else on a sale is immutable.

alter table public.sales
  add column if not exists voided_at  timestamptz,
  add column if not exists void_reason text,
  add column if not exists voided_by  text;

alter table public.sales
  drop constraint if exists voided_has_reason;
alter table public.sales
  add constraint voided_has_reason check ((voided_at is null) = (void_reason is null));

create or replace function public.guard_sale_void() returns trigger
language plpgsql as $$
begin
  if new.occurred_on <> old.occurred_on
     or new.customer_id <> old.customer_id
     or new.is_first_visit <> old.is_first_visit then
    raise exception 'a sale is immutable except for its void' using errcode = '23514';
  end if;

  if new.voided_at is not null and old.voided_at is null then
    if exists (
      select 1 from public.payment_receipts r
      join public.sale_payments p on p.id = r.sale_payment_id
      where p.sale_id = new.id
    ) or exists (
      select 1 from public.sale_refunds where sale_id = new.id
    ) then
      raise exception 'a sale with receipts or returns cannot be voided; record a return instead'
        using errcode = '23514';
    end if;
  end if;

  if new.voided_at is null and old.voided_at is not null then
    raise exception 'a voided sale cannot be reopened' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists sales_guard_void on public.sales;
create trigger sales_guard_void
  before update on public.sales
  for each row execute function public.guard_sale_void();
