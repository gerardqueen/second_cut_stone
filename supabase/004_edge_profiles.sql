-- ============================================================
-- Second Cut Stone — edge profile pictures
-- Run once in Supabase SQL Editor. Each finish can choose which outline customers see.
-- Leave it empty and the site guesses from the finish's name.
-- ============================================================
alter table public.edge_finishes add column if not exists profile text;
update public.edge_finishes set profile = case
  when name ilike '%half%bull%' then 'halfBullnose'
  when name ilike '%bull%' then 'bullnose'
  when name ilike '%ogee%' then 'ogee'
  when name ilike '%bevel%' or name ilike '%chamfer%' then 'bevel'
  when name ilike '%pencil%' or name ilike '%eased%' then 'pencil'
  when name ilike '%mitre%' or name ilike '%apron%' then 'mitred'
  when name ilike '%dupont%' then 'dupont'
  else 'square' end
where profile is null;
