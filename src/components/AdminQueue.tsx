"use client";

import { useCallback, useEffect, useState } from "react";
import { formatSession, STYLE_LABELS, type Gym, type GymStatus } from "@/lib/types";
import GymEditor from "./GymEditor";
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
  const [gyms, setGyms] = useState<Gym[] | null>(null);
  const [filter, setFilter] = useState<GymStatus | "all">("pending");
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(KEY_STORAGE);
    if (stored) setAdminKey(stored);
  }, []);

  const load = useCallback(async (key: string) => {
    setError(null);
    try {
      const res = await fetch("/api/gyms?status=all", {
        headers: { "x-admin-key": key },
      });
      if (res.status === 401) {
        setError("That key was rejected. Check OPENMAT_ADMIN_KEY on the server.");
        setGyms(null);
        return false;
      }
      const data = (await res.json()) as { gyms: Gym[] };
      setGyms(data.gyms);
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
      const { gym } = (await res.json()) as { gym: Gym };
      setGyms((prev) => prev?.map((g) => (g.id === gym.id ? gym : g)) ?? null);
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

      <div className="mt-5 flex flex-wrap gap-1.5">
        {(["pending", "approved", "rejected", "all"] as const).map((value) => {
          const count =
            value === "all"
              ? (gyms?.length ?? 0)
              : (gyms?.filter((g) => g.status === value).length ?? 0);
          return (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value);
                setEditing(null);
              }}
              className={`rounded-full border px-3 py-1 text-[12px] font-medium capitalize transition ${
                filter === value
                  ? "border-mat-500/50 bg-mat-500/15 text-mat-300"
                  : "border-ink-700 text-ink-400 hover:border-ink-600 hover:text-ink-300"
              }`}
            >
              {value === "approved" ? "live" : value} ({count})
            </button>
          );
        })}
      </div>

      {gyms === null ? (
        <p className="mt-8 text-[13px] text-ink-400">Loading…</p>
      ) : (
        (() => {
          const shown = filter === "all" ? gyms : gyms.filter((g) => g.status === filter);
          if (shown.length === 0) {
            return (
              <p className="mt-8 text-[13px] text-ink-400">
                {filter === "pending"
                  ? "Nothing waiting. Inbox zero."
                  : `No ${filter === "approved" ? "live" : filter} listings.`}
              </p>
            );
          }
          return (
            <ul className="mt-6 space-y-3">
              {shown.map((gym) => (
                <GymRow
                  key={gym.id}
                  gym={gym}
                  busy={busy === gym.id}
                  editing={editing === gym.id}
                  adminKey={adminKey}
                  onEdit={() => setEditing(editing === gym.id ? null : gym.id)}
                  onDecide={decide}
                  onSaved={(updated) => {
                    setGyms((prev) =>
                      prev?.map((g) => (g.id === updated.id ? updated : g)) ?? null,
                    );
                    setEditing(null);
                  }}
                />
              ))}
            </ul>
          );
        })()
      )}
    </main>
  );
}

function GymRow({
  gym,
  busy,
  editing,
  adminKey,
  onEdit,
  onDecide,
  onSaved,
}: {
  gym: Gym;
  busy: boolean;
  editing: boolean;
  adminKey: string;
  onEdit: () => void;
  onDecide: (id: string, status: "approved" | "rejected") => void;
  onSaved: (gym: Gym) => void;
}) {
  const website = safeHref(gym.website);
  const handle = gym.instagram ? normalizeInstagram(gym.instagram) : null;

  return (
    <li className="rounded-xl border border-ink-700 bg-ink-900 px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[14px] font-semibold text-white">{gym.name}</h2>
            <StatusBadge status={gym.status} />
          </div>
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
            onClick={onEdit}
            aria-expanded={editing}
            className="rounded-lg border border-ink-600 px-3 py-1.5 text-[12.5px] text-ink-200 hover:border-mat-500 hover:text-mat-300"
          >
            {editing ? "Close" : "Edit"}
          </button>
          {gym.status !== "approved" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide(gym.id, "approved")}
              className="rounded-lg bg-live-500 px-3 py-1.5 text-[12.5px] font-semibold text-ink-950 disabled:opacity-50"
            >
              Approve
            </button>
          )}
          {gym.status !== "rejected" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide(gym.id, "rejected")}
              className="rounded-lg border border-ink-600 px-3 py-1.5 text-[12.5px] text-ink-300 disabled:opacity-50"
            >
              {gym.status === "approved" ? "Take down" : "Reject"}
            </button>
          )}
        </div>
      </div>

      {editing && (
        <GymEditor
          gym={gym}
          adminKey={adminKey}
          onSaved={onSaved}
          onCancel={onEdit}
        />
      )}
    </li>
  );
}

function StatusBadge({ status }: { status: GymStatus }) {
  const tone =
    status === "approved"
      ? "border-live-500/40 text-live-400"
      : status === "pending"
        ? "border-mat-500/40 text-mat-300"
        : "border-ink-600 text-ink-400";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${tone}`}>
      {status === "approved" ? "live" : status}
    </span>
  );
}
