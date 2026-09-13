import { NextResponse } from "next/server";
import { setGymStatus } from "@/lib/store";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

/** Admin-only: approve or reject a pending submission. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const { status } = (await request.json().catch(() => ({}))) as { status?: string };

  if (status !== "approved" && status !== "rejected" && status !== "pending") {
    return NextResponse.json({ error: "status must be approved|rejected|pending" }, { status: 400 });
  }

  const gym = await setGymStatus(id, status);
  if (!gym) return NextResponse.json({ error: "No such gym" }, { status: 404 });
  return NextResponse.json({ ok: true, gym });
}
