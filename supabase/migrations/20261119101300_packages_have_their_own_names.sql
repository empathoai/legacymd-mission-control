-- 101300_packages_have_their_own_names.sql
-- A package is a treatment with unit_type package, but it is a different catalog to the desk:
-- it has its own code series (PCK) and its own name space. Until now a package named "test"
-- collided with a treatment named "test", which is not what the clinic means.
--
-- The unique key becomes (unit_type, normalized_name): TRT and PCK can share a name, two
-- treatments cannot, and two packages cannot.

alter table public.treatments drop constraint if exists treatments_normalized_name_key;

alter table public.treatments
  add constraint treatments_unit_normalized_name_key unique (unit_type, normalized_name);

comment on constraint treatments_unit_normalized_name_key on public.treatments is
  'One name per catalog: treatments and packages are separate name spaces.';
