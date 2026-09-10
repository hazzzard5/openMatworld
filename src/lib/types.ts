export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];

export const DAY_LABELS: Record<Day, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

export const STYLES = ["gi", "nogi", "wrestling", "judo", "mma", "striking"] as const;
export type Style = (typeof STYLES)[number];

export const STYLE_LABELS: Record<Style, string> = {
  gi: "Gi",
  nogi: "No-Gi",
  wrestling: "Wrestling",
  judo: "Judo",
  mma: "MMA",
  striking: "Striking",
};

/** A single recurring open mat slot, e.g. Saturday 11:00–13:00. */
export type MatSession = {
  day: Day;
  /** 24h local time, "HH:MM". */
  start: string;
  end: string;
};

export type GymStatus = "pending" | "approved" | "rejected";

export type Gym = {
  id: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  address?: string;
  styles: Style[];
  sessions: MatSession[];
  /** Free-text: "Free", "$20 drop-in", "Members of any academy welcome". */
  dropIn?: string;
  website?: string;
  instagram?: string;
  contactEmail?: string;
  notes?: string;
  status: GymStatus;
  createdAt: string;
};

export type SponsorTier = "headline" | "standard";

export type Sponsor = {
  id: string;
  name: string;
  tagline?: string;
  url: string;
  /** Path or absolute URL to a logo. Falls back to initials when absent. */
  logo?: string;
  tier: SponsorTier;
  /** True for the "your brand here" slots shown while a tier is unsold. */
  placeholder?: boolean;
};

export const SPONSOR_DURATIONS = [
  "1 month",
  "3 months",
  "6 months",
  "12 months",
  "Not sure yet",
] as const;

export type SponsorDuration = (typeof SPONSOR_DURATIONS)[number];

export type SponsorInquiry = {
  id: string;
  name: string;
  email: string;
  business: string;
  duration: string;
  message?: string;
  createdAt: string;
};

/** Formats "14:30" as "2:30pm". */
export function formatTime(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const suffix = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

export function formatSession(s: MatSession): string {
  return `${DAY_LABELS[s.day]} ${formatTime(s.start)}–${formatTime(s.end)}`;
}

/** Day key for "today" in the viewer's own timezone. */
export function todayKey(now = new Date()): Day {
  return DAYS[(now.getDay() + 6) % 7];
}
