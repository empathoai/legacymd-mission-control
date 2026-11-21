-- 20261121190000_regenerative_glow_as_package.sql
-- The owner's call: Regenerative Glow stays a package. The package `PCK-0012` already holds
-- the only sale (2026-05-11, 1.357,50), the price (1,357.50) and a cost (950.25); the unit
-- row `TRT-0035` carries neither a sale nor a cost. So the package becomes the live row and
-- the unit row is retired, which also settles the pair.
--
-- Nothing about the sale moves: it points at the package already. Retiring is `active =
-- false`, never a delete — the code stays, the history stays, and the row could come back.

do $$
declare
  v_package int;
  v_unit int;
begin
  update public.treatments set active = true  where code = 'PCK-0012';
  get diagnostics v_package = row_count;
  update public.treatments set active = false where code = 'TRT-0035';
  get diagnostics v_unit = row_count;

  if v_package <> 1 or v_unit <> 1 then
    raise exception 'C: expected one row each, updated % and %', v_package, v_unit;
  end if;

  if (
    select count(*) from public.treatments
    where name = 'Regenerative Glow Protocol' and active
  ) <> 1 then
    raise exception 'C: Regenerative Glow must have exactly one active row';
  end if;

  if not exists (
    select 1 from public.treatments
    where code = 'PCK-0012' and unit_type = 'package' and active and price = 1357.50
  ) then
    raise exception 'C: the active row is not the package with its price';
  end if;

  raise notice 'Regenerative Glow sells as the package PCK-0012; TRT-0035 retired';
end $$;
