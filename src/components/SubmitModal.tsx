"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { normalizeWebsite } from "@/lib/url";
import {
  DAYS,
  DAY_LABELS,
  STYLES,
  STYLE_LABELS,
  type Day,
  type Gym,
  type MatSession,
  type Style,
} from "@/lib/types";

type Place = { label: string; lat: number; lng: number; city: string; country: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onAdded: (gym: Gym) => void;
};

const emptySession = (): MatSession => ({ day: "sat", start: "11:00", end: "13:00" });

export default function SubmitModal({ open, onClose, onAdded }: Props) {
  const formId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  const [name, setName] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [place, setPlace] = useState<Place | null>(null);
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [geocodeDown, setGeocodeDown] = useState(false);
  const [manual, setManual] = useState(false);
  const [manualCity, setManualCity] = useState("");
  const [manualCountry, setManualCountry] = useState("");
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [styles, setStyles] = useState<Style[]>(["gi", "nogi"]);
  const [sessions, setSessions] = useState<MatSession[]>([emptySession()]);
  const [dropIn, setDropIn] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [honeypot, setHoneypot] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"pending" | "approved" | null>(null);

  const reset = useCallback(() => {
    setName("");
    setLocationQuery("");
    setPlace(null);
    setResults([]);
    setGeocodeDown(false);
    setManual(false);
    setManualCity("");
    setManualCountry("");
    setManualLat("");
    setManualLng("");
    setStyles(["gi", "nogi"]);
    setSessions([emptySession()]);
    setDropIn("");
    setWebsite("");
    setInstagram("");
    setContactEmail("");
    setNotes("");
    setError(null);
    setDone(null);
  }, []);

  // Close on Escape, and keep the page behind from scrolling.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  // Debounced geocoding — Nominatim asks callers to go easy.
  useEffect(() => {
    if (place || manual || locationQuery.trim().length < 3) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(locationQuery)}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as { results?: Place[]; error?: string };
        setResults(data.results ?? []);
        setGeocodeDown(!res.ok);
      } catch (err) {
        // Aborting a superseded request is normal; anything else means the
        // lookup is unavailable and the manual fallback should be offered.
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setGeocodeDown(true);
        }
      } finally {
        setSearching(false);
      }
    }, 450);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [locationQuery, place, manual]);

  useEffect(() => {
    if (error) {
      errorRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [error]);

  if (!open) return null;

  /** Builds a Place from the manual fields, or null if they're not usable. */
  function manualPlace(): Place | null {
    const lat = Number(manualLat);
    const lng = Number(manualLng);
    const city = manualCity.trim();
    const country = manualCountry.trim();
    if (!city || !country) return null;
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return null;
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) return null;
    return { label: `${city}, ${country}`, lat, lng, city, country };
  }

  const updateSession = (index: number, patch: Partial<MatSession>) => {
    setSessions((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const resolved = manual ? manualPlace() : place;
    if (!resolved) {
      setError(
        manual
          ? "Fill in the city, country and coordinates."
          : "Search for the gym's location so we can put it on the globe.",
      );
      return;
    }
    if (styles.length === 0) {
      setError("Pick at least one style.");
      return;
    }
    if (!normalizeWebsite(website)) {
      setError(
        website.trim()
          ? "That website doesn't look like a working address — try yourgym.com."
          : "Add your gym's website so visitors can check you're a real academy.",
      );
      return;
    }
    if (sessions.some((s) => s.end <= s.start)) {
      setError("Each session needs to end after it starts.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/gyms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          city: resolved.city || resolved.label.split(",")[0].trim(),
          country: resolved.country,
          lat: resolved.lat,
          lng: resolved.lng,
          address: resolved.label,
          styles,
          sessions,
          dropIn,
          website,
          instagram,
          contactEmail,
          notes,
          website_url: honeypot,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        issues?: { message?: string }[];
        gym?: Gym;
        status?: "pending" | "approved";
      };

      if (!res.ok) {
        // Field-level messages are far more useful than "some fields need fixing".
        setError(
          data.issues?.find((i) => i.message)?.message ??
            data.error ??
            "Something went wrong. Try again.",
        );
        return;
      }

      setDone(data.status ?? "pending");
      if (data.gym && data.status === "approved") onAdded(data.gym);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/80 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${formId}-title`}
        className="my-auto w-full max-w-lg rounded-2xl border border-ink-700 bg-ink-900 shadow-2xl"
      >
        {done ? (
          <div className="px-6 py-10 text-center">
            <div className="mx-auto grid size-11 place-items-center rounded-full bg-live-500/15 text-live-400">
              ✓
            </div>
            <h2 className="mt-4 text-[16px] font-semibold text-white">
              {done === "approved" ? "You're on the globe" : "Submitted — thank you"}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-ink-400">
              {done === "approved"
                ? "Your open mat is live. Spin the globe and find it."
                : "We check submissions by hand so the map stays accurate. It'll normally appear within a day."}
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  reset();
                }}
                className="rounded-lg border border-ink-600 px-3.5 py-2 text-[13px] text-ink-200 hover:border-ink-400"
              >
                Add another
              </button>
              <button
                type="button"
                onClick={() => {
                  reset();
                  onClose();
                }}
                className="rounded-lg bg-mat-500 px-3.5 py-2 text-[13px] font-semibold text-ink-950 hover:bg-mat-400"
              >
                Back to the globe
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <header className="flex items-start justify-between gap-4 border-b border-ink-800 px-6 py-5">
              <div>
                <h2 id={`${formId}-title`} className="text-[16px] font-semibold text-white">
                  Add your open mat
                </h2>
                <p className="mt-1 text-[12.5px] text-ink-400">
                  Free, forever. Only list sessions that visitors from other gyms can
                  actually attend.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mt-1 shrink-0 rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-200"
              >
                ✕
              </button>
            </header>

            <div className="scroll-slim max-h-[min(70vh,640px)] space-y-5 overflow-y-auto px-6 py-5">
              <Field label="Gym name" htmlFor={`${formId}-name`} required>
                <input
                  id={`${formId}-name`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={120}
                  placeholder="Southside Jiu-Jitsu"
                  className={inputClass}
                />
              </Field>

              <Field
                label="Location"
                htmlFor={manual ? `${formId}-city` : `${formId}-loc`}
                required
                hint={
                  manual
                    ? "Right-click a spot in Google Maps to copy its coordinates."
                    : "Search an address or suburb — we'll pin it on the globe."
                }
              >
                {place && !manual ? (
                  <div className="flex items-start justify-between gap-3 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2.5">
                    <span className="text-[12.5px] leading-snug text-ink-200">
                      {place.label}
                      <span className="mt-0.5 block text-[11px] text-ink-400 tabular-nums">
                        {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPlace(null);
                        setLocationQuery("");
                      }}
                      className="shrink-0 text-[11.5px] text-mat-400 hover:text-mat-300"
                    >
                      Change
                    </button>
                  </div>
                ) : manual ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        id={`${formId}-city`}
                        value={manualCity}
                        onChange={(e) => setManualCity(e.target.value)}
                        placeholder="City"
                        aria-label="City"
                        className={inputClass}
                      />
                      <input
                        value={manualCountry}
                        onChange={(e) => setManualCountry(e.target.value)}
                        placeholder="Country"
                        aria-label="Country"
                        className={inputClass}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={manualLat}
                        onChange={(e) => setManualLat(e.target.value)}
                        inputMode="decimal"
                        placeholder="Latitude, e.g. 64.1466"
                        aria-label="Latitude"
                        className={`${inputClass} tabular-nums`}
                      />
                      <input
                        value={manualLng}
                        onChange={(e) => setManualLng(e.target.value)}
                        inputMode="decimal"
                        placeholder="Longitude, e.g. -21.9426"
                        aria-label="Longitude"
                        className={`${inputClass} tabular-nums`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setManual(false)}
                      className="text-[11.5px] text-mat-400 hover:text-mat-300"
                    >
                      Search for an address instead
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      id={`${formId}-loc`}
                      value={locationQuery}
                      onChange={(e) => setLocationQuery(e.target.value)}
                      placeholder="123 Example St, Austin, TX"
                      autoComplete="off"
                      className={inputClass}
                    />
                    {searching && (
                      <p className="mt-1.5 text-[11.5px] text-ink-400">Looking that up…</p>
                    )}
                    {results.length > 0 && (
                      <ul className="mt-1.5 overflow-hidden rounded-lg border border-ink-700">
                        {results.map((r, i) => (
                          <li key={i}>
                            <button
                              type="button"
                              onClick={() => {
                                setPlace(r);
                                setResults([]);
                              }}
                              className="block w-full border-b border-ink-800 bg-ink-850 px-3 py-2 text-left text-[12.5px] text-ink-300 last:border-0 hover:bg-ink-800 hover:text-white"
                            >
                              {r.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {!searching && (geocodeDown || locationQuery.trim().length >= 3) && (
                      <p className="mt-1.5 text-[11.5px] text-ink-400">
                        {geocodeDown && "Address lookup isn't responding. "}
                        <button
                          type="button"
                          onClick={() => setManual(true)}
                          className="text-mat-400 underline underline-offset-2 hover:text-mat-300"
                        >
                          Enter the coordinates yourself
                        </button>
                      </p>
                    )}
                  </>
                )}
              </Field>

              <Field label="What's on the mat" required>
                <div className="flex flex-wrap gap-1.5">
                  {STYLES.map((style) => {
                    const active = styles.includes(style);
                    return (
                      <button
                        key={style}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          setStyles((prev) =>
                            active ? prev.filter((s) => s !== style) : [...prev, style],
                          )
                        }
                        className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${
                          active
                            ? "border-mat-500/60 bg-mat-500/15 text-mat-300"
                            : "border-ink-700 text-ink-400 hover:border-ink-600 hover:text-ink-300"
                        }`}
                      >
                        {STYLE_LABELS[style]}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="Open mat times" required hint="In the gym's local time.">
                <div className="space-y-2">
                  {sessions.map((session, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      {/* At phone width the day drops onto its own line so the
                          native time pickers keep enough room to show "11:00". */}
                      <select
                        aria-label="Day"
                        value={session.day}
                        onChange={(e) => updateSession(i, { day: e.target.value as Day })}
                        className={`${inputBase} w-full shrink-0 sm:w-[4.5rem]`}
                      >
                        {DAYS.map((d) => (
                          <option key={d} value={d}>
                            {DAY_LABELS[d]}
                          </option>
                        ))}
                      </select>
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <input
                          aria-label="Start time"
                          type="time"
                          value={session.start}
                          onChange={(e) => updateSession(i, { start: e.target.value })}
                          className={`${inputBase} w-0 min-w-0 flex-1`}
                        />
                        <span className="text-ink-400">–</span>
                        <input
                          aria-label="End time"
                          type="time"
                          value={session.end}
                          onChange={(e) => updateSession(i, { end: e.target.value })}
                          className={`${inputBase} w-0 min-w-0 flex-1`}
                        />
                        {sessions.length > 1 && (
                          <button
                            type="button"
                            aria-label="Remove this session"
                            onClick={() =>
                              setSessions((prev) => prev.filter((_, idx) => idx !== i))
                            }
                            className="shrink-0 rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-200"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {sessions.length < 14 && (
                  <button
                    type="button"
                    onClick={() => setSessions((prev) => [...prev, emptySession()])}
                    className="mt-2 text-[12px] text-mat-400 hover:text-mat-300"
                  >
                    + Add another time
                  </button>
                )}
              </Field>

              <Field
                label="Drop-in cost"
                htmlFor={`${formId}-drop`}
                hint="Leave blank if you'd rather not say."
              >
                <input
                  id={`${formId}-drop`}
                  value={dropIn}
                  onChange={(e) => setDropIn(e.target.value)}
                  maxLength={120}
                  placeholder="Free for visiting grapplers"
                  className={inputClass}
                />
              </Field>

              <Field
                label="Website"
                htmlFor={`${formId}-web`}
                required
                hint="Shown on your listing so visitors can check you're a real academy before turning up."
              >
                <input
                  id={`${formId}-web`}
                  type="text"
                  inputMode="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  required
                  maxLength={240}
                  placeholder="yourgym.com"
                  aria-invalid={website.trim() !== "" && !normalizeWebsite(website)}
                  className={inputClass}
                />
              </Field>

              <Field label="Instagram" htmlFor={`${formId}-ig`}>
                <input
                  id={`${formId}-ig`}
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  maxLength={120}
                  placeholder="@yourgym"
                  className={inputClass}
                />
              </Field>

              <Field
                label="Contact email"
                htmlFor={`${formId}-email`}
                hint="Not shown publicly — only used if we need to check a detail."
              >
                <input
                  id={`${formId}-email`}
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="coach@yourgym.com"
                  className={inputClass}
                />
              </Field>

              <Field
                label="Anything visitors should know"
                htmlFor={`${formId}-notes`}
              >
                <textarea
                  id={`${formId}-notes`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={600}
                  rows={3}
                  placeholder="Ring the buzzer, gi optional in summer, park on the street."
                  className={`${inputClass} resize-y`}
                />
              </Field>

              {/* Honeypot — hidden from people, catnip for bots. */}
              <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label htmlFor={`${formId}-hp`}>Leave this empty</label>
                <input
                  id={`${formId}-hp`}
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

              {error && (
                <p
                  ref={errorRef}
                  role="alert"
                  className="rounded-lg border border-mat-500/40 bg-mat-500/10 px-3 py-2 text-[12.5px] text-mat-300"
                >
                  {error}
                </p>
              )}
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-ink-800 px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3.5 py-2 text-[13px] text-ink-400 hover:text-ink-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-mat-500 px-4 py-2 text-[13px] font-semibold text-ink-950 transition hover:bg-mat-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Sending…" : "Put us on the map"}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}

// Width is kept out of the base so callers in a flex row can set their own —
// two width utilities on one element is a coin toss over which wins.
const inputBase =
  "rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-[13px] text-ink-200 placeholder:text-ink-400 focus:border-ink-600 focus:outline-none focus-visible:ring-1 focus-visible:ring-mat-500/60";

const inputClass = `w-full ${inputBase}`;

function Field({
  label,
  htmlFor,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[12px] font-medium text-ink-300"
      >
        {label}
        {required && <span className="ml-1 text-mat-400">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[11.5px] text-ink-400">{hint}</p>}
    </div>
  );
}
