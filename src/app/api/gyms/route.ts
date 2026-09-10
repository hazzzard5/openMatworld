import { NextResponse } from "next/server";
import { createGym, findDuplicate, listGyms } from "@/lib/store";
import { gymSubmissionSchema, normalize } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "approved";

  if (status !== "approved") {
    const adminKey = process.env.OPENMAT_ADMIN_KEY;
    if (!adminKey || request.headers.get("x-admin-key") !== adminKey) {
      return NextResponse.json({ error: "Not authorised" }, { status: 401 });
    }
  }

  const gyms = await listGyms(status as "approved" | "pending" | "rejected");
  return NextResponse.json({ gyms });
}

/** Crude per-IP throttle. Good enough to blunt casual spam on a single node. */
const recent = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > MAX_PER_WINDOW;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }

  const parsed = gymSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Some fields need fixing", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Honeypot field — bots fill it in, the real form keeps it hidden and empty.
  if (parsed.data.website_url) {
    return NextResponse.json({ ok: true, status: "pending" });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "That's a lot of submissions. Try again a bit later." },
      { status: 429 },
    );
  }

  const gym = normalize(parsed.data);

  const duplicate = await findDuplicate(gym.name, gym.city);
  if (duplicate) {
    return NextResponse.json(
      { error: `${gym.name} in ${gym.city} is already on the map.` },
      { status: 409 },
    );
  }

  try {
    const created = await createGym(gym);
    return NextResponse.json({ ok: true, gym: created, status: created.status }, { status: 201 });
  } catch (err) {
    console.error("Failed to save gym submission", err);
    return NextResponse.json({ error: "Could not save that. Try again." }, { status: 500 });
  }
}
