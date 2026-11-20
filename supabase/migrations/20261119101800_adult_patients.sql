-- 101800_adult_patients.sql
-- The clinic treats adults. A birth date is optional, but when it is recorded the patient must
-- be 18 or older. Enforced here so the rule holds no matter which screen creates the customer:
-- the patient form, a booking or a sale.

create or replace function public.customers_adult_birth_date() returns trigger
language plpgsql
as $$
declare
  v_today  date := (now() at time zone 'America/New_York')::date;
  v_cutoff date := (v_today - interval '18 years')::date;
begin
  if new.birth_date is not null and new.birth_date > v_cutoff then
    raise exception 'Patients must be 18 or older' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists customers_adult_birth_date on public.customers;
create trigger customers_adult_birth_date
  before insert or update of birth_date on public.customers
  for each row execute function public.customers_adult_birth_date();

comment on function public.customers_adult_birth_date() is
  'A recorded birth date must be at least 18 years old: the clinic treats adults only.';
