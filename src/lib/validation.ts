import { z } from "zod";
import { DAYS, STYLES } from "./types";
import { normalizeInstagram, normalizeWebsite } from "./url";

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM, e.g. 11:30");

export const sessionSchema = z
  .object({
    day: z.enum(DAYS),
    start: time,
    end: time,
  })
  .refine((s) => s.end > s.start, {
    message: "End time must be after the start time",
    path: ["end"],
  });

/**
 * Both links are individually optional, but the object-level check below
 * requires one of them: a public page is what lets a visitor — and the
 * moderator — confirm an academy is real before turning up to train.
 * Plenty of small gyms run on an Instagram page alone and have no website.
 */
const websiteSchema = z
  .string()
  .trim()
  .max(240, "That address is too long")
  .optional()
  .refine((v) => !v || normalizeWebsite(v) !== null, {
    message: "Enter a working web address, like yourgym.com",
  })
  .transform((v) => (v ? (normalizeWebsite(v) ?? undefined) : undefined));

/** A broken handle makes a broken link, so it's checked too. */
const instagramSchema = z
  .string()
  .trim()
  .max(120)
  .optional()
  .refine((v) => !v || normalizeInstagram(v) !== null, {
    message: "Use just your handle, like @yourgym",
  })
  .transform((v) => (v ? (normalizeInstagram(v) ?? undefined) : undefined));

const gymSubmissionFields = z.object({
  name: z.string().trim().min(2, "Gym name is required").max(120),
  city: z.string().trim().min(1, "City is required").max(120),
  country: z.string().trim().min(1, "Country is required").max(120),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().trim().max(240).optional().or(z.literal("")),
  styles: z.array(z.enum(STYLES)).min(1, "Pick at least one style"),
  sessions: z.array(sessionSchema).min(1, "Add at least one open mat time").max(14),
  dropIn: z.string().trim().max(120).optional().or(z.literal("")),
  website: websiteSchema,
  instagram: instagramSchema,
  contactEmail: z.string().trim().email("Not a valid email").max(160).optional().or(z.literal("")),
  notes: z.string().trim().max(600).optional().or(z.literal("")),
  /**
   * Honeypot: real people leave this empty. Deliberately not length-checked
   * here — the route accepts a filled one and silently discards it, so a bot
   * gets a 201 rather than a validation error naming the trap.
   */
  website_url: z.string().max(240).optional(),
});

export const gymSubmissionSchema = gymSubmissionFields.refine(
  (v) => Boolean(v.website || v.instagram),
  {
    message: "Add a website or an Instagram handle so people can check the gym is real",
    path: ["website"],
  },
);

export type GymSubmission = z.infer<typeof gymSubmissionSchema>;

/**
 * An admin edit. Every field is optional — only what's sent gets changed —
 * but anything sent is held to the same rules as a submission, so a
 * moderator can't quietly introduce a value the form would have rejected.
 *
 * The link fields keep their raw string rather than collapsing "" to
 * undefined: an empty string is how the editor says "clear this", and that
 * has to stay distinguishable from "field not sent".
 */
const editLink = (
  check: (v: string) => string | null,
  message: string,
) =>
  z
    .string()
    .trim()
    .max(240)
    .refine((v) => v === "" || check(v) !== null, { message })
    .optional();

export const gymEditSchema = gymSubmissionFields
  .omit({ website_url: true, website: true, instagram: true })
  .extend({
    website: editLink(normalizeWebsite, "Enter a working web address, like yourgym.com"),
    instagram: editLink(normalizeInstagram, "Use just your handle, like @yourgym"),
  })
  .partial()
  .refine(
    (v) => {
      // Only checked when the edit touches the links; an edit that leaves
      // both alone cannot have removed the gym's last public link.
      if (v.website === undefined && v.instagram === undefined) return true;
      return Boolean(
        (v.website && normalizeWebsite(v.website)) ||
          (v.instagram && normalizeInstagram(v.instagram)),
      );
    },
    {
      message: "A gym needs a website or an Instagram so people can check it's real",
      path: ["website"],
    },
  );

export type GymEditInput = z.infer<typeof gymEditSchema>;

/**
 * Turns a parsed edit into a patch. A key appears only when it was sent;
 * an emptied optional field becomes null, meaning "clear it".
 */
export function normalizeEdit(input: GymEditInput) {
  const patch: Record<string, unknown> = {};

  const required = ["name", "city", "country", "lat", "lng", "styles", "sessions"] as const;
  for (const key of required) {
    if (input[key] !== undefined) patch[key] = input[key];
  }

  const clearable = {
    address: (v: string) => v,
    dropIn: (v: string) => v,
    contactEmail: (v: string) => v,
    notes: (v: string) => v,
    website: (v: string) => normalizeWebsite(v),
    instagram: (v: string) => normalizeInstagram(v),
  } as const;

  for (const [key, clean] of Object.entries(clearable)) {
    const value = input[key as keyof GymEditInput] as string | undefined;
    if (value === undefined) continue;
    const trimmed = value.trim();
    patch[key] = trimmed ? clean(trimmed) : null;
  }

  return patch;
}

/** Strips empty-string optionals down to undefined. */
export function normalize(input: GymSubmission) {
  const blank = (v?: string) => (v && v.trim() ? v.trim() : undefined);
  return {
    name: input.name,
    city: input.city,
    country: input.country,
    lat: input.lat,
    lng: input.lng,
    address: blank(input.address),
    styles: input.styles,
    sessions: input.sessions,
    dropIn: blank(input.dropIn),
    website: input.website,
    instagram: input.instagram,
    contactEmail: blank(input.contactEmail),
    notes: blank(input.notes),
  };
}
