-- ============================================================
-- Second Cut Stone — editable wording and images (admin → Site content)
-- Run once in Supabase SQL Editor. One row per changed item; an item with no row
-- shows the website's original wording. Images go in the offcut-photos bucket (site/…).
-- ============================================================
create table if not exists public.site_content (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
alter table public.site_content enable row level security;

drop policy if exists "site content public read" on public.site_content;
create policy "site content public read" on public.site_content
  for select using (true);
drop policy if exists "site content admin write" on public.site_content;
create policy "site content admin write" on public.site_content
  for all using (public.is_admin()) with check (public.is_admin());
