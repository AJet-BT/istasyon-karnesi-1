import { assertSameOrigin, hashPassword, normalizeEmail, sha256, validatePassword } from "@/lib/server/auth";
import { PlatformError } from "@/lib/server/errors";
import { getRuntimeBindings } from "@/lib/server/runtime-bindings";

export const ACCOUNT_RESET_OPERATION_ID = "ajet-account-reset-v1";
const ADMIN_EMAIL = "madiyaman@ajet.com";

function resetDatabase() {
  const database = getRuntimeBindings().DB;
  if (!database) throw new Error("Account reset requires the D1 database binding.");
  return database;
}

export async function isAccountResetCompleted() {
  const marker = await resetDatabase().prepare("SELECT id FROM maintenance_operations WHERE id = ?")
    .bind(ACCOUNT_RESET_OPERATION_ID).first();
  return Boolean(marker);
}

async function authorizeMaintenance(request: Request) {
  const configured = getRuntimeBindings().ACCOUNT_RESET_TOKEN;
  const supplied = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/)?.[1];
  if (!configured || configured.length < 32 || !supplied) throw new PlatformError("Bakım işlemi için yetki gerekli.", 403);
  const [expected, received] = await Promise.all([sha256(configured), sha256(supplied)]);
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= expected.charCodeAt(index) ^ received.charCodeAt(index);
  if (difference !== 0) throw new PlatformError("Bakım işlemi için yetki gerekli.", 403);
}

export async function resetAccounts(request: Request) {
  await authorizeMaintenance(request);
  assertSameOrigin(request);
  if (await isAccountResetCompleted()) throw new PlatformError("Hesap sıfırlama işlemi daha önce tamamlandı.", 409);
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    throw new PlatformError("Geçerli bir bakım isteği gönderin.");
  }
  if (!body || typeof body !== "object" || normalizeEmail(body.email) !== ADMIN_EMAIL) throw new PlatformError("Bakım işlemi yalnızca belirlenmiş yönetici hesabı için kullanılabilir.");
  if (typeof body.password !== "string" || new TextEncoder().encode(body.password).length > 72) throw new PlatformError("Geçerli bir şifre girin.");
  const password = validatePassword(body.password, ADMIN_EMAIL);
  const passwordHash = await hashPassword(password);
  const timestamp = Date.now();
  const administratorId = `usr_${crypto.randomUUID()}`;
  const database = resetDatabase();
  if (!await database.prepare("SELECT id FROM workspaces LIMIT 1").first()) throw new PlatformError("Korunacak çalışma alanı bulunamadı.", 409);

  // D1 batches are transactions. The fixed primary-key marker is inserted
  // first, so a repeated or concurrent request cannot mutate any accounts.
  const statements = [
    database.prepare("INSERT INTO maintenance_operations (id, completed_at, actor_user_id) VALUES (?, ?, COALESCE((SELECT id FROM users WHERE email = ?), ?))")
      .bind(ACCOUNT_RESET_OPERATION_ID, timestamp, ADMIN_EMAIL, administratorId),
    database.prepare(`INSERT INTO users (id, email, full_name, first_name, last_name, password_hash, force_password_change, password_changed_at, failed_login_attempts, locked_until, role_code, status, data_scope, created_by_user_id, archived_at, archived_by_user_id, force_logout_at, created_at, updated_at)
      VALUES (?, ?, 'AJet Sistem Yöneticisi', 'AJet', 'Sistem Yöneticisi', ?, 0, ?, 0, NULL, 'super_admin', 'active', 'tenant', ?, NULL, NULL, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, force_password_change = 0, password_changed_at = excluded.password_changed_at,
      failed_login_attempts = 0, locked_until = NULL, role_code = 'super_admin', status = 'active', data_scope = 'tenant', archived_at = NULL, archived_by_user_id = NULL,
      force_logout_at = excluded.force_logout_at, updated_at = excluded.updated_at`)
      .bind(administratorId, ADMIN_EMAIL, passwordHash, timestamp, administratorId, timestamp, timestamp, timestamp),
    database.prepare(`UPDATE users SET status = 'inactive', archived_at = COALESCE(archived_at, ?),
      archived_by_user_id = COALESCE(archived_by_user_id, (SELECT id FROM users WHERE email = ?)), force_logout_at = ?, updated_at = ? WHERE email <> ?`)
      .bind(timestamp, ADMIN_EMAIL, timestamp, timestamp, ADMIN_EMAIL),
    database.prepare("UPDATE user_sessions SET revoked_at = COALESCE(revoked_at, ?)").bind(timestamp),
    database.prepare(`INSERT INTO workspace_members (workspace_id, user_id, access_level)
      SELECT id, (SELECT id FROM users WHERE email = ?), 'owner' FROM workspaces WHERE 1
      ON CONFLICT(workspace_id, user_id) DO UPDATE SET access_level = 'owner'`).bind(ADMIN_EMAIL),
    database.prepare("INSERT INTO user_preferences (user_id, updated_at) SELECT id, ? FROM users WHERE email = ? ON CONFLICT(user_id) DO NOTHING").bind(timestamp, ADMIN_EMAIL),
    database.prepare("INSERT INTO roles (code, name, description) VALUES ('super_admin', 'Sistem Yöneticisi', 'Tüm çalışma alanlarına ve sistem ayarlarına erişir.') ON CONFLICT(code) DO NOTHING"),
    database.prepare("INSERT INTO role_permissions (role_code, permission_code) SELECT 'super_admin', code FROM permissions WHERE 1 ON CONFLICT(role_code, permission_code) DO NOTHING"),
    database.prepare(`INSERT INTO audit_logs (id, tenant_id, workspace_id, user_id, action, target_type, target_id, new_value, session_info, result, created_at)
      SELECT ?, tenant_id, id, (SELECT id FROM users WHERE email = ?), 'maintenance.account-reset', 'system', ?, ?, 'controlled-maintenance', 'success', ?
      FROM workspaces ORDER BY (SELECT COUNT(*) FROM uploads WHERE uploads.workspace_id = workspaces.id) DESC, created_at ASC, id ASC LIMIT 1`)
      .bind(crypto.randomUUID(), ADMIN_EMAIL, ACCOUNT_RESET_OPERATION_ID, JSON.stringify({ administratorEmail: ADMIN_EMAIL, otherAccountsArchived: true, retainedData: true }), timestamp),
  ];
  try {
    await database.batch(statements);
  } catch (error) {
    if (await isAccountResetCompleted()) throw new PlatformError("Hesap sıfırlama işlemi daha önce tamamlandı.", 409);
    throw error;
  }
  return { ok: true, operationId: ACCOUNT_RESET_OPERATION_ID, administratorEmail: ADMIN_EMAIL };
}
