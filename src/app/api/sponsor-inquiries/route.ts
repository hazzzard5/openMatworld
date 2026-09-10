import { NextResponse } from "next/server";
import { z } from "zod";
import { createInquiry, markInquiryEmailed } from "@/lib/store";
import { sendSponsorInquiry } from "@/lib/mail";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(2, "Your name is required").max(120),
  email: z.string().trim().email("That email doesn't look right").max(160),
  business: z.string().trim().min(2, "Business name is required").max(160),
  duration: z.string().trim().min(1, "Pick how long you'd like to run").max(60),
  message: z.string().trim().max(1200).optional().or(z.literal("")),
  /**
   * Honeypot: real people leave this empty. Accepted by the schema so the
   * check below can discard it silently instead of returning a 400 that
   * names the trap.
   */
  company_url: z.string().max(240).optional(),
});

const recent = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 4;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > MAX_PER_WINDOW;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Some fields need fixing", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  if (parsed.data.company_url) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "That's a lot of enquiries. Try again a bit later." },
      { status: 429 },
    );
  }

  const { name, email, business, duration, message } = parsed.data;

  let inquiry;
  try {
    inquiry = await createInquiry({
      name,
      email,
      business,
      duration,
      message: message?.trim() ? message.trim() : undefined,
    });
  } catch (err) {
    console.error("Could not store sponsor enquiry", err);
    return NextResponse.json({ error: "Could not send that. Try again." }, { status: 500 });
  }

  // Stored first, so a mail failure never costs us the lead.
  const mail = await sendSponsorInquiry(inquiry);
  if (mail.sent) {
    await markInquiryEmailed(inquiry.id);
  } else {
    console.error(
      `Sponsor enquiry ${inquiry.id} stored but not emailed: ${mail.reason}. ` +
        `From ${email} (${business}).`,
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
