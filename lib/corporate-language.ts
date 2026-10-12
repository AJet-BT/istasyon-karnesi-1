export const CORPORATE_TERMS = {
  overview: "Genel Bakış",
  airport: "Havalimanı",
  station: "İstasyon",
  comparison: "Karşılaştırma",
  comparisonPeriod: "Karşılaştırma Dönemi",
  provider: "Handling Provider",
  sourceFile: "Kaynak Dosya",
  upload: "Veri Yükleme",
  dataQuality: "Veri Kalitesi",
  reportCenter: "Rapor Merkezi",
  user: "Kullanıcı",
  role: "Rol",
  workspace: "Çalışma Alanı",
  active: "Aktif",
  inactive: "Pasif",
  mapping: "Sütun Eşleştirme",
  rawData: "Kaynak Veri",
  trend: "Dönemsel Eğilim",
} as const;

export const KPI_LABELS = {
  flights: "Toplam Uçuş",
  passengers: "Yolcu Sayısı",
  otp: "OTP",
  ota: "OTA",
  delay: "Toplam Tehir",
  damaged: "Hasarlı Bagaj %",
  lost: "Kayıp Bagaj %",
  complaint: "Şikâyet Dönüş Süresi",
  safety: "Safety %",
  documents: "Doküman Hata Oranı",
  unreadDocuments: "Extgoms–Okunmayan Doküman Sayısı",
  visaPassportIssues: "Vize Pasaport Doküman Aksaklıkları",
  safetyReports: "Emniyet Raporlaması",
  gseDamageReports: "Hasar Raporlama GSE",
  digitalBoarding: "Dijital Biniş Kartı Kullanım Oranı",
} as const;

export const MISSING_VALUE_LABEL = "Kaynakta Raporlanmamış";
export const MISSING_VALUE_TOOLTIP = "Kaynak dosyada bu alan için veri raporlanmamış.";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Sistem Yöneticisi",
  admin: "Yönetici",
  data_manager: "Veri Yöneticisi",
  analyst: "Analist",
  manager: "Yönetici",
  readonly: "Salt Okunur Kullanıcı",
  viewer: "Salt Okunur Kullanıcı",
};

const DATA_SCOPE_LABELS: Record<string, string> = {
  own_workspace: "Kendi Çalışma Alanı",
  assigned: "Atanmış Kapsam",
  tenant: "Kurum Kapsamı",
};

const PROCESS_STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  inactive: "Pasif",
  archived: "Arşivlendi",
  deleted: "Silindi",
  restored: "Geri Yüklendi",
  pending: "Bekliyor",
  processing: "İşleniyor",
  completed: "Tamamlandı",
  ready: "Hazır",
  prepared: "Yazdırma için hazırlandı; kaydedildiği doğrulanmadı",
  failed: "Başarısız",
  success: "Başarılı",
  warning: "Uyarı Var",
  valid: "Doğrulandı",
  error: "Geçersiz Değer",
  unresolved: "Eşleştirme Gerekli",
  review: "İnceleme Gerekli",
  excluded: "Kapsam Dışı",
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  "user.create": "Kullanıcı Oluşturuldu",
  "user.update": "Kullanıcı Güncellendi",
  "user.status": "Kullanıcı Durumu Güncellendi",
  "user.role": "Kullanıcı Rolü Güncellendi",
  "user.archive": "Kullanıcı Arşivlendi",
  "user.reset_password": "Kullanıcı Şifresi Sıfırlandı",
  "user.revoke_sessions": "Kullanıcı Oturumları Sonlandırıldı",
  "upload.create": "Veri Yükleme Tamamlandı",
  "upload.delete": "Dosya Silindi",
  "upload.restore": "Dosya Geri Yüklendi",
  "upload.reprocess": "Dosya Yeniden İşlendi",
  "export.create": "Dışa Aktarım Oluşturuldu",
  "export.delete": "Dışa Aktarım Silindi",
  "view.save": "Görünüm Kaydedildi",
  "port.create": "Havalimanı Kaydı Oluşturuldu",
  "port.update": "Havalimanı Kaydı Güncellendi",
  "port.map": "Havalimanı Eşleştirildi",
  "port.review": "Havalimanı İncelemeye Alındı",
  "port.exclude": "Havalimanı Kapsam Dışı Bırakıldı",
  create: "Kayıt Oluşturuldu",
  update: "Kayıt Güncellendi",
  map: "Eşleştirme Yapıldı",
  review: "İncelemeye Alındı",
  exclude: "Kapsam Dışı Bırakıldı",
};

const AUDIT_TARGET_LABELS: Record<string, string> = {
  user: "Kullanıcı",
  upload: "Yüklenen Dosya",
  export: "Dışa Aktarım",
  port: "Havalimanı",
  saved_view: "Kayıtlı Görünüm",
  view: "Kayıtlı Görünüm",
  session: "Oturum",
  workspace: "Çalışma Alanı",
  auth: "Kimlik Doğrulama",
};

export function formatRoleLabel(value: string | null | undefined) {
  if (!value) return MISSING_VALUE_LABEL;
  return ROLE_LABELS[value] ?? "Tanımlı Rol";
}

export function formatDataScope(value: string | null | undefined) {
  if (!value) return MISSING_VALUE_LABEL;
  return DATA_SCOPE_LABELS[value] ?? "Tanımlı Veri Kapsamı";
}

export function formatProcessStatus(value: string | null | undefined, completedLabel = "Tamamlandı") {
  if (!value) return MISSING_VALUE_LABEL;
  if (value === "completed") return completedLabel;
  return PROCESS_STATUS_LABELS[value] ?? "İnceleme Gerekli";
}

export function formatAuditAction(value: string | null | undefined) {
  if (!value) return "Sistem İşlemi";
  return AUDIT_ACTION_LABELS[value] ?? "Sistem İşlemi";
}

export function formatAuditTarget(value: string | null | undefined) {
  if (!value) return "Sistem Kaydı";
  return AUDIT_TARGET_LABELS[value] ?? "Sistem Kaydı";
}

export function formatAuditValue(value: string | null | undefined) {
  if (!value) return MISSING_VALUE_LABEL;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed === "string") return formatPlainAuditValue(parsed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "Değişiklik Kaydedildi";
    const record = parsed as Record<string, unknown>;
    const candidates = [
      typeof record.stationCode === "string" ? record.stationCode : null,
      typeof record.airportName === "string" ? record.airportName : null,
      typeof record.fileName === "string" ? record.fileName : null,
      typeof record.roleCode === "string" ? formatRoleLabel(record.roleCode) : null,
      typeof record.status === "string" ? formatProcessStatus(record.status) : null,
      typeof record.deletionStatus === "string" ? formatProcessStatus(record.deletionStatus) : null,
    ].filter((item): item is string => Boolean(item));
    return candidates.length ? candidates.join(" · ") : "Değişiklik Kaydedildi";
  } catch {
    return formatPlainAuditValue(value);
  }
}

function formatPlainAuditValue(value: string) {
  if (ROLE_LABELS[value]) return ROLE_LABELS[value];
  if (DATA_SCOPE_LABELS[value]) return DATA_SCOPE_LABELS[value];
  if (PROCESS_STATUS_LABELS[value]) return PROCESS_STATUS_LABELS[value];
  return value.length <= 80 && !/[{}\[\]"]/.test(value) ? value : "Değişiklik Kaydedildi";
}

const TECHNICAL_ERROR_PATTERN = /(?:query\s+failed|failed\s+query|undefined|null\b|stack\s*trace|sqlite|drizzle|d1\b|r2\b|sql\b|constraint|exception|syntaxerror|typeerror|referenceerror|\bat\s+[\w.$<>]+\s*\(|select\s+.+\s+from|insert\s+into|update\s+.+\s+set)/i;

export function userFacingError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message.trim() : typeof error === "string" ? error.trim() : "";
  if (!message || TECHNICAL_ERROR_PATTERN.test(message)) return fallback;
  return message;
}
