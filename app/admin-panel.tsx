"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Archive, ArrowDownUp, Check, ChevronLeft, ChevronRight, Eye, EyeOff, FileSpreadsheet, KeyRound, LockKeyhole, Plus, RefreshCw, Search, ShieldCheck, UserCog, UserRound, X } from "lucide-react";
import PortMaster from "@/app/port-master";
import { formatAuditAction, formatAuditTarget, formatAuditValue, formatDataScope, formatProcessStatus, formatRoleLabel, MISSING_VALUE_LABEL, userFacingError } from "@/lib/corporate-language";

type AdminUser = {
  id: string; email: string; fullName: string; firstName: string | null; lastName: string | null;
  roleCode: string; status: string; displayStatus: string; workspaceId: string | null; workspaceName: string | null;
  uploadCount: number; lastLoginAt: number | null; createdAt: number; createdByAdmin: string; dataScope: string;
  activeSessionCount: number; forcePasswordChange: boolean; archivedAt: number | null;
};
type Role = { code: string; name: string; description: string };
type AuditRow = { id: string; action: string; targetType: string; targetId: string; previousValue: string | null; newValue: string | null; result: string; createdAt: number };
type UserDetail = {
  user: AdminUser; workspaceId: string | null; workspaceName: string | null; accessLevel: string | null;
  files: Array<{ id: string; fileName: string; provider: string; period: string; createdAt: number }>;
  exports: Array<{ id: string; fileName: string; exportType: string; createdAt: number }>;
  views: Array<{ id: string; name: string; createdAt: number }>;
  activities: AuditRow[];
  sessions: Array<{ id: string; createdAt: number; lastSeenAt: number; expiresAt: number; revokedAt: number | null; userAgent: string | null }>;
};

const statusNames: Record<string, string> = { active: "Aktif", inactive: "Pasif", pending_first_login: "İlk giriş bekleniyor", locked: "Kilitli", archived: "Arşivlendi" };
const tabs = [["users", "Kullanıcılar"], ["new", "Yeni Kullanıcı"], ["roles", "Roller ve Yetkiler"], ["scopes", "Veri Kapsamları"], ["activity", "Kullanıcı Aktiviteleri"], ["inactive", "Pasif Kullanıcılar"], ["airports", "Havalimanı Master Verisi"]] as const;
const permissionsByRole: Record<string, string[]> = {
  admin: ["Kullanıcı oluşturma ve düzenleme", "Rol ve şifre yönetimi", "Oturum sonlandırma", "Yönetim ekranlarının tamamı"],
  data_manager: ["Excel veri yükleme ve sütun eşleştirme", "Kendi dosyalarını silme", "Genel Bakışı görüntüleme", "PDF ve Excel dışa aktarımı"],
  analyst: ["Yetkili verileri görüntüleme", "Filtre ve analiz", "Rapor oluşturma", "Kullanıcı yönetimi yok"],
  viewer: ["Genel Bakışı görüntüleme", "İzinli PDF indirme", "Veri yükleme ve sütun eşleştirme yok", "Kullanıcı yönetimi yok"],
};
const roleDescriptions: Record<string, string> = {
  super_admin: "Tüm çalışma alanlarını, kullanıcıları ve sistem ayarlarını yönetir.",
  admin: "Kullanıcıları, veri kapsamlarını ve dosya yaşam döngüsünü yönetir.",
  data_manager: "Veri yükleme, sütun eşleştirme ve veri kalitesi işlemlerini yönetir.",
  analyst: "Yetkili kapsamda analiz, filtreleme ve raporlama işlemlerini yürütür.",
  viewer: "Yetkili kapsamı salt okunur olarak görüntüler.",
  readonly: "Yetkili kapsamı salt okunur olarak görüntüler.",
};

function formatDate(value: number | null | undefined) { return value ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Henüz giriş yok"; }
function initials(value: string) { return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("tr-TR"); }
function passwordRules(password: string, email: string, firstName: string, lastName: string, confirmation: string) {
  const low = password.toLocaleLowerCase("tr-TR");
  return {
    length: password.length >= 8, upper: /[A-ZÇĞİÖŞÜ]/.test(password), lower: /[a-zçğıöşü]/.test(password), number: /\d/.test(password),
    notIdentity: low !== email.toLocaleLowerCase("tr-TR") && ![firstName, lastName].filter((name) => name.length >= 3).some((name) => low.includes(name.toLocaleLowerCase("tr-TR"))),
    match: Boolean(password) && password === confirmation,
  };
}

export default function AdminPanel({ onChanged, onToast }: { onChanged: () => void; onToast: (message: string) => void }) {
  const [tab, setTab] = useState<typeof tabs[number][0]>(() => typeof window !== "undefined" && window.location.hash === "#airport-master" ? "airports" : "users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [pendingStatus, setPendingStatus] = useState<AdminUser | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", passwordConfirmation: "", roleCode: "analyst", status: "active", workspaceName: "", dataScope: "own_workspace", forcePasswordChange: true });

  const load = useCallback(async (includeArchived = false) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users${includeArchived ? "?archived=true" : ""}`);
      const result = await response.json() as { users?: AdminUser[]; roles?: Role[]; audit?: AuditRow[]; error?: string };
      if (response.status === 401 || response.status === 428) { window.location.assign(response.status === 428 ? "/change-password" : "/login"); return; }
      if (!response.ok) throw new Error(result.error || "Kullanıcı ve erişim verileri alınamadı.");
      setUsers(result.users ?? []); setRoles(result.roles ?? []); setAudit(result.audit ?? []); setError(null);
    } catch (loadError) { setError(userFacingError(loadError, "Kullanıcı ve erişim verileri yüklenemedi. Lütfen yeniden deneyin.")); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void load(tab === "inactive"); }, 0); return () => window.clearTimeout(timer); }, [load, tab]);

  async function request(path: string, options: RequestInit) {
    const response = await fetch(path, { ...options, headers: { "content-type": "application/json", ...(options.headers ?? {}) } });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error || "İşlem tamamlanamadı.");
    return result;
  }

  const filtered = useMemo(() => users.filter((user) => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    const matchSearch = !q || `${user.fullName} ${user.email}`.toLocaleLowerCase("tr-TR").includes(q);
    const matchRole = roleFilter === "all" || user.roleCode === roleFilter;
    const matchStatus = statusFilter === "all" || user.displayStatus === statusFilter;
    const matchTab = tab !== "inactive" || user.displayStatus === "inactive" || user.displayStatus === "archived" || user.displayStatus === "locked";
    return matchSearch && matchRole && matchStatus && matchTab;
  }).sort((a, b) => sortDesc ? (b.lastLoginAt ?? 0) - (a.lastLoginAt ?? 0) : (a.lastLoginAt ?? 0) - (b.lastLoginAt ?? 0)), [users, search, roleFilter, statusFilter, tab, sortDesc]);
  const pageSize = 8;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  async function createUser(event: FormEvent) {
    event.preventDefault(); setError(null);
    const normalizedEmail = form.email.trim().toLocaleLowerCase("tr-TR");
    if (form.email !== form.email.trim()) { setError("E-posta adresinin başında veya sonunda boşluk bulunamaz."); return; }
    if (users.some((user) => user.email === normalizedEmail)) { setError("Bu e-posta adresiyle kayıtlı bir kullanıcı bulunuyor."); return; }
    const rules = passwordRules(form.password, normalizedEmail, form.firstName, form.lastName, form.passwordConfirmation);
    if (!Object.values(rules).every(Boolean)) { setError("Geçici şifre kurallarının tamamını karşılayın."); return; }
    try {
      await request("/api/admin/users", { method: "POST", body: JSON.stringify({ ...form, email: normalizedEmail, workspaceName: form.workspaceName || `${form.firstName} ${form.lastName} Çalışma Alanı` }) });
      onToast("Kullanıcı başarıyla oluşturuldu."); setForm({ firstName: "", lastName: "", email: "", password: "", passwordConfirmation: "", roleCode: "analyst", status: "active", workspaceName: "", dataScope: "own_workspace", forcePasswordChange: true }); setTab("users"); await load(); onChanged();
    } catch (createError) { setError(userFacingError(createError, "Kullanıcı oluşturulamadı. Lütfen bilgileri kontrol ederek yeniden deneyin.")); }
  }

  async function openDetail(user: AdminUser) {
    try { const response = await fetch(`/api/admin/users/${user.id}`); const result = await response.json() as UserDetail & { error?: string }; if (!response.ok) throw new Error(result.error || "Kullanıcı detayı alınamadı."); setDetail(result); }
    catch (detailError) { setError(userFacingError(detailError, "Kullanıcı detayları yüklenemedi. Lütfen yeniden deneyin.")); }
  }

  async function confirmStatus() {
    if (!pendingStatus) return;
    const next = pendingStatus.status === "active" ? "inactive" : "active";
    try { await request(`/api/admin/users/${pendingStatus.id}/status`, { method: "PATCH", body: JSON.stringify({ status: next }) }); onToast(next === "inactive" ? "Kullanıcı pasif hale getirildi." : "Kullanıcı yeniden aktifleştirildi."); setPendingStatus(null); await load(tab === "inactive"); onChanged(); }
    catch (statusError) { setError(userFacingError(statusError, "Kullanıcı durumu güncellenemedi. Lütfen yeniden deneyin.")); }
  }

  async function changeRole(user: AdminUser, nextRole: string) {
    try { await request(`/api/admin/users/${user.id}/role`, { method: "PATCH", body: JSON.stringify({ roleCode: nextRole }) }); onToast("Kullanıcı rolü güncellendi."); await load(tab === "inactive"); onChanged(); }
    catch (roleError) { setError(userFacingError(roleError, "Kullanıcı rolü güncellenemedi. Lütfen yeniden deneyin.")); }
  }

  async function resetUserPassword(event: FormEvent) {
    event.preventDefault(); if (!resetTarget) return;
    const rules = passwordRules(resetPassword, resetTarget.email, resetTarget.firstName ?? "", resetTarget.lastName ?? "", resetConfirmation);
    if (!Object.values(rules).every(Boolean)) { setError("Yeni geçici şifre kuralların tamamını karşılamalıdır."); return; }
    try { await request(`/api/admin/users/${resetTarget.id}/reset-password`, { method: "POST", body: JSON.stringify({ password: resetPassword, passwordConfirmation: resetConfirmation }) }); onToast("Geçici şifre yenilendi ve oturumlar sonlandırıldı."); setResetTarget(null); setResetPassword(""); setResetConfirmation(""); await load(tab === "inactive"); }
    catch (resetError) { setError(userFacingError(resetError, "Şifre sıfırlanamadı. Lütfen yeniden deneyin.")); }
  }

  async function revoke(user: AdminUser) { try { await request(`/api/admin/users/${user.id}/revoke-sessions`, { method: "POST", body: "{}" }); onToast("Kullanıcının aktif oturumları sonlandırıldı."); await load(tab === "inactive"); } catch (revokeError) { setError(userFacingError(revokeError, "Oturumlar sonlandırılamadı. Lütfen yeniden deneyin.")); } }
  async function archive(user: AdminUser) { if (!window.confirm(`${user.fullName} arşivlensin mi? Geçmiş veriler korunacaktır.`)) return; try { await request(`/api/admin/users/${user.id}`, { method: "DELETE", body: "{}" }); onToast("Kullanıcı arşivlendi; geçmiş kayıtları korundu."); setDetail(null); await load(tab === "inactive"); onChanged(); } catch (archiveError) { setError(userFacingError(archiveError, "Kullanıcı arşivlenemedi. Lütfen yeniden deneyin.")); } }

  const rules = passwordRules(form.password, form.email, form.firstName, form.lastName, form.passwordConfirmation);
  const resetRules = resetTarget ? passwordRules(resetPassword, resetTarget.email, resetTarget.firstName ?? "", resetTarget.lastName ?? "", resetConfirmation) : rules;

  return <div className="page-stack admin-page">
    <div className="page-heading admin-heading"><div><span>YER İŞLETME BAŞKANLIĞI · YÖNETİM</span><h2>Kullanıcı ve Erişim Yönetimi</h2><p>Kullanıcıları, rolleri ve çalışma alanı erişimlerini yönetin.</p></div><button className="primary-button" onClick={() => setTab("new")}><Plus size={16} /> Yeni Kullanıcı</button></div>
    <div className="admin-tabs" role="tablist">{tabs.map(([key, label]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => { setTab(key); setPage(1); }}>{label}{key === "inactive" && <b>{users.filter((user) => user.displayStatus !== "active" && user.displayStatus !== "pending_first_login").length}</b>}</button>)}</div>
    {error && <div className="quality-callout warning"><AlertCircle size={20} /><div><strong>İşlem tamamlanamadı</strong><p>{error}</p></div><button className="icon-button" onClick={() => setError(null)}><X size={16} /></button></div>}

    {(tab === "users" || tab === "inactive") && <article className="panel table-panel admin-user-table">
      <div className="table-toolbar admin-toolbar"><div className="admin-search"><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Kullanıcı veya e-posta ara" /></div><div><select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1); }}><option value="all">Tüm roller</option>{roles.map((role) => <option key={role.code} value={role.code}>{formatRoleLabel(role.code)}</option>)}</select><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}><option value="all">Tüm durumlar</option><option value="active">Aktif</option><option value="pending_first_login">İlk giriş bekleniyor</option><option value="inactive">Pasif</option><option value="locked">Kilitli</option><option value="archived">Arşivlendi</option></select><button className="secondary-button" onClick={() => void load(tab === "inactive")}><RefreshCw size={15} /> Yenile</button></div></div>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>Kullanıcı</th><th>E-posta</th><th>Rol</th><th>Durum</th><th>Çalışma Alanı</th><th>Yüklenen Dosya</th><th><button onClick={() => setSortDesc((value) => !value)}>Son Giriş <ArrowDownUp size={12} /></button></th><th>Oluşturulma</th><th>Oluşturan Yönetici</th><th>İşlemler</th></tr></thead><tbody>{loading ? <tr><td colSpan={10}>Kullanıcılar yükleniyor…</td></tr> : visible.length ? visible.map((user) => <tr key={user.id} onClick={() => void openDetail(user)}><td><div className="user-cell"><span>{initials(user.fullName)}</span><div><b>{user.fullName}</b><small>{user.email}</small></div></div></td><td>{user.email}</td><td onClick={(event) => event.stopPropagation()}><select value={user.roleCode} disabled={user.roleCode === "super_admin"} onChange={(event) => void changeRole(user, event.target.value)}>{user.roleCode === "super_admin" && <option value="super_admin">Sistem Yöneticisi</option>}{roles.map((role) => <option key={role.code} value={role.code}>{formatRoleLabel(role.code)}</option>)}</select></td><td><span className={`admin-status ${user.displayStatus}`}>{statusNames[user.displayStatus] ?? user.displayStatus}</span></td><td>{user.workspaceName ?? MISSING_VALUE_LABEL}</td><td>{user.uploadCount}</td><td>{formatDate(user.lastLoginAt)}</td><td>{formatDate(user.createdAt)}</td><td>{user.createdByAdmin}</td><td onClick={(event) => event.stopPropagation()}><div className="row-actions"><button title="Şifreyi Sıfırla" onClick={() => setResetTarget(user)}><KeyRound size={15} /></button><button title={user.status === "active" ? "Kullanıcıyı Pasifleştir" : "Kullanıcıyı Aktifleştir"} onClick={() => setPendingStatus(user)}><UserCog size={15} /></button><button title="Oturumları Sonlandır" onClick={() => void revoke(user)}><LockKeyhole size={15} /></button></div></td></tr>) : <tr><td colSpan={10}><b>Seçilen filtrelerle eşleşen kullanıcı bulunamadı.</b><small>Filtreleri değiştirerek yeniden deneyebilirsiniz.</small></td></tr>}</tbody></table></div>
      <div className="table-footer"><span>{filtered.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)}` : "0"} / {filtered.length}</span><div><button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={16} /></button><button className="active">{page}</button><button disabled={page === pages} onClick={() => setPage((value) => Math.min(pages, value + 1))}><ChevronRight size={16} /></button></div></div>
    </article>}

    {tab === "new" && <form className="panel admin-form" onSubmit={createUser}><div className="section-header"><div><span>YENİ KULLANICI</span><h2>Hesap ve Çalışma Alanı Oluşturun</h2></div></div><div className="admin-form-grid"><label><span>Ad</span><input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required /></label><label><span>Soyad</span><input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required /></label><label className="wide"><span>E-posta</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="ad.soyad@ajet.com" required /></label><label><span>Rol</span><select value={form.roleCode} onChange={(event) => setForm({ ...form, roleCode: event.target.value })}>{roles.map((role) => <option key={role.code} value={role.code}>{formatRoleLabel(role.code)}</option>)}</select></label><label><span>Kullanıcı Durumu</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="active">Aktif</option><option value="inactive">Pasif</option></select></label><label className="wide"><span>Çalışma Alanı Adı</span><input value={form.workspaceName} onChange={(event) => setForm({ ...form, workspaceName: event.target.value })} placeholder={`${form.firstName || "Ad"} ${form.lastName || "Soyad"} Çalışma Alanı`} /></label><label className="wide"><span>Veri Kapsamı</span><select value={form.dataScope} onChange={(event) => setForm({ ...form, dataScope: event.target.value })}><option value="own_workspace">Yalnızca kendi çalışma alanı</option><option value="assigned">Kendisine atanan veriler</option><option value="tenant">Yetkili kurum kapsamı</option></select></label><label className="wide"><span>Geçici Şifre</span><div className="password-input"><input type={showPassword ? "text" : "password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Şifreyi Gizle" : "Şifreyi Göster"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label><label className="wide"><span>Geçici Şifre Tekrarı</span><input type={showPassword ? "text" : "password"} value={form.passwordConfirmation} onChange={(event) => setForm({ ...form, passwordConfirmation: event.target.value })} required /></label></div><PasswordChecklist rules={rules} /><label className="admin-checkbox"><input type="checkbox" checked={form.forcePasswordChange} onChange={(event) => setForm({ ...form, forcePasswordChange: event.target.checked })} /><span><b>İlk girişte şifre değişikliği zorunlu</b><small>Kullanıcı Genel Bakışa geçmeden önce kalıcı şifresini belirler.</small></span></label><div className="wizard-actions"><button type="button" className="ghost-button" onClick={() => setTab("users")}>İptal</button><button className="primary-button"><Plus size={16} /> Kullanıcıyı Oluştur</button></div></form>}

    {tab === "roles" && <section className="role-grid">{roles.map((role) => <article className="panel role-permission-card" key={role.code}><div><span><ShieldCheck size={19} /></span><div><small>ROL</small><h3>{formatRoleLabel(role.code)}</h3></div></div><p>{roleDescriptions[role.code] ?? "Yetkili kapsam için tanımlı erişim rolü."}</p><ul>{(permissionsByRole[role.code] ?? []).map((permission) => <li key={permission}><Check size={14} /> {permission}</li>)}</ul></article>)}</section>}
    {tab === "scopes" && <section className="scope-grid">{[
      ["own_workspace", "Kendi Çalışma Alanı", "Kullanıcı yalnız kendi dosya, Genel Bakış, dışa aktarım ve silme kapsamını görür."],
      ["assigned", "Atanmış Kapsam", "Yalnız açıkça atanan Handling Provider, istasyon veya dönemleri görüntüler."],
      ["tenant", "Kurum Kapsamı", "Yönetici onayıyla aynı kurum içindeki çalışma alanlarını denetleyebilir."],
    ].map(([code, label, description]) => <article className="panel scope-card" key={code}><div><span><LockKeyhole size={18} /></span><div><small>VERİ KAPSAMI</small><h3>{label}</h3></div></div><p>{description}</p><strong>{users.filter((user) => user.dataScope === code).length} kullanıcı</strong><ul><li><Check size={14} /> Sistem sorgularında çalışma alanı zorunlu</li><li><Check size={14} /> Dışa aktarım geçmişi kullanıcıya özel</li><li><Check size={14} /> Silme işlemleri sahiplik kontrolünde</li></ul></article>)}</section>}
    {tab === "activity" && <article className="panel table-panel"><div className="section-header"><div><span>AKTİVİTE KAYDI</span><h2>Kullanıcı Yönetimi Aktiviteleri</h2></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>İşlem</th><th>Etkilenen Kayıt</th><th>Önceki Değer</th><th>Yeni Değer</th><th>Sonuç</th><th>Tarih</th></tr></thead><tbody>{audit.map((entry) => <tr key={entry.id}><td><b>{formatAuditAction(entry.action)}</b></td><td>{formatAuditTarget(entry.targetType)} · {entry.targetId}</td><td><small>{formatAuditValue(entry.previousValue)}</small></td><td><small>{formatAuditValue(entry.newValue)}</small></td><td><span className="admin-status active">{formatProcessStatus(entry.result)}</span></td><td>{formatDate(entry.createdAt)}</td></tr>)}</tbody></table></div></article>}
    {tab === "airports" && <PortMaster onToast={onToast} />}

    {detail && <div className="drawer-backdrop" onMouseDown={() => setDetail(null)}><aside className="station-drawer user-drawer" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><div><span>{initials(detail.user.fullName)}</span><div><small>{formatRoleLabel(detail.user.roleCode)} · {statusNames[detail.user.displayStatus]}</small><h2>{detail.user.fullName}</h2></div></div><button onClick={() => setDetail(null)} aria-label="Kapat"><X size={20} /></button></div><div className="drawer-body"><div className="detail-identity"><UserRound size={18} /><div><b>{detail.user.email}</b><small>{detail.workspaceName ?? MISSING_VALUE_LABEL} · {formatDataScope(detail.user.dataScope)}</small></div></div><section className="drawer-kpis"><div><span>Yüklenen Dosya</span><strong>{detail.files.length}</strong></div><div><span>PDF / Dışa Aktarım</span><strong>{detail.exports.length}</strong></div><div><span>Kayıtlı Görünüm</span><strong>{detail.views.length}</strong></div><div><span>Aktif Oturum</span><strong>{detail.sessions.filter((session) => !session.revokedAt).length}</strong></div><div><span>Son Giriş</span><strong className="small-value">{formatDate(detail.user.lastLoginAt)}</strong></div><div><span>Oluşturulma</span><strong className="small-value">{formatDate(detail.user.createdAt)}</strong></div></section><section className="drawer-section"><div className="detail-actions"><button className="secondary-button" onClick={() => setResetTarget(detail.user)}><KeyRound size={15} /> Şifreyi Sıfırla</button><button className="secondary-button" onClick={() => void revoke(detail.user)}><LockKeyhole size={15} /> Oturumları Sonlandır</button><button className="secondary-button danger" onClick={() => void archive(detail.user)}><Archive size={15} /> Arşivle</button></div></section><DetailLists detail={detail} /></div></aside></div>}
    {pendingStatus && <div className="modal-backdrop"><div className="confirm-modal"><div className="auth-icon"><UserCog size={21} /></div><h3>{pendingStatus.status === "active" ? "Kullanıcıyı Pasifleştir" : "Kullanıcıyı Aktifleştir"}</h3><p>{pendingStatus.status === "active" ? "Kullanıcı pasifleştirildiğinde sisteme erişemez ve mevcut oturumları sonlandırılır." : "Kullanıcı yeniden giriş yapabilir ve kendi çalışma alanına erişebilir."}</p><div><button className="ghost-button" onClick={() => setPendingStatus(null)}>Vazgeç</button><button className="primary-button" onClick={() => void confirmStatus()}>Onayla</button></div></div></div>}
    {resetTarget && <div className="modal-backdrop"><form className="confirm-modal reset-modal" onSubmit={resetUserPassword}><button type="button" className="modal-close" onClick={() => setResetTarget(null)}><X size={18} /></button><div className="auth-icon"><KeyRound size={21} /></div><h3>Geçici şifre belirle</h3><p>{resetTarget.fullName} için yeni bir geçici şifre oluşturun. Eski şifre geçersiz olacak ve aktif oturumlar kapanacaktır.</p><label><span>Yeni geçici şifre</span><input type={showPassword ? "text" : "password"} value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} required /></label><label><span>Şifre tekrarı</span><input type={showPassword ? "text" : "password"} value={resetConfirmation} onChange={(event) => setResetConfirmation(event.target.value)} required /></label><PasswordChecklist rules={resetRules} /><div><button type="button" className="ghost-button" onClick={() => setResetTarget(null)}>Vazgeç</button><button className="primary-button">Şifreyi Sıfırla</button></div></form></div>}
  </div>;
}

function PasswordChecklist({ rules }: { rules: Record<string, boolean> }) { const labels: Record<string, string> = { length: "En az 8 karakter", upper: "Büyük harf", lower: "Küçük harf", number: "Rakam", notIdentity: "Ad, soyad veya e-posta içermez", match: "Şifreler eşleşiyor" }; return <div className="admin-password-rules">{Object.entries(rules).map(([key, ok]) => <span className={ok ? "ok" : ""} key={key}><Check size={12} /> {labels[key]}</span>)}</div>; }
function DetailLists({ detail }: { detail: UserDetail }) { return <><section className="drawer-section"><h3>Yüklediği dosyalar</h3>{detail.files.length ? detail.files.slice(0, 5).map((file) => <div className="detail-row" key={file.id}><FileSpreadsheet size={15} /><div><b>{file.fileName}</b><small>{file.provider} · {file.period} · {formatDate(file.createdAt)}</small></div></div>) : <p className="detail-empty">Henüz dosya yüklenmedi.</p>}</section><section className="drawer-section"><h3>Son aktiviteler</h3>{detail.activities.length ? detail.activities.slice(0, 6).map((entry) => <div className="detail-row" key={entry.id}><ShieldCheck size={15} /><div><b>{formatAuditAction(entry.action)}</b><small>{formatDate(entry.createdAt)}</small></div></div>) : <p className="detail-empty">Henüz aktivite bulunmuyor.</p>}</section></>; }
