"use client";

import { useState } from "react";
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
import { normalizeInstagram, normalizeWebsite } from "@/lib/url";

type Props = {
  gym: Gym;
  adminKey: string;
  onSaved: (gym: Gym) => void;
  onCancel: () => void;
};

/** Inline edit form for a listing. Mirrors the rules the public form applies. */
export default function GymEditor({ gym, adminKey, onSaved, onCancel }: Props) {
  const [name, setName] = useState(gym.name);
  const [city, setCity] = useState(gym.city);
  const [country, setCountry] = useState(gym.country);
  const [address, setAddress] = useState(gym.address ?? "");
  const [lat, setLat] = useState(String(gym.lat));
  const [lng, setLng] = useState(String(gym.lng));
  const [styles, setStyles] = useState<Style[]>(gym.styles);
  const [sessions, setSessions] = useState<MatSession[]>(gym.sessions);
  const [dropIn, setDropIn] = useState(gym.dropIn ?? "");
  const [website, setWebsite] = useState(gym.website ?? "");
  const [instagram, setInstagram] = useState(gym.instagram ?? "");
  const [contactEmail, setContactEmail] = useState(gym.contactEmail ?? "");
  const [notes, setNotes] = useState(gym.notes ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateSession = (index: number, patch: Partial<MatSession>) =>
    setSessions((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  async function save() {
    setError(null);

    if (styles.length === 0) return setError("Pick at least one style.");
    if (sessions.length === 0) return setError("A listing needs at least one open mat time.");
    if (sessions.some((s) => s.end <= s.start)) {
      return setError("Each session needs to end after it starts.");
    }
    if (website.trim() && !normalizeWebsite(website)) {
      return setError("That website doesn't look like a working address.");
    }
    if (instagram.trim() && !normalizeInstagram(instagram)) {
      return setError("That Instagram doesn't look right — just the handle.");
    }
    if (!normalizeWebsite(website) && !normalizeInstagram(instagram)) {
      return setError("Keep a website or an Instagram so people can check it's real.");
    }

    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
      return setError("Latitude must be between -90 and 90.");
    }
    if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
      return setError("Longitude must be between -180 and 180.");
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/gyms/${gym.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({
          name,
          city,
          country,
          address,
          lat: latNum,
          lng: lngNum,
          styles,
          sessions,
          dropIn,
          website,
          instagram,
          contactEmail,
          notes,
        }),
      });
      const data = (await res.json()) as {
        gym?: Gym;
        error?: string;
        issues?: { message?: string }[];
      };
      if (!res.ok || !data.gym) {
        setError(
          data.issues?.find((i) => i.message)?.message ?? data.error ?? "Could not save that.",
        );
        return;
      }
      onSaved(data.gym);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 space-y-3 border-t border-ink-700 pt-4">
      <Row>
        <Field label="Gym name">
          <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
        </Field>
      </Row>

      <Row>
        <Field label="City">
          <input value={city} onChange={(e) => setCity(e.target.value)} className={input} />
        </Field>
        <Field label="Country">
          <input value={country} onChange={(e) => setCountry(e.target.value)} className={input} />
        </Field>
      </Row>

      <Field label="Address">
        <input value={address} onChange={(e) => setAddress(e.target.value)} className={input} />
      </Field>

      <Row>
        <Field label="Latitude">
          <input
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            inputMode="decimal"
            className={`${input} tabular-nums`}
          />
        </Field>
        <Field label="Longitude">
          <input
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            inputMode="decimal"
            className={`${input} tabular-nums`}
          />
        </Field>
      </Row>

      <Field label="Styles">
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
                className={`rounded-full border px-2.5 py-1 text-[11.5px] transition ${
                  active
                    ? "border-mat-500/60 bg-mat-500/15 text-mat-300"
                    : "border-ink-700 text-ink-400 hover:border-ink-600"
                }`}
              >
                {STYLE_LABELS[style]}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Open mat times">
        <div className="space-y-2">
          {sessions.map((session, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
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
                    onClick={() => setSessions((prev) => prev.filter((_, idx) => idx !== i))}
                    className="shrink-0 rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-200"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setSessions((prev) => [...prev, { day: "sat", start: "11:00", end: "13:00" }])
          }
          className="mt-2 text-[12px] text-mat-400 hover:text-mat-300"
        >
          + Add another time
        </button>
      </Field>

      <Field label="Drop-in">
        <input value={dropIn} onChange={(e) => setDropIn(e.target.value)} className={input} />
      </Field>

      <Row>
        <Field label="Website">
          <input value={website} onChange={(e) => setWebsite(e.target.value)} className={input} />
        </Field>
        <Field label="Instagram">
          <input
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            className={input}
          />
        </Field>
      </Row>

      <Field label="Contact email (private)">
        <input
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          className={input}
        />
      </Field>

      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className={`${input} resize-y`}
        />
      </Field>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-mat-500/40 bg-mat-500/10 px-3 py-2 text-[12.5px] text-mat-300"
        >
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-[12.5px] text-ink-400 hover:text-ink-200"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded-lg bg-mat-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-ink-950 hover:bg-mat-400 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

const inputBase =
  "rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-[13px] text-ink-200 focus:border-ink-600 focus:outline-none focus-visible:ring-1 focus-visible:ring-mat-500/60";
const input = `w-full ${inputBase}`;

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-1.5 block text-[11.5px] font-medium text-ink-400">{label}</span>
      {children}
    </div>
  );
}
