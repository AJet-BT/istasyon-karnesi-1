import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { assertSameOrigin, getSessionIdentity, hashPassword, revokeSessions, validatePassword } from "@/lib/server/auth";
import { PlatformError } from "@/lib/server/errors";
import { audit, requireActor } from "@/lib/server/platform";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const identity = await getSessionIdentity(request);
    if (!identity) throw new PlatformError("Oturum gerekli.", 401);
    const payload = await request.json() as { password?: string; passwordConfirmation?: string };
    const password = validatePassword(payload.password, identity.user.email, identity.user.firstName ?? "", identity.user.lastName ?? "");
    if (password !== String(payload.passwordConfirmation ?? "")) throw new PlatformError("Şifreler eşleşmiyor.");
    if (identity.user.passwordHash && await import("bcryptjs").then(({ compare }) => compare(password, identity.user.passwordHash!))) throw new PlatformError("Yeni şifre mevcut şifreden farklı olmalıdır.");
    const passwordHash = await hashPassword(password);
    const timestamp = Date.now();
    await getDb().update(users).set({ passwordHash, forcePasswordChange: false, passwordChangedAt: timestamp, failedLoginAttempts: 0, lockedUntil: null, updatedAt: timestamp }).where(eq(users.id, identity.user.id));
    await revokeSessions(identity.user.id, identity.session.id);
    const actor = await requireActor(request);
    await audit(actor, "user.password.change", "user", actor.id, { forcePasswordChange: true }, { forcePasswordChange: false });
    return NextResponse.json({ ok: true, redirectTo: "/" });
  } catch (error) {
    if (error instanceof PlatformError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Password change failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Şifre değiştirilemedi." }, { status: 500 });
  }
}
