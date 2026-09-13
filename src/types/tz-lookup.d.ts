declare module "tz-lookup" {
  /** IANA timezone name for a coordinate. Throws on invalid input. */
  export default function tzLookup(lat: number, lng: number): string;
}
