import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test, { after } from "node:test";
import { build } from "esbuild";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import XLSX from "xlsx";
import { detectWorkbook } from "../lib/workbook-import.ts";

await mkdir(new URL("../work/", import.meta.url), { recursive: true });
const scratch = await mkdtemp(new URL("../work/import-test-", import.meta.url).pathname.replace(/^\/(?:([A-Z]:))/, "$1"));
const entry = join(scratch, "entry.ts");
await writeFile(entry, 'export { importWorkbook, reprocessUpload, createExportJob, getDashboardPayload } from "../../lib/server/platform"; export { setRuntimeBindings } from "../../lib/server/runtime-bindings"; export * as schema from "../../db/schema";');
await build({ entryPoints: [entry], outfile: join(scratch, "server.mjs"), bundle: true, packages: "external", platform: "node", format: "esm", tsconfig: new URL("../tsconfig.json", import.meta.url).pathname.replace(/^\/(?:([A-Z]:))/, "$1"), plugins: [{ name: "request-header-adapter", setup(builder) {
  builder.onResolve({ filter: /chatgpt-auth$/ }, () => ({ path: "test-auth", namespace: "auth" }));
  builder.onLoad({ filter: /.*/, namespace: "auth" }, () => ({ contents: "export async function getChatGPTUser() { return null; }", loader: "js" }));
} }] });
const server = await import(pathToFileURL(join(scratch, "server.mjs")));
after(() => rm(scratch, { recursive: true, force: true }));

const actor = { id: "owner", tenantId: "tenant", workspaceId: "workspace", roleCode: "data_manager", isAdmin: false };
function setup({ concurrentPuts = 0 } = {}) {
  const sqlite = new DatabaseSync(":memory:");
  for (const table of Object.values(server.schema)) {
    const config = getTableConfig(table);
    const columns = config.columns.map((column) => {
      const defaultValue = column.default === undefined ? "" : ` DEFAULT ${typeof column.default === "string" ? `'${column.default.replaceAll("'", "''")}'` : Number(column.default)}`;
      return `"${column.name}" ${column.getSQLType()}${column.notNull ? " NOT NULL" : ""}${defaultValue}`;
    });
    sqlite.exec(`CREATE TABLE "${config.name}" (${columns.join(",")})`);
  }
  sqlite.prepare("INSERT INTO role_permissions (role_code,permission_code) VALUES (?,?)").run("data_manager", "upload.create");
  sqlite.prepare("INSERT INTO role_permissions (role_code,permission_code) VALUES (?,?)").run("data_manager", "export.pdf");
  sqlite.prepare("INSERT INTO role_permissions (role_code,permission_code) VALUES (?,?)").run("data_manager", "export.excel");
  sqlite.prepare("INSERT INTO role_permissions (role_code,permission_code) VALUES (?,?)").run("data_manager", "dashboard.view");
  const objects = new Map();
  let releasePuts;
  let putCount = 0;
  const putsReady = concurrentPuts ? new Promise((resolve) => { releasePuts = resolve; }) : Promise.resolve();
  const bucket = {
    async put(key, bytes, options) {
      objects.set(key, { bytes: bytes.slice(0), httpMetadata: options?.httpMetadata });
      if (++putCount >= concurrentPuts) releasePuts?.();
      await putsReady;
    },
    async get(key) { const stored = objects.get(key); return stored ? { arrayBuffer: async () => stored.bytes.slice(0), httpMetadata: stored.httpMetadata } : null; },
    async delete(key) { objects.delete(key); },
  };
  function prepare(query, params = []) {
    return {
      bind(...values) { return prepare(query, values); },
      async raw() { const statement = sqlite.prepare(query); statement.setReturnArrays(true); return statement.all(...params); },
      async all() { return { results: sqlite.prepare(query).all(...params), success: true }; },
      async run() { const changes = sqlite.prepare(query).run(...params); return { results: [], success: true, meta: { changes: Number(changes.changes) } }; },
    };
  }
  let pendingBatch = Promise.resolve();
  const db = { prepare, async batch(statements) {
    // A single D1 database serializes each atomic batch; permit overlapping import requests.
    const next = pendingBatch.then(async () => {
      sqlite.exec("BEGIN");
      try { const results = []; for (const statement of statements) results.push(await statement.all()); sqlite.exec("COMMIT"); return results; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    });
    pendingBatch = next.catch(() => {});
    return next;
  } };
  server.setRuntimeBindings({ DB: db, BUCKET: bucket });
  return { sqlite, objects };
}
const titles = ["ISTASYON", "FLIGHT", "Extgoms–Okunmayan Doküman Sayısı", "Yolcu Sayısı", "Vize Pasaport Doküman Aksaklıkları", "Emniyet Raporlaması", "Hasar Raporlama GSE", "Dijital Biniş Kartı Kullanım Oranı", "DOC", "DAM", "LOST", "OTP", "OTA"];
function fileFor(value = 0, passengers = 100) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Documentation"]]), "Açıklama");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["TGS Haziran 2026"], titles, ["SAW", 10, value, passengers, 2, 3, 1, "75%", 0.01, 0.01, 0.02, 0.9, 0.8]]), "Veri");
  return { file: new File([XLSX.write(book, { type: "array", bookType: "xlsx" })], "rapor.xlsx"), selection: detectWorkbook(book, "rapor.xlsx").selection };
}

test("atomic import stores custom title selected sheet nullable metrics and reprocessing selection", async () => {
  const { sqlite } = setup();
  const { file, selection } = fileFor();
  const imported = await server.importWorkbook(actor, file, { title: "Haziran İstasyonları", selection });
  const upload = sqlite.prepare("SELECT * FROM uploads WHERE id=?").get(imported.uploadId);
  assert.equal(upload.title, "Haziran İstasyonları");
  assert.equal(upload.source_sheet, "Veri");
  assert.deepEqual(JSON.parse(upload.import_selection), selection);
  const row = sqlite.prepare("SELECT * FROM station_performance WHERE upload_id=?").get(imported.uploadId);
  assert.equal(row.passengers, 100);
  assert.equal(row.unread_documents, 0);
  assert.equal(row.safety_reports, 3);
  assert.equal(row.digital_boarding_ratio, 0.75);
  const reprocessed = await server.reprocessUpload(actor, imported.uploadId);
  const next = sqlite.prepare("SELECT * FROM uploads WHERE id=?").get(reprocessed.uploadId);
  assert.equal(next.title, "Haziran İstasyonları");
  assert.equal(next.import_selection, upload.import_selection);
  assert.equal(next.version_number, 2);
  assert.equal(sqlite.prepare("SELECT count(*) AS count FROM uploads WHERE is_active_version=1").get().count, 1);
  assert.equal(sqlite.prepare("SELECT digital_boarding_ratio FROM station_performance WHERE upload_id=?").get(reprocessed.uploadId).digital_boarding_ratio, 0.75);
  sqlite.close();
});

test("failed station persistence preserves the prior active upload and removes the uploaded object", async () => {
  const { sqlite, objects } = setup();
  const initial = fileFor();
  const first = await server.importWorkbook(actor, initial.file, { title: "Başlangıç", selection: initial.selection });
  sqlite.exec("CREATE TRIGGER reject_metric BEFORE INSERT ON station_performance WHEN NEW.unread_documents=7 BEGIN SELECT RAISE(ABORT,'rejected measurement'); END");
  const failing = fileFor(7);
  await assert.rejects(server.importWorkbook(actor, failing.file, { title: "Yeni veri", selection: failing.selection }), /rejected measurement/);
  assert.equal(sqlite.prepare("SELECT count(*) AS count FROM uploads").get().count, 1);
  assert.equal(sqlite.prepare("SELECT is_active_version FROM uploads WHERE id=?").get(first.uploadId).is_active_version, 1);
  assert.equal(sqlite.prepare("SELECT count(*) AS count FROM station_performance").get().count, 1);
  assert.equal(sqlite.prepare("SELECT count(*) AS count FROM audit_logs").get().count, 1);
  assert.equal(objects.size, 1);
  sqlite.close();
});

test("PDF history records preparation and test inclusion only from the rendered snapshot scope", async () => {
  const { sqlite } = setup();
  const reportSnapshot = { scope: "summary", generatedAt: Date.now(), records: [{ isTestData: false }], comparison: [], history: [{ isTestData: true }], issues: [], filters: {} };
  const summary = await server.createExportJob(actor, { type: "pdf", fileName: "Rapor.pdf", reportSnapshot, includeTestData: true });
  const summaryJob = sqlite.prepare("SELECT * FROM export_jobs WHERE id=?").get(summary.id);
  assert.equal(summaryJob.status, "prepared");
  assert.equal(summaryJob.include_test_data, 0);
  const full = await server.createExportJob(actor, { type: "pdf", fileName: "Rapor.pdf", reportSnapshot: { ...reportSnapshot, scope: "full" }, includeTestData: false });
  assert.equal(sqlite.prepare("SELECT include_test_data FROM export_jobs WHERE id=?").get(full.id).include_test_data, 1);
  await assert.rejects(server.createExportJob(actor, { type: "pdf", reportSnapshot: { ...reportSnapshot, scope: "unknown" } }), /kapsam/i);
  sqlite.close();
});

test("missing passenger count remains null through persistence and dashboard while reported zero survives", async () => {
  const { sqlite } = setup();
  const missing = fileFor(0, "");
  const imported = await server.importWorkbook(actor, missing.file, { title: "Eksik yolcu", selection: missing.selection });
  const stored = sqlite.prepare("SELECT passengers,damaged_count,lost_count,unread_documents FROM station_performance WHERE upload_id=?").get(imported.uploadId);
  assert.equal(stored.passengers, null);
  assert.equal(stored.damaged_count, null);
  assert.equal(stored.lost_count, null);
  assert.equal(stored.unread_documents, 0);
  const dashboard = await server.getDashboardPayload(actor, { period: "2026-06" });
  assert.equal(dashboard.current[0].passengers, null);
  assert.equal(dashboard.current[0].unreadDocuments, 0);
  assert.equal(dashboard.current[0].sourceTitle, "Eksik yolcu");
  const zero = fileFor(0, 0);
  const next = await server.importWorkbook(actor, zero.file, { title: "Raporlanan sıfır", selection: zero.selection });
  assert.equal(sqlite.prepare("SELECT passengers FROM station_performance WHERE upload_id=?").get(next.uploadId).passengers, 0);
  sqlite.close();
});

test("CSV history marks completed bytes and derives test-data inclusion from exported records", async () => {
  const { sqlite } = setup();
  const exported = await server.createExportJob(actor, { type: "csv", fileName: "veri.csv", sizeBytes: 100, records: [{ isTestData: true }], includeTestData: false });
  const job = sqlite.prepare("SELECT status,include_test_data,size_bytes FROM export_jobs WHERE id=?").get(exported.id);
  assert.equal(job.status, "completed");
  assert.equal(job.include_test_data, 1);
  assert.equal(job.size_bytes, 100);
  await assert.rejects(server.createExportJob(actor, { type: "csv", records: [{ isTestData: "false" }] }), /kayıtları/i);
  sqlite.close();
});

test("two simultaneous first imports commit unique versions and exactly one active upload", async () => {
  const { sqlite } = setup({ concurrentPuts: 2 });
  const first = fileFor(1);
  const second = fileFor(2);
  const responses = await Promise.all([
    server.importWorkbook(actor, first.file, { title: "İlk eşzamanlı veri", selection: first.selection }),
    server.importWorkbook(actor, second.file, { title: "İkinci eşzamanlı veri", selection: second.selection }),
  ]);
  const committed = sqlite.prepare("SELECT id,version_number,mapping_version,is_active_version,replaces_upload_id FROM uploads ORDER BY version_number").all();
  assert.deepEqual(committed.map((upload) => upload.version_number), [1, 2]);
  assert.deepEqual(committed.map((upload) => upload.is_active_version), [0, 1]);
  assert.equal(committed[0].replaces_upload_id, null);
  assert.equal(committed[1].replaces_upload_id, committed[0].id);
  assert.deepEqual(committed.map((upload) => upload.mapping_version), ["TGS-v1.0", "TGS-v2.0"]);
  for (const response of responses) assert.equal(response.versionNumber, committed.find((upload) => upload.id === response.uploadId).version_number);
  const latestAudit = sqlite.prepare("SELECT previous_value,new_value FROM audit_logs WHERE target_id=?").get(committed[1].id);
  assert.equal(JSON.parse(latestAudit.previous_value).activeUploadId, committed[0].id);
  assert.equal(JSON.parse(latestAudit.new_value).versionNumber, 2);
  assert.equal(sqlite.prepare("SELECT count(*) AS count FROM station_performance").get().count, 2);
  sqlite.close();
});

test("reprocessing an older source makes a fresh version after the current head", async () => {
  const { sqlite } = setup();
  const source = fileFor(1);
  const newer = fileFor(2);
  const original = await server.importWorkbook(actor, source.file, { title: "Özgün kaynak", selection: source.selection });
  const current = await server.importWorkbook(actor, newer.file, { title: "Güncel kaynak", selection: newer.selection });
  const reprocessed = await server.reprocessUpload(actor, original.uploadId);
  const saved = sqlite.prepare("SELECT version_number,replaces_upload_id,title FROM uploads WHERE id=?").get(reprocessed.uploadId);
  assert.equal(saved.version_number, 3);
  assert.equal(saved.replaces_upload_id, current.uploadId);
  assert.equal(saved.title, "Özgün kaynak");
  assert.equal(sqlite.prepare("SELECT unread_documents FROM station_performance WHERE upload_id=?").get(reprocessed.uploadId).unread_documents, 1);
  assert.equal(JSON.parse(sqlite.prepare("SELECT new_value FROM audit_logs WHERE action='upload.reprocess'").get().new_value).versionNumber, 3);
  sqlite.close();
});

test("quality completeness counts every operational metric including missing legacy fields", async () => {
  const { sqlite } = setup();
  const source = fileFor();
  await server.importWorkbook(actor, source.file, { title: "Kısmi rapor", selection: source.selection });
  const dashboard = await server.getDashboardPayload(actor, { period: "2026-06" });
  // 12 of 16 measurements are supplied; delay, safety, secondary safety and complaint are absent.
  assert.equal(dashboard.quality.components.completeness, 75);
  sqlite.close();
});
