import { NextResponse } from "next/server";
import { getGym, updateGym } from "@/lib/store";
import { gymEditSchema, normalizeEdit } from "@/lib/validation";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

/** Admin-only: read one gym whatever its status. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const gym = await getGym((await params).id);
  if (!gym) return NextResponse.json({ error: "No such gym" }, { status: 404 });
  return NextResponse.json({ gym });
}

/** Admin-only: edit a listing. Only the fields sent are changed. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }

  const parsed = gymEditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Some fields need fixing", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const patch = normalizeEdit(parsed.data);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  }

  try {
    const gym = await updateGym((await params).id, patch);
    if (!gym) return NextResponse.json({ error: "No such gym" }, { status: 404 });
    return NextResponse.json({ ok: true, gym });
  } catch (err) {
    console.error("Could not update gym", err);
    return NextResponse.json({ error: "Could not save that. Try again." }, { status: 500 });
  }
}
