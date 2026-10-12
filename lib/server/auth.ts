import { and, eq, gt, isNull } from "drizzle-orm";
import { compare, hash } from "bcryptjs";
import { getDb } from "@/db";
import { rateLimits, userSessions, users } from "@/db/schema";
import { PlatformError } from "@/lib/server/errors";
import { getRuntimeBindings } from "@/lib/server/runtime-bindings";

export const SESSION_COOKIE = "ajet_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const BCRYPT_COST = 12;

export function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("tr-TR");
}

export function validateEmail(value: unknown) {
  const raw = String(value ?? "");
  const email = normalizeEmail(raw);
  if (!raw || raw !== raw.trim()) throw new PlatformError("E-posta adresinin başında veya sonunda boşluk bulunamaz.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PlatformError("Geçerli bir e-posta adresi girin.");
  return email;
}

export function passwordChecks(password: string, email: string, firstName = "", lastName = "") {
  const normalized = password.toLocaleLowerCase("tr-TR");
  return {
    minLength: password.length >= 8,
    uppercase: /[A-ZÇĞİÖŞÜ]/.test(password),
    lowercase: /[a-zçğıöşü]/.test(password),
    number: /\d/.test(password),
    notEmail: normalized !== email.toLocaleLowerCase("tr-TR"),
    excludesName: ![firstName, lastName].filter((part) => part.trim().length >= 3)
      .some((part) => normalized.includes(part.trim().toLocaleLowerCase("tr-TR"))),
  };
}

export function validatePassword(password: unknown, email: string, firstName = "", lastName = "") {
  const value = String(password ?? "");
  const checks = passwordChecks(value, email, firstName, lastName);
  if (!Object.values(checks).every(Boolean)) {
    throw new PlatformError("Şifre en az 8 karakter olmalı; büyük harf, küçük harf ve rakam içermeli; e-posta, ad veya soyadı içermemelidir.");
  }
  return value;
}

export function hashPassword(password: string) {
  return hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!match) return null;
  try { return decodeURIComponent(match.slice(name.length + 1)); } catch { return null; }
}

export function hasSessionCookie(request: Request) {
  return (request.headers.get("cookie") ?? "").split(";").some((part) => part.trim().startsWith(`${SESSION_COOKIE}=`));
}

function requestIp(request: Request) {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export function sessionCookie(token: string, expiresAt: number) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=${new Date(expiresAt).toUTCString()}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function createSession(userId: string, request: Request, expectedPasswordHash: string) {
  const token = `${crypto.randomUUID()}${crypto.randomUUID().replaceAll("-", "")}`;
  const tokenHash = await sha256(token);
  const timestamp = Date.now();
  const expiresAt = timestamp + SESSION_TTL_MS;
  const ipHash = await sha256(requestIp(request));
  const userAgent = (request.headers.get("user-agent") ?? "Bilinmiyor").slice(0, 240);
  const database = getRuntimeBindings().DB;
  if (!database) throw new Error("Session creation requires the D1 database binding.");
  // The password hash and account state are checked in the same statement as
  // session creation, including when maintenance replaces the credentials.
  const inserted = await database.prepare(`INSERT INTO user_sessions (id, user_id, token_hash, created_at, last_seen_at, expires_at, revoked_at, ip_hash, user_agent)
    SELECT ?, id, ?, MAX(?, COALESCE(force_logout_at, 0) + 1), ?, ?, NULL, ?, ? FROM users
    WHERE id = ? AND password_hash = ? AND status = 'active' AND archived_at IS NULL`)
    .bind(crypto.randomUUID(), tokenHash, timestamp, timestamp, expiresAt, ipHash, userAgent, userId, expectedPasswordHash).run();
  if (inserted.meta.changes !== 1) throw new PlatformError("Oturum bilgileri değişti. Yeniden giriş yapın.", 401);
  return { token, expiresAt };
}

export async function getSessionIdentity(request: Request) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const db = getDb();
  const rows = await db.select({ user: users, session: userSessions }).from(userSessions)
    .innerJoin(users, eq(userSessions.userId, users.id))
    .where(and(eq(userSessions.tokenHash, tokenHash), isNull(userSessions.revokedAt), gt(userSessions.expiresAt, Date.now())))
    .limit(1);
  const identity = rows[0];
  if (!identity) return null;
  if (identity.user.archivedAt || identity.user.status !== "active") {
    await db.update(userSessions).set({ revokedAt: Date.now() }).where(eq(userSessions.id, identity.session.id));
    return null;
  }
  if (identity.user.forceLogoutAt && identity.session.createdAt <= identity.user.forceLogoutAt) {
    await db.update(userSessions).set({ revokedAt: Date.now() }).where(eq(userSessions.id, identity.session.id));
    return null;
  }
  await db.update(userSessions).set({ lastSeenAt: Date.now() }).where(eq(userSessions.id, identity.session.id));
  return identity;
}

export async function revokeSessions(userId: string, exceptSessionId?: string) {
  const db = getDb();
  const active = await db.select({ id: userSessions.id }).from(userSessions)
    .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)));
  const timestamp = Date.now();
  for (const session of active) {
    if (session.id !== exceptSessionId) await db.update(userSessions).set({ revokedAt: timestamp }).where(eq(userSessions.id, session.id));
  }
  return active.filter((session) => session.id !== exceptSessionId).length;
}

export function assertSameOrigin(request: Request) {
  const target = new URL(request.url);
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  if (origin && new URL(origin).origin !== target.origin) throw new PlatformError("Geçersiz istek kaynağı.", 403);
  if (!origin && referer && new URL(referer).origin !== target.origin) throw new PlatformError("Geçersiz istek kaynağı.", 403);
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) throw new PlatformError("Geçersiz istek kaynağı.", 403);
}

export async function enforceRateLimit(key: string, limit: number, windowMs: number, blockMs = windowMs) {
  const db = getDb();
  const timestamp = Date.now();
  const current = (await db.select().from(rateLimits).where(eq(rateLimits.key, key)).limit(1))[0];
  if (current?.blockedUntil && current.blockedUntil > timestamp) throw new PlatformError("Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.", 429);
  if (!current || timestamp - current.windowStartedAt >= windowMs) {
    await db.insert(rateLimits).values({ key, attempts: 1, windowStartedAt: timestamp, blockedUntil: null })
      .onConflictDoUpdate({ target: rateLimits.key, set: { attempts: 1, windowStartedAt: timestamp, blockedUntil: null } });
    return;
  }
  const attempts = current.attempts + 1;
  const blockedUntil = attempts > limit ? timestamp + blockMs : null;
  await db.update(rateLimits).set({ attempts, blockedUntil }).where(eq(rateLimits.key, key));
  if (blockedUntil) throw new PlatformError("Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.", 429);
}

export async function loginRateKey(request: Request, email: string) {
  return `login:${await sha256(`${requestIp(request)}:${email}`)}`;
}
