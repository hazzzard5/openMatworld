import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Thin proxy over OpenStreetMap's Nominatim so the submit form can turn
 * "123 Main St, Austin" into coordinates. Nominatim asks for an identifying
 * User-Agent and no more than 1 request/second, so results are cached and the
 * client debounces.
 */
const CONTACT = process.env.OPENMAT_CONTACT_EMAIL ?? "hello@openmat.world";
const USER_AGENT = `OpenMatWorld/0.1 (${CONTACT})`;

type Cached = { at: number; body: unknown };
const cache = new Map<string, Cached>();
const CACHE_MS = 10 * 60 * 1000;

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q || q.length < 3) {
    return NextResponse.json({ results: [] });
  }

  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return NextResponse.json(hit.body);
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);

    type Hit = {
      display_name: string;
      lat: string;
      lon: string;
      address?: Record<string, string>;
    };
    const hits = (await res.json()) as Hit[];

    const body = {
      results: hits.map((h) => ({
        label: h.display_name,
        lat: Number(h.lat),
        lng: Number(h.lon),
        city:
          h.address?.city ??
          h.address?.town ??
          h.address?.village ??
          h.address?.municipality ??
          h.address?.county ??
          "",
        country: h.address?.country ?? "",
      })),
    };

    cache.set(key, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch (err) {
    console.error("Geocode lookup failed", err);
    return NextResponse.json(
      { results: [], error: "Lookup unavailable — you can drop a pin instead." },
      { status: 502 },
    );
  }
}
