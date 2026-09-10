import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Gym, GymStatus } from "./types";
import seed from "../../data/seed-gyms.json";

/**
 * Two backends, picked at runtime:
 *
 *  - Supabase, when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set. This is
 *    what production should use; see supabase/schema.sql.
 *  - A JSON file under data/, seeded from data/seed-gyms.json, so a fresh
 *    clone runs with no configuration at all. On a read-only filesystem it
 *    degrades to in-memory, which is fine for a preview deploy.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const useSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);

/** Submissions go live immediately when this is set — handy for a solo demo. */
const autoApprove = process.env.OPENMAT_AUTO_APPROVE === "1";

export type NewGym = Omit<Gym, "id" | "status" | "createdAt" | "sample">;

const seedGyms = seed as Gym[];

/* ------------------------------------------------------------------ */
/* File backend                                                        */
/* ------------------------------------------------------------------ */

const DATA_FILE = path.join(process.cwd(), "data", "gyms.local.json");

/**
 * Only used when the file can't be written (a read-only serverless disk).
 * Otherwise the file is re-read on every call: Next.js gives pages and route
 * handlers separate module instances, so a cached array in one of them would
 * never see writes made by the other.
 */
let fallbackMemory: Gym[] | null = null;
let memoryOnly = false;

async function loadFile(): Promise<Gym[]> {
  if (memoryOnly) {
    fallbackMemory ??= seedGyms.map((g) => ({ ...g }));
    return fallbackMemory;
  }
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, "utf8")) as Gym[];
  } catch {
    const seeded = seedGyms.map((g) => ({ ...g }));
    await saveFile(seeded);
    return memoryOnly ? (fallbackMemory ?? seeded) : seeded;
  }
}

async function saveFile(gyms: Gym[]): Promise<void> {
  if (memoryOnly) {
    fallbackMemory = gyms;
    return;
  }
  try {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(gyms, null, 2) + "\n", "utf8");
  } catch {
    // Read-only filesystem (e.g. a serverless deploy without Supabase).
    // Keep serving from memory rather than failing the request.
    memoryOnly = true;
    fallbackMemory = gyms;
  }
}

/* ------------------------------------------------------------------ */
/* Supabase backend                                                    */
/* ------------------------------------------------------------------ */

type Row = {
  id: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  address: string | null;
  styles: string[];
  sessions: unknown;
  drop_in: string | null;
  website: string | null;
  instagram: string | null;
  contact_email: string | null;
  notes: string | null;
  status: GymStatus;
  created_at: string;
};

function rowToGym(row: Row): Gym {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    country: row.country,
    lat: Number(row.lat),
    lng: Number(row.lng),
    address: row.address ?? undefined,
    styles: row.styles as Gym["styles"],
    sessions: (row.sessions ?? []) as Gym["sessions"],
    dropIn: row.drop_in ?? undefined,
    website: row.website ?? undefined,
    instagram: row.instagram ?? undefined,
    contactEmail: row.contact_email ?? undefined,
    notes: row.notes ?? undefined,
    status: row.status,
    createdAt: row.created_at,
  };
}

async function supabase(pathname: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: SUPABASE_KEY!,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function listGyms(status: GymStatus = "approved"): Promise<Gym[]> {
  if (useSupabase) {
    const res = await supabase(
      `gyms?status=eq.${status}&select=*&order=created_at.desc`,
    );
    return ((await res.json()) as Row[]).map(rowToGym);
  }
  const all = await loadFile();
  return all.filter((g) => g.status === status);
}

export async function createGym(input: NewGym): Promise<Gym> {
  const status: GymStatus = autoApprove ? "approved" : "pending";

  if (useSupabase) {
    const res = await supabase("gyms", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        name: input.name,
        city: input.city,
        country: input.country,
        lat: input.lat,
        lng: input.lng,
        address: input.address ?? null,
        styles: input.styles,
        sessions: input.sessions,
        drop_in: input.dropIn ?? null,
        website: input.website ?? null,
        instagram: input.instagram ?? null,
        contact_email: input.contactEmail ?? null,
        notes: input.notes ?? null,
        status,
      }),
    });
    const [row] = (await res.json()) as Row[];
    return rowToGym(row);
  }

  const all = await loadFile();
  const gym: Gym = {
    ...input,
    id: randomUUID(),
    status,
    createdAt: new Date().toISOString(),
  };
  all.push(gym);
  await saveFile(all);
  return gym;
}

export async function setGymStatus(id: string, status: GymStatus): Promise<Gym | null> {
  if (useSupabase) {
    const res = await supabase(`gyms?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status }),
    });
    const rows = (await res.json()) as Row[];
    return rows[0] ? rowToGym(rows[0]) : null;
  }

  const all = await loadFile();
  const gym = all.find((g) => g.id === id);
  if (!gym) return null;
  gym.status = status;
  await saveFile(all);
  return gym;
}

/** True when a duplicate-ish gym already exists (same name in the same city). */
export async function findDuplicate(name: string, city: string): Promise<Gym | null> {
  const norm = (s: string) => s.trim().toLowerCase();
  const candidates = useSupabase
    ? [...(await listGyms("approved")), ...(await listGyms("pending"))]
    : await loadFile();
  return (
    candidates.find((g) => norm(g.name) === norm(name) && norm(g.city) === norm(city)) ?? null
  );
}

export const backend = useSupabase ? "supabase" : "file";
