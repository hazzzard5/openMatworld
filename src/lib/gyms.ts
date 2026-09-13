import { DAYS, type Day, type Gym, type MatSession, type Style } from "./types";

const MINUTES_PER_DAY = 24 * 60;
const WEEK_MINUTES = 7 * MINUTES_PER_DAY;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

const WEEKDAY_KEYS: Record<string, Day> = {
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
  Sun: "sun",
};

/**
 * Wall-clock time in an IANA zone. Intl handles daylight saving and the real
 * zone boundaries, which a longitude estimate cannot: in September, Ohio is
 * on EDT (UTC-4) while its longitude suggests UTC-5:37 — an hour and a half
 * out, which is enough to call a finished session "on now".
 */
function zonedNow(timeZone: string, now: Date): { day: Day; minutes: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);

    const get = (type: string) => parts.find((p) => p.type === type)?.value;
    const day = WEEKDAY_KEYS[get("weekday") ?? ""];
    const hour = Number(get("hour"));
    const minute = Number(get("minute"));

    if (!day || !Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return { day, minutes: hour * 60 + minute };
  } catch {
    // Unknown zone name — fall back to the estimate.
    return null;
  }
}

/** Local time at a gym: its real zone when we have one, else the estimate. */
export function localNow(gym: Pick<Gym, "lng" | "timezone">, now = new Date()) {
  const zoned = gym.timezone ? zonedNow(gym.timezone, now) : null;
  return zoned ?? approxLocalNow(gym.lng, now);
}

/**
 * Fallback only: wall-clock estimated from longitude (15° per hour). Ignores
 * daylight saving and zone boundaries, so it can be well over an hour out.
 * Used when a coordinate has no resolvable timezone.
 */
export function approxLocalNow(lng: number, now = new Date()): { day: Day; minutes: number } {
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const offset = Math.round((lng / 15) * 60);
  let total = utcMinutes + offset;
  let dayIndex = (now.getUTCDay() + 6) % 7; // Monday-first

  while (total < 0) {
    total += MINUTES_PER_DAY;
    dayIndex = (dayIndex + 6) % 7;
  }
  while (total >= MINUTES_PER_DAY) {
    total -= MINUTES_PER_DAY;
    dayIndex = (dayIndex + 1) % 7;
  }

  return { day: DAYS[dayIndex], minutes: total };
}

/** Minutes from a week-position to the next occurrence of a session. */
function minutesUntil(from: { day: Day; minutes: number }, session: MatSession): number {
  const start = DAYS.indexOf(session.day) * MINUTES_PER_DAY + toMinutes(session.start);
  const cursor = DAYS.indexOf(from.day) * MINUTES_PER_DAY + from.minutes;
  return (start - cursor + WEEK_MINUTES) % WEEK_MINUTES;
}

export function isLiveNow(gym: Gym, now = new Date()): boolean {
  const local = localNow(gym, now);
  return gym.sessions.some((s) => {
    if (s.day !== local.day) return false;
    return local.minutes >= toMinutes(s.start) && local.minutes < toMinutes(s.end);
  });
}

export type NextUp = { session: MatSession; inMinutes: number };

export function nextSession(gym: Gym, now = new Date()): NextUp | null {
  const local = localNow(gym, now);
  let best: NextUp | null = null;
  for (const session of gym.sessions) {
    const inMinutes = minutesUntil(local, session);
    if (!best || inMinutes < best.inMinutes) best = { session, inMinutes };
  }
  return best;
}

export function formatCountdown(inMinutes: number): string {
  if (inMinutes < 60) return `in ${inMinutes} min`;
  const hours = Math.round(inMinutes / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "tomorrow" : `in ${days} days`;
}

export type Filters = {
  query: string;
  styles: Style[];
  liveOnly: boolean;
};

export function filterGyms(gyms: Gym[], filters: Filters, now = new Date()): Gym[] {
  const q = filters.query.trim().toLowerCase();
  return gyms.filter((gym) => {
    if (filters.liveOnly && !isLiveNow(gym, now)) return false;
    if (filters.styles.length && !filters.styles.some((s) => gym.styles.includes(s))) {
      return false;
    }
    if (!q) return true;
    return (
      gym.name.toLowerCase().includes(q) ||
      gym.city.toLowerCase().includes(q) ||
      gym.country.toLowerCase().includes(q)
    );
  });
}

/** Sorted by whatever is happening soonest — the list's default order. */
export function bySoonest(gyms: Gym[], now = new Date()): Gym[] {
  return [...gyms].sort((a, b) => {
    const aLive = isLiveNow(a, now);
    const bLive = isLiveNow(b, now);
    if (aLive !== bLive) return aLive ? -1 : 1;
    return (nextSession(a, now)?.inMinutes ?? Infinity) - (nextSession(b, now)?.inMinutes ?? Infinity);
  });
}
