import type { SponsorInquiry } from "./types";

/**
 * Sponsor enquiry notifications, sent through Resend's HTTP API — no SDK, so
 * nothing to keep up to date. Configure with:
 *
 *   RESEND_API_KEY      from resend.com
 *   SPONSOR_TO_EMAIL    where enquiries land (default sponsor@narigroup.net)
 *   SPONSOR_FROM_EMAIL  a sender on a domain verified in Resend
 *
 * With no key set, sending is skipped and the caller relies on the stored
 * row. That keeps local development from needing mail credentials.
 */

const TO = process.env.SPONSOR_TO_EMAIL ?? "sponsor@narigroup.net";
const FROM = process.env.SPONSOR_FROM_EMAIL ?? "Open Mat Atlas <onboarding@resend.dev>";

export type MailResult = { sent: boolean; reason?: string };

export async function sendSponsorInquiry(inquiry: SponsorInquiry): Promise<MailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "RESEND_API_KEY is not set" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        // So a reply goes straight back to the business, not into the void.
        reply_to: inquiry.email,
        subject: `Sponsor enquiry — ${inquiry.business}`,
        text: asPlainText(inquiry),
        html: asHtml(inquiry),
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return { sent: false, reason: `Resend ${res.status}: ${await res.text()}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : "unknown error" };
  }
}

function asPlainText(i: SponsorInquiry): string {
  return [
    `Business:  ${i.business}`,
    `Contact:   ${i.name}`,
    `Email:     ${i.email}`,
    `Duration:  ${i.duration}`,
    "",
    i.message ? `Message:\n${i.message}` : "(no message)",
    "",
    `Received:  ${new Date(i.createdAt).toUTCString()}`,
  ].join("\n");
}

/** Values are user-submitted, so everything interpolated here is escaped. */
function asHtml(i: SponsorInquiry): string {
  const row = (label: string, value: string) =>
    `<tr>
       <td style="padding:6px 14px 6px 0;color:#6b7994;font:14px system-ui,sans-serif;vertical-align:top">${label}</td>
       <td style="padding:6px 0;color:#111;font:14px system-ui,sans-serif">${escapeHtml(value)}</td>
     </tr>`;

  return `<div style="font:14px system-ui,sans-serif;color:#111">
    <h2 style="margin:0 0 14px;font-size:17px">New sponsor enquiry</h2>
    <table style="border-collapse:collapse">
      ${row("Business", i.business)}
      ${row("Contact", i.name)}
      ${row("Email", i.email)}
      ${row("Duration", i.duration)}
    </table>
    ${
      i.message
        ? `<p style="margin:16px 0 0;white-space:pre-wrap;line-height:1.5">${escapeHtml(i.message)}</p>`
        : ""
    }
    <p style="margin:20px 0 0;color:#6b7994;font-size:12px">
      Received ${escapeHtml(new Date(i.createdAt).toUTCString())} · Open Mat Atlas
    </p>
  </div>`;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
