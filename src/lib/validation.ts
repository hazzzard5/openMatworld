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
 * Required: a public website is the one thing that lets a visitor — and the
 * moderator — check that an academy is real before turning up to train.
 */
const websiteSchema = z
  .string()
  .trim()
  .min(1, "A website is required so people can check the gym is real")
  .max(240, "That address is too long")
  .refine((v) => normalizeWebsite(v) !== null, {
    message: "Enter a working web address, like yourgym.com",
  })
  .transform((v) => normalizeWebsite(v)!);

/** Optional, but a broken handle makes a broken link, so it's checked too. */
const instagramSchema = z
  .string()
  .trim()
  .max(120)
  .optional()
  .refine((v) => !v || normalizeInstagram(v) !== null, {
    message: "Use just your handle, like @yourgym",
  })
  .transform((v) => (v ? (normalizeInstagram(v) ?? undefined) : undefined));

export const gymSubmissionSchema = z.object({
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
  /** Honeypot: real people leave this empty. */
  website_url: z.string().max(0).optional(),
});

export type GymSubmission = z.infer<typeof gymSubmissionSchema>;

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
