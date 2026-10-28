-- ============================================================
-- Second Cut Stone — email alert for every new enquiry
-- Run once in Supabase SQL Editor. Records which enquiries have been emailed, so the
-- enquiry-alert Edge Function never sends the same one twice and retries any that failed.
-- ============================================================
alter table public.enquiries add column if not exists notified_at timestamptz;
