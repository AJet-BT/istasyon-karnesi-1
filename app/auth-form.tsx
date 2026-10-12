"use client";
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useMemo, useState } from "react";
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { userFacingError } from "@/lib/corporate-language";

export function AuthForm({ mode }: { mode: "login" | "change" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checks = useMemo(() => ({
    length: password.length >= 8,
    upper: /[A-ZÇĞİÖŞÜ]/.test(password),
    lower: /[a-zçğıöşü]/.test(password),
    number: /\d/.test(password),
    match: Boolean(password) && password === confirmation,
  }), [password, confirmation]);
  const strength = Object.values(checks).filter(Boolean).length;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setError(null);
    try {
      const response = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mode === "login" ? { email, password } : { password, passwordConfirmation: confirmation }),
      });
      const result = await response.json() as { error?: string; redirectTo?: string };
      if (!response.ok) throw new Error(result.error || "İşlem tamamlanamadı.");
      window.location.assign(result.redirectTo || "/");
    } catch (submitError) {
      setError(userFacingError(submitError, mode === "login" ? "Giriş yapılamadı. E-posta ve şifrenizi kontrol ederek yeniden deneyin." : "Şifre değiştirilemedi. Lütfen yeniden deneyin."));
    } finally { setLoading(false); }
  }

  return (
    <main className="auth-shell">
      <section className="auth-brand">
        <div className="auth-brand-content">
          <img src="/ajet-logo.png" alt="AJet" />
          <span>YER İŞLETME BAŞKANLIĞI</span>
          <h1>İstasyon performansını tek çalışma alanında yönetin.</h1>
          <p>Veri yükleme, veri kalitesi, analiz, raporlama ve kullanıcı erişimleri AJet güvenlik kurallarıyla korunur.</p>
          <div className="auth-trust"><ShieldCheck size={20} /><div><b>Güvenli kullanıcı erişimi</b><small>Güçlü şifreleme · rol bazlı yetki · kişisel çalışma alanı</small></div></div>
        </div>
      </section>
      <section className="auth-form-side">
        <form className="auth-card" onSubmit={submit}>
          <div className="auth-icon"><LockKeyhole size={23} /></div>
          <span className="auth-eyebrow">AJET PERFORMANS PLATFORMU</span>
          <h2>{mode === "login" ? "Hesabınıza giriş yapın" : "Yeni şifrenizi belirleyin"}</h2>
          <p>{mode === "login" ? "Genel Bakışa ve çalışma alanınıza erişmek için kurumsal kullanıcı bilgilerinizle giriş yapın." : "İlk girişinizi tamamlamak için geçici şifrenizi kalıcı ve güvenli bir şifreyle değiştirin."}</p>
          {mode === "login" && <label className="auth-field"><span>E-posta</span><div><Mail size={17} /><input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ad.soyad@ajet.com" required /></div></label>}
          <label className="auth-field"><span>{mode === "login" ? "Şifre" : "Yeni şifre"}</span><div><LockKeyhole size={17} /><input type={visible ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••••••" required /><button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? "Şifreyi gizle" : "Şifreyi göster"}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
          {mode === "change" && <>
            <label className="auth-field"><span>Yeni şifre tekrarı</span><div><LockKeyhole size={17} /><input type={visible ? "text" : "password"} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="••••••••••••" required /></div></label>
            <div className="password-strength"><div><span>Şifre gücü</span><b>{strength >= 5 ? "Güçlü" : strength >= 3 ? "Orta" : "Zayıf"}</b></div><i><b style={{ width: `${strength * 20}%` }} /></i><ul><li className={checks.length ? "ok" : ""}><Check /> En az 8 karakter</li><li className={checks.upper ? "ok" : ""}><Check /> Büyük harf</li><li className={checks.lower ? "ok" : ""}><Check /> Küçük harf</li><li className={checks.number ? "ok" : ""}><Check /> Rakam</li><li className={checks.match ? "ok" : ""}><Check /> Şifreler eşleşiyor</li></ul></div>
          </>}
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-submit" disabled={loading || (mode === "change" && strength < 5)}>{loading ? "Kontrol ediliyor…" : mode === "login" ? "Giriş Yap" : "Şifreyi Değiştir"}<ArrowRight size={17} /></button>
          <small className="auth-footnote">Yetkisiz erişim girişimleri güvenlik kayıtlarına alınır.</small>
        </form>
      </section>
    </main>
  );
}
