import { DAYS, type Day, type Gym, type MatSession, type Style } from "./types";

const MINUTES_PER_DAY = 24 * 60;
const WEEK_MINUTES = 7 * MINUTES_PER_DAY;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Wall-clock time at a gym, approximated from its longitude (15° per hour).
 * We don't ask submitters for a timezone, and a solar estimate is close enough
 * to answer "is anything rolling right now?" — the UI says it's approximate.
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
  const local = approxLocalNow(gym.lng, now);
  return gym.sessions.some((s) => {
    if (s.day !== local.day) return false;
    return local.minutes >= toMinutes(s.start) && local.minutes < toMinutes(s.end);
  });
}

export type NextUp = { session: MatSession; inMinutes: number };

export function nextSession(gym: Gym, now = new Date()): NextUp | null {
  const local = approxLocalNow(gym.lng, now);
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
