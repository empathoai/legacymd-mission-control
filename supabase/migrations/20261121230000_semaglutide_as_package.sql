-- 20261121230000_semaglutide_as_package.sql
-- The owner's correction: the item is named "Weight Loss Package w/ Semaglutide", and the
-- master's own Category column says Package. A unit row wearing the word Package is the
-- inconsistency, not the name. So the package `PCK-0015` becomes the live row again and the
-- unit `TRT-0037` is retired.
--
-- Price (1,512.00) and cost (195.00) are the same on both rows, so nothing about the money
-- changes. The 13 historical lines stay on `TRT-0037`, which is retired, not deleted — a
-- retired row still resolves its history.
--
-- Timmix stays a unit: its name carries no "Package" and the owner asked for it explicitly.

do $$
declare
  v_on int;
  v_off int;
begin
  update public.treatments set active = true  where code = 'PCK-0015';
  get diagnostics v_on = row_count;
  update public.treatments set active = false where code = 'TRT-0037';
  get diagnostics v_off = row_count;

  if v_on <> 1 or v_off <> 1 then
    raise exception 'C: expected one row each, updated % and %', v_on, v_off;
  end if;

  if (
    select count(*) from public.treatments
    where name = 'Weight Loss Package w/ Semaglutide' and active
  ) <> 1 then
    raise exception 'C: Semaglutide must have exactly one active row';
  end if;

  if not exists (
    select 1 from public.treatments
    where code = 'PCK-0015' and unit_type = 'package' and active and price = 1512.00
  ) then
    raise exception 'C: the active Semaglutide row is not the package at its price';
  end if;

  if not exists (
    select 1 from public.treatments
    where code = 'TRT-0012' and unit_type = 'unit' and active
  ) then
    raise exception 'C: Timmix should stay a unit';
  end if;

  raise notice 'Semaglutide sells as the package PCK-0015; TRT-0037 retired';
end $$;
