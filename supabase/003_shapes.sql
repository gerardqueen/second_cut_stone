-- ============================================================
-- Second Cut Stone — shaped pieces (circle, oval, half-moon, L-shape…)
-- Run once in Supabase SQL Editor. Adds the shape and its measurements to enquiries.
-- length_mm / width_mm keep holding the rectangle of stone the piece is cut from.
-- ============================================================
alter table public.enquiries add column if not exists shape text not null default 'rectangle';
alter table public.enquiries add column if not exists dims jsonb not null default '{}'::jsonb;
