import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import XLSX from "xlsx";
import { detectWorkbook, parseWorkbook } from "../lib/workbook-import.ts";
import { MOCK_PERIODS, mockFileName } from "../scripts/mock-data-fixture.mjs";

test("platform routes authenticate every method and storage is workspace scoped", async () => {
  const route = await readFile(new URL("../app/api/platform/route.ts", import.meta.url), "utf8");
  const server = await readFile(new URL("../lib/server/platform.ts", import.meta.url), "utf8");
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");

  assert.equal((route.match(/const actor = await requireActor\(request\);/g) ?? []).length, 4);
  assert.match(server, /eq\(stationPerformance\.workspaceId, actor\.workspaceId\)/);
  assert.match(server, /eq\(uploads\.workspaceId, actor\.workspaceId\)/);
  assert.match(server, /ownerUserId: actor\.id/);
  assert.match(schema, /tenantId: text\("tenant_id"\)\.notNull\(\)/);
  assert.match(schema, /workspaceId: text\("workspace_id"\)\.notNull\(\)/);
  assert.match(schema, /deletedAt: integer\("deleted_at"\)/);
});

test("dashboard bootstrap avoids repeated D1 seed writes and cannot remain loading forever", async () => {
  const server = await readFile(new URL("../lib/server/platform.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(server, /async function referenceDataIsReady\(\)/);
  assert.match(server, /if \(await referenceDataIsReady\(\)\) return;/);
  assert.match(server, /where\(eq\(ports\.stationCode, "SAW"\)\)/);
  assert.match(page, /requestTimedOut = true;/);
  assert.match(page, /15_000/);
  assert.match(page, /Veri isteği zaman aşımına uğradı/);
});

test("password authentication and admin RBAC are implemented server-side", async () => {
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  const auth = await readFile(new URL("../lib/server/auth.ts", import.meta.url), "utf8");
  const admin = await readFile(new URL("../lib/server/admin.ts", import.meta.url), "utf8");
  const adminRoute = await readFile(new URL("../app/api/admin/users/route.ts", import.meta.url), "utf8");
  const loginRoute = await readFile(new URL("../app/api/auth/login/route.ts", import.meta.url), "utf8");

  assert.match(schema, /passwordHash: text\("password_hash"\)/);
  assert.match(schema, /export const userSessions/);
  assert.match(auth, /hash\(password, BCRYPT_COST\)/);
  assert.match(auth, /HttpOnly; Secure; SameSite=Strict/);
  assert.match(loginRoute, /verifyPassword\(password, user.passwordHash\)/);
  assert.match(adminRoute, /adminActor\(request, true\)/);
  assert.match(admin, /requireAdmin\(actor\)/);
  assert.match(admin, /await revokeSessions\(id\)/);
  assert.doesNotMatch(admin, /return \{[^}]*passwordHash/);
});

test("admin panel is separate and new users receive isolated workspaces", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const panel = await readFile(new URL("../app/admin-panel.tsx", import.meta.url), "utf8");
  const admin = await readFile(new URL("../lib/server/admin.ts", import.meta.url), "utf8");
  const upload = await readFile(new URL("../app/dataset-upload.tsx", import.meta.url), "utf8");

  assert.match(page, /label: "Yönetim"/);
  assert.match(page, /label: "Kullanıcı ve Erişim Yönetimi"/);
  assert.match(page, /item\.key === "management" \|\| item\.key === "admin"/);
  assert.match(panel, /Kullanıcılar/);
  assert.match(panel, /Yeni Kullanıcı/);
  assert.match(panel, /Roller ve Yetkiler/);
  assert.match(panel, /Kullanıcı Aktiviteleri/);
  assert.match(panel, /Pasif Kullanıcılar/);
  assert.match(admin, /db\.insert\(workspaces\)/);
  assert.match(admin, /db\.insert\(workspaceMembers\)/);
  assert.match(upload, /Henüz veri yüklenmedi\./);
  assert.match(page, /yeni bir Excel dosyası yükleyebilirsiniz/);
});

test("12-month mock reset uses the real workbook import and mapping pipeline", async () => {
  const server = await readFile(new URL("../lib/server/platform.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(server, /missingMockPeriods/);
  assert.match(server, /ENABLE_TEST_DATA_AUTO_IMPORT === "true"/);
  assert.match(server, /AJet_TGS_\\d\{4\}-\\d\{2\}_test_mock/);
  assert.match(server, /parseWorkbook\(workbook, selection\)/);
  let importedRows = 0;
  for (const period of MOCK_PERIODS) {
    const fileName = mockFileName(period);
    const workbook = XLSX.read(await readFile(new URL(`../public/mock-data/${fileName}`, import.meta.url)), { type: "buffer", cellNF: true });
    const detected = detectWorkbook(workbook, fileName);
    assert.equal(detected.needsReview, false, fileName);
    assert.equal(detected.selection.period, period);
    assert.equal(detected.selection.provider, "TGS");
    const parsed = parseWorkbook(workbook, detected.selection);
    assert.equal(parsed.errorCount, 0, fileName);
    assert.equal(parsed.rows.length, 7);
    for (const row of parsed.rows) {
      assert.equal(row.damagedCount, Math.round(row.damagedRatio * row.passengers));
      assert.equal(row.safetyCount, Math.round(row.safetyRatio * row.flights));
    }
    importedRows += parsed.rows.length;
  }
  assert.equal(importedRows, 84);
  assert.match(page, /for \(const mockPeriod of payload\.missingMockPeriods\)/);
  assert.match(page, /fetch\(`\/mock-data\/\$\{fileName\}`\)/);
  assert.match(page, /fetch\("\/api\/platform", \{ method: "POST", body: form \}\)/);
});

test("production upload validation and response hardening remain enabled", async () => {
  const server = await readFile(new URL("../lib/server/platform.ts", import.meta.url), "utf8");
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  assert.match(server, /file\.size === 0/);
  assert.match(server, /Dosya içeriği geçerli bir XLSX dosyası değil/);
  const workbook = { SheetNames: ["Veri"], Sheets: { Veri: XLSX.utils.aoa_to_sheet([["TGS"], ["STATION_CODE", "FLIGHT"], ["SAW", 10]]) } };
  const detected = detectWorkbook(workbook, "rapor.xlsx");
  assert.equal(detected.needsReview, true);
  assert.ok(detected.issues.some((issue) => issue.field === "period" && issue.level === "error"));
  assert.match(worker, /X-Content-Type-Options/);
  assert.match(worker, /Strict-Transport-Security/);
  assert.match(worker, /Cache-Control", "private, no-store"/);
});

test("shared workbook import preserves the canonical STATION_CODE mapping", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const server = await readFile(new URL("../lib/server/platform.ts", import.meta.url), "utf8");
  const workbook = { SheetNames: ["Veri"], Sheets: { Veri: XLSX.utils.aoa_to_sheet([["TGS Haziran 2026"], ["STATION_CODE", "FLIGHT"], ["SAW", 10]]) } };
  const detected = detectWorkbook(workbook, "rapor.xlsx");
  assert.equal(detected.selection.mappings.stationCode, 0);
  assert.equal(parseWorkbook(workbook, detected.selection).rows[0].stationCode, "SAW");
  assert.match(server, /\^AJet_TGS_\\d\{4\}-\\d\{2\}_test_mock\\\.xlsx\$\/i/);
  assert.match(page, /OverviewTrend[^>]+onSelect=\{setSelectedKpi\}/);
});
