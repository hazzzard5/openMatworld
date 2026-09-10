# Open Mat World

An interactive globe of open mats. Spin it, find somewhere to roll when you're
travelling, and let gyms put their own sessions on the map.

<!-- Add a screenshot here once deployed. -->

## What it does

- **A dotted globe** built on `react-globe.gl` / three.js. It idles with a slow
  spin and stops as soon as you touch it or pick a gym.
- **A marker per gym.** Orange normally, green while a session is actually
  running, with a pulsing ring so live mats stand out at a glance.
- **A left rail** to search, filter by style, and drill into a gym's schedule,
  drop-in cost and links.
- **A submission form** so any gym can add itself — address lookup, opening
  times, styles, contact details. **A website or an Instagram is required** —
  either one, since plenty of small academies have only a page. It's shown on
  the listing so a visitor can check the gym is real before turning up, and it
  gives the moderator something to click before approving.
- **A moderation queue** at `/admin`, because an open submission form without
  one fills up with junk.
- **A sponsor rail** on the right, backed by a `sponsors` table. Unsold slots
  fall back to the placeholders in `data/sponsors.json` and open an enquiry
  form, so an empty rail reads as an invitation rather than a gap.

## Running it

```bash
npm install
npm run dev
```

That's the whole setup. With no environment variables the app stores gyms in
`data/gyms.local.json`, seeded from `data/seed-gyms.json`, so the globe has
something on it from the first load.

To moderate submissions locally:

```bash
OPENMAT_ADMIN_KEY=dev-key npm run dev
# then open http://localhost:3000/admin
```

Copy `.env.example` to `.env.local` for the full list of settings.

## Going to production

The file-backed store is for development. A serverless deploy has a read-only
filesystem, so submissions there would live only in memory until the next cold
start. Point it at Supabase instead:

1. Create a project and run `supabase/schema.sql` in the SQL editor.
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
3. Set `OPENMAT_ADMIN_KEY` to something you generated, not something you typed.

The service-role key is only ever used server-side in `src/lib/store.ts`; it is
never sent to the browser.

### Moderation

Submissions land as `pending` and stay off the globe until approved at `/admin`.
Set `OPENMAT_AUTO_APPROVE=1` to publish them immediately — convenient for a demo,
a bad idea once anyone can find the site.

`/admin` is gated by a single shared key held in `localStorage`. That is enough
for one person moderating their own map, and not enough for a team — put it
behind real auth before you hand out access.

Each queued gym shows whichever public links it has, as links that open in a
new tab. Opening one is the check: it should be a real academy, at the city the
submission claims, with the open mat plausibly on it.

Each link is individually optional; the object-level check on
`gymSubmissionSchema` is what requires one of the two. Websites and Instagram
handles are normalised and scheme-checked in `src/lib/url.ts` before storing — `new URL()` on its own accepts
`javascript:` and `data:`, which would be a stored XSS once rendered as a link.
Bare domains like `yourgym.com` are accepted and expanded to `https://`.

## Selling the sponsor rail

Edit `data/sponsors.json`. Each entry takes a `name`, `url`, optional `tagline`
and `logo` (put the image in `public/`), and a `tier` of `headline` or
`standard` — headline renders larger and sits at the top. Drop the
`placeholder: true` flag when a slot is sold, and change the `mailto:` addresses
in `src/components/SponsorRail.tsx` to your own.

## Sponsors and billing

`data/sponsors.json` holds the placeholder slots shown while a tier is unsold.
Real sponsors live in the `sponsors` table; `listSponsors()` returns the live
ones and falls back to the placeholders when there are none. A sponsor is live
when `status = 'active'` and now falls inside `starts_at`/`ends_at`.

The table carries `stripe_customer_id`, `stripe_subscription_id`,
`stripe_price_id`, `stripe_status` and `current_period_end` from the start, so
billing can be attached without a migration. Nothing writes them yet — a
sponsor invoiced by hand just gets `status` and `ends_at` set directly. When
Stripe is wired up, a webhook maps `customer.subscription.*` onto those columns
and flips `status`.

Contact and Stripe columns are never exposed: `listSponsors()` selects an
explicit column list, and the RLS policy only grants anonymous reads of rows
that are currently live.

### Enquiries

"Sponsor this space" posts to `/api/sponsor-inquiries`, which **stores the
enquiry first and then emails it**, so a mail outage costs a notification, not
a lead. Mail goes through Resend over plain HTTP — no SDK:

```
RESEND_API_KEY      from resend.com
SPONSOR_TO_EMAIL    where enquiries land (default sponsor@narigroup.net)
SPONSOR_FROM_EMAIL  a sender on a domain you've verified in Resend
```

With no key set, sending is skipped and the row is still written — the server
logs the enquiry so nothing is silently lost. Unsent enquiries are the rows in
`sponsor_inquiries` with `emailed_at is null`.

"On now" is estimated from longitude (15° per hour) rather than a real timezone
database, because the form doesn't ask submitters for a timezone. It's right to
within about an hour for most places and wrong wherever politics beat geography.
The UI says so; treat it as a hint, not a schedule.

Listing coordinates are often only accurate to the city, which is fine for a
pin on a globe and useless for directions — so the Directions link uses the
street address when a listing has one, and falls back to coordinates when it
doesn't.

Address lookup proxies OpenStreetMap's Nominatim through `/api/geocode`, with
caching and a debounce to stay inside their usage policy. If it's unavailable
the form falls back to entering coordinates by hand.

## Layout of the code

```
src/app/            routes — the map, /admin, and the API under /api
src/components/     GlobeView, Sidebar, SponsorRail, SubmitModal, AdminQueue
src/lib/store.ts    Supabase-or-file persistence
src/lib/gyms.ts     filtering, "on now", and next-session maths
src/lib/types.ts    shared types and formatting
data/               seed gyms, sponsor slots, local submissions
supabase/schema.sql the gyms table, indexes and RLS policy
```

## Ideas worth building next

- Cluster markers when zoomed out, so cities with several gyms don't overlap.
- Let gyms claim and edit a listing instead of emailing you.
- A shareable URL per gym (`/gym/[id]`) for social previews.
- Real timezones, once the form collects them.
