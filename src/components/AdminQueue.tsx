"use client";

import { useCallback, useEffect, useState } from "react";
import { formatSession, STYLE_LABELS, type Gym } from "@/lib/types";
import { displayHost, normalizeInstagram, safeHref } from "@/lib/url";

const KEY_STORAGE = "openmat.adminKey";

/**
 * Minimal moderation queue. The admin key never leaves the browser except as
 * an x-admin-key header, and it's only as strong as the secret you choose —
 * put this behind real auth before the site gets popular.
 */
export default function AdminQueue() {
  const [adminKey, setAdminKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [pending, setPending] = useState<Gym[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(KEY_STORAGE);
    if (stored) setAdminKey(stored);
  }, []);

  const load = useCallback(async (key: string) => {
    setError(null);
    try {
      const res = await fetch("/api/gyms?status=pending", {
        headers: { "x-admin-key": key },
      });
      if (res.status === 401) {
        setError("That key was rejected. Check OPENMAT_ADMIN_KEY on the server.");
        setPending(null);
        return false;
      }
      const data = (await res.json()) as { gyms: Gym[] };
      setPending(data.gyms);
      return true;
    } catch {
      setError("Couldn't reach the server.");
      return false;
    }
  }, []);

  useEffect(() => {
    if (adminKey) void load(adminKey);
  }, [adminKey, load]);

  async function decide(id: string, status: "approved" | "rejected") {
    setBusy(id);
    try {
      const res = await fetch(`/api/gyms/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        setError("That didn't save. Try again.");
        return;
      }
      setPending((prev) => prev?.filter((g) => g.id !== id) ?? null);
    } finally {
      setBusy(null);
    }
  }

  if (!adminKey) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
        <h1 className="text-[16px] font-semibold text-white">Moderation queue</h1>
        <p className="mt-1.5 text-[13px] text-ink-400">
          Enter the admin key set as <code className="text-ink-300">OPENMAT_ADMIN_KEY</code>.
        </p>
        <form
          className="mt-4 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await load(keyInput)) {
              window.localStorage.setItem(KEY_STORAGE, keyInput);
              setAdminKey(keyInput);
            }
          }}
        >
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Admin key"
            className="flex-1 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-[13px] text-ink-200"
          />
          <button
            type="submit"
            className="rounded-lg bg-mat-500 px-3.5 py-2 text-[13px] font-semibold text-ink-950"
          >
            Unlock
          </button>
        </form>
        {error && <p className="mt-3 text-[12.5px] text-mat-300">{error}</p>}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <header className="flex items-baseline justify-between">
        <h1 className="text-[17px] font-semibold text-white">Moderation queue</h1>
        <button
          type="button"
          onClick={() => {
            window.localStorage.removeItem(KEY_STORAGE);
            setAdminKey("");
          }}
          className="text-[12px] text-ink-400 hover:text-ink-200"
        >
          Sign out
        </button>
      </header>

      {error && <p className="mt-4 text-[12.5px] text-mat-300">{error}</p>}

      {pending === null ? (
        <p className="mt-8 text-[13px] text-ink-400">Loading…</p>
      ) : pending.length === 0 ? (
        <p className="mt-8 text-[13px] text-ink-400">Nothing waiting. Inbox zero.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {pending.map((gym) => (
            <PendingRow
              key={gym.id}
              gym={gym}
              busy={busy === gym.id}
              onDecide={decide}
            />
          ))}
        </ul>
      )}
    </main>
  );
}

function PendingRow({
  gym,
  busy,
  onDecide,
}: {
  gym: Gym;
  busy: boolean;
  onDecide: (id: string, status: "approved" | "rejected") => void;
}) {
  const website = safeHref(gym.website);
  const handle = gym.instagram ? normalizeInstagram(gym.instagram) : null;

  return (
    <li className="rounded-xl border border-ink-700 bg-ink-900 px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-white">{gym.name}</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-400">
            {gym.address ?? `${gym.city}, ${gym.country}`}
            <span className="ml-2 tabular-nums">
              ({gym.lat.toFixed(3)}, {gym.lng.toFixed(3)})
            </span>
          </p>
          <p className="mt-2 text-[12.5px] text-ink-300">
            {gym.styles.map((s) => STYLE_LABELS[s]).join(" · ")}
          </p>
          <ul className="mt-1 text-[12.5px] text-ink-200 tabular-nums">
            {gym.sessions.map((s, i) => (
              <li key={i}>{formatSession(s)}</li>
            ))}
          </ul>
          {gym.dropIn && (
            <p className="mt-1 text-[12.5px] text-ink-300">Drop-in: {gym.dropIn}</p>
          )}
          {gym.notes && <p className="mt-1 text-[12px] text-ink-400">{gym.notes}</p>}

          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-400">
            {/* Open these before approving — they're the whole point of
                asking for a public link. */}
            {website && (
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-mat-400 underline underline-offset-2 hover:text-mat-300"
              >
                {displayHost(gym.website!)} ↗
              </a>
            )}
            {handle && (
              <a
                href={`https://instagram.com/${handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-mat-400 underline underline-offset-2 hover:text-mat-300"
              >
                @{handle} ↗
              </a>
            )}
            {!website && !handle && (
              <span className="text-ink-400 italic">no public link</span>
            )}
            {gym.contactEmail && <span>{gym.contactEmail}</span>}
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onDecide(gym.id, "approved")}
            className="rounded-lg bg-live-500 px-3 py-1.5 text-[12.5px] font-semibold text-ink-950 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onDecide(gym.id, "rejected")}
            className="rounded-lg border border-ink-600 px-3 py-1.5 text-[12.5px] text-ink-300 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
    </li>
  );
}
