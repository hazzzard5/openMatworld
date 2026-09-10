/**
 * URL handling shared by the submit form and the API.
 *
 * Gym websites are user-submitted and then rendered as links, so anything that
 * isn't plainly http(s) has to be rejected here — `new URL()` alone happily
 * accepts `javascript:` and `data:`, which would be a stored XSS in an href.
 */

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * Parses a submitted website. Accepts "yourgym.com" as well as a full URL —
 * people rarely type the scheme — and returns null for anything that isn't a
 * public http(s) address.
 */
export function parseWebsite(value: string): URL | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const candidate = HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  // A real gym site has a dotted hostname; this also rules out "localhost".
  if (!url.hostname.includes(".") || url.hostname.endsWith(".")) return null;

  return url;
}

/** Canonical string form to store, or null if the input isn't usable. */
export function normalizeWebsite(value: string): string | null {
  return parseWebsite(value)?.toString() ?? null;
}

/** "https://www.southsidebjj.com/mats" -> "southsidebjj.com" */
export function displayHost(value: string): string {
  const url = parseWebsite(value);
  if (!url) return value;
  return url.hostname.replace(/^www\./, "");
}

/**
 * Safe href for a stored website. Older rows predate validation, so never
 * trust what's in the database straight into an anchor.
 */
export function safeHref(value: string | undefined): string | null {
  return value ? normalizeWebsite(value) : null;
}

const INSTAGRAM_HANDLE = /^[A-Za-z0-9._]{1,30}$/;

/**
 * Reduces "@gym", "instagram.com/gym/" and "https://www.instagram.com/gym" to
 * "gym". A URL pointing anywhere other than Instagram is rejected rather than
 * mangled into a handle, and so is anything that isn't a plausible username —
 * the result gets interpolated into a profile URL.
 */
export function normalizeInstagram(value: string): string | null {
  let handle = value.trim();
  if (!handle) return null;

  if (/[:/]/.test(handle)) {
    const match = handle.match(
      /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/@?([A-Za-z0-9._]{1,30})\/?(?:[?#].*)?$/i,
    );
    if (!match) return null;
    handle = match[1];
  }

  handle = handle.replace(/^@+/, "");
  return INSTAGRAM_HANDLE.test(handle) ? handle : null;
}
