import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { assertSameOrigin, createSession, enforceRateLimit, loginRateKey, normalizeEmail, sessionCookie, verifyPassword } from "@/lib/server/auth";
import { PlatformError } from "@/lib/server/errors";

function errorResponse(error: unknown) {
  if (error instanceof PlatformError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("Login failed", error instanceof Error ? error.name : "unknown");
  return NextResponse.json({ error: "Giriş işlemi tamamlanamadı." }, { status: 500 });
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const body = await request.json() as { email?: string; password?: string };
    const email = normalizeEmail(body.email);
    const password = String(body.password ?? "");
    if (!email || !password) throw new PlatformError("E-posta ve şifre zorunludur.");
    await enforceRateLimit(await loginRateKey(request, email), 5, 15 * 60 * 1000, 15 * 60 * 1000);
    const db = getDb();
    const user: typeof users.$inferSelect | null = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0] ?? null;
    if (!user || user.archivedAt) throw new PlatformError("E-posta veya şifre hatalı.", 401);
    if (user.status !== "active") throw new PlatformError("Kullanıcı hesabı pasif. Sistem yöneticinizle iletişime geçin.", 403);
    if (user.lockedUntil && user.lockedUntil > Date.now()) throw new PlatformError("Hesabınız geçici olarak kilitlendi. Daha sonra tekrar deneyin.", 423);
    if (!user.passwordHash) throw new PlatformError("Bu hesap için henüz şifre belirlenmedi. Yönetim ekranından şifreyi sıfırlayın.", 403);
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      const failedLoginAttempts = user.failedLoginAttempts + 1;
      const lockedUntil = failedLoginAttempts >= 5 ? Date.now() + 15 * 60 * 1000 : null;
      await db.update(users).set({ failedLoginAttempts, lockedUntil, updatedAt: Date.now() }).where(eq(users.id, user.id));
      throw new PlatformError(lockedUntil ? "Hesabınız çok sayıda hatalı deneme nedeniyle 15 dakika kilitlendi." : "E-posta veya şifre hatalı.", lockedUntil ? 423 : 401);
    }
    await db.update(users).set({ failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: Date.now(), updatedAt: Date.now() }).where(eq(users.id, user.id));
    const session = await createSession(user.id, request, user.passwordHash);
    const response = NextResponse.json({ ok: true, forcePasswordChange: user.forcePasswordChange, redirectTo: user.forcePasswordChange ? "/change-password" : "/" });
    response.headers.set("set-cookie", sessionCookie(session.token, session.expiresAt));
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
