-- 20261120110000_create_sale.sql
-- The sale entry screen writes through this one function, so the sale, its frozen
-- list prices, the payment plan and the receipts land together or not at all.
-- It is the only writer of a live sale: no screen inserts into sales, sale_items,
-- sale_payments or payment_receipts directly.
--
-- What it derives, so the screen cannot get it wrong:
--   * visit_number and is_first_visit from the customer's own history;
--   * list_price from the price list in force on the business day (C06);
--   * the line category from the catalog item's default when the screen omits it.
-- What it enforces: the payment plan must equal the sale total (C01), and a first
-- visit must carry a source.

create or replace function public.create_sale(
  p_customer_id    uuid,
  p_occurred_on    date,
  p_billed_at      timestamptz,
  p_source_id      uuid,
  p_appointment_id uuid,
  p_notes          text,
  p_by             text,
  p_lines          jsonb,
  p_payments       jsonb
) returns uuid
language plpgsql
as $$
declare
  v_sale_id      uuid;
  v_visit_number integer;
  v_is_first     boolean;
  v_sold         numeric(12,2);
  v_planned      numeric(12,2);
  v_list_price   numeric(10,2);
  v_category_id  uuid;
  v_item_ok      boolean;
  ln             record;
  pay            record;
begin
  if p_by is null or btrim(p_by) = '' then
    raise exception 'recorded_by is required' using errcode = '22023';
  end if;
  if p_customer_id is null then
    raise exception 'a customer is required' using errcode = '22023';
  end if;
  if p_occurred_on is null then
    raise exception 'a business day is required' using errcode = '22023';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'at least one sale line is required' using errcode = '22023';
  end if;
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then
    raise exception 'at least one payment is required' using errcode = '22023';
  end if;

  -- Serialize the visit ordinal per customer, then derive the first-visit flag.
  perform 1 from public.customers where id = p_customer_id for update;
  if not found then
    raise exception 'customer % does not exist', p_customer_id using errcode = '23503';
  end if;

  select coalesce(max(visit_number), 0) + 1 into v_visit_number
  from public.sales where customer_id = p_customer_id;
  v_is_first := (v_visit_number = 1);

  if v_is_first and p_source_id is null then
    raise exception 'a source is required on the first visit' using errcode = '22023';
  end if;

  -- Validate the lines and total them.
  v_sold := 0;
  for ln in
    select * from jsonb_to_recordset(p_lines) as l(
      kind text, item_id uuid, category_id uuid, description text,
      quantity numeric, unit_price numeric)
  loop
    if ln.kind is null or ln.kind not in ('treatment', 'product', 'service', 'custom') then
      raise exception 'unknown line kind %', ln.kind using errcode = '22023';
    end if;
    if ln.quantity is null or ln.quantity <= 0 then
      raise exception 'every line needs a positive quantity' using errcode = '22023';
    end if;
    if ln.unit_price is null or ln.unit_price < 0 then
      raise exception 'every line needs a price of zero or more' using errcode = '22023';
    end if;

    if ln.kind = 'custom' then
      if ln.description is null or length(btrim(ln.description)) < 2 then
        raise exception 'a custom line needs a description' using errcode = '22023';
      end if;
    else
      if ln.item_id is null then
        raise exception 'a catalog line needs its item' using errcode = '22023';
      end if;
      select exists (
        select 1 from public.treatments where id = ln.item_id and active and ln.kind = 'treatment'
        union all
        select 1 from public.products   where id = ln.item_id and active and ln.kind = 'product'
        union all
        select 1 from public.services   where id = ln.item_id and active and ln.kind = 'service'
      ) into v_item_ok;
      if v_item_ok is false then
        raise exception 'item % of kind % does not exist or is inactive', ln.item_id, ln.kind
          using errcode = '23503';
      end if;
    end if;

    v_sold := v_sold + round(ln.quantity * ln.unit_price, 2);
  end loop;

  -- Validate the payments and total the plan.
  v_planned := 0;
  for pay in
    select * from jsonb_to_recordset(p_payments) as p(
      method_id uuid, due_on date, amount numeric, collected numeric)
  loop
    if pay.method_id is null then
      raise exception 'every payment needs a method' using errcode = '22023';
    end if;
    if not exists (select 1 from public.payment_methods where id = pay.method_id) then
      raise exception 'payment method % does not exist', pay.method_id using errcode = '23503';
    end if;
    if pay.amount is null or pay.amount <= 0 then
      raise exception 'every payment needs a positive amount' using errcode = '22023';
    end if;
    if pay.due_on is null then
      raise exception 'every payment needs a due date' using errcode = '22023';
    end if;
    if pay.collected is not null and (pay.collected < 0 or pay.collected > pay.amount) then
      raise exception 'the collected amount must be between zero and the installment'
        using errcode = '23514';
    end if;

    v_planned := v_planned + round(pay.amount, 2);
  end loop;

  if v_planned <> v_sold then
    raise exception 'the payment plan (%), does not equal the sale total (%)',
      v_planned, v_sold using errcode = '23514';
  end if;

  insert into public.sales
    (occurred_on, customer_id, source_id, is_first_visit, visit_number,
     appointment_id, notes, billed_at, billed_at_source)
  values
    (p_occurred_on, p_customer_id,
     case when v_is_first then p_source_id else null end,
     v_is_first, v_visit_number, p_appointment_id, p_notes,
     coalesce(p_billed_at, now()), 'live')
  returning id into v_sale_id;

  for ln in
    select * from jsonb_to_recordset(p_lines) as l(
      kind text, item_id uuid, category_id uuid, description text,
      quantity numeric, unit_price numeric)
  loop
    if ln.kind = 'custom' then
      insert into public.sale_items (sale_id, category_id, description, quantity, unit_price)
      values (v_sale_id, ln.category_id, btrim(ln.description), ln.quantity, ln.unit_price);
    else
      select public.price_on(ln.kind, ln.item_id, p_occurred_on) into v_list_price;

      v_category_id := ln.category_id;
      if v_category_id is null then
        if ln.kind = 'treatment' then
          select default_category_id into v_category_id
          from public.treatments where id = ln.item_id;
        elsif ln.kind = 'product' then
          select default_category_id into v_category_id
          from public.products where id = ln.item_id;
        else
          select default_category_id into v_category_id
          from public.services where id = ln.item_id;
        end if;
      end if;

      insert into public.sale_items
        (sale_id, treatment_id, product_id, service_id, category_id,
         quantity, unit_price, list_price)
      values
        (v_sale_id,
         case when ln.kind = 'treatment' then ln.item_id end,
         case when ln.kind = 'product'   then ln.item_id end,
         case when ln.kind = 'service'   then ln.item_id end,
         v_category_id, ln.quantity, ln.unit_price, v_list_price);
    end if;
  end loop;

  for pay in
    select * from jsonb_to_recordset(p_payments) as p(
      method_id uuid, due_on date, amount numeric, collected numeric)
  loop
    with installment as (
      insert into public.sale_payments (sale_id, method_id, due_on, amount, status)
      values (v_sale_id, pay.method_id, pay.due_on, pay.amount, 'pending')
      returning id
    )
    insert into public.payment_receipts
      (sale_payment_id, amount, received_on, method_id, source, recorded_by)
    select id, pay.collected, p_occurred_on, pay.method_id, 'manual', p_by
    from installment
    where coalesce(pay.collected, 0) > 0;
  end loop;

  return v_sale_id;
end;
$$;

comment on function public.create_sale(uuid, date, timestamptz, uuid, uuid, text, text, jsonb, jsonb) is
  'The single writer of a live sale: the sale, its frozen list prices, the payment plan and the receipts, atomically. The visit ordinal and first-visit flag are derived, and list_price is frozen from the price list on the business day.';
