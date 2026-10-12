import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, enforceRateLimit } from "@/lib/server/auth";
import { PlatformError, requireActor, requireAdmin, requirePasswordReady } from "@/lib/server/platform";

export function jsonError(error: unknown) {
  if (error instanceof PlatformError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("Admin API error", error instanceof Error ? error.name : "unknown");
  return NextResponse.json({ error: "İşlem tamamlanamadı." }, { status: 500 });
}

export async function adminActor(request: NextRequest, mutation = false) {
  if (mutation) assertSameOrigin(request);
  const actor = await requireActor(request);
  requirePasswordReady(actor);
  requireAdmin(actor);
  if (mutation) await enforceRateLimit(`admin:${actor.id}`, 80, 5 * 60 * 1000);
  return actor;
}
