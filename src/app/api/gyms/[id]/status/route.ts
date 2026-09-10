import { NextResponse } from "next/server";
import { setGymStatus } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Admin-only: approve or reject a pending submission. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminKey = process.env.OPENMAT_ADMIN_KEY;
  if (!adminKey || request.headers.get("x-admin-key") !== adminKey) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const { id } = await params;
  const { status } = (await request.json().catch(() => ({}))) as { status?: string };

  if (status !== "approved" && status !== "rejected" && status !== "pending") {
    return NextResponse.json({ error: "status must be approved|rejected|pending" }, { status: 400 });
  }

  const gym = await setGymStatus(id, status);
  if (!gym) return NextResponse.json({ error: "No such gym" }, { status: 404 });
  return NextResponse.json({ ok: true, gym });
}
