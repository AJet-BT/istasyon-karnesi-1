/** Shared by browser preview, server import and stored-file reprocessing. */
export const METRIC_HEADERS = {
  unreadDocuments: "Extgoms–Okunmayan Doküman Sayısı",
  passengers: "Yolcu Sayısı",
  visaPassportIssues: "Vize Pasaport Doküman Aksaklıkları",
  safetyReports: "Emniyet Raporlaması",
  gseDamageReports: "Hasar Raporlama GSE",
  digitalBoardingRatio: "Dijital Biniş Kartı Kullanım Oranı",
} as const;

export const IMPORT_FIELDS = [
  "stationCode", "flights", "passengers", "delayMinutes", "docRatio", "docCount",
  "internationalPassengers", "damagedRatio", "damagedCount", "lostRatio", "lostCount",
  "safetyRatio", "safetyCount", "nonSafetyRatio", "nonSafetyCount", "safetyReports",
  "otpRatio", "otaRatio", "complaintDays", "unreadDocuments", "visaPassportIssues",
  "gseDamageReports", "digitalBoardingRatio",
] as const;
export type ImportField = typeof IMPORT_FIELDS[number];
export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  stationCode: "İstasyon Kodu", flights: "Toplam Uçuş", delayMinutes: "Toplam Tehir",
  docRatio: "Doküman Hata Oranı", docCount: "Doküman Hata Sayısı", internationalPassengers: "Dış Hat Yolcu Sayısı",
  damagedRatio: "Hasarlı Bagaj Oranı", damagedCount: "Hasarlı Bagaj Sayısı", lostRatio: "Kayıp Bagaj Oranı", lostCount: "Kayıp Bagaj Sayısı",
  safetyRatio: "Safety %", safetyCount: "Safety Olay Sayısı", nonSafetyRatio: "İkincil Safety %", nonSafetyCount: "İkincil Safety Olay Sayısı",
  otpRatio: "OTP", otaRatio: "OTA", complaintDays: "Şikâyet Dönüş Süresi", ...METRIC_HEADERS,
};
type NumericField = Exclude<ImportField, "stationCode">;
export type ImportSelection = {
  sheetName: string;
  /** Actual Excel row number, starting at 1. */
  headerRow: number;
  /** Actual column positions, starting at 0; duplicate header text is never an identity. */
  mappings: Partial<Record<ImportField, number>>;
  provider: string | null;
  period: string | null;
};
export type WorkbookSource = { SheetNames: string[]; Sheets: Record<string, Record<string, unknown>> };
export type ImportIssue = { level: "error" | "warning"; code: string; message: string; field?: ImportField | "provider" | "period"; sourceRow?: number };
export type ImportColumn = { index: number; label: string; field: ImportField | null };
export type SheetCandidate = { sheetName: string; headerRow: number; score: number; columns: ImportColumn[]; mappings: Partial<Record<ImportField, number>>; duplicateFields: ImportField[] };
export type WorkbookDetection = {
  selection: ImportSelection | null;
  candidates: SheetCandidate[];
  columns: ImportColumn[];
  issues: ImportIssue[];
  needsReview: boolean;
  providerCandidates: string[];
  periodCandidates: string[];
};
export type ImportedRow = { stationCode: string; sourceRow: number } & Record<NumericField, number | null>;
export type WorkbookParseResult = { selection: ImportSelection | null; rows: ImportedRow[]; issues: ImportIssue[]; errorCount: number; warningCount: number };
type Cell = { v?: unknown; t?: string; z?: string; w?: string };

function fold(value: unknown) {
  return String(value ?? "").trim().toLocaleUpperCase("tr-TR")
    .replaceAll("İ", "I").replaceAll("Ş", "S").replaceAll("Ğ", "G")
    .replaceAll("Ü", "U").replaceAll("Ö", "O").replaceAll("Ç", "C");
}
export function normalizeImportHeader(value: unknown) { return fold(value).replace(/[^A-Z0-9]/g, ""); }

const aliases: Record<string, ImportField> = {
  ISTASYON: "stationCode", ISTASYONKODU: "stationCode", STATION: "stationCode", STATIONCODE: "stationCode", HAVAS: "stationCode",
  FLIGHT: "flights", FLIGHTS: "flights", UCUS: "flights", UCUSSAYISI: "flights",
  DELAY: "delayMinutes", TEHIR: "delayMinutes", DOC: "docRatio", DAM: "damagedRatio", DPR: "damagedRatio",
  LOST: "lostRatio", AHL: "lostRatio", IRSAFE: "safetyRatio", NIRSAFE: "nonSafetyRatio",
  SAFE: "safetyReports", OTP: "otpRatio", OTA: "otaRatio", COMP: "complaintDays", PASS: "passengers", YOLCU: "passengers",
  DOCCOUNT: "docCount", INTERNATIONALPASSENGERS: "internationalPassengers", DAMAGEDCOUNT: "damagedCount", LOSTCOUNT: "lostCount",
  SAFETYCOUNT: "safetyCount", NONSAFETYCOUNT: "nonSafetyCount",
  ...Object.fromEntries(Object.entries(METRIC_HEADERS).map(([field, label]) => [normalizeImportHeader(label), field as ImportField])),
};
const countFields = new Set<ImportField>(["flights", "passengers", "docCount", "internationalPassengers", "damagedCount", "lostCount", "safetyCount", "nonSafetyCount", "safetyReports", "unreadDocuments", "visaPassportIssues", "gseDamageReports"]);
const ratioFields = new Set<ImportField>(["docRatio", "damagedRatio", "lostRatio", "safetyRatio", "nonSafetyRatio", "otpRatio", "otaRatio", "digitalBoardingRatio"]);
const monthNames = ["OCAK", "SUBAT", "MART", "NISAN", "MAYIS", "HAZIRAN", "TEMMUZ", "AGUSTOS", "EYLUL", "EKIM", "KASIM", "ARALIK"];

function columnName(index: number): string {
  let name = "";
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) name = String.fromCharCode(65 + (value - 1) % 26) + name;
  return name;
}
function address(value: string) {
  const matched = value.replaceAll("$", "").match(/^([A-Z]+)(\d+)$/i);
  if (!matched) return null;
  let column = 0;
  for (const letter of matched[1].toUpperCase()) column = column * 26 + letter.charCodeAt(0) - 64;
  return { column: column - 1, row: Number(matched[2]) };
}
function bounds(sheet: Record<string, unknown>) {
  const reference = typeof sheet["!ref"] === "string" ? sheet["!ref"] : "";
  const [start, end = start] = reference.split(":");
  const first = address(start);
  const last = address(end);
  return first && last ? { firstRow: first.row, lastRow: last.row, lastColumn: last.column } : null;
}
function cellAt(sheet: Record<string, unknown>, row: number, column: number): Cell {
  const value = sheet[`${columnName(column)}${row}`];
  return value && typeof value === "object" ? value as Cell : {};
}
function candidateAt(sheetName: string, sheet: Record<string, unknown>, headerRow: number): SheetCandidate {
  const extent = bounds(sheet);
  const columns: ImportColumn[] = [];
  const matches: Partial<Record<ImportField, number[]>> = {};
  for (let index = 0; index <= Math.min(extent?.lastColumn ?? 0, 511); index++) {
    const label = String(cellAt(sheet, headerRow, index).v ?? "").trim();
    const field = aliases[normalizeImportHeader(label)] ?? null;
    columns.push({ index, label, field });
    if (field) (matches[field] ??= []).push(index);
  }
  const mappings: Partial<Record<ImportField, number>> = {};
  const duplicateFields: ImportField[] = [];
  for (const field of IMPORT_FIELDS) {
    if (matches[field]?.length === 1) mappings[field] = matches[field]?.[0];
    else if ((matches[field]?.length ?? 0) > 1) duplicateFields.push(field);
  }
  return { sheetName, headerRow, score: Object.keys(matches).length, columns, mappings, duplicateFields };
}
function contextFor(sheet: Record<string, unknown>, headerRow: number) {
  const lines: string[] = [];
  const extent = bounds(sheet);
  for (let row = Math.max(extent?.firstRow ?? 1, headerRow - 100); row < headerRow; row++) {
    const cells: string[] = [];
    for (let column = 0; column <= Math.min(extent?.lastColumn ?? 0, 511); column++) {
      const value = cellAt(sheet, row, column).v;
      if (value !== null && value !== undefined && value !== "") cells.push(String(value));
    }
    lines.push(cells.join(" "));
  }
  return lines;
}
function detectMetadata(lines: string[]) {
  const providerSet = new Set<string>();
  const periodSet = new Set<string>();
  const contextYears = new Set<string>();
  const contextMonths = new Set<string>();
  for (const line of lines) {
    const normalized = fold(line).replaceAll("_", " ");
    for (const [pattern, canonical] of [[/\bTGS\b/, "TGS"], [/\bHAVAS\b/, "Havaş"], [/\bCELEBI\b/, "Çelebi"]] as const) {
      if (pattern.test(normalized)) providerSet.add(canonical);
    }
    const labeled = line.match(/(?:handling\s*provider|hizmet\s*sağlayıcı|yer\s*hizmetleri\s*(?:şirketi|sağlayıcısı))\s*[:=\-]?\s*(.+)$/iu);
    if (labeled && !/\b(?:TGS|HAVAS|CELEBI)\b/.test(fold(labeled[1]))) providerSet.add(labeled[1].trim());
    for (const match of normalized.matchAll(/\b((?:19|20|21)\d{2})\s*[-/.]\s*(0?[1-9]|1[0-2])\b/g)) periodSet.add(`${match[1]}-${match[2].padStart(2, "0")}`);
    const years = [...normalized.matchAll(/\b((?:19|20|21)\d{2})\b/g)].map((match) => match[1]);
    for (const year of years) contextYears.add(year);
    monthNames.forEach((month, index) => {
      if (new RegExp(`\\b${month}\\b`).test(normalized)) {
        const monthNumber = String(index + 1).padStart(2, "0");
        contextMonths.add(monthNumber);
        for (const year of years) periodSet.add(`${year}-${monthNumber}`);
      }
    });
  }
  if (!periodSet.size && contextYears.size === 1 && contextMonths.size === 1) periodSet.add(`${[...contextYears][0]}-${[...contextMonths][0]}`);
  return { providerCandidates: [...providerSet], periodCandidates: [...periodSet] };
}
function metadataIssues(selection: ImportSelection): ImportIssue[] {
  const issues: ImportIssue[] = [];
  if (!selection.provider || typeof selection.provider !== "string" || selection.provider.length > 80 || /[\u0000-\u001f\u007f]/.test(selection.provider)) issues.push({ level: "error", code: "provider_required", field: "provider", message: "Handling Provider algılanamadı veya belirsiz; gelişmiş seçeneklerden doğrulayın." });
  if (!selection.period || !/^\d{4}-(0[1-9]|1[0-2])$/.test(selection.period)) issues.push({ level: "error", code: "period_required", field: "period", message: "Raporlama dönemi algılanamadı veya belirsiz; gelişmiş seçeneklerden doğrulayın." });
  return issues;
}
export function detectWorkbook(workbook: WorkbookSource, fileName: string, explicit: Partial<ImportSelection> = {}): WorkbookDetection {
  const candidates: SheetCandidate[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const extent = bounds(sheet);
    if (!extent) continue;
    for (let row = extent.firstRow; row <= Math.min(extent.lastRow, extent.firstRow + 99); row++) {
      const candidate = candidateAt(sheetName, sheet, row);
      if (candidate.columns.some((column) => column.field === "stationCode") && candidate.columns.some((column) => column.field === "flights")) candidates.push(candidate);
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  let eligible = candidates.filter((candidate) => (!explicit.sheetName || candidate.sheetName === explicit.sheetName) && (explicit.headerRow === undefined || candidate.headerRow === explicit.headerRow));
  if (explicit.sheetName && explicit.headerRow !== undefined && workbook.Sheets[explicit.sheetName]) {
    const candidate = candidateAt(explicit.sheetName, workbook.Sheets[explicit.sheetName], explicit.headerRow);
    eligible = [candidate];
    if (!candidates.some((item) => item.sheetName === candidate.sheetName && item.headerRow === candidate.headerRow)) candidates.push(candidate);
  }
  const best = eligible[0];
  if (!best || eligible.filter((candidate) => candidate.score === best.score).length !== 1) {
    const issue: ImportIssue = { level: "error", code: best ? "ambiguous_sheet" : "header_required", message: best ? "Birden fazla çalışma sayfası veya başlık satırı eşleşti; gelişmiş seçeneklerden seçin." : "İstasyon ve uçuş sütunlarını içeren başlık satırı bulunamadı; gelişmiş seçeneklerden seçin." };
    return { selection: null, candidates, columns: [], issues: [issue], needsReview: true, providerCandidates: [], periodCandidates: [] };
  }
  const metadata = detectMetadata([fileName, best.sheetName, ...contextFor(workbook.Sheets[best.sheetName], best.headerRow)]);
  if (!metadata.providerCandidates.length || !metadata.periodCandidates.length) {
    const coverLines: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      if (sheetName === best.sheetName || candidates.some((candidate) => candidate.sheetName === sheetName)) continue;
      const sheet = workbook.Sheets[sheetName];
      const extent = sheet && bounds(sheet);
      if (extent) coverLines.push(...contextFor(sheet, Math.min(extent.lastRow + 1, extent.firstRow + 100)));
    }
    const coverMetadata = detectMetadata(coverLines);
    if (!metadata.providerCandidates.length) metadata.providerCandidates = coverMetadata.providerCandidates;
    if (!metadata.periodCandidates.length) metadata.periodCandidates = coverMetadata.periodCandidates;
  }
  const selection: ImportSelection = {
    sheetName: best.sheetName, headerRow: best.headerRow,
    mappings: explicit.mappings === undefined ? { ...best.mappings } : { ...explicit.mappings },
    provider: explicit.provider === undefined ? metadata.providerCandidates.length === 1 ? metadata.providerCandidates[0] : null : explicit.provider?.trim() || null,
    period: explicit.period === undefined ? metadata.periodCandidates.length === 1 ? metadata.periodCandidates[0] : null : explicit.period?.trim() || null,
  };
  const issues = [...metadataIssues(selection), ...validateSelection(workbook, selection)];
  if (explicit.mappings === undefined) for (const field of best.duplicateFields) issues.push({ level: "error", code: "ambiguous_mapping", field, message: `${IMPORT_FIELD_LABELS[field]}: birden fazla sütun eşleşti; sütun konumunu seçin.` });
  for (const field of Object.keys(METRIC_HEADERS) as ImportField[]) if (selection.mappings[field] === undefined && !best.duplicateFields.includes(field)) issues.push({ level: "warning", code: "missing_metric", field, message: `${METRIC_HEADERS[field as keyof typeof METRIC_HEADERS]} sütunu bulunamadı; değerler eksik kalacak.` });
  return { selection, candidates, columns: best.columns, issues, needsReview: issues.some((issue) => issue.level === "error"), ...metadata };
}
export function validateSelection(workbook: WorkbookSource, selection: ImportSelection | null): ImportIssue[] {
  const errors: ImportIssue[] = [];
  const sheet = selection && typeof selection.sheetName === "string" ? workbook.Sheets[selection.sheetName] : undefined;
  const extent = sheet && bounds(sheet);
  if (!selection || !sheet || !extent || !Number.isInteger(selection.headerRow) || selection.headerRow < extent.firstRow || selection.headerRow >= extent.lastRow || !selection.mappings || typeof selection.mappings !== "object" || Array.isArray(selection.mappings)) return [{ level: "error", code: "invalid_selection", message: "Çalışma sayfası, başlık satırı veya sütun seçimi geçersiz." }];
  const seen = new Set<number>();
  for (const [field, index] of Object.entries(selection.mappings)) {
    if (!IMPORT_FIELDS.includes(field as ImportField) || !Number.isInteger(index) || index! < 0 || index! > extent.lastColumn || seen.has(index!)) errors.push({ level: "error", code: "invalid_mapping", message: `${field}: sütun konumu geçersiz veya başka bir ölçümde kullanılıyor.` });
    else seen.add(index!);
  }
  for (const field of ["stationCode", "flights"] as const) if (selection.mappings[field] === undefined) errors.push({ level: "error", code: "required_mapping", field, message: `${field === "stationCode" ? "İstasyon" : "Uçuş"} sütunu zorunludur.` });
  return errors;
}
function isMissing(value: unknown) { return value === null || value === undefined || /^(?:\s*|--?|N\/?A)$/i.test(String(value).trim()); }
function numericValue(value: unknown, count: boolean, ratio: boolean): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  let cleaned = value.trim().replace(/\s/g, "");
  if (ratio) {
    if ((cleaned.match(/%/g) ?? []).length > 1 || (cleaned.includes("%") && !cleaned.startsWith("%") && !cleaned.endsWith("%"))) return null;
    cleaned = cleaned.replace("%", "");
  } else if (!count) cleaned = cleaned.replace(/min(?:ute)?s?|gün|gun/gi, "");
  if (!/^[+-]?(?:\d+[.,]?\d*|[.,]\d+)(?:[.,]\d+)*$/.test(cleaned)) return null;
  if (cleaned.includes(",") && cleaned.includes(".")) cleaned = cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/,/g, "");
  else if (count && /^[+-]?\d{1,3}(?:[.,]\d{3})+$/.test(cleaned)) cleaned = cleaned.replace(/[.,]/g, "");
  else cleaned = cleaned.replace(",", ".");
  const result = Number(cleaned);
  return Number.isFinite(result) ? result : null;
}
export function parseWorkbook(workbook: WorkbookSource, selection: ImportSelection | null): WorkbookParseResult {
  const issues = validateSelection(workbook, selection);
  if (selection) issues.push(...metadataIssues(selection));
  const rows: ImportedRow[] = [];
  const result = () => ({ selection, rows, issues, errorCount: issues.filter((issue) => issue.level === "error").length, warningCount: issues.filter((issue) => issue.level === "warning").length });
  if (!selection || issues.length) return result();
  const sheet = workbook.Sheets[selection.sheetName];
  const extent = bounds(sheet)!;
  const seen = new Set<string>();
  for (let sourceRow = selection.headerRow + 1; sourceRow <= extent.lastRow; sourceRow++) {
    const stationValue = cellAt(sheet, sourceRow, selection.mappings.stationCode!).v;
    if (isMissing(stationValue)) {
      if (Object.values(selection.mappings).some((column) => !isMissing(cellAt(sheet, sourceRow, column!).v))) issues.push({ level: "error", code: "missing_station", field: "stationCode", sourceRow, message: `${sourceRow}. satır: ölçüm değerleri var ancak istasyon eksik.` });
      continue;
    }
    const stationCode = normalizeImportHeader(stationValue);
    if (!stationCode) { issues.push({ level: "error", code: "invalid_station", field: "stationCode", sourceRow, message: `${sourceRow}. satır: istasyon geçersiz.` }); continue; }
    if (seen.has(stationCode)) issues.push({ level: "error", code: "duplicate_station", field: "stationCode", sourceRow, message: `${stationCode}: mükerrer istasyon.` });
    seen.add(stationCode);
    const row = { stationCode, sourceRow } as ImportedRow;
    for (const field of IMPORT_FIELDS) {
      if (field === "stationCode") continue;
      const column = selection.mappings[field];
      const cell = column === undefined ? {} : cellAt(sheet, sourceRow, column);
      if (isMissing(cell.v)) {
        row[field] = null;
        if (field === "flights") issues.push({ level: "error", code: "missing_value", field, sourceRow, message: `${stationCode}: uçuş sayısı eksik.` });
        else if (column !== undefined) issues.push({ level: "warning", code: "missing_value", field, sourceRow, message: `${stationCode}: ${IMPORT_FIELD_LABELS[field]} değeri eksik.` });
        continue;
      }
      let parsed = numericValue(cell.v, countFields.has(field), ratioFields.has(field));
      // Numeric Excel percentage cells already store a ratio; only literal % text needs division.
      if (parsed !== null && ratioFields.has(field) && typeof cell.v === "string" && cell.v.includes("%")) parsed /= 100;
      const invalid = parsed === null || parsed < 0 || (countFields.has(field) && !Number.isSafeInteger(parsed)) || (ratioFields.has(field) && parsed > 1);
      row[field] = invalid ? null : parsed;
      if (invalid) issues.push({ level: "error", code: "invalid_value", field, sourceRow, message: `${stationCode}: ${IMPORT_FIELD_LABELS[field]} ${countFields.has(field) ? "sıfır veya daha büyük tam sayı" : ratioFields.has(field) ? "0–1 oranı veya % değeri" : "sıfır veya daha büyük sayı"} olmalıdır.` });
    }
    // Preserve explicit source counts. Derived counts require a present denominator.
    for (const [count, ratio, denominator] of [["damagedCount", "damagedRatio", "passengers"], ["lostCount", "lostRatio", "passengers"], ["safetyCount", "safetyRatio", "flights"], ["nonSafetyCount", "nonSafetyRatio", "flights"]] as const) {
      if (selection.mappings[count] === undefined && row[ratio] !== null && row[denominator] !== null) row[count] = Math.round(row[ratio]! * row[denominator]!);
    }
    rows.push(row);
  }
  if (!rows.length) issues.push({ level: "error", code: "no_rows", message: "İçe aktarılabilir istasyon satırı bulunamadı." });
  return result();
}
