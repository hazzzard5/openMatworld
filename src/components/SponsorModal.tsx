"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SPONSOR_DURATIONS } from "@/lib/types";

type Props = { open: boolean; onClose: () => void };

export default function SponsorModal({ open, onClose }: Props) {
  const formId = useId();
  const errorRef = useRef<HTMLParagraphElement>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [business, setBusiness] = useState("");
  const [duration, setDuration] = useState<string>(SPONSOR_DURATIONS[1]);
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");

  // The rail this renders from has a backdrop-filter, which makes it the
  // containing block for position:fixed — the overlay would be trapped in a
  // 280px column. Portalling to the body escapes that.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [error]);

  if (!open || !mounted) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/sponsor-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          business,
          duration,
          message,
          company_url: honeypot,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        issues?: { message?: string }[];
      };
      if (!res.ok) {
        setError(
          data.issues?.find((i) => i.message)?.message ??
            data.error ??
            "Something went wrong. Try again.",
        );
        return;
      }
      setDone(true);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/80 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${formId}-title`}
        className="my-auto w-full max-w-md rounded-2xl border border-ink-700 bg-ink-900 shadow-2xl"
      >
        {done ? (
          <div className="px-6 py-10 text-center">
            <div className="mx-auto grid size-11 place-items-center rounded-full bg-live-500/15 text-live-400">
              ✓
            </div>
            <h2 className="mt-4 text-[16px] font-semibold text-white">Thanks — got it</h2>
            <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-ink-400">
              We&apos;ll get back to you at {email} with rates and what the slot looks
              like.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 rounded-lg bg-mat-500 px-3.5 py-2 text-[13px] font-semibold text-ink-950 hover:bg-mat-400"
            >
              Back to the globe
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <header className="flex items-start justify-between gap-4 border-b border-ink-800 px-6 py-5">
              <div>
                <h2 id={`${formId}-title`} className="text-[16px] font-semibold text-white">
                  Sponsor Open Mat World
                </h2>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-400">
                  Grapplers plan their training trips here. Tell us a little about your
                  brand and we&apos;ll come back with rates.
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

            <div className="space-y-4 px-6 py-5">
              <Field label="Your name" htmlFor={`${formId}-name`} required>
                <input
                  id={`${formId}-name`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={120}
                  autoComplete="name"
                  placeholder="Alex Silva"
                  className={inputClass}
                />
              </Field>

              <Field label="Email" htmlFor={`${formId}-email`} required>
                <input
                  id={`${formId}-email`}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={160}
                  autoComplete="email"
                  placeholder="alex@yourbrand.com"
                  className={inputClass}
                />
              </Field>

              <Field label="Business" htmlFor={`${formId}-business`} required>
                <input
                  id={`${formId}-business`}
                  value={business}
                  onChange={(e) => setBusiness(e.target.value)}
                  required
                  maxLength={160}
                  autoComplete="organization"
                  placeholder="Your Brand Co."
                  className={inputClass}
                />
              </Field>

              <Field
                label="How long would you like to sponsor?"
                htmlFor={`${formId}-duration`}
                required
              >
                <select
                  id={`${formId}-duration`}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className={inputClass}
                >
                  {SPONSOR_DURATIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Anything else" htmlFor={`${formId}-message`}>
                <textarea
                  id={`${formId}-message`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={1200}
                  rows={3}
                  placeholder="What you sell, who you'd like to reach, budget if you have one in mind."
                  className={`${inputClass} resize-y`}
                />
              </Field>

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
                {submitting ? "Sending…" : "Send enquiry"}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}

const inputClass =
  "w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-[13px] text-ink-200 placeholder:text-ink-400 focus:border-ink-600 focus:outline-none focus-visible:ring-1 focus-visible:ring-mat-500/60";

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[12px] font-medium text-ink-300">
        {label}
        {required && <span className="ml-1 text-mat-400">*</span>}
      </label>
      {children}
    </div>
  );
}
