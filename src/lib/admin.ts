import { NextResponse } from "next/server";

/**
 * Shared gate for the admin routes. A single shared key is enough for one
 * person moderating their own map; anything bigger wants real auth.
 */
export function requireAdmin(request: Request): NextResponse | null {
  const adminKey = process.env.OPENMAT_ADMIN_KEY;
  if (!adminKey || request.headers.get("x-admin-key") !== adminKey) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  return null;
}
