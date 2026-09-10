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
  times, styles, contact details. A public **website is required**: it's shown
  on the listing so a visitor can check the academy is real before turning up,
  and it gives the moderator something to click before approving.
- **A moderation queue** at `/admin`, because an open submission form without
  one fills up with junk.
- **A sponsor rail** on the right. It's real layout space, populated from
  `data/sponsors.json`, and reads as an invitation while it's empty.

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

Each queued gym shows its website and Instagram as links that open in a new
tab. Opening the site is the check: it should be a real academy, at the city
the submission claims, with the open mat plausibly on it.

Websites and Instagram handles are normalised and scheme-checked in
`src/lib/url.ts` before they're stored — `new URL()` on its own accepts
`javascript:` and `data:`, which would be a stored XSS once rendered as a link.
Bare domains like `yourgym.com` are accepted and expanded to `https://`.

## Selling the sponsor rail

Edit `data/sponsors.json`. Each entry takes a `name`, `url`, optional `tagline`
and `logo` (put the image in `public/`), and a `tier` of `headline` or
`standard` — headline renders larger and sits at the top. Drop the
`placeholder: true` flag when a slot is sold, and change the `mailto:` addresses
in `src/components/SponsorRail.tsx` to your own.

### Gyms without a website

Plenty of small academies run on an Instagram page alone and have no site at
all. The form currently rejects them. If that turns out to cost you real
listings, the change is to accept an Instagram profile in place of a website —
`websiteSchema` in `src/lib/validation.ts`, plus the matching check in
`SubmitModal`.

## Notes on the data

The 60 seeded gyms are **invented**. They sit in real cities so the globe looks
alive on day one, and each is flagged `sample: true` and labelled as a sample in
the UI. Don't leave them in once real gyms start signing up — delete
`data/seed-gyms.json`'s contents, or filter out `sample` rows.

"On now" is estimated from longitude (15° per hour) rather than a real timezone
database, because the form doesn't ask submitters for a timezone. It's right to
within about an hour for most places and wrong wherever politics beat geography.
The UI says so; treat it as a hint, not a schedule.

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
