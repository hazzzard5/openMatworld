import tzLookup from "tz-lookup";

/**
 * IANA timezone for a coordinate, e.g. "America/New_York".
 *
 * Server-only: this pulls in a ~72KB boundary table, and keeping it out of
 * the browser bundle is why the zone travels with each gym rather than being
 * resolved on the client. Never import this from a client component.
 */
export function timezoneFor(lat: number, lng: number): string | undefined {
  try {
    return tzLookup(lat, lng);
  } catch {
    // Coordinates outside the table (mid-ocean, bad data). Callers fall back
    // to estimating from longitude.
    return undefined;
  }
}
