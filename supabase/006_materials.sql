-- ============================================================
-- Second Cut Stone — managed list of materials (Granite, Quartz, Slate…)
-- Run once in Supabase SQL Editor. Staff manage the list in admin → Materials.
-- Offcuts still store the material by name, so renaming a material renames it
-- on its offcuts too (the admin page does that in one go).
-- ============================================================
create table if not exists public.materials (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  sort        integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.materials enable row level security;

drop policy if exists "materials public read" on public.materials;
create policy "materials public read" on public.materials
  for select using (active or public.is_admin());
drop policy if exists "materials admin write" on public.materials;
create policy "materials admin write" on public.materials
  for all using (public.is_admin()) with check (public.is_admin());

-- Starting list: the usual stones, plus every material already used on an offcut.
insert into public.materials (name, sort)
select name, sort from (values
  ('Granite', 1), ('Quartz', 2), ('Marble', 3), ('Dekton', 4), ('Silestone', 5),
  ('Corian', 6), ('Sensa Granite', 7), ('Limestone', 8), ('Slate', 9)
) v(name, sort)
on conflict (name) do nothing;

insert into public.materials (name, sort)
select distinct o.material, 50 from public.offcuts o
where o.material is not null and trim(o.material) <> ''
  and not exists (select 1 from public.materials m where lower(m.name) = lower(o.material))
on conflict (name) do nothing;
