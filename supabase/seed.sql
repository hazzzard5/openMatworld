-- Initial listings for a fresh database.
--
-- Once SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set, data/seed-gyms.json
-- stops being read — the table is the only source of truth, and an empty table
-- means an empty map. Run this once after schema.sql to carry the first
-- listing over.
--
-- Safe to re-run: the unique index on (lower(name), lower(city)) makes a
-- second run a no-op rather than a duplicate.

insert into public.gyms
  (name, city, country, lat, lng, address, styles, sessions, drop_in, website, instagram, status)
values
  (
    'Queen City Grappling Club',
    'Springboro',
    'United States',
    39.5573,
    -84.2515,
    '815 W Central Ave, Springboro, OH 45066',
    array['gi', 'nogi', 'wrestling', 'mma'],
    '[{"day": "sun", "start": "10:00", "end": "12:00"}]'::jsonb,
    'Open mat — visiting grapplers welcome',
    'https://queencitygrappling.com/',
    'queencitygrappling',
    'approved'
  )
on conflict do nothing;
