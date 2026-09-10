"use client";

import { useEffect, useRef } from "react";
import { STYLES, STYLE_LABELS, type Gym, type Style } from "@/lib/types";
import { formatCountdown, isLiveNow, nextSession } from "@/lib/gyms";
import { displayHost, normalizeInstagram, safeHref } from "@/lib/url";
import { formatSession } from "@/lib/types";

type Props = {
  gyms: Gym[];
  total: number;
  countries: number;
  liveCount: number;
  query: string;
  onQuery: (q: string) => void;
  styles: Style[];
  onToggleStyle: (s: Style) => void;
  liveOnly: boolean;
  onToggleLive: () => void;
  selected: Gym | null;
  onSelect: (g: Gym | null) => void;
  onSubmit: () => void;
};

export default function Sidebar({
  gyms,
  total,
  countries,
  liveCount,
  query,
  onQuery,
  styles,
  onToggleStyle,
  liveOnly,
  onToggleLive,
  selected,
  onSelect,
  onSubmit,
}: Props) {
  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-ink-800 bg-ink-900/80 backdrop-blur">
      <header className="border-b border-ink-800 px-5 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="relative inline-flex size-2.5 text-mat-500">
            <span className="pulse-dot absolute inset-0 rounded-full" />
            <span className="relative size-2.5 rounded-full bg-mat-500" />
          </span>
          <h1 className="text-[15px] leading-none font-semibold tracking-tight text-white">
            Open Mat World
          </h1>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-400">
          Every open mat on one globe. Travelling? Find somewhere to roll.
        </p>

        <dl className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="mats" value={total} />
          <Stat label="countries" value={countries} />
          <Stat label="on now" value={liveCount} accent={liveCount > 0} />
        </dl>

        <button
          type="button"
          onClick={onSubmit}
          className="mt-4 w-full rounded-lg bg-mat-500 px-3 py-2.5 text-[13px] font-semibold text-ink-950 transition hover:bg-mat-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-mat-300"
        >
          Add your open mat
        </button>
      </header>

      <div className="border-b border-ink-800 px-5 py-4">
        <label className="sr-only" htmlFor="gym-search">
          Search gyms
        </label>
        <input
          id="gym-search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search city, country or gym…"
          className="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-[13px] text-ink-200 placeholder:text-ink-400 focus:border-ink-600 focus:outline-none focus-visible:ring-1 focus-visible:ring-mat-500/60"
        />

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip active={liveOnly} onClick={onToggleLive} tone="live">
            On now
          </Chip>
          {STYLES.map((style) => (
            <Chip
              key={style}
              active={styles.includes(style)}
              onClick={() => onToggleStyle(style)}
            >
              {STYLE_LABELS[style]}
            </Chip>
          ))}
        </div>
      </div>

      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto">
        {gyms.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-ink-400">
            Nothing matches that yet.
            <br />
            <button
              type="button"
              onClick={onSubmit}
              className="mt-2 text-mat-400 underline underline-offset-2 hover:text-mat-300"
            >
              Add the first one?
            </button>
          </p>
        ) : (
          <ul>
            {gyms.map((gym) => (
              <GymRow
                key={gym.id}
                gym={gym}
                selected={selected?.id === gym.id}
                onSelect={onSelect}
              />
            ))}
          </ul>
        )}
      </div>

      <footer className="border-t border-ink-800 px-5 py-3 text-[11px] leading-relaxed text-ink-400">
        Times are shown as the gym&apos;s local time. &ldquo;On now&rdquo; is estimated from
        longitude, so treat it as a hint — always check with the gym first.
      </footer>
    </aside>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-ink-800 bg-ink-850 px-2.5 py-2">
      <dd
        className={`text-[17px] leading-none font-semibold tabular-nums ${
          accent ? "text-live-400" : "text-white"
        }`}
      >
        {value}
      </dd>
      <dt className="mt-1 text-[10.5px] tracking-wide text-ink-400 uppercase">{label}</dt>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  tone = "default",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "default" | "live";
}) {
  const activeClass =
    tone === "live"
      ? "border-live-500/50 bg-live-500/15 text-live-400"
      : "border-mat-500/50 bg-mat-500/15 text-mat-300";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition ${
        active
          ? activeClass
          : "border-ink-700 text-ink-400 hover:border-ink-600 hover:text-ink-300"
      }`}
    >
      {children}
    </button>
  );
}

function GymRow({
  gym,
  selected,
  onSelect,
}: {
  gym: Gym;
  selected: boolean;
  onSelect: (g: Gym | null) => void;
}) {
  const live = isLiveNow(gym);
  const next = nextSession(gym);
  const ref = useRef<HTMLLIElement>(null);

  // Expanding a row often pushes its detail below the fold — and selecting
  // from the globe can expand a row that's scrolled out of sight entirely.
  useEffect(() => {
    if (selected) {
      ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selected]);

  return (
    <li
      ref={ref}
      className={`border-b border-ink-800/70 ${selected ? "bg-ink-800/60" : ""}`}
    >
      <button
        type="button"
        onClick={() => onSelect(selected ? null : gym)}
        aria-expanded={selected}
        className={`w-full px-5 py-3 text-left transition ${
          selected ? "" : "hover:bg-ink-850/70"
        }`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[13.5px] font-medium text-white">{gym.name}</span>
          {live ? (
            <span className="shrink-0 text-[11px] font-semibold text-live-400">● on now</span>
          ) : next ? (
            <span className="shrink-0 text-[11px] text-ink-400">
              {formatCountdown(next.inMinutes)}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 truncate text-[12px] text-ink-400">
          {gym.city}, {gym.country}
        </div>
      </button>

      {selected && (
        <div className="px-5 pb-4">
          <GymDetail gym={gym} />
        </div>
      )}
    </li>
  );
}

function GymDetail({ gym }: { gym: Gym }) {
  // Rows submitted before websites were required — and before scheme
  // checking — still have to render safely.
  const website = safeHref(gym.website);
  const handle = gym.instagram ? normalizeInstagram(gym.instagram) : null;

  return (
    <div className="space-y-3 border-t border-ink-700/70 pt-3">
      <div className="flex flex-wrap gap-1.5">
        {gym.styles.map((s) => (
          <span
            key={s}
            className="rounded border border-ink-700 px-1.5 py-0.5 text-[10.5px] text-ink-300"
          >
            {STYLE_LABELS[s]}
          </span>
        ))}
      </div>

      <div>
        <p className="mb-1 text-[10.5px] tracking-wide text-ink-400 uppercase">Open mat</p>
        <ul className="space-y-0.5">
          {gym.sessions.map((s, i) => (
            <li key={i} className="text-[12.5px] text-ink-200 tabular-nums">
              {formatSession(s)}
            </li>
          ))}
        </ul>
      </div>

      {gym.dropIn && (
        <p className="text-[12.5px] text-ink-300">
          <span className="text-ink-400">Drop-in: </span>
          {gym.dropIn}
        </p>
      )}
      {gym.address && <p className="text-[12px] text-ink-400">{gym.address}</p>}
      {gym.notes && <p className="text-[12px] leading-relaxed text-ink-300">{gym.notes}</p>}

      {(website || handle) && (
        <div>
          <p className="mb-1 text-[10.5px] tracking-wide text-ink-400 uppercase">Verify</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
            {website && (
              <ExternalLink href={website}>{displayHost(website)} ↗</ExternalLink>
            )}
            {handle && (
              <ExternalLink href={`https://instagram.com/${handle}`}>
                @{handle} ↗
              </ExternalLink>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
        <ExternalLink
          href={`https://www.google.com/maps/search/?api=1&query=${gym.lat},${gym.lng}`}
        >
          Directions
        </ExternalLink>
      </div>

      {gym.sample && (
        <p className="text-[11px] text-ink-400 italic">
          Sample listing — seeded so the globe isn&apos;t empty on day one.
        </p>
      )}
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-mat-400 underline underline-offset-2 hover:text-mat-300"
    >
      {children}
    </a>
  );
}
