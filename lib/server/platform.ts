import { and, asc, desc, eq, isNull, ne, sql } from "drizzle-orm";
import * as XLSX from "xlsx";
import type { BatchItem } from "drizzle-orm/batch";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { getSessionIdentity, hasSessionCookie } from "@/lib/server/auth";
import { isAccountResetCompleted } from "@/lib/server/account-reset";
import { PlatformError } from "@/lib/server/errors";
import { getRuntimeBindings } from "@/lib/server/runtime-bindings";
import { detectWorkbook, parseWorkbook, type ImportSelection, type WorkbookSource } from "@/lib/workbook-import";
import {
  auditLogs,
  cities,
  countries,
  countryAliases,
  exportJobs,
  permissions,
  ports,
  qualityWeights,
  rolePermissions,
  roles,
  regions,
  savedViews,
  stationPerformance,
  uploads,
  userPreferences,
  users,
  workspaceMembers,
  workspaces,
} from "@/db/schema";

export type Actor = {
  id: string;
  email: string;
  fullName: string;
  roleCode: string;
  status: string;
  workspaceId: string;
  tenantId: string;
  workspaceName: string;
  workspaces?: Array<{ id: string; name: string }>;
  isAdmin: boolean;
  authType: "password" | "platform";
  sessionId: string | null;
  forcePasswordChange: boolean;
};

export { PlatformError } from "@/lib/server/errors";

const ROLE_SEEDS = [
  ["super_admin", "Sistem Yöneticisi", "Tüm çalışma alanlarına ve sistem ayarlarına erişir."],
  ["admin", "Yönetici", "Kullanıcı, kapsam ve dosya yaşam döngüsünü yönetir."],
  ["data_manager", "Veri Yöneticisi", "Dosya, sütun eşleştirme ve veri kalitesi işlemlerini yönetir."],
  ["analyst", "Analist", "Genel Bakış, analiz ve dışa aktarım özelliklerini kullanır."],
  ["manager", "Yönetici", "Yönetici özetlerini ve raporları görüntüler."],
  ["readonly", "Salt Okunur Kullanıcı", "Yalnızca yetkili veri kapsamını görüntüler."],
  ["viewer", "Salt Okunur Kullanıcı", "Yalnızca yetkili veri kapsamını görüntüler."],
] as const;

const PERMISSION_SEEDS = [
  "user.create", "user.update", "user.deactivate", "upload.create", "upload.delete",
  "upload.restore", "mapping.manage", "dashboard.view", "export.pdf", "export.excel",
  "kpi.manage", "audit.view", "workspace.view_all",
];

const ADMIN_PERMISSIONS = PERMISSION_SEEDS;
const DATA_MANAGER_PERMISSIONS = ["upload.create", "upload.delete", "upload.restore", "mapping.manage", "dashboard.view", "export.pdf", "export.excel"];
const ANALYST_PERMISSIONS = ["upload.create", "dashboard.view", "export.pdf", "export.excel"];

const REGION_SEEDS = [
  ["reg-ege", "ege", "Ege"], ["reg-akdeniz", "akdeniz", "Akdeniz"],
  ["reg-ic-anadolu", "ic-anadolu", "İç Anadolu"], ["reg-marmara", "marmara", "Marmara"],
] as const;

const COUNTRY_SEEDS = [["country-tr", "TR", "TUR", "Türkiye", "Turkey", null]] as const;
const CITY_SEEDS = [
  ["city-izmir", "country-tr", "İzmir", "İzmir"], ["city-antalya", "country-tr", "Antalya", "Antalya"],
  ["city-mugla", "country-tr", "Muğla", "Muğla"], ["city-mersin", "country-tr", "Mersin", "Mersin"],
  ["city-ankara", "country-tr", "Ankara", "Ankara"], ["city-istanbul", "country-tr", "İstanbul", "İstanbul"],
] as const;

const PORT_SEEDS = [
  { id: "port-adb", code: "ADB", airportName: "İzmir Adnan Menderes Havalimanı", shortName: "İzmir Adnan Menderes", cityId: "city-izmir", city: "İzmir", displayCity: "İzmir", regionId: "reg-ege", regionCode: "ege", region: "Ege" },
  { id: "port-ayt", code: "AYT", airportName: "Antalya Havalimanı", shortName: "Antalya", cityId: "city-antalya", city: "Antalya", displayCity: "Antalya", regionId: "reg-akdeniz", regionCode: "akdeniz", region: "Akdeniz" },
  { id: "port-bjv", code: "BJV", airportName: "Milas-Bodrum Havalimanı", shortName: "Milas-Bodrum", cityId: "city-mugla", city: "Muğla", displayCity: "Bodrum / Muğla", regionId: "reg-ege", regionCode: "ege", region: "Ege" },
  { id: "port-cov", code: "COV", airportName: "Çukurova Uluslararası Havalimanı", shortName: "Çukurova", cityId: "city-mersin", city: "Mersin", displayCity: "Çukurova / Mersin", regionId: "reg-akdeniz", regionCode: "akdeniz", region: "Akdeniz" },
  { id: "port-dlm", code: "DLM", airportName: "Dalaman Havalimanı", shortName: "Dalaman", cityId: "city-mugla", city: "Muğla", displayCity: "Dalaman / Muğla", regionId: "reg-ege", regionCode: "ege", region: "Ege" },
  { id: "port-esb", code: "ESB", airportName: "Ankara Esenboğa Havalimanı", shortName: "Ankara Esenboğa", cityId: "city-ankara", city: "Ankara", displayCity: "Ankara", regionId: "reg-ic-anadolu", regionCode: "ic-anadolu", region: "İç Anadolu" },
  { id: "port-saw", code: "SAW", airportName: "İstanbul Sabiha Gökçen Havalimanı", shortName: "İstanbul Sabiha Gökçen", cityId: "city-istanbul", city: "İstanbul", displayCity: "İstanbul", regionId: "reg-marmara", regionCode: "marmara", region: "Marmara" },
] as const;

const LEGACY_JUNE = [
  ["ADB", 405, 70013, null, null, null, null, 0.0054, 375, 0.0003, 24, null, null, null, null, null, 0.86, 0.84, 0.92],
  ["AYT", 451, 78745, 66, null, null, null, 0.0056, 441, 0.0004, 28, null, null, null, null, null, 0.88, 0.89, 0.96],
  ["BJV", 245, 38111, null, null, null, null, 0.0058, 221, 0.0001, 2, null, null, null, null, null, 0.91, 0.89, 1.31],
  ["COV", 209, 36238, null, null, null, null, 0.0063, 230, 0.0002, 9, null, null, null, null, null, 0.90, 0.91, 0.87],
  ["DLM", 158, 25057, null, null, null, null, 0.0045, 112, 0.0001, 2, null, null, null, null, null, 0.96, 0.94, 0.50],
  ["ESB", 2316, 398208, 273, 0.00001, 1, 82247, 0.0035, 1404, 0.0013, 529, 0.0013, 3, 0.0009, 2, null, 0.91, 0.90, 0.58],
  ["SAW", 4080, 707669, 369, 0.00005, 16, 299928, 0.0038, 2683, 0.0022, 1556, 0.0032, 13, 0.0005, 2, 2, 0.92, 0.92, 1.87],
] as const;

function now() { return Date.now(); }

function normalize(value: unknown) {
  return String(value ?? "").trim().toLocaleUpperCase("tr-TR")
    .replaceAll("İ", "I").replaceAll("Ş", "S").replaceAll("Ğ", "G")
    .replaceAll("Ü", "U").replaceAll("Ö", "O").replaceAll("Ç", "C")
    .replace(/[^A-Z0-9]/g, "");
}

export function normalizeCountryCode(value: unknown) {
  const alias = normalize(value);
  if (["TURKIYE", "TURKEY", "TR", "TUR"].includes(alias)) return "TR";
  return null;
}

async function stableId(prefix: string, value: string) {
  const bytes = new TextEncoder().encode(value.toLocaleLowerCase("tr-TR"));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest)).slice(0, 12).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex}`;
}

async function seedReferenceData() {
  const db = getDb();
  for (const [code, name, description] of ROLE_SEEDS) {
    await db.insert(roles).values({ code, name, description }).onConflictDoNothing();
  }
  for (const code of PERMISSION_SEEDS) {
    await db.insert(permissions).values({ code, name: code }).onConflictDoNothing();
  }
  const roleSets: Array<[string, readonly string[]]> = [
    ["super_admin", ADMIN_PERMISSIONS], ["admin", ADMIN_PERMISSIONS],
    ["data_manager", DATA_MANAGER_PERMISSIONS], ["analyst", ANALYST_PERMISSIONS],
    ["manager", ["dashboard.view", "export.pdf"]], ["readonly", ["dashboard.view"]],
    ["viewer", ["dashboard.view", "export.pdf"]],
  ];
  for (const [roleCode, permissionSet] of roleSets) {
    for (const permissionCode of permissionSet) {
      await db.insert(rolePermissions).values({ roleCode, permissionCode }).onConflictDoNothing();
    }
  }
  for (const [id, code, name] of REGION_SEEDS) {
    await db.insert(regions).values({ id, code, name }).onConflictDoUpdate({ target: regions.code, set: { name } });
  }
  for (const [id, iso2Code, iso3Code, nameTr, nameEn, regionId] of COUNTRY_SEEDS) {
    await db.insert(countries).values({ id, iso2Code, iso3Code, nameTr, nameEn, regionId }).onConflictDoUpdate({ target: countries.iso2Code, set: { iso3Code, nameTr, nameEn, regionId } });
  }
  for (const alias of ["TURKIYE", "TURKEY", "TR", "TUR"]) {
    await db.insert(countryAliases).values({ alias, countryId: "country-tr" }).onConflictDoUpdate({ target: countryAliases.alias, set: { countryId: "country-tr" } });
  }
  for (const [id, countryId, name, displayName] of CITY_SEEDS) {
    await db.insert(cities).values({ id, countryId, name, displayName }).onConflictDoNothing();
  }
  for (const seed of PORT_SEEDS) {
    const existing = (await db.select().from(ports).where(eq(ports.stationCode, seed.code)).limit(1))[0];
    const timestamp = now();
    const values = {
      id: existing?.id ?? seed.id, regionCode: seed.regionCode, regionName: seed.region, countryCode: "TR", countryName: "Türkiye",
      cityName: seed.city, stationCode: seed.code, stationName: seed.shortName, iataCode: seed.code,
      airportName: seed.airportName, shortName: seed.shortName, cityId: seed.cityId, countryId: "country-tr",
      regionId: seed.regionId, displayCity: seed.displayCity, activeStatus: existing?.activeStatus ?? "active",
      createdAt: existing?.createdAt || timestamp, updatedAt: existing?.updatedAt || timestamp,
    };
    if (!existing) await db.insert(ports).values(values);
    else if (!existing.iataCode || !existing.airportName || !existing.cityId || !existing.countryId || !existing.regionId) {
      await db.update(ports).set(values).where(eq(ports.id, existing.id));
    }
    await db.update(stationPerformance).set({ portId: values.id, locationMappingStatus: "resolved" }).where(eq(stationPerformance.stationCode, seed.code));
  }
}

let referenceSeedPromise: Promise<void> | null = null;

async function referenceDataIsReady() {
  const db = getDb();
  const [sentinel] = await db.select({
    iataCode: ports.iataCode,
    airportName: ports.airportName,
    cityId: ports.cityId,
    countryId: ports.countryId,
    regionId: ports.regionId,
  }).from(ports).where(eq(ports.stationCode, "SAW")).limit(1);

  // SAW is the final canonical port inserted by seedReferenceData. When this
  // fully enriched record exists, the roles, permissions and geography rows
  // that precede it have already been initialized. This keeps normal dashboard
  // requests read-only instead of repeating dozens of D1 writes per isolate.
  return sentinel?.iataCode === "SAW"
    && sentinel.airportName === "İstanbul Sabiha Gökçen Havalimanı"
    && Boolean(sentinel.cityId && sentinel.countryId && sentinel.regionId);
}

function ensureReferenceData() {
  referenceSeedPromise ??= (async () => {
    if (await referenceDataIsReady()) return;
    await seedReferenceData();
  })().catch((error) => {
    referenceSeedPromise = null;
    throw error;
  });
  return referenceSeedPromise;
}

async function seedLegacyJune(actor: Actor) {
  const db = getDb();
  const uploadId = `legacy_june_${actor.workspaceId}`;
  const existing = await db.select({ id: uploads.id }).from(uploads).where(eq(uploads.id, uploadId)).limit(1);
  if (existing.length) return;
  const timestamp = now();
  await db.insert(uploads).values({
    id: uploadId, tenantId: actor.tenantId, workspaceId: actor.workspaceId,
    ownerUserId: actor.id, createdBy: actor.id, updatedBy: actor.id,
    fileName: "Haziran 2026 TGS İstasyon Performans Karnesi.xlsx",
    r2Key: "legacy://haziran-2026-tgs", provider: "TGS", period: "2026-06",
    sourceSheet: "Genel", rowCount: 7, validCount: 7, warningCount: 3, errorCount: 0,
    mappingVersion: "TGS-v1.0", versionNumber: 1, isActiveVersion: true,
    isTestData: false, importStatus: "completed", createdAt: timestamp, updatedAt: timestamp,
  });
  for (let index = 0; index < LEGACY_JUNE.length; index += 1) {
    const row = LEGACY_JUNE[index];
    const [stationCode, flights, passengers, delayMinutes, docRatio, docCount, internationalPassengers,
      damagedRatio, damagedCount, lostRatio, lostCount, safetyRatio, safetyCount, nonSafetyRatio,
      nonSafetyCount, safetyReports, otpRatio, otaRatio, complaintDays] = row;
    await db.insert(stationPerformance).values({
      id: `${uploadId}_${stationCode}`, tenantId: actor.tenantId, workspaceId: actor.workspaceId,
      ownerUserId: actor.id, createdBy: actor.id, updatedBy: actor.id, uploadId,
      provider: "TGS", period: "2026-06", stationCode, portId: `port-${stationCode.toLocaleLowerCase("tr-TR")}`,
      locationMappingStatus: "resolved", flights, passengers, delayMinutes,
      docRatio, docCount, internationalPassengers, damagedRatio, damagedCount, lostRatio, lostCount,
      safetyRatio, safetyCount, nonSafetyRatio, nonSafetyCount, safetyReports, otpRatio, otaRatio,
      complaintDays, sourceRow: index + 2,
      validationStatus: stationCode === "ESB" || stationCode === "SAW" ? "valid" : "warning",
      createdAt: timestamp,
    });
  }
}

export async function requireActor(request?: Request): Promise<Actor> {
  const db = getDb();
  const passwordIdentity = request ? await getSessionIdentity(request) : null;
  const accountsReset = await isAccountResetCompleted();
  let user = passwordIdentity?.user;
  let authType: Actor["authType"] = "password";
  if (!user) {
    // An expired, malformed or revoked password cookie never falls back to
    // platform authentication. Completed maintenance also disables account
    // provisioning through platform identity headers permanently.
    if ((request && hasSessionCookie(request)) || accountsReset) throw new PlatformError("E-posta ve şifrenizle giriş yapın.", 401);
    const authUser = await getChatGPTUser();
    const isDev = process.env.NODE_ENV !== "production";
    const identity = authUser ?? (isDev ? { email: "admin@ajet.local", fullName: "AJet Admin", displayName: "AJet Admin" } : null);
    if (!identity) throw new PlatformError("Oturum gerekli.", 401);
    const email = identity.email.toLocaleLowerCase("tr-TR");
    const existingUsers = await db.select().from(users).where(eq(users.email, email)).limit(1);
    user = existingUsers[0];
    if (user?.passwordHash) throw new PlatformError("E-posta ve şifrenizle giriş yapın.", 401);
    if (!user) throw new PlatformError("Hesap bulunamadı. Yönetici tarafından oluşturulmuş bir hesapla giriş yapın.", 401);
    authType = "platform";
  }
  if (!user || user.archivedAt || user.status !== "active") throw new PlatformError("Kullanıcı hesabı pasif.", 403);
  if (user.lockedUntil && user.lockedUntil > now()) throw new PlatformError("Kullanıcı hesabı geçici olarak kilitli.", 423);
  // Normal authorized requests only perform the reference sentinel read.
  await ensureReferenceData();
  const memberships = await db.select({
    workspaceId: workspaces.id, workspaceName: workspaces.name, tenantId: workspaces.tenantId,
  }).from(workspaceMembers).innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, user.id))
    .orderBy(sql`(SELECT COUNT(*) FROM uploads WHERE uploads.workspace_id = ${workspaces.id}) DESC`, asc(workspaces.createdAt), asc(workspaces.id));
  const requestedWorkspaceId = request ? new URL(request.url).searchParams.get("workspaceId") : null;
  const membership = requestedWorkspaceId ? memberships.find((scope) => scope.workspaceId === requestedWorkspaceId) : memberships[0];
  if (!membership) throw new PlatformError("Çalışma alanı bulunamadı veya erişim yetkiniz yok.", 403);
  const actor: Actor = {
    id: user.id, email: user.email, fullName: user.fullName, roleCode: user.roleCode,
    status: user.status, workspaceId: membership.workspaceId, tenantId: membership.tenantId,
    workspaceName: membership.workspaceName,
    workspaces: memberships.map((scope) => ({ id: scope.workspaceId, name: scope.workspaceName })),
    isAdmin: user.roleCode === "super_admin" || user.roleCode === "admin",
    authType,
    sessionId: passwordIdentity?.session.id ?? null,
    forcePasswordChange: user.forcePasswordChange,
  };
  if (authType === "platform") await db.update(users).set({ lastLoginAt: now(), updatedAt: now() }).where(eq(users.id, actor.id));
  if (actor.roleCode === "super_admin" && !accountsReset) await seedLegacyJune(actor);
  return actor;
}

export function requirePasswordReady(actor: Actor) {
  if (actor.forcePasswordChange) throw new PlatformError("Devam etmeden önce şifrenizi değiştirin.", 428);
}

export function requireAdmin(actor: Actor) {
  if (!actor.isAdmin) throw new PlatformError("Kullanıcı ve Erişim Yönetimi ekranına erişim yetkiniz yok.", 403);
}

export async function audit(actor: Actor, action: string, targetType: string, targetId: string, previousValue?: unknown, newValue?: unknown, result = "success") {
  const db = getDb();
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(), tenantId: actor.tenantId, workspaceId: actor.workspaceId,
    userId: actor.id, action, targetType, targetId,
    previousValue: previousValue === undefined ? null : JSON.stringify(previousValue),
    newValue: newValue === undefined ? null : JSON.stringify(newValue),
    sessionInfo: "workspace-authenticated", result, createdAt: now(),
  });
}

export async function getSessionPayload(actor: Actor) {
  const db = getDb();
  const permissionRows = await db.select({ code: rolePermissions.permissionCode }).from(rolePermissions).where(eq(rolePermissions.roleCode, actor.roleCode));
  const preferences = await db.select().from(userPreferences).where(eq(userPreferences.userId, actor.id)).limit(1);
  return { user: actor, workspaces: actor.workspaces ?? [{ id: actor.workspaceId, name: actor.workspaceName }], permissions: permissionRows.map((row) => row.code), preferences: preferences[0] ?? null, signOutPath: "/api/auth/logout" };
}

async function assertPermission(actor: Actor, permissionCode: string) {
  const db = getDb();
  const permitted = await db.select({ code: rolePermissions.permissionCode }).from(rolePermissions)
    .where(and(eq(rolePermissions.roleCode, actor.roleCode), eq(rolePermissions.permissionCode, permissionCode))).limit(1);
  if (!permitted.length) throw new PlatformError("Bu işlem için yetkiniz yok.", 403);
}

function computeQuality(records: Array<{ stationCode: string; validationStatus: string; flights: number; passengers: number | null; otpRatio: number | null; otaRatio: number | null; damagedRatio: number | null; lostRatio: number | null; delayMinutes: number | null; docRatio: number | null; safetyRatio: number | null; nonSafetyRatio: number | null; complaintDays: number | null; unreadDocuments: number | null; visaPassportIssues: number | null; safetyReports: number | null; gseDamageReports: number | null; digitalBoardingRatio: number | null }>, weights: { completeness: number; validity: number; uniqueness: number; consistency: number }) {
  if (!records.length) return { score: null, components: null };
  const expected = records.length * 16;
  const present = records.reduce((total, row) => total + [row.flights, row.passengers, row.otpRatio, row.otaRatio, row.damagedRatio, row.lostRatio, row.delayMinutes, row.docRatio, row.safetyRatio, row.nonSafetyRatio, row.complaintDays, row.unreadDocuments, row.visaPassportIssues, row.safetyReports, row.gseDamageReports, row.digitalBoardingRatio].filter((value) => value !== null && value !== undefined).length, 0);
  const completeness = present / expected * 100;
  const validity = records.filter((row) => row.validationStatus !== "error").length / records.length * 100;
  const uniqueness = new Set(records.map((row) => row.stationCode)).size / records.length * 100;
  const consistent = records.filter((row) => [row.otpRatio, row.otaRatio, row.damagedRatio, row.lostRatio, row.digitalBoardingRatio].every((value) => value === null || (value >= 0 && value <= 1))).length;
  const consistency = consistent / records.length * 100;
  const score = completeness * weights.completeness + validity * weights.validity + uniqueness * weights.uniqueness + consistency * weights.consistency;
  return { score: Math.round(score * 10) / 10, components: { completeness, validity, uniqueness, consistency, weights } };
}

type DashboardFilters = {
  period?: string; comparisonPeriod?: string; provider?: string; region?: string;
  country?: string; city?: string; ports?: string[]; sourceFile?: string; dataStatus?: string;
};

export async function getDashboardPayload(actor: Actor, filters: DashboardFilters) {
  await assertPermission(actor, "dashboard.view");
  const db = getDb();
  const rows = await db.select({
    id: stationPerformance.id, provider: stationPerformance.provider, period: stationPerformance.period,
    stationCode: stationPerformance.stationCode, masterStationCode: ports.stationCode, portId: stationPerformance.portId,
    locationMappingStatus: stationPerformance.locationMappingStatus,
    flights: stationPerformance.flights, passengers: stationPerformance.passengers,
    unreadDocuments: stationPerformance.unreadDocuments, visaPassportIssues: stationPerformance.visaPassportIssues,
    gseDamageReports: stationPerformance.gseDamageReports, digitalBoardingRatio: stationPerformance.digitalBoardingRatio,
    delayMinutes: stationPerformance.delayMinutes, docRatio: stationPerformance.docRatio, docCount: stationPerformance.docCount,
    internationalPassengers: stationPerformance.internationalPassengers, damagedRatio: stationPerformance.damagedRatio,
    damagedCount: stationPerformance.damagedCount, lostRatio: stationPerformance.lostRatio, lostCount: stationPerformance.lostCount,
    safetyRatio: stationPerformance.safetyRatio, safetyCount: stationPerformance.safetyCount,
    nonSafetyRatio: stationPerformance.nonSafetyRatio, nonSafetyCount: stationPerformance.nonSafetyCount,
    safetyReports: stationPerformance.safetyReports, otpRatio: stationPerformance.otpRatio, otaRatio: stationPerformance.otaRatio,
    complaintDays: stationPerformance.complaintDays, sourceRow: stationPerformance.sourceRow,
    validationStatus: stationPerformance.validationStatus, uploadId: uploads.id, fileName: uploads.fileName,
    sourceSheet: uploads.sourceSheet, sourceTitle: uploads.title, mappingVersion: uploads.mappingVersion, isTestData: uploads.isTestData,
    createdAt: uploads.createdAt, regionCode: regions.code, regionName: regions.name,
    countryCode: countries.iso2Code, countryName: countries.nameTr, countryNameEn: countries.nameEn,
    cityName: cities.name, cityDisplayName: cities.displayName, displayCity: ports.displayCity,
    stationName: ports.airportName, shortName: ports.shortName,
  }).from(stationPerformance)
    .innerJoin(uploads, eq(stationPerformance.uploadId, uploads.id))
    .leftJoin(ports, eq(stationPerformance.portId, ports.id))
    .leftJoin(cities, eq(ports.cityId, cities.id))
    .leftJoin(countries, eq(ports.countryId, countries.id))
    .leftJoin(regions, eq(ports.regionId, regions.id))
    .where(and(
      eq(stationPerformance.workspaceId, actor.workspaceId),
      eq(uploads.workspaceId, actor.workspaceId), eq(uploads.isActiveVersion, true),
      isNull(uploads.deletedAt),
      ne(stationPerformance.locationMappingStatus, "excluded"),
    )).orderBy(asc(stationPerformance.stationCode));

  const scoped = rows.filter((row) => {
    if (filters.provider && filters.provider !== "Tümü" && row.provider !== filters.provider) return false;
    if (filters.region && filters.region !== "Tümü" && row.regionCode !== filters.region) return false;
    if (filters.country && filters.country !== "Tümü" && row.countryCode !== filters.country) return false;
    if (filters.city && filters.city !== "Tümü" && row.cityName !== filters.city) return false;
    if (filters.ports?.length && !filters.ports.includes(row.masterStationCode ?? row.stationCode)) return false;
    if (filters.sourceFile && filters.sourceFile !== "Tümü" && row.uploadId !== filters.sourceFile) return false;
    if (filters.dataStatus && filters.dataStatus !== "Tümü" && row.validationStatus !== filters.dataStatus) return false;
    return true;
  });
  const periods = Array.from(new Set(scoped.map((row) => row.period))).sort().reverse();
  const mainPeriod = filters.period || periods.find((period) => period === "2026-06") || periods[0] || "2026-06";
  const comparisonPeriod = filters.comparisonPeriod || periods.find((period) => period !== mainPeriod) || "2026-05";
  const mapRecord = (row: typeof rows[number]) => ({
    id: row.id, provider: row.provider, period: row.period, stationCode: row.masterStationCode ?? row.stationCode, rawStationCode: row.stationCode, portId: row.portId,
    locationMappingStatus: row.locationMappingStatus, airportName: row.stationName,
    stationName: row.stationName ?? row.stationCode, shortName: row.shortName ?? row.stationCode,
    region: row.regionName, regionCode: row.regionCode,
    country: row.countryName, countryCode: row.countryCode, countryNameEn: row.countryNameEn,
    city: row.cityName, displayCity: row.displayCity ?? row.cityDisplayName,
    flights: row.flights, passengers: row.passengers, delayMinutes: row.delayMinutes,
    unreadDocuments: row.unreadDocuments, visaPassportIssues: row.visaPassportIssues,
    gseDamageReports: row.gseDamageReports, digitalBoardingRatio: row.digitalBoardingRatio,
    docRatePct: row.docRatio === null ? null : row.docRatio * 100, docCount: row.docCount,
    internationalPassengers: row.internationalPassengers, damagedRate: row.damagedRatio,
    damagedCount: row.damagedCount, lostRate: row.lostRatio, lostCount: row.lostCount,
    safetyPct: row.safetyRatio === null ? null : row.safetyRatio * 100, safetyCount: row.safetyCount,
    nonSafetyPct: row.nonSafetyRatio === null ? null : row.nonSafetyRatio * 100,
    nonSafetyCount: row.nonSafetyCount, safetyReports: row.safetyReports,
    otp: row.otpRatio === null ? null : row.otpRatio * 100, ota: row.otaRatio === null ? null : row.otaRatio * 100,
    complaintDays: row.complaintDays, sourceFile: row.fileName, sourceTitle: row.sourceTitle ?? row.fileName, sourceSheet: row.sourceSheet,
    sourceRow: row.sourceRow, mappingVersion: row.mappingVersion, calculationVersion: "KPI-v2.0",
    validationStatus: row.validationStatus, uploadId: row.uploadId, isTestData: row.isTestData,
  });
  const activeUploads = await db.select().from(uploads).where(and(eq(uploads.workspaceId, actor.workspaceId), isNull(uploads.deletedAt))).orderBy(desc(uploads.createdAt));
  const allUploads = await db.select().from(uploads).where(eq(uploads.workspaceId, actor.workspaceId)).orderBy(desc(uploads.createdAt));
  const weightRows = await db.select().from(qualityWeights).where(eq(qualityWeights.workspaceId, actor.workspaceId)).limit(1);
  const weights = weightRows[0] ?? { completeness: 0.4, validity: 0.3, uniqueness: 0.2, consistency: 0.1 };
  const currentRows = scoped.filter((row) => row.period === mainPeriod);
  const latest = activeUploads[0]?.createdAt ?? null;
  const portRows = await db.select({
    id: ports.id, stationCode: ports.stationCode, iataCode: ports.iataCode,
    airportName: ports.airportName, shortName: ports.shortName, displayCity: ports.displayCity,
    cityId: cities.id, cityName: cities.name, cityDisplayName: cities.displayName,
    countryId: countries.id, countryCode: countries.iso2Code, countryName: countries.nameTr, countryNameEn: countries.nameEn,
    regionId: regions.id, regionCode: regions.code, regionName: regions.name,
    activeStatus: ports.activeStatus,
  }).from(ports)
    .leftJoin(cities, eq(ports.cityId, cities.id))
    .leftJoin(countries, eq(ports.countryId, countries.id))
    .leftJoin(regions, eq(ports.regionId, regions.id))
    .where(eq(ports.activeStatus, "active")).orderBy(asc(ports.stationCode));
  const exportRows = await db.select().from(exportJobs)
    .where(and(eq(exportJobs.workspaceId, actor.workspaceId), isNull(exportJobs.deletedAt), actor.isAdmin ? undefined : eq(exportJobs.userId, actor.id)))
    .orderBy(desc(exportJobs.createdAt)).limit(25);
  const people = await db.select({ id: users.id, fullName: users.fullName }).from(users);
  const peopleById = new Map(people.map((person) => [person.id, person.fullName]));
  const uploadPayload = allUploads.map((upload) => ({ ...upload, ownerName: peopleById.get(upload.ownerUserId) ?? "Bilinmeyen kullanıcı" }));
  const exportPayload = exportRows.map((entry) => ({ ...entry, userName: peopleById.get(entry.userId) ?? "Bilinmeyen kullanıcı" }));
  const auditRows = await db.select().from(auditLogs)
    .where(eq(auditLogs.workspaceId, actor.workspaceId)).orderBy(desc(auditLogs.createdAt)).limit(50);
  const savedViewRows = await db.select().from(savedViews)
    .where(and(eq(savedViews.workspaceId, actor.workspaceId), eq(savedViews.userId, actor.id)))
    .orderBy(desc(savedViews.createdAt));
  const unresolvedCodes = Array.from(new Set(rows.filter((row) => row.locationMappingStatus === "unresolved").map((row) => row.stationCode)));
  const requiredMockPeriods = [
    "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
    "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
  ];
  const activeMockPeriods = new Set(allUploads.filter((upload) => upload.deletedAt === null && upload.isActiveVersion && upload.isTestData && /^AJet_TGS_\d{4}-\d{2}_test_mock\.xlsx$/.test(upload.fileName)).map((upload) => upload.period));
  const testDataAutoImportEnabled = getRuntimeBindings().ENABLE_TEST_DATA_AUTO_IMPORT === "true";
  const missingMockPeriods = actor.roleCode === "super_admin" && testDataAutoImportEnabled
    ? requiredMockPeriods.filter((period) => !activeMockPeriods.has(period))
    : [];
  return {
    session: await getSessionPayload(actor),
    current: currentRows.map(mapRecord),
    comparison: scoped.filter((row) => row.period === comparisonPeriod).map(mapRecord),
    history: scoped.map(mapRecord),
    periods, mainPeriod, comparisonPeriod,
    uploads: uploadPayload,
    activeUploads,
    latestDataAt: latest,
    quality: computeQuality(currentRows, weights),
    geography: portRows,
    exports: exportPayload,
    audit: auditRows,
    savedViews: savedViewRows,
    mappingIssues: unresolvedCodes.map((stationCode) => ({
      level: "warning", field: "station_code", stationCode,
      message: `${stationCode} havalimanı kodu coğrafi master veride bulunamadı.`,
    })),
    missingMockPeriods,
    testMockMissing: missingMockPeriods.length > 0,
  };
}

function getBucket() {
  const env = getRuntimeBindings();
  if (!env.BUCKET) throw new PlatformError("Dosya depolama bağlantısı kullanılamıyor.", 503);
  return env.BUCKET;
}

type ImportMetadata = { title?: string; selection?: Partial<ImportSelection>; provider?: string; period?: string; isTestData?: boolean; mode?: string; reprocess?: { uploadId: string; versionNumber: number } };

async function readImportFile(file: File) {
  const extension = file.name.match(/\.([^.]+)$/)?.[1]?.toLocaleLowerCase("tr-TR");
  if (!extension || !["xlsx", "xls", "csv"].includes(extension)) throw new PlatformError("Yalnızca XLSX, XLS veya CSV kabul edilir.");
  if (file.size > 15 * 1024 * 1024) throw new PlatformError("Dosya 15 MB sınırını aşıyor.");
  if (file.size === 0) throw new PlatformError("Boş dosya yüklenemez.");
  const bytes = await file.arrayBuffer();
  const signature = new Uint8Array(bytes.slice(0, 8));
  const isZip = signature[0] === 0x50 && signature[1] === 0x4b && [0x03, 0x05, 0x07].includes(signature[2]);
  const isCompound = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((value, index) => signature[index] === value);
  if (extension === "xlsx" && !isZip) throw new PlatformError("Dosya içeriği geçerli bir XLSX dosyası değil.");
  if (extension === "xls" && !isCompound) throw new PlatformError("Dosya içeriği geçerli bir XLS dosyası değil.");
  if (extension === "csv" && new Uint8Array(bytes.slice(0, Math.min(bytes.byteLength, 4096))).includes(0)) throw new PlatformError("Dosya içeriği geçerli bir CSV dosyası değil.");
  let workbook: WorkbookSource;
  try { workbook = XLSX.read(bytes, { type: "array", cellDates: true, cellNF: true }); }
  catch { throw new PlatformError("Çalışma kitabı okunamadı; dosya içeriğini kontrol edin."); }
  return { bytes, workbook };
}

function detectImportFile(workbook: WorkbookSource, fileName: string, metadata: ImportMetadata) {
  const explicit = { ...metadata.selection };
  if (metadata.provider !== undefined && explicit.provider === undefined) explicit.provider = metadata.provider;
  if (metadata.period !== undefined && explicit.period === undefined) explicit.period = metadata.period;
  return detectWorkbook(workbook, fileName, explicit);
}

export async function previewWorkbook(actor: Actor, file: File, metadata: ImportMetadata = {}) {
  await assertPermission(actor, "upload.create");
  const { workbook } = await readImportFile(file);
  const detection = detectImportFile(workbook, file.name, metadata);
  const parsed = detection.selection && !detection.needsReview ? parseWorkbook(workbook, detection.selection) : null;
  return { ...detection, preview: parsed?.rows.slice(0, 50) ?? [], rowCount: parsed?.rows.length ?? 0, validationIssues: parsed?.issues ?? [], errorCount: parsed?.errorCount ?? detection.issues.filter((issue) => issue.level === "error").length };
}

export async function importWorkbook(actor: Actor, file: File, metadata: ImportMetadata = {}) {
  await assertPermission(actor, "upload.create");
  const db = getDb();
  const isTestData = Boolean(metadata.isTestData) || /^AJet_TGS_\d{4}-\d{2}_test_mock\.xlsx$/i.test(file.name);
  const { bytes, workbook } = await readImportFile(file);
  const detection = detectImportFile(workbook, file.name, metadata);
  if (detection.needsReview || !detection.selection) throw new PlatformError(detection.issues.filter((issue) => issue.level === "error").map((issue) => issue.message).join("; "));
  const selection = detection.selection;
  const parsed = parseWorkbook(workbook, selection);
  if (parsed.errorCount) throw new PlatformError(parsed.issues.filter((issue) => issue.level === "error").slice(0, 20).map((issue) => issue.message).join("; "));
  const provider = selection.provider!;
  const period = selection.period!;
  const title = (metadata.title === undefined ? file.name.replace(/\.[^.]+$/, "") : metadata.title).trim();
  if (!title || title.length > 200 || /[\u0000-\u001f\u007f]/.test(title)) throw new PlatformError("Veri seti başlığı 1–200 karakter olmalıdır.");
  const masterPorts = await db.select({ id: ports.id, iataCode: ports.iataCode, stationCode: ports.stationCode }).from(ports).where(eq(ports.activeStatus, "active"));
  const portLookup = new Map(masterPorts.map((port) => [(port.iataCode ?? port.stationCode).toLocaleUpperCase("tr-TR"), port.id]));
  const rows = parsed.rows.map((row) => {
    const stationCode = row.stationCode;
    return { ...row,
      portId: /^[A-Z]{3}$/.test(stationCode) ? portLookup.get(stationCode) ?? null : null,
      locationMappingStatus: /^[A-Z]{3}$/.test(stationCode) && portLookup.has(stationCode) ? "resolved" : "unresolved",
    };
  });
  const uploadScope = and(eq(uploads.workspaceId, actor.workspaceId), eq(uploads.provider, provider), eq(uploads.period, period));
  const active = await db.select().from(uploads).where(and(uploadScope, eq(uploads.isActiveVersion, true), isNull(uploads.deletedAt))).orderBy(desc(uploads.versionNumber)).limit(1);
  const previous = active[0];
  if (previous && metadata.mode === "cancel") throw new PlatformError("Yükleme iptal edildi.");
  const nextVersion = sql<number>`(SELECT coalesce(max(version_number), 0) + 1 FROM uploads WHERE workspace_id = ${actor.workspaceId} AND provider = ${provider} AND period = ${period})`;
  const priorActive = sql<string | null>`(SELECT id FROM uploads WHERE workspace_id = ${actor.workspaceId} AND provider = ${provider} AND period = ${period} AND is_active_version = 1 AND deleted_at IS NULL ORDER BY version_number DESC LIMIT 1)`;
  const uploadId = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._ğüşöçıİĞÜŞÖÇ -]/g, "_");
  const r2Key = `${actor.tenantId}/${actor.workspaceId}/uploads/${uploadId}/${safeName}`;
  const timestamp = now();
  const unresolvedCodes = Array.from(new Set(rows.filter((row) => row.locationMappingStatus === "unresolved").map((row) => row.stationCode)));
  const warningRows = new Set(parsed.issues.filter((issue) => issue.level === "warning" && issue.sourceRow).map((issue) => issue.sourceRow));
  for (const row of rows) if (row.locationMappingStatus === "unresolved") warningRows.add(row.sourceRow);
  const statements: BatchItem<"sqlite">[] = [];
  statements.push(db.insert(uploads).values({
    id: uploadId, tenantId: actor.tenantId, workspaceId: actor.workspaceId, ownerUserId: actor.id,
    createdBy: actor.id, updatedBy: actor.id, fileName: safeName, title, importSelection: JSON.stringify(selection), r2Key, provider, period,
    sourceSheet: selection.sheetName, rowCount: rows.length, validCount: rows.length - warningRows.size, warningCount: warningRows.size,
    errorCount: 0, mappingVersion: sql`${provider} || '-v' || ${nextVersion} || '.0'`, versionNumber: nextVersion,
    replacesUploadId: priorActive, isActiveVersion: true, isTestData, importStatus: "completed", createdAt: timestamp, updatedAt: timestamp,
  }).returning({ versionNumber: uploads.versionNumber }));
  statements.push(db.update(uploads).set({ isActiveVersion: false, supersededAt: timestamp, updatedAt: timestamp, updatedBy: actor.id }).where(and(uploadScope, ne(uploads.id, uploadId), eq(uploads.isActiveVersion, true), isNull(uploads.deletedAt))));
  for (const row of rows) statements.push(db.insert(stationPerformance).values({
    ...row, flights: row.flights!,
    id: crypto.randomUUID(), tenantId: actor.tenantId, workspaceId: actor.workspaceId,
    ownerUserId: actor.id, createdBy: actor.id, updatedBy: actor.id, uploadId, provider, period,
    validationStatus: warningRows.has(row.sourceRow) ? "warning" : "valid", createdAt: timestamp,
  }));
  statements.push(db.insert(auditLogs).values({
    id: crypto.randomUUID(), tenantId: actor.tenantId, workspaceId: actor.workspaceId, userId: actor.id,
    action: "upload.create", targetType: "upload", targetId: uploadId,
    previousValue: sql`(SELECT CASE WHEN replaces_upload_id IS NULL THEN NULL ELSE json_object('activeUploadId', replaces_upload_id) END FROM uploads WHERE id = ${uploadId})`,
    newValue: sql`json_set(${JSON.stringify({ fileName: safeName, title, provider, period, rows: rows.length, unresolvedCodes, isTestData, selection })}, '$.versionNumber', (SELECT version_number FROM uploads WHERE id = ${uploadId}))`,
    sessionInfo: "workspace-authenticated", result: "success", createdAt: timestamp,
  }));
  if (metadata.reprocess) statements.push(db.insert(auditLogs).values({
    id: crypto.randomUUID(), tenantId: actor.tenantId, workspaceId: actor.workspaceId, userId: actor.id,
    action: "upload.reprocess", targetType: "upload", targetId: metadata.reprocess.uploadId,
    previousValue: JSON.stringify({ versionNumber: metadata.reprocess.versionNumber }),
    newValue: sql`json_set(${JSON.stringify({ newUploadId: uploadId })}, '$.versionNumber', (SELECT version_number FROM uploads WHERE id = ${uploadId}))`,
    sessionInfo: "workspace-authenticated", result: "success", createdAt: timestamp,
  }));
  const bucket = getBucket();
  await bucket.put(r2Key, bytes, { httpMetadata: { contentType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } });
  let versionNumber: number;
  try {
    const results = await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
    versionNumber = Number((results[0] as Array<{versionNumber:number}>)[0].versionNumber);
  }
  catch (error) {
    try { await bucket.delete(r2Key); }
    catch (cleanupError) { console.error("Failed to remove uncommitted import object", cleanupError); }
    throw error;
  }
  return { uploadId, fileName: safeName, title, provider, period, rows: rows.length, versionNumber, unresolvedCodes, isTestData, selection, warnings: [...detection.issues, ...parsed.issues].filter((issue) => issue.level === "warning") };
}

export async function softDeleteUpload(actor: Actor, uploadId: string, reason: string) {
  await assertPermission(actor, "upload.delete");
  const db = getDb();
  const found = await db.select().from(uploads).where(and(eq(uploads.id, uploadId), eq(uploads.workspaceId, actor.workspaceId))).limit(1);
  const upload = found[0];
  if (!upload) throw new PlatformError("Dosya bulunamadı.", 404);
  if (upload.ownerUserId !== actor.id && !actor.isAdmin) throw new PlatformError("Bu dosyayı silme yetkiniz yok.", 403);
  const timestamp = now();
  await db.update(uploads).set({ deletedAt: timestamp, deletedBy: actor.id, deletionReason: reason || "Kullanıcı isteği", deletionStatus: "deleted", isActiveVersion: false, updatedAt: timestamp, updatedBy: actor.id }).where(and(eq(uploads.id, uploadId), eq(uploads.workspaceId, actor.workspaceId)));
  if (upload.isActiveVersion) {
    const previous = await db.select().from(uploads).where(and(
      eq(uploads.workspaceId, actor.workspaceId), eq(uploads.provider, upload.provider), eq(uploads.period, upload.period), isNull(uploads.deletedAt),
    )).orderBy(desc(uploads.versionNumber)).limit(1);
    if (previous[0]) await db.update(uploads).set({ isActiveVersion: true, updatedAt: timestamp, updatedBy: actor.id }).where(and(eq(uploads.id, previous[0].id), eq(uploads.workspaceId, actor.workspaceId)));
  }
  await audit(actor, "upload.delete", "upload", uploadId, { deletionStatus: upload.deletionStatus }, { deletionStatus: "deleted", reason });
  return { id: uploadId, deleted: true, affectedStations: upload.rowCount, period: upload.period, provider: upload.provider };
}

export async function restoreUpload(actor: Actor, uploadId: string) {
  await assertPermission(actor, "upload.restore");
  const db = getDb();
  const found = await db.select().from(uploads).where(and(eq(uploads.id, uploadId), eq(uploads.workspaceId, actor.workspaceId))).limit(1);
  const upload = found[0];
  if (!upload) throw new PlatformError("Dosya bulunamadı.", 404);
  if (upload.ownerUserId !== actor.id && !actor.isAdmin) throw new PlatformError("Bu dosyayı geri yükleme yetkiniz yok.", 403);
  const activeSamePeriod = await db.select().from(uploads).where(and(eq(uploads.workspaceId, actor.workspaceId), eq(uploads.provider, upload.provider), eq(uploads.period, upload.period), eq(uploads.isActiveVersion, true), isNull(uploads.deletedAt)));
  for (const active of activeSamePeriod) await db.update(uploads).set({ isActiveVersion: false, supersededAt: now(), updatedAt: now(), updatedBy: actor.id }).where(eq(uploads.id, active.id));
  await db.update(uploads).set({ deletedAt: null, deletedBy: null, deletionReason: null, deletionStatus: "active", isActiveVersion: true, updatedAt: now(), updatedBy: actor.id }).where(and(eq(uploads.id, uploadId), eq(uploads.workspaceId, actor.workspaceId)));
  await audit(actor, "upload.restore", "upload", uploadId, { deletionStatus: "deleted" }, { deletionStatus: "active" });
  return { id: uploadId, restored: true };
}

export async function reprocessUpload(actor: Actor, uploadId: string) {
  await assertPermission(actor, "upload.create");
  const db = getDb();
  const found = await db.select().from(uploads).where(and(eq(uploads.id, uploadId), eq(uploads.workspaceId, actor.workspaceId))).limit(1);
  const upload = found[0];
  if (!upload) throw new PlatformError("Dosya bulunamadı.", 404);
  if (upload.deletedAt) throw new PlatformError("Silinmiş dosya yeniden işlenmeden önce geri yüklenmelidir.");
  if (upload.ownerUserId !== actor.id && !actor.isAdmin) throw new PlatformError("Bu dosyayı yeniden işleme yetkiniz yok.", 403);
  const stored = await getBucket().get(upload.r2Key);
  if (!stored) throw new PlatformError("Kaynak dosya depoda bulunamadı.", 404);
  const bytes = await stored.arrayBuffer();
  const file = new File([bytes], upload.fileName, { type: stored.httpMetadata?.contentType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  let selection: Partial<ImportSelection> = { sheetName: upload.sourceSheet, provider: upload.provider, period: upload.period };
  if (upload.importSelection) {
    try { selection = JSON.parse(upload.importSelection) as ImportSelection; }
    catch { throw new PlatformError("Kaydedilmiş içe aktarma seçimi okunamadı."); }
    if (!selection || typeof selection !== "object" || Array.isArray(selection)) throw new PlatformError("Kaydedilmiş içe aktarma seçimi geçersiz.");
  }
  return importWorkbook(actor, file, { title: upload.title ?? undefined, selection, isTestData: upload.isTestData, mode: "version", reprocess: { uploadId, versionNumber: upload.versionNumber } });
}

export async function getAdminPayload(actor: Actor) {
  if (!actor.isAdmin) throw new PlatformError("Yönetim alanı yalnızca adminlere açıktır.", 403);
  const db = getDb();
  const userRows = await db.select({
    id: users.id, email: users.email, fullName: users.fullName, roleCode: users.roleCode,
    status: users.status, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt,
    workspaceId: workspaces.id, workspaceName: workspaces.name, tenantId: workspaces.tenantId,
  }).from(users).leftJoin(workspaceMembers, eq(users.id, workspaceMembers.userId))
    .leftJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id)).orderBy(desc(users.createdAt));
  const scopedUsers = actor.roleCode === "super_admin" ? userRows : userRows.filter((row) => row.tenantId === actor.tenantId);
  const auditRows = actor.roleCode === "super_admin"
    ? await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100)
    : await db.select().from(auditLogs).where(eq(auditLogs.tenantId, actor.tenantId)).orderBy(desc(auditLogs.createdAt)).limit(100);
  const roleRows = await db.select().from(roles).orderBy(asc(roles.name));
  const exportRows = await db.select().from(exportJobs).where(eq(exportJobs.workspaceId, actor.workspaceId)).orderBy(desc(exportJobs.createdAt)).limit(50);
  return { users: scopedUsers, roles: roleRows, audit: auditRows, exports: exportRows };
}

async function assertCanManageUser(actor: Actor, targetUserId: string) {
  if (actor.roleCode === "super_admin") return;
  const db = getDb();
  const target = await db.select({ tenantId: workspaces.tenantId }).from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, targetUserId)).limit(1);
  if (!target[0] || target[0].tenantId !== actor.tenantId) throw new PlatformError("Bu kullanıcı yönetim kapsamınızda değil.", 403);
}

export async function createManagedUser(actor: Actor, payload: { email?: string; fullName?: string; roleCode?: string }) {
  if (!actor.isAdmin) throw new PlatformError("Kullanıcı oluşturma yetkiniz yok.", 403);
  const email = payload.email?.trim().toLocaleLowerCase("tr-TR");
  const fullName = payload.fullName?.trim();
  if (!email || !fullName) throw new PlatformError("Ad soyad ve e-posta zorunludur.");
  const db = getDb();
  const selectedRole = payload.roleCode || "analyst";
  const roleExists = await db.select({ code: roles.code }).from(roles).where(eq(roles.code, selectedRole)).limit(1);
  if (!roleExists.length || selectedRole === "super_admin") throw new PlatformError("Geçersiz rol seçimi.");
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) throw new PlatformError("Bu e-posta zaten kayıtlı.");
  const userId = await stableId("usr", email);
  const workspaceId = await stableId("wsp", email);
  const timestamp = now();
  await db.insert(users).values({ id: userId, email, fullName, roleCode: selectedRole, status: "active", createdAt: timestamp, updatedAt: timestamp });
  await db.insert(workspaces).values({ id: workspaceId, name: `${fullName} Çalışma Alanı`, ownerUserId: userId, tenantId: actor.tenantId, createdAt: timestamp });
  await db.insert(workspaceMembers).values({ workspaceId, userId, accessLevel: "owner" });
  await db.insert(userPreferences).values({ userId, defaultPeriod: null, comparisonPeriod: null, updatedAt: timestamp });
  await db.insert(qualityWeights).values({ workspaceId, updatedBy: actor.id, updatedAt: timestamp });
  await audit(actor, "user.create", "user", userId, undefined, { email, fullName, roleCode: selectedRole, workspaceId });
  return { id: userId, email, fullName, roleCode: selectedRole, workspaceId };
}

export async function updateManagedUser(actor: Actor, payload: { id?: string; status?: string; roleCode?: string; fullName?: string; terminateSessions?: boolean }) {
  if (!actor.isAdmin) throw new PlatformError("Kullanıcı güncelleme yetkiniz yok.", 403);
  if (!payload.id) throw new PlatformError("Kullanıcı kimliği zorunludur.");
  if (payload.id === actor.id && payload.status && payload.status !== "active") throw new PlatformError("Kendi hesabınızı pasife alamazsınız.");
  await assertCanManageUser(actor, payload.id);
  const db = getDb();
  const previous = await db.select().from(users).where(eq(users.id, payload.id)).limit(1);
  if (!previous[0]) throw new PlatformError("Kullanıcı bulunamadı.", 404);
  if (payload.roleCode === "super_admin" && actor.roleCode !== "super_admin") throw new PlatformError("Sistem Yöneticisi rolünü atama yetkiniz yok.", 403);
  const next = {
    status: payload.status ?? previous[0].status,
    roleCode: payload.roleCode ?? previous[0].roleCode,
    fullName: payload.fullName ?? previous[0].fullName,
    forceLogoutAt: payload.terminateSessions ? now() : previous[0].forceLogoutAt,
    updatedAt: now(),
  };
  await db.update(users).set(next).where(eq(users.id, payload.id));
  await audit(actor, payload.terminateSessions ? "user.session.terminate" : "user.update", "user", payload.id, previous[0], next);
  return { id: payload.id, ...next };
}

export async function saveUserView(actor: Actor, payload: { name?: string; filters?: unknown; isDefault?: boolean }) {
  if (!payload.name?.trim()) throw new PlatformError("Görünüm adı zorunludur.");
  const db = getDb();
  const id = crypto.randomUUID();
  if (payload.isDefault) await db.update(savedViews).set({ isDefault: false }).where(and(eq(savedViews.workspaceId, actor.workspaceId), eq(savedViews.userId, actor.id)));
  await db.insert(savedViews).values({ id, workspaceId: actor.workspaceId, userId: actor.id, name: payload.name.trim(), filterState: JSON.stringify(payload.filters ?? {}), isDefault: payload.isDefault ?? false, createdAt: now() });
  await audit(actor, "filter.view.save", "saved_view", id, undefined, payload);
  return { id };
}

type ExportSnapshot = { scope: "summary" | "full"; generatedAt: number; records: unknown[]; comparison: unknown[]; history: unknown[]; issues: unknown[]; filters: Record<string, unknown> };
function exportRecords(value: unknown) {
  if (!Array.isArray(value) || value.length > 50000 || value.some((record) => !record || typeof record !== "object" || Array.isArray(record) || typeof record.isTestData !== "boolean")) throw new PlatformError("Dışa aktarım kayıtları geçersiz.");
  return value as Array<{ isTestData: boolean }>;
}

export async function createExportJob(actor: Actor, payload: { type?: string; fileName?: string; filters?: unknown; includeTestData?: boolean; sizeBytes?: number; reportSnapshot?: unknown; records?: unknown; scope?: unknown }) {
  const type = payload.type || "pdf";
  if (!["pdf", "excel", "csv"].includes(type)) throw new PlatformError("Dışa aktarım türü geçersiz.");
  await assertPermission(actor, type === "excel" || type === "csv" ? "export.excel" : "export.pdf");
  let actualRecords: Array<{ isTestData: boolean }>;
  let filters: unknown = payload.filters ?? {};
  let scope: "summary" | "full" | null = null;
  if (type === "pdf") {
    const snapshot = payload.reportSnapshot as ExportSnapshot | undefined;
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot) || !["summary", "full"].includes(snapshot.scope) || (payload.scope !== undefined && payload.scope !== snapshot.scope)) throw new PlatformError("Rapor kapsamı geçersiz.");
    if (!Number.isSafeInteger(snapshot.generatedAt) || snapshot.generatedAt <= 0 || !Array.isArray(snapshot.issues) || !snapshot.filters || typeof snapshot.filters !== "object" || Array.isArray(snapshot.filters)) throw new PlatformError("Rapor anlık görüntüsü geçersiz.");
    const current = exportRecords(snapshot.records);
    const comparison = exportRecords(snapshot.comparison);
    const history = exportRecords(snapshot.history);
    scope = snapshot.scope;
    actualRecords = scope === "full" ? [...current, ...comparison, ...history] : [...current, ...comparison];
    filters = { ...snapshot.filters, reportScope: scope, generatedAt: snapshot.generatedAt };
  } else actualRecords = exportRecords(payload.records);
  const includeTestData = actualRecords.some((record) => record.isTestData);
  const status = type === "pdf" ? "prepared" : "completed";
  const timestamp = now();
  const fileName = payload.fileName || `AJet_${timestamp}.${type === "excel" ? "xlsx" : type}`;
  if (typeof fileName !== "string" || fileName.length > 240 || /[\u0000-\u001f\u007f]/.test(fileName)) throw new PlatformError("Rapor dosya adı geçersiz.");
  const sizeBytes = payload.sizeBytes === undefined ? null : payload.sizeBytes;
  if (sizeBytes !== null && (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0)) throw new PlatformError("Rapor dosya boyutu geçersiz.");
  const db = getDb();
  const id = crypto.randomUUID();
  await db.insert(exportJobs).values({ id, workspaceId: actor.workspaceId, userId: actor.id, exportType: type, fileName, filterState: JSON.stringify(filters), includeTestData, status, sizeBytes, createdAt: timestamp });
  await audit(actor, type === "pdf" ? "export.pdf" : "export.excel", "export", id, undefined, { type, fileName, filters, includeTestData, status, scope, recordCount: actualRecords.length, sizeBytes });
  return { id, status, includeTestData };
}

export async function deleteExportJob(actor: Actor, exportId: string) {
  const db = getDb();
  const found = await db.select().from(exportJobs).where(and(eq(exportJobs.id, exportId), eq(exportJobs.workspaceId, actor.workspaceId))).limit(1);
  const item = found[0];
  if (!item) throw new PlatformError("Rapor kaydı bulunamadı.", 404);
  if (item.userId !== actor.id && !actor.isAdmin) throw new PlatformError("Bu raporu silme yetkiniz yok.", 403);
  await db.update(exportJobs).set({ deletedAt: now() }).where(and(eq(exportJobs.id, exportId), eq(exportJobs.workspaceId, actor.workspaceId)));
  await audit(actor, "export.delete", "export", exportId, { deletedAt: null }, { deletedAt: now() });
  return { id: exportId, deleted: true };
}

export async function getAuditForWorkspace(actor: Actor) {
  await assertPermission(actor, "audit.view");
  const db = getDb();
  return db.select().from(auditLogs).where(eq(auditLogs.workspaceId, actor.workspaceId)).orderBy(desc(auditLogs.createdAt)).limit(100);
}
