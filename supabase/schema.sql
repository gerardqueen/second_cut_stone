-- ============================================================
-- Second Cut Stone — Supabase schema
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run
-- ============================================================

-- ---------- Admins ----------
-- Only users listed here can add/edit stock. Signing up alone grants nothing.
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- Offcuts ----------
create table if not exists public.offcuts (
  id            uuid primary key default gen_random_uuid(),
  ref           text unique,                         -- e.g. SC-014 (shown to customers)
  material      text not null,                       -- Granite, Quartz, Marble, Dekton…
  name          text not null,                       -- colour / product name
  thickness_mm  integer not null default 20,
  length_mm     integer not null check (length_mm > 0),
  width_mm      integer not null check (width_mm > 0),
  price_per_m2  numeric(10,2) not null check (price_per_m2 >= 0),
  photo_url     text,
  notes         text,
  status        text not null default 'available'
                check (status in ('available','reserved','sold')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------- Edge finishes ----------
create table if not exists public.edge_finishes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  price_per_m numeric(10,2) not null default 0 check (price_per_m >= 0),  -- £ per linear metre
  sort        integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- Enquiries (quote requests from customers) ----------
create table if not exists public.enquiries (
  id            uuid primary key default gen_random_uuid(),
  offcut_id     uuid references public.offcuts(id) on delete set null,
  offcut_ref    text,
  customer_name text not null,
  email         text not null,
  phone         text,
  length_mm     integer not null,
  width_mm      integer not null,
  edges         jsonb not null default '{}'::jsonb,  -- {front:"Pencil round", back:null, …}
  quoted_total  numeric(10,2),
  message       text,
  handled       boolean not null default false,
  created_at    timestamptz not null default now()
);

-- keep updated_at fresh
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists offcuts_touch on public.offcuts;
create trigger offcuts_touch before update on public.offcuts
  for each row execute function public.touch_updated_at();

-- ---------- Row Level Security ----------
alter table public.admins        enable row level security;
alter table public.offcuts       enable row level security;
alter table public.edge_finishes enable row level security;
alter table public.enquiries     enable row level security;

-- admins: an admin can see the admin list (used by the admin page to check access)
drop policy if exists "admins read own" on public.admins;
create policy "admins read own" on public.admins
  for select using (user_id = auth.uid());

-- offcuts: public can see anything not sold; admins see and change everything
drop policy if exists "offcuts public read" on public.offcuts;
create policy "offcuts public read" on public.offcuts
  for select using (status <> 'sold' or public.is_admin());
drop policy if exists "offcuts admin write" on public.offcuts;
create policy "offcuts admin write" on public.offcuts
  for all using (public.is_admin()) with check (public.is_admin());

-- edge finishes: public can see active ones; admins manage
drop policy if exists "edges public read" on public.edge_finishes;
create policy "edges public read" on public.edge_finishes
  for select using (active or public.is_admin());
drop policy if exists "edges admin write" on public.edge_finishes;
create policy "edges admin write" on public.edge_finishes
  for all using (public.is_admin()) with check (public.is_admin());

-- enquiries: anyone can submit; only admins can read/update/delete
drop policy if exists "enquiries public insert" on public.enquiries;
create policy "enquiries public insert" on public.enquiries
  for insert with check (true);
drop policy if exists "enquiries admin manage" on public.enquiries;
create policy "enquiries admin manage" on public.enquiries
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Photo storage ----------
insert into storage.buckets (id, name, public)
values ('offcut-photos', 'offcut-photos', true)
on conflict (id) do nothing;

drop policy if exists "photos public read" on storage.objects;
create policy "photos public read" on storage.objects
  for select using (bucket_id = 'offcut-photos');
drop policy if exists "photos admin insert" on storage.objects;
create policy "photos admin insert" on storage.objects
  for insert with check (bucket_id = 'offcut-photos' and public.is_admin());
drop policy if exists "photos admin update" on storage.objects;
create policy "photos admin update" on storage.objects
  for update using (bucket_id = 'offcut-photos' and public.is_admin());
drop policy if exists "photos admin delete" on storage.objects;
create policy "photos admin delete" on storage.objects
  for delete using (bucket_id = 'offcut-photos' and public.is_admin());

-- ---------- Starter edge finishes (edit prices in the admin page) ----------
insert into public.edge_finishes (name, description, price_per_m, sort)
select * from (values
  ('Pencil round',  'Softly rounded top and bottom arris',  25.00, 1),
  ('Square polished','Crisp square edge, polished face',     30.00, 2),
  ('Bevelled',      '45° chamfer along the top edge',        40.00, 3),
  ('Bullnose',      'Fully rounded half-circle profile',     55.00, 4),
  ('Ogee',          'Decorative S-curve profile',            75.00, 5)
) v(name, description, price_per_m, sort)
where not exists (select 1 from public.edge_finishes);

-- ============================================================
-- AFTER RUNNING: make yourself an admin
--   1. Authentication → Users → Add user (your email + password)
--   2. Copy the new user's UID, then run:
--        insert into public.admins (user_id) values ('PASTE-UID-HERE');
--   3. Authentication → Providers → Email: turn OFF "Allow new users to sign up"
-- ============================================================
