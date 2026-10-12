import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { userSessions } from "@/db/schema";
import { assertSameOrigin, clearSessionCookie, getSessionIdentity } from "@/lib/server/auth";

export async function POST(request: NextRequest) {
  assertSameOrigin(request);
  const identity = await getSessionIdentity(request);
  if (identity) await getDb().update(userSessions).set({ revokedAt: Date.now() }).where(eq(userSessions.id, identity.session.id));
  const response = NextResponse.json({ ok: true, redirectTo: "/login" });
  response.headers.set("set-cookie", clearSessionCookie());
  return response;
}
