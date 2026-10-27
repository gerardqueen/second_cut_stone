-- ============================================================
-- Second Cut Stone — self sign-up with admin approval
-- Run once in Supabase SQL Editor (after schema.sql).
-- Anyone can create an account; they get NO access until an
-- existing admin approves them in the admin page's "Admins" tab.
-- ============================================================

create table if not exists public.access_requests (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);
alter table public.access_requests enable row level security;

drop policy if exists "requests admin read" on public.access_requests;
create policy "requests admin read" on public.access_requests
  for select using (public.is_admin());
drop policy if exists "requests admin delete" on public.access_requests;
create policy "requests admin delete" on public.access_requests
  for delete using (public.is_admin());

-- Every new account lands in the request queue automatically.
create or replace function public.queue_access_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.access_requests (user_id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (user_id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created_scs on auth.users;
create trigger on_auth_user_created_scs
  after insert on auth.users
  for each row execute function public.queue_access_request();

-- Queue any existing accounts that aren't admins yet.
insert into public.access_requests (user_id, email)
select u.id, coalesce(u.email, '') from auth.users u
where not exists (select 1 from public.admins a where a.user_id = u.id)
on conflict (user_id) do nothing;

-- Approve: admin-only.
create or replace function public.approve_admin(target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not authorised'; end if;
  insert into public.admins (user_id) values (target) on conflict do nothing;
  delete from public.access_requests where user_id = target;
end; $$;

-- Remove an admin (can't remove yourself, so there's always one left).
create or replace function public.remove_admin(target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not authorised'; end if;
  if target = auth.uid() then raise exception 'You cannot remove your own admin access'; end if;
  delete from public.admins where user_id = target;
end; $$;

-- List current admins with emails (admin-only).
create or replace function public.list_admins()
returns table (user_id uuid, email text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not authorised'; end if;
  return query
    select a.user_id, u.email::text, a.created_at
    from public.admins a join auth.users u on u.id = a.user_id
    order by a.created_at;
end; $$;

revoke all on function public.approve_admin(uuid) from public, anon;
revoke all on function public.remove_admin(uuid) from public, anon;
revoke all on function public.list_admins() from public, anon;
grant execute on function public.approve_admin(uuid) to authenticated;
grant execute on function public.remove_admin(uuid) to authenticated;
grant execute on function public.list_admins() to authenticated;
