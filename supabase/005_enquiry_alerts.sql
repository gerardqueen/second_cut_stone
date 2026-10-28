-- ============================================================
-- Second Cut Stone — email alert for every new enquiry
-- Run once in Supabase SQL Editor, after deploying the "enquiry-alert" Edge Function.
-- The trigger just pokes the function; the function decides what to send.
-- ============================================================
alter table public.enquiries add column if not exists notified_at timestamptz;

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_new_enquiry()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(
    url := 'https://bzgnlzsdyjwjfpsexquz.supabase.co/functions/v1/enquiry-alert',
    body := '{}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return new;
end; $$;

drop trigger if exists enquiry_alert on public.enquiries;
create trigger enquiry_alert
  after insert on public.enquiries
  for each row execute function public.notify_new_enquiry();
