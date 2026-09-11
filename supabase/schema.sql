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


-- ---------------------------------------------------------------------------
-- Sponsors
-- ---------------------------------------------------------------------------
-- Paid placements in the right-hand rail. Stripe columns are here from the
-- start so billing can be attached without a migration: nothing writes them
-- yet, and a sponsor can be run manually (invoice, bank transfer) by leaving
-- them null and setting status/ends_at by hand.

create table if not exists public.sponsors (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null,
  tagline     text,
  url         text        not null,
  logo_url    text,
  tier        text        not null default 'standard'
                check (tier in ('headline', 'standard')),
  status      text        not null default 'draft'
                check (status in ('draft', 'active', 'paused', 'expired', 'cancelled')),

  -- Manual scheduling. Independent of Stripe so a comped or invoiced sponsor
  -- works the same way as a subscribed one.
  starts_at   timestamptz,
  ends_at     timestamptz,

  -- Lower sorts first within a tier.
  sort_order  integer     not null default 100,

  -- Who to talk to. Never rendered publicly.
  contact_name  text,
  contact_email text,

  -- Stripe. Populated by a webhook once billing is wired up.
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  stripe_price_id        text,
  stripe_status          text,
  current_period_end     timestamptz,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists sponsors_slot_idx
  on public.sponsors (status, tier, sort_order);

alter table public.sponsors enable row level security;

-- Anonymous visitors read live sponsors only, and never the contact or
-- billing columns — the API selects an explicit column list.
drop policy if exists "live sponsors are public" on public.sponsors;
create policy "live sponsors are public"
  on public.sponsors for select
  using (
    status = 'active'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );


-- ---------------------------------------------------------------------------
-- Sponsor enquiries
-- ---------------------------------------------------------------------------
-- Submissions from the "Sponsor this space" form. Stored as well as emailed,
-- so an enquiry survives the mail provider being down or misconfigured.

create table if not exists public.sponsor_inquiries (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  business   text not null,
  -- Free text rather than an enum: what people want rarely fits a dropdown,
  -- and this is read by a human, not queried.
  duration   text not null,
  message    text,
  status     text not null default 'new'
               check (status in ('new', 'contacted', 'converted', 'declined')),
  -- Set when the notification email actually went out.
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists sponsor_inquiries_status_idx
  on public.sponsor_inquiries (status, created_at desc);

alter table public.sponsor_inquiries enable row level security;
-- No policy: enquiries are private. Writes and reads go through the API
-- routes using the service-role key, which bypasses RLS.


-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- Supabase normally hands new tables in `public` to its built-in roles through
-- default privileges, but that doesn't always reach tables created this way —
-- PostgREST then answers 42501, "permission denied for table gyms". Granting
-- explicitly makes the schema self-sufficient instead of depending on whatever
-- defaults happen to be in place.
--
-- These are table privileges, which are checked before row-level security:
-- service_role bypasses RLS but still needs the GRANT.

-- The API routes act as service_role.
grant select, insert, update, delete on public.gyms              to service_role;
grant select, insert, update, delete on public.sponsors          to service_role;
grant select, insert, update, delete on public.sponsor_inquiries to service_role;

-- Anonymous reads stay gated by the RLS policies above; without the grant the
-- policies can never apply. Nothing in the app uses these yet — they exist so
-- a future browser-side read works without reopening the schema.
grant select on public.gyms     to anon, authenticated;
grant select on public.sponsors to anon, authenticated;

-- sponsor_inquiries is deliberately absent: enquiries are private, readable
-- only through the service-role key.
