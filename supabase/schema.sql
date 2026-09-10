-- Open Mat World — gym submissions.
-- Apply with the Supabase SQL editor, or `supabase db push`.

create table if not exists public.gyms (
  id            uuid primary key default gen_random_uuid(),
  name          text        not null,
  city          text        not null,
  country       text        not null,
  lat           double precision not null check (lat between -90 and 90),
  lng           double precision not null check (lng between -180 and 180),
  address       text,
  styles        text[]      not null default '{}',
  sessions      jsonb       not null default '[]'::jsonb,
  drop_in       text,
  website       text,
  instagram     text,
  contact_email text,
  notes         text,
  status        text        not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected')),
  created_at    timestamptz not null default now()
);

create index if not exists gyms_status_idx on public.gyms (status);

-- Stops the same academy being listed twice.
create unique index if not exists gyms_name_city_idx
  on public.gyms (lower(name), lower(city));

alter table public.gyms enable row level security;

-- Anonymous visitors may read approved listings and nothing else. Writes and
-- moderation go through the API routes, which use the service-role key and
-- bypass RLS.
drop policy if exists "approved gyms are public" on public.gyms;
create policy "approved gyms are public"
  on public.gyms for select
  using (status = 'approved');
