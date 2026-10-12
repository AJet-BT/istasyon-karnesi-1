"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Ban, Check, Clock3, Edit3, Link2, MapPin, Plus, Search, X } from "lucide-react";
import { formatAuditAction, formatAuditValue, MISSING_VALUE_LABEL, userFacingError } from "@/lib/corporate-language";

type Port = { id: string; stationCode: string; iataCode: string | null; airportName: string | null; shortName: string | null; displayCity: string | null; cityId: string | null; cityName: string | null; countryId: string | null; countryCode: string | null; countryName: string | null; regionId: string | null; regionCode: string | null; regionName: string | null; activeStatus: string; createdAt: number; updatedAt: number };
type Region = { id: string; code: string; name: string };
type Country = { id: string; iso2Code: string; iso3Code: string; nameTr: string; nameEn: string };
type City = { id: string; countryId: string; name: string; displayName: string };
type History = { id: string; portId: string | null; stationCode: string; action: string; previousValue: string | null; newValue: string | null; changedBy: string; createdAt: number };
type Payload = { ports: Port[]; regions: Region[]; countries: Country[]; cities: City[]; unresolved: Array<{ stationCode: string; count: number }>; history: History[] };

const emptyForm = { id: "", iataCode: "", airportName: "", shortName: "", cityId: "", countryId: "country-tr", regionId: "", displayCity: "", activeStatus: "active" };
function formatDate(value: number) { return value ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : MISSING_VALUE_LABEL; }

export default function PortMaster({ onToast }: { onToast: (message: string) => void }) {
  const [data, setData] = useState<Payload>({ ports: [], regions: [], countries: [], cities: [], unresolved: [], history: [] });
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [targets, setTargets] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/ports");
      const result = await response.json() as Payload & { error?: string };
      if (!response.ok) throw new Error(result.error || "Havalimanı master verisi alınamadı.");
      setData(result); setError(null);
    } catch (loadError) { setError(userFacingError(loadError, "Havalimanı master verisi yüklenemedi. Lütfen yeniden deneyin.")); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("tr-TR");
    return data.ports.filter((port) => !query || `${port.stationCode} ${port.airportName} ${port.shortName} ${port.cityName} ${port.countryName} ${port.regionName}`.toLocaleLowerCase("tr-TR").includes(query));
  }, [data.ports, search]);

  async function request(path: string, options: RequestInit) {
    const response = await fetch(path, { ...options, headers: { "content-type": "application/json" } });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error || "İşlem tamamlanamadı.");
    return result;
  }

  function startCreate(code = "") { setForm({ ...emptyForm, iataCode: code }); setFormOpen(true); }
  function startEdit(port: Port) { setForm({ id: port.id, iataCode: port.stationCode, airportName: port.airportName ?? "", shortName: port.shortName ?? "", cityId: port.cityId ?? "", countryId: port.countryId ?? "country-tr", regionId: port.regionId ?? "", displayCity: port.displayCity ?? "", activeStatus: port.activeStatus }); setFormOpen(true); }

  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      await request(form.id ? `/api/admin/ports/${form.id}` : "/api/admin/ports", { method: form.id ? "PATCH" : "POST", body: JSON.stringify(form) });
      onToast(form.id ? "Havalimanı master kaydı güncellendi." : "Yeni havalimanı master kaydı oluşturuldu.");
      setFormOpen(false); setForm(emptyForm); await load();
    } catch (saveError) { setError(userFacingError(saveError, "Havalimanı kaydı kaydedilemedi. Lütfen bilgileri kontrol ederek yeniden deneyin.")); }
  }

  async function resolve(stationCode: string, action: "map" | "review" | "exclude") {
    try {
      await request("/api/admin/ports/resolve", { method: "POST", body: JSON.stringify({ stationCode, action, portId: targets[stationCode] }) });
      onToast(action === "map" ? `${stationCode} kodu master veriyle eşleştirildi.` : action === "exclude" ? `${stationCode} içe aktarım kapsamı dışında bırakıldı.` : `${stationCode} inceleme listesinde bırakıldı.`);
      await load();
    } catch (resolveError) { setError(userFacingError(resolveError, "Eşleştirme işlemi tamamlanamadı. Lütfen yeniden deneyin.")); }
  }

  return <div className="port-master-stack">
    {error && <div className="quality-callout warning"><AlertTriangle size={19} /><div><strong>Master veri işlemi tamamlanamadı</strong><p>{error}</p></div><button className="icon-button" onClick={() => setError(null)}><X size={16} /></button></div>}
    {data.unresolved.length > 0 && <article className="panel unresolved-panel"><div className="section-header"><div><span>ÇÖZÜMLENMEMİŞ KODLAR</span><h2>Coğrafi Eşleştirme Bekleyen Havalimanları</h2></div><b>{data.unresolved.length} kod</b></div><div className="unresolved-grid">{data.unresolved.map((item) => <div key={item.stationCode}><span><AlertTriangle size={17} /></span><div><b>{item.stationCode}</b><small>{item.count} performans kaydı · coğrafi bilgi üretilmedi</small><select value={targets[item.stationCode] ?? ""} onChange={(event) => setTargets({ ...targets, [item.stationCode]: event.target.value })}><option value="">Mevcut havalimanıyla eşleştir</option>{data.ports.filter((port) => port.activeStatus === "active").map((port) => <option key={port.id} value={port.id}>{port.stationCode} — {port.shortName}</option>)}</select></div><div className="unresolved-actions"><button disabled={!targets[item.stationCode]} onClick={() => void resolve(item.stationCode, "map")} title="Eşleştir"><Link2 size={14} /></button><button onClick={() => startCreate(item.stationCode)} title="Yeni Havalimanı Oluştur"><Plus size={14} /></button><button onClick={() => void resolve(item.stationCode, "review")} title="İncelemede Bırak"><Clock3 size={14} /></button><button onClick={() => void resolve(item.stationCode, "exclude")} title="İçe Aktarımdan Hariç Tut"><Ban size={14} /></button></div></div>)}</div></article>}
    <article className="panel table-panel port-master-table"><div className="table-toolbar admin-toolbar"><div className="admin-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Kod, havalimanı, şehir veya ülke ara" /></div><button className="primary-button" onClick={() => startCreate()}><Plus size={15} /> Yeni Havalimanı</button></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Kod</th><th>Havalimanı</th><th>Şehir</th><th>Ülke</th><th>Bölge</th><th>Durum</th><th>Son Güncelleme</th><th>İşlemler</th></tr></thead><tbody>{filtered.map((port) => <tr key={port.id}><td><b>{port.stationCode}</b></td><td><b>{port.airportName}</b><small>{port.shortName}</small></td><td>{port.displayCity || port.cityName}</td><td>{port.countryName} <small>{port.countryCode}</small></td><td>{port.regionName}</td><td><span className={`admin-status ${port.activeStatus === "active" ? "active" : "inactive"}`}>{port.activeStatus === "active" ? "Aktif" : "Pasif"}</span></td><td>{formatDate(port.updatedAt)}</td><td><button className="icon-button" onClick={() => startEdit(port)} title="Düzenle"><Edit3 size={15} /></button></td></tr>)}</tbody></table></div></article>
    <article className="panel table-panel"><div className="section-header"><div><span>EŞLEŞTİRME GEÇMİŞİ</span><h2>Master Veri Değişiklikleri</h2></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Kod</th><th>İşlem</th><th>Değiştiren</th><th>Tarih</th><th>Yeni Değer</th></tr></thead><tbody>{data.history.slice(0, 30).map((entry) => <tr key={entry.id}><td><b>{entry.stationCode}</b></td><td>{formatAuditAction(entry.action)}</td><td>{entry.changedBy}</td><td>{formatDate(entry.createdAt)}</td><td><small>{formatAuditValue(entry.newValue)}</small></td></tr>)}</tbody></table></div></article>
    {formOpen && <div className="modal-backdrop"><form className="confirm-modal port-form-modal" onSubmit={save}><button type="button" className="modal-close" onClick={() => setFormOpen(false)}><X size={18} /></button><div className="auth-icon"><MapPin size={21} /></div><h3>{form.id ? "Havalimanını düzenle" : "Yeni havalimanı ekle"}</h3><p>IATA kodunu merkezi coğrafi master veriye bağlayın. Bu kayıt sonraki Excel yüklemelerinde otomatik kullanılacaktır.</p><div className="port-form-grid"><label><span>IATA kodu</span><input maxLength={3} value={form.iataCode} onChange={(event) => setForm({ ...form, iataCode: event.target.value.toLocaleUpperCase("tr-TR") })} required /></label><label><span>Durum</span><select value={form.activeStatus} onChange={(event) => setForm({ ...form, activeStatus: event.target.value })}><option value="active">Aktif</option><option value="inactive">Pasif</option></select></label><label className="wide"><span>Havalimanı adı</span><input value={form.airportName} onChange={(event) => setForm({ ...form, airportName: event.target.value })} required /></label><label className="wide"><span>Kısa ad</span><input value={form.shortName} onChange={(event) => setForm({ ...form, shortName: event.target.value })} placeholder="Ankara Esenboğa" required /></label><label><span>Şehir</span><select value={form.cityId} onChange={(event) => { const city = data.cities.find((item) => item.id === event.target.value); setForm({ ...form, cityId: event.target.value, countryId: city?.countryId ?? form.countryId }); }} required><option value="">Şehir seçin</option>{data.cities.map((city) => <option key={city.id} value={city.id}>{city.displayName}</option>)}</select></label><label><span>Ülke</span><select value={form.countryId} onChange={(event) => setForm({ ...form, countryId: event.target.value })} required>{data.countries.map((country) => <option key={country.id} value={country.id}>{country.nameTr} · {country.iso2Code}</option>)}</select></label><label><span>Bölge</span><select value={form.regionId} onChange={(event) => setForm({ ...form, regionId: event.target.value })} required><option value="">Bölge seçin</option>{data.regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select></label><label><span>Görünen şehir</span><input value={form.displayCity} onChange={(event) => setForm({ ...form, displayCity: event.target.value })} placeholder="Bodrum / Muğla" /></label></div><div><button type="button" className="ghost-button" onClick={() => setFormOpen(false)}>Vazgeç</button><button className="primary-button"><Check size={15} /> Kaydet</button></div></form></div>}
  </div>;
}
