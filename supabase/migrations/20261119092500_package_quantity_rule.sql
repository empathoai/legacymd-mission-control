-- 20261119092500_package_quantity_rule.sql
-- A package is sold as one thing: quantity 1 and the price the owner decides.
-- What is inside the package is not modelled yet, and must not be inferred.
-- The rule lives in the database so no screen can break it.

-- normalize the two lines that broke it, keeping their money
update public.sale_items i
set quantity = 1,
    unit_price = i.line_total,
    list_price = i.line_total
from public.treatments t
where t.id = i.treatment_id
  and t.unit_type = 'package'
  and i.quantity <> 1;

create or replace function public.enforce_package_quantity() returns trigger
language plpgsql as $$
declare
  is_package boolean;
begin
  if new.treatment_id is null then
    return new;
  end if;
  select (unit_type = 'package') into is_package
  from public.treatments where id = new.treatment_id;
  if coalesce(is_package, false) and new.quantity <> 1 then
    raise exception 'a package is sold with quantity 1 and its own price, got quantity %', new.quantity;
  end if;
  return new;
end;
$$;

drop trigger if exists sale_items_package_quantity on public.sale_items;
create trigger sale_items_package_quantity
before insert or update of treatment_id, quantity on public.sale_items
for each row execute function public.enforce_package_quantity();
