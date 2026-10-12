import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  auditLogs,
  exportJobs,
  qualityWeights,
  rolePermissions,
  roles,
  savedViews,
  uploads,
  userPreferences,
  userSessions,
  users,
  workspaceMembers,
  workspaces,
} from "@/db/schema";
import { hashPassword, revokeSessions, validateEmail, validatePassword } from "@/lib/server/auth";
import { Actor, audit, PlatformError, requireAdmin } from "@/lib/server/platform";

const ASSIGNABLE_ROLES = ["admin", "data_manager", "analyst", "viewer"] as const;
const ALLOWED_STATUSES = ["active", "inactive"] as const;

type CreateUserPayload = {
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  password?: unknown;
  passwordConfirmation?: unknown;
  roleCode?: unknown;
  status?: unknown;
  workspaceName?: unknown;
  dataScope?: unknown;
  forcePasswordChange?: unknown;
};

function cleanName(value: unknown, label: string) {
  const result = String(value ?? "").trim();
  if (!result) throw new PlatformError(`${label} zorunludur.`);
  if (result.length > 80) throw new PlatformError(`${label} en fazla 80 karakter olabilir.`);
  return result;
}

function roleCode(value: unknown) {
  const role = String(value ?? "analyst").toLocaleLowerCase("tr-TR");
  if (!ASSIGNABLE_ROLES.includes(role as typeof ASSIGNABLE_ROLES[number])) throw new PlatformError("Geçersiz rol seçimi.");
  return role;
}

function statusCode(value: unknown) {
  const status = String(value ?? "active").toLocaleLowerCase("tr-TR");
  if (!ALLOWED_STATUSES.includes(status as typeof ALLOWED_STATUSES[number])) throw new PlatformError("Geçersiz kullanıcı durumu.");
  return status;
}

async function stableId(prefix: string, value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value.toLocaleLowerCase("tr-TR")));
  const hex = Array.from(new Uint8Array(digest)).slice(0, 12).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex}`;
}

async function targetWithWorkspace(id: string) {
  return (await getDb().select({
    user: users,
    workspaceId: workspaces.id,
    workspaceName: workspaces.name,
    tenantId: workspaces.tenantId,
    accessLevel: workspaceMembers.accessLevel,
  }).from(users)
    .leftJoin(workspaceMembers, eq(users.id, workspaceMembers.userId))
    .leftJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(users.id, id)).limit(1))[0];
}

async function assertTarget(actor: Actor, id: string) {
  requireAdmin(actor);
  const target = await targetWithWorkspace(id);
  if (!target) throw new PlatformError("Kullanıcı bulunamadı.", 404);
  if (actor.roleCode !== "super_admin" && target.tenantId !== actor.tenantId) throw new PlatformError("Bu kullanıcı yönetim kapsamınızda değil.", 403);
  return target;
}

export async function listAdminUsers(actor: Actor, includeArchived = false) {
  requireAdmin(actor);
  const db = getDb();
  const rows = await db.select({
    id: users.id,
    email: users.email,
    fullName: users.fullName,
    firstName: users.firstName,
    lastName: users.lastName,
    roleCode: users.roleCode,
    status: users.status,
    forcePasswordChange: users.forcePasswordChange,
    failedLoginAttempts: users.failedLoginAttempts,
    lockedUntil: users.lockedUntil,
    dataScope: users.dataScope,
    lastLoginAt: users.lastLoginAt,
    createdAt: users.createdAt,
    createdByUserId: users.createdByUserId,
    archivedAt: users.archivedAt,
    workspaceId: workspaces.id,
    workspaceName: workspaces.name,
    tenantId: workspaces.tenantId,
  }).from(users)
    .leftJoin(workspaceMembers, eq(users.id, workspaceMembers.userId))
    .leftJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .orderBy(desc(users.createdAt));
  const scoped = rows.filter((row) => (actor.roleCode === "super_admin" || row.tenantId === actor.tenantId) && (includeArchived || !row.archivedAt));
  const creatorIds = Array.from(new Set(scoped.map((row) => row.createdByUserId).filter(Boolean))) as string[];
  const creatorMap = new Map<string, string>();
  for (const id of creatorIds) {
    const creator = (await db.select({ fullName: users.fullName }).from(users).where(eq(users.id, id)).limit(1))[0];
    if (creator) creatorMap.set(id, creator.fullName);
  }
  const enriched = [];
  for (const row of scoped) {
    const uploadCount = row.workspaceId ? Number((await db.select({ count: sql<number>`count(*)` }).from(uploads).where(eq(uploads.workspaceId, row.workspaceId)))[0]?.count ?? 0) : 0;
    const activeSessionCount = Number((await db.select({ count: sql<number>`count(*)` }).from(userSessions).where(and(eq(userSessions.userId, row.id), isNull(userSessions.revokedAt))))[0]?.count ?? 0);
    const displayStatus = row.archivedAt ? "archived" : row.lockedUntil && row.lockedUntil > Date.now() ? "locked" : row.status !== "active" ? "inactive" : row.forcePasswordChange || !row.lastLoginAt ? "pending_first_login" : "active";
    enriched.push({ ...row, uploadCount, activeSessionCount, createdByAdmin: row.createdByUserId ? creatorMap.get(row.createdByUserId) ?? "Bilinmiyor" : "Sistem", displayStatus });
  }
  return enriched;
}

export async function adminReferenceData(actor: Actor) {
  requireAdmin(actor);
  const db = getDb();
  const roleRows = await db.select().from(roles).where(sql`${roles.code} in ('admin','data_manager','analyst','viewer')`).orderBy(asc(roles.name));
  const permissionRows = await db.select().from(rolePermissions).orderBy(asc(rolePermissions.roleCode));
  const auditRows = actor.roleCode === "super_admin"
    ? await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(200)
    : await db.select().from(auditLogs).where(eq(auditLogs.tenantId, actor.tenantId)).orderBy(desc(auditLogs.createdAt)).limit(200);
  return { roles: roleRows, rolePermissions: permissionRows, audit: auditRows };
}

export async function createAdminUser(actor: Actor, payload: CreateUserPayload) {
  requireAdmin(actor);
  const firstName = cleanName(payload.firstName, "Ad");
  const lastName = cleanName(payload.lastName, "Soyad");
  const email = validateEmail(payload.email);
  const password = validatePassword(payload.password, email, firstName, lastName);
  if (password !== String(payload.passwordConfirmation ?? "")) throw new PlatformError("Şifreler eşleşmiyor.");
  const selectedRole = roleCode(payload.roleCode);
  const selectedStatus = statusCode(payload.status);
  const workspaceName = cleanName(payload.workspaceName || `${firstName} ${lastName} Çalışma Alanı`, "Çalışma alanı adı");
  const dataScope = String(payload.dataScope ?? "own_workspace").trim() || "own_workspace";
  const db = getDb();
  if ((await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)).length) {
    throw new PlatformError("Bu e-posta adresiyle kayıtlı bir kullanıcı bulunuyor.", 409);
  }
  const timestamp = Date.now();
  const userId = await stableId("usr", email);
  const workspaceId = await stableId("wsp", email);
  const passwordHash = await hashPassword(password);
  await db.insert(users).values({
    id: userId, email, fullName: `${firstName} ${lastName}`, firstName, lastName,
    passwordHash, forcePasswordChange: payload.forcePasswordChange !== false,
    roleCode: selectedRole, status: selectedStatus, dataScope, createdByUserId: actor.id,
    createdAt: timestamp, updatedAt: timestamp,
  });
  await db.insert(workspaces).values({ id: workspaceId, name: workspaceName, ownerUserId: userId, tenantId: actor.tenantId, createdAt: timestamp });
  await db.insert(workspaceMembers).values({ workspaceId, userId, accessLevel: "owner" });
  await db.insert(userPreferences).values({ userId, defaultPeriod: null, comparisonPeriod: null, updatedAt: timestamp });
  await db.insert(qualityWeights).values({ workspaceId, updatedBy: actor.id, updatedAt: timestamp });
  await audit(actor, "user.create", "user", userId, undefined, { email, fullName: `${firstName} ${lastName}`, roleCode: selectedRole, status: selectedStatus, workspaceId, workspaceName, dataScope, forcePasswordChange: payload.forcePasswordChange !== false });
  return { id: userId, email, fullName: `${firstName} ${lastName}`, roleCode: selectedRole, status: selectedStatus, workspaceId, workspaceName, dataScope };
}

export async function getAdminUser(actor: Actor, id: string) {
  const target = await assertTarget(actor, id);
  const db = getDb();
  const files = target.workspaceId ? await db.select({ id: uploads.id, fileName: uploads.fileName, period: uploads.period, provider: uploads.provider, createdAt: uploads.createdAt, deletionStatus: uploads.deletionStatus }).from(uploads).where(eq(uploads.workspaceId, target.workspaceId)).orderBy(desc(uploads.createdAt)).limit(50) : [];
  const exports = target.workspaceId ? await db.select().from(exportJobs).where(eq(exportJobs.workspaceId, target.workspaceId)).orderBy(desc(exportJobs.createdAt)).limit(50) : [];
  const views = await db.select().from(savedViews).where(eq(savedViews.userId, id)).orderBy(desc(savedViews.createdAt)).limit(50);
  const activities = await db.select().from(auditLogs).where(eq(auditLogs.targetId, id)).orderBy(desc(auditLogs.createdAt)).limit(50);
  const sessions = await db.select({ id: userSessions.id, createdAt: userSessions.createdAt, lastSeenAt: userSessions.lastSeenAt, expiresAt: userSessions.expiresAt, revokedAt: userSessions.revokedAt, userAgent: userSessions.userAgent }).from(userSessions).where(eq(userSessions.userId, id)).orderBy(desc(userSessions.createdAt)).limit(20);
  const displayStatus = target.user.archivedAt ? "archived" : target.user.lockedUntil && target.user.lockedUntil > Date.now() ? "locked" : target.user.status !== "active" ? "inactive" : target.user.forcePasswordChange || !target.user.lastLoginAt ? "pending_first_login" : "active";
  return { ...target, user: { ...target.user, displayStatus, activeSessionCount: sessions.filter((session) => !session.revokedAt).length }, files, exports, views, activities, sessions };
}

export async function updateAdminUser(actor: Actor, id: string, payload: Record<string, unknown>) {
  const target = await assertTarget(actor, id);
  const db = getDb();
  const firstName = payload.firstName === undefined ? target.user.firstName : cleanName(payload.firstName, "Ad");
  const lastName = payload.lastName === undefined ? target.user.lastName : cleanName(payload.lastName, "Soyad");
  const dataScope = payload.dataScope === undefined ? target.user.dataScope : String(payload.dataScope).trim() || "own_workspace";
  const fullName = `${firstName ?? ""} ${lastName ?? ""}`.trim() || target.user.fullName;
  const timestamp = Date.now();
  await db.update(users).set({ firstName, lastName, fullName, dataScope, updatedAt: timestamp }).where(eq(users.id, id));
  if (payload.workspaceName !== undefined && target.workspaceId) await db.update(workspaces).set({ name: cleanName(payload.workspaceName, "Çalışma alanı adı") }).where(eq(workspaces.id, target.workspaceId));
  if (payload.accessLevel !== undefined && target.workspaceId) await db.update(workspaceMembers).set({ accessLevel: String(payload.accessLevel) }).where(and(eq(workspaceMembers.workspaceId, target.workspaceId), eq(workspaceMembers.userId, id)));
  await audit(actor, "user.update", "user", id, { fullName: target.user.fullName, dataScope: target.user.dataScope, workspaceName: target.workspaceName, accessLevel: target.accessLevel }, { fullName, dataScope, workspaceName: payload.workspaceName ?? target.workspaceName, accessLevel: payload.accessLevel ?? target.accessLevel });
  return getAdminUser(actor, id);
}

export async function setAdminUserStatus(actor: Actor, id: string, statusValue: unknown) {
  const target = await assertTarget(actor, id);
  const status = statusCode(statusValue);
  if (id === actor.id && status !== "active") throw new PlatformError("Kendi hesabınızı pasife alamazsınız.");
  const timestamp = Date.now();
  await getDb().update(users).set({ status, forceLogoutAt: status === "inactive" ? timestamp : target.user.forceLogoutAt, failedLoginAttempts: status === "active" ? 0 : target.user.failedLoginAttempts, lockedUntil: status === "active" ? null : target.user.lockedUntil, updatedAt: timestamp }).where(eq(users.id, id));
  const revokedSessions = status === "inactive" ? await revokeSessions(id) : 0;
  await audit(actor, status === "active" ? "user.activate" : "user.deactivate", "user", id, { status: target.user.status }, { status, revokedSessions, workspaceId: target.workspaceId });
  return { id, status, revokedSessions };
}

export async function setAdminUserRole(actor: Actor, id: string, value: unknown) {
  const target = await assertTarget(actor, id);
  const nextRole = roleCode(value);
  if (target.user.roleCode === "super_admin") throw new PlatformError("Sistem Yöneticisi rolü bu ekrandan değiştirilemez.", 403);
  await getDb().update(users).set({ roleCode: nextRole, updatedAt: Date.now() }).where(eq(users.id, id));
  await audit(actor, "user.role.update", "user", id, { roleCode: target.user.roleCode }, { roleCode: nextRole, workspaceId: target.workspaceId });
  return { id, roleCode: nextRole };
}

export async function resetAdminUserPassword(actor: Actor, id: string, payload: Record<string, unknown>) {
  const target = await assertTarget(actor, id);
  const password = validatePassword(payload.password, target.user.email, target.user.firstName ?? "", target.user.lastName ?? "");
  if (password !== String(payload.passwordConfirmation ?? "")) throw new PlatformError("Şifreler eşleşmiyor.");
  const passwordHash = await hashPassword(password);
  const timestamp = Date.now();
  await getDb().update(users).set({ passwordHash, forcePasswordChange: true, passwordChangedAt: timestamp, forceLogoutAt: timestamp, failedLoginAttempts: 0, lockedUntil: null, updatedAt: timestamp }).where(eq(users.id, id));
  const revokedSessions = await revokeSessions(id);
  await audit(actor, "user.password.reset", "user", id, { forcePasswordChange: target.user.forcePasswordChange }, { forcePasswordChange: true, revokedSessions, workspaceId: target.workspaceId });
  return { id, forcePasswordChange: true, revokedSessions };
}

export async function revokeAdminUserSessions(actor: Actor, id: string) {
  const target = await assertTarget(actor, id);
  const timestamp = Date.now();
  await getDb().update(users).set({ forceLogoutAt: timestamp, updatedAt: timestamp }).where(eq(users.id, id));
  const revokedSessions = await revokeSessions(id);
  await audit(actor, "user.session.revoke", "user", id, undefined, { revokedSessions, workspaceId: target.workspaceId });
  return { id, revokedSessions };
}

export async function archiveAdminUser(actor: Actor, id: string) {
  const target = await assertTarget(actor, id);
  if (id === actor.id) throw new PlatformError("Kendi hesabınızı arşivleyemezsiniz.");
  if (target.user.roleCode === "super_admin") throw new PlatformError("Sistem Yöneticisi hesabı arşivlenemez.", 403);
  const timestamp = Date.now();
  await getDb().update(users).set({ status: "inactive", archivedAt: timestamp, archivedByUserId: actor.id, forceLogoutAt: timestamp, updatedAt: timestamp }).where(eq(users.id, id));
  const revokedSessions = await revokeSessions(id);
  await audit(actor, "user.archive", "user", id, { status: target.user.status, archivedAt: target.user.archivedAt }, { status: "inactive", archivedAt: timestamp, revokedSessions, workspaceId: target.workspaceId });
  return { id, archivedAt: timestamp, revokedSessions };
}
