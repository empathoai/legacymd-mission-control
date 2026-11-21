-- 20261121260000_visit_number_is_purchase_ordinal.sql
-- The council's call, after the appointments decision: `visit_number` stops meaning "the
-- n-th visit of the patient's life" and means "the n-th business day with a sale".
--
-- Why not keep the old meaning: the only thing that produced a visit without a purchase was
-- the imported appointment, and no screen will ever write one again — the desk records a
-- sale when the patient arrives. A `visits` table would carry 51 historical rows and no
-- writer, and `create_sale` would keep skipping ordinals to imitate a book that is gone.
--
-- Why not renumber the past: `is_first_visit` is tied to `visit_number = 1`, it is hashed in
-- `docs/data/baseline.json`, and the owner froze the imported history. Renumbering would
-- move the new-patient KPI and fail the check that protects the base.
--
-- The 51 rows themselves are frozen in `docs/data/appointments-2026-11-21.json`; the table
-- stays as an archive with no reader until the screens that still call it are removed.

do $$
declare
  v_rows int;
begin
  comment on column public.sales.visit_number is
    'Purchase ordinal: 1 is the first business day with a sale. Gaps are inherited from the source workbook (days the patient came and nothing was sold) and are never produced forward.';

  comment on table public.appointments is
    'Archive only since 2026-11-21. The clinic keeps its diary outside this system and nothing books here. A frozen export lives in docs/data/appointments-2026-11-21.json.';

  select count(*) into v_rows from public.appointments;
  if v_rows <> 51 then
    raise exception 'C: expected the 51 imported appointments, found %', v_rows;
  end if;

  if exists (
    select 1 from public.sales
    where visit_number is not null and is_first_visit and visit_number <> 1
  ) then
    raise exception 'C: a first visit is not visit 1';
  end if;
end $$;
