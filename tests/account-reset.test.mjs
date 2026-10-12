import assert from "node:assert/strict";
import test from "node:test";
import { TestD1 } from "./account-reset-d1.mjs";
import { setRuntimeBindings } from "../lib/server/runtime-bindings.ts";
import { createSession, hashPassword, getSessionIdentity, sha256, verifyPassword } from "../lib/server/auth.ts";
import { requireActor, getSessionPayload } from "../lib/server/platform.ts";
import { POST as login } from "../app/api/auth/login/route.ts";

const resetModule = await import("../lib/server/account-reset.ts").catch((error) => {
  if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
  return { resetAccounts: async () => { throw new Error("Controlled account reset is not implemented"); } };
});
const { resetAccounts } = resetModule;
const maintenanceRoute = await import("../app/api/maintenance/account-reset/route.ts").catch((error) => {
  if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
  return { POST: async () => { throw new Error("Controlled maintenance endpoint is not implemented"); } };
});
const maintenanceToken = "test-maintenance-token-only-01234567890123456789";
const newPassword = "SafeAccount987";
const oldPassword = "OldAccount987";
const oldHash = await hashPassword(oldPassword);

test("the nullable metric migration preserves existing station data and histories", (t) => {
  let originalRecord;
  const database = new TestD1((sqlite, file) => {
    if (!file.startsWith("0004_")) return;
    sqlite.exec(`INSERT INTO station_performance (id, tenant_id, workspace_id, owner_user_id, created_by, updated_by, upload_id, provider, period, station_code, flights, passengers, otp_ratio, doc_count, source_row, created_at)
      VALUES ('before-migration', 'tenant-keep', 'workspace-keep', 'user-keep', 'user-keep', 'user-keep', 'upload-keep', 'TGS', '2026-06', 'SAW', 42, 7000, 0.95, 3, 9, 1000);
      INSERT INTO audit_logs (id, tenant_id, workspace_id, user_id, action, target_type, target_id, created_at) VALUES ('audit-before-migration', 'tenant-keep', 'workspace-keep', 'user-keep', 'upload.create', 'upload', 'upload-keep', 1000);
      INSERT INTO port_mapping_history (id, station_code, action, changed_by, created_at) VALUES ('mapping-before-migration', 'SAW', 'port.map', 'user-keep', 1000);`);
    originalRecord = { ...sqlite.prepare("SELECT * FROM station_performance WHERE id = 'before-migration'").get() };
  });
  t.after(() => database.close());
  assert.ok(originalRecord, "The station-table migration must run against existing data");
  const migrated = database.rows("station_performance")[0];
  for (const [column, value] of Object.entries(originalRecord)) assert.equal(migrated[column], value, `Existing ${column} must be preserved`);
  for (const column of ["unread_documents", "visa_passport_issues", "gse_damage_reports", "digital_boarding_ratio"]) assert.equal(migrated[column], null);
  assert.equal(database.rows("audit_logs")[0].id, "audit-before-migration");
  assert.equal(database.rows("port_mapping_history")[0].id, "mapping-before-migration");
});

function request(body = { email: "madiyaman@ajet.com", password: newPassword }, token = maintenanceToken) {
  return new Request("https://example.test/api/maintenance/account-reset", {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body),
  });
}

async function fixture(t, { targetExists = true } = {}) {
  const database = new TestD1();
  t.after(() => database.close());
  setRuntimeBindings({ DB: database, ACCOUNT_RESET_TOKEN: maintenanceToken });
  const timestamp = Date.now() - 60_000;
  for (const [id, email, role] of [["legacy-owner", "legacy@ajet.com", "super_admin"], ["legacy-analyst", "analyst@ajet.com", "analyst"]]) {
    database.insert("users", { id, email, full_name: id, role_code: role, status: "active", password_hash: oldHash, created_at: timestamp, updated_at: timestamp });
  }
  if (targetExists) database.insert("users", { id: "retained-admin-id", email: "madiyaman@ajet.com", full_name: "Madiyaman", role_code: "analyst", status: "inactive", archived_at: timestamp, password_hash: oldHash, created_at: timestamp, updated_at: timestamp });
  database.insert("workspaces", { id: "empty-workspace", name: "Earlier empty workspace", tenant_id: "tenant-a", owner_user_id: "legacy-owner", created_at: timestamp - 5000 });
  database.insert("workspaces", { id: "data-workspace", name: "Existing data", tenant_id: "tenant-b", owner_user_id: "legacy-analyst", created_at: timestamp });
  for (const [workspace, owner] of [["empty-workspace", "legacy-owner"], ["data-workspace", "legacy-analyst"]]) database.insert("workspace_members", { workspace_id: workspace, user_id: owner, access_level: "owner" });
  database.insert("uploads", { id: "retained-upload", tenant_id: "tenant-b", workspace_id: "data-workspace", owner_user_id: "legacy-analyst", created_by: "legacy-analyst", updated_by: "legacy-analyst", file_name: "existing.xlsx", r2_key: "existing.xlsx", provider: "TGS", period: "2026-06", source_sheet: "Genel", row_count: 1, valid_count: 1, warning_count: 0, error_count: 0, mapping_version: "TGS-v1.0", created_at: timestamp, updated_at: timestamp });
  database.insert("station_performance", { id: "retained-record", tenant_id: "tenant-b", workspace_id: "data-workspace", owner_user_id: "legacy-analyst", created_by: "legacy-analyst", updated_by: "legacy-analyst", upload_id: "retained-upload", provider: "TGS", period: "2026-06", station_code: "SAW", flights: 10, passengers: 1000, source_row: 2, created_at: timestamp });
  database.insert("audit_logs", { id: "retained-audit", tenant_id: "tenant-b", workspace_id: "data-workspace", user_id: "legacy-analyst", action: "upload.create", target_type: "upload", target_id: "retained-upload", created_at: timestamp });
  database.insert("port_mapping_history", { id: "retained-mapping", station_code: "SAW", action: "port.map", changed_by: "legacy-analyst", created_at: timestamp });
  database.insert("ports", { id: "port-saw", region_code: "marmara", region_name: "Marmara", country_code: "TR", country_name: "Türkiye", city_name: "İstanbul", station_code: "SAW", station_name: "Sabiha Gökçen", iata_code: "SAW", airport_name: "İstanbul Sabiha Gökçen Havalimanı", city_id: "city-istanbul", country_id: "country-tr", region_id: "reg-marmara" });
  for (const id of ["legacy-owner", "legacy-analyst", ...(targetExists ? ["retained-admin-id"] : [])]) database.insert("user_sessions", { id: `session-${id}`, user_id: id, token_hash: await sha256(`old-${id}`), created_at: timestamp, last_seen_at: timestamp, expires_at: Date.now() + 60_000 });
  return database;
}

test("reset retains the administrator ID, archives every other account and revokes every session", async (t) => {
  const database = await fixture(t);
  const result = await resetAccounts(request());
  assert.equal(result.ok, true);
  const rows = database.rows("users");
  assert.deepEqual(rows.filter((user) => user.status === "active" && user.archived_at === null).map((user) => user.email), ["madiyaman@ajet.com"]);
  const administrator = rows.find((user) => user.email === "madiyaman@ajet.com");
  assert.equal(administrator.id, "retained-admin-id");
  assert.equal(administrator.role_code, "super_admin");
  assert.equal(administrator.force_password_change, 0);
  assert.match(administrator.password_hash, /^\$2[aby]\$12\$/);
  assert.equal(await verifyPassword(newPassword, administrator.password_hash), true);
  assert.equal(await verifyPassword(oldPassword, administrator.password_hash), false);
  assert.ok(rows.every((user) => user.force_logout_at > 0));
  assert.ok(rows.filter((user) => user.id !== administrator.id).every((user) => user.archived_at > 0 && user.status === "inactive"));
  assert.ok(database.rows("user_sessions").every((session) => session.revoked_at > 0));
  assert.deepEqual(database.rows("workspace_members").filter((member) => member.user_id === administrator.id).map((member) => member.workspace_id).sort(), ["data-workspace", "empty-workspace"]);
  assert.equal(JSON.stringify(result).includes("password"), false);
});

test("reset creates the administrator explicitly and preserves workspaces, uploads, records, audits and mappings", async (t) => {
  const database = await fixture(t, { targetExists: false });
  const preserved = Object.fromEntries(["workspaces", "uploads", "station_performance", "port_mapping_history"].map((table) => [table, database.rows(table)]));
  const audit = database.rows("audit_logs")[0];
  await resetAccounts(request());
  for (const [table, rows] of Object.entries(preserved)) assert.deepEqual(database.rows(table), rows);
  assert.deepEqual(database.rows("audit_logs")[0], audit);
  assert.equal(database.rows("audit_logs").filter((row) => row.action === "maintenance.account-reset").length, 1);
  assert.equal(database.rows("users").filter((row) => row.email === "madiyaman@ajet.com").length, 1);
});

test("an unconfigured or incorrect maintenance secret rejects the reset without changing data", async (t) => {
  const database = await fixture(t);
  const before = database.rows("users");
  setRuntimeBindings({ DB: database });
  await assert.rejects(resetAccounts(request()), (error) => error.status === 403);
  setRuntimeBindings({ DB: database, ACCOUNT_RESET_TOKEN: maintenanceToken });
  await assert.rejects(resetAccounts(request(undefined, "incorrect-token")), (error) => error.status === 403);
  assert.deepEqual(database.rows("users"), before);
  assert.deepEqual(database.rows("maintenance_operations"), []);
});

test("reset rejects another email or an invalid password before mutating accounts", async (t) => {
  const database = await fixture(t);
  const before = database.rows("users");
  await assert.rejects(resetAccounts(request({ email: "different@ajet.com", password: newPassword })), (error) => error.status === 400);
  await assert.rejects(resetAccounts(request({ email: "madiyaman@ajet.com", password: "weak" })), (error) => error.status === 400);
  assert.deepEqual(database.rows("users"), before);
});

test("a failed D1 batch rolls back accounts, sessions and the completion marker", async (t) => {
  const database = await fixture(t);
  const users = database.rows("users");
  const sessions = database.rows("user_sessions");
  database.failSql = /INSERT INTO audit_logs/i;
  await assert.rejects(resetAccounts(request()), /Injected D1 failure/);
  assert.deepEqual(database.rows("users"), users);
  assert.deepEqual(database.rows("user_sessions"), sessions);
  assert.deepEqual(database.rows("maintenance_operations"), []);
  database.failSql = null;
  assert.equal((await resetAccounts(request())).ok, true);
});

test("concurrent and later resets cannot execute the operation twice", async (t) => {
  const database = await fixture(t);
  const results = await Promise.allSettled([resetAccounts(request()), resetAccounts(request())]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.find((result) => result.status === "rejected").reason.status, 409);
  await assert.rejects(resetAccounts(request()), (error) => error.status === 409);
  assert.equal(database.rows("maintenance_operations").length, 1);
  assert.equal(database.rows("audit_logs").filter((row) => row.action === "maintenance.account-reset").length, 1);
});

test("revoked cookies and platform identities cannot bypass the reset, and the administrator can choose retained workspaces", async (t) => {
  const database = await fixture(t);
  await resetAccounts(request());
  for (const id of ["legacy-owner", "legacy-analyst", "retained-admin-id"]) {
    const old = new Request("https://example.test/api/platform", { headers: { cookie: `ajet_session=old-${id}`, "oai-authenticated-user-email": "new-platform@ajet.com" } });
    assert.equal(await getSessionIdentity(old), null);
    await assert.rejects(requireActor(old), (error) => error.status === 401);
  }
  await assert.rejects(requireActor(new Request("https://example.test/api/platform", { headers: { "oai-authenticated-user-email": "new-platform@ajet.com" } })), (error) => error.status === 401);
  assert.equal(database.rows("users").some((user) => user.email === "new-platform@ajet.com"), false);
  const administrator = database.rows("users").find((row) => row.email === "madiyaman@ajet.com");
  const session = await createSession(administrator.id, new Request("https://example.test"), administrator.password_hash);
  const cookie = `ajet_session=${session.token}`;
  const actor = await requireActor(new Request("https://example.test/api/platform", { headers: { cookie } }));
  assert.equal(actor.workspaceId, "data-workspace");
  const payload = await getSessionPayload(actor);
  assert.deepEqual(payload.workspaces.map((workspace) => workspace.id), ["data-workspace", "empty-workspace"]);
  const selected = await requireActor(new Request("https://example.test/api/platform?workspaceId=empty-workspace", { headers: { cookie } }));
  assert.equal(selected.workspaceId, "empty-workspace");
  await assert.rejects(requireActor(new Request("https://example.test/api/platform?workspaceId=unjoined-workspace", { headers: { cookie } })), (error) => error.status === 403);
});

test("password login accepts the replacement credentials and rejects archived or bootstrap accounts", async (t) => {
  const database = await fixture(t);
  await resetAccounts(request());
  const good = await login(new Request("https://example.test/api/auth/login", { method: "POST", body: JSON.stringify({ email: "madiyaman@ajet.com", password: newPassword }) }));
  assert.equal(good.status, 200);
  assert.match(good.headers.get("set-cookie"), /ajet_session=/);
  const archived = await login(new Request("https://example.test/api/auth/login", { method: "POST", body: JSON.stringify({ email: "legacy@ajet.com", password: oldPassword }) }));
  assert.equal(archived.status, 401);
  setRuntimeBindings({ DB: database, ACCOUNT_RESET_TOKEN: maintenanceToken, BOOTSTRAP_ADMIN_EMAIL: "bootstrap@ajet.com", BOOTSTRAP_ADMIN_PASSWORD: newPassword });
  const bootstrap = await login(new Request("https://example.test/api/auth/login", { method: "POST", body: JSON.stringify({ email: "bootstrap@ajet.com", password: newPassword }) }));
  assert.equal(bootstrap.status, 401);
  assert.equal(database.rows("users").some((user) => user.email === "bootstrap@ajet.com"), false);
});

test("a login verified before reset cannot create a session using the replaced password hash", async (t) => {
  const database = await fixture(t);
  await resetAccounts(request());
  await assert.rejects(createSession("retained-admin-id", new Request("https://example.test"), oldHash), (error) => error.status === 401);
  await assert.rejects(createSession("legacy-owner", new Request("https://example.test"), oldHash), (error) => error.status === 401);
  assert.ok(database.rows("user_sessions").every((session) => session.revoked_at > 0));
});

test("the maintenance HTTP endpoint protects its secret and returns a noncacheable one-time result", async (t) => {
  const database = await fixture(t);
  const unauthorized = await maintenanceRoute.POST(request(undefined, "incorrect-token"));
  assert.equal(unauthorized.status, 403);
  assert.equal(database.rows("maintenance_operations").length, 0);
  const result = await maintenanceRoute.POST(request());
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.equal(JSON.stringify(await result.json()).includes(newPassword), false);
  const repeated = await maintenanceRoute.POST(request());
  assert.equal(repeated.status, 409);
});
