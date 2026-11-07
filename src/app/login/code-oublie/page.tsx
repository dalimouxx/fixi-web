'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, KeyRound, MapPin, Store, UserRound } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { FixiAnimatedLogo } from '@/components/fixi-animated-logo';

/** « Code PIN oublié » : le gérant choisit un nouveau PIN avec son code de secours. */
export default function ForgotPin() {
  const [regions, setRegions] = useState<string[]>([]); const [region, setRegion] = useState('');
  const [shops, setShops] = useState<any[]>([]); const [shop, setShop] = useState('');
  const [users, setUsers] = useState<any[]>([]); const [user, setUser] = useState('');
  const [code, setCode] = useState(''); const [pin, setPin] = useState(''); const [pin2, setPin2] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  useEffect(() => { fetch('/api/public/login-options').then(r => r.json()).then(j => { setRegions(j.regions || []); const r = localStorage.getItem('fixi-region'); if (r) setRegion(r); }).catch(() => {}); }, []);
  useEffect(() => { if (!region) return; fetch('/api/public/login-options?region=' + encodeURIComponent(region)).then(r => r.json()).then(j => { setShops(j.shops || []); const s = localStorage.getItem('fixi-shop'); if ((j.shops || []).some((x: any) => x.slug === s)) setShop(s!); }).catch(() => {}); }, [region]);
  useEffect(() => { if (!shop) return; fetch('/api/public/login-options?shop=' + encodeURIComponent(shop)).then(r => r.json()).then(j => setUsers(j.users || [])).catch(() => {}); }, [shop]);
  const ready = shop && user && code.replace(/[^A-Za-z0-9]/g, '').length >= 12 && /^\d{6}$/.test(pin) && pin === pin2;
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!ready) return; setBusy(true); setErr('');
    try {
      const r = await fetch('/api/auth/recover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shopSlug: shop, userId: user, code, newPin: pin }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Opération impossible');
      setDone(true);
    } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }
  return <div className="supplier-auth fxm-auth fxm-auth--card"><div className="fxm-aurora" aria-hidden="true"><span className="fxm-blob b1" /><span className="fxm-blob b2" /></div><span className="fxm-auth-theme"><ThemeToggle /></span>
    <form className="supplier-login-card fxm-forgot" onSubmit={submit}>
      <div className="supplier-login-logo fx-auth-brand"><FixiAnimatedLogo size={52} /><div><b>Code PIN oublié</b><span>Espace atelier · gérant</span></div></div>
      {done ? <div className="fxm-forgot-done"><CheckCircle2 size={44} /><h1>Nouveau code PIN enregistré</h1><p>Votre code de secours a été utilisé : pensez à en créer un nouveau dans Paramètres → Sécurité et données.</p><Link className="btn btn-primary btn-block" href="/login">Se connecter</Link></div> : <>
        <p>Avec le <b>code de secours</b> créé dans Paramètres → Sécurité et données (format FIXI-XXXX-XXXX-XXXX). Vous êtes employé ? Demandez à votre gérant de changer votre code dans Équipe.</p>
        {err && <div className="error" role="alert">{err}</div>}
        <label className="label"><MapPin size={13} /> Région</label><select className="input" value={region} onChange={e => { setRegion(e.target.value); setShop(''); setUser(''); }}><option value="">Choisir…</option>{regions.map(r => <option key={r}>{r}</option>)}</select>
        <label className="label"><Store size={13} /> Boutique</label><select className="input" value={shop} disabled={!region} onChange={e => { setShop(e.target.value); setUser(''); }}><option value="">Choisir…</option>{shops.map(s => <option key={s.slug} value={s.slug}>{s.name}</option>)}</select>
        <label className="label"><UserRound size={13} /> Gérant</label><select className="input" value={user} disabled={!shop} onChange={e => setUser(e.target.value)}><option value="">Choisir…</option>{users.map(u => <option key={u.id} value={u.id}>{u.fullName} · {u.roleLabel}</option>)}</select>
        <label className="label"><KeyRound size={13} /> Code de secours</label><input className="input mono" autoCapitalize="characters" autoComplete="off" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="FIXI-XXXX-XXXX-XXXX" />
        <label className="label">Nouveau code PIN (6 chiffres)</label><input className="input" type="password" inputMode="numeric" maxLength={6} autoComplete="new-password" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} />
        <label className="label">Confirmer le code PIN</label><input className="input" type="password" inputMode="numeric" maxLength={6} autoComplete="new-password" value={pin2} onChange={e => setPin2(e.target.value.replace(/\D/g, '').slice(0, 6))} />
        {pin2.length === 6 && pin !== pin2 && <small className="fxm-forgot-warn">Les deux codes ne sont pas identiques.</small>}
        <button className="btn btn-primary btn-block" disabled={!ready || busy}><KeyRound size={16} />{busy ? 'Vérification…' : 'Enregistrer mon nouveau code'}</button>
        <div className="supplier-login-foot"><Link href="/login"><ArrowLeft size={14} /> Retour à la connexion</Link></div>
      </>}
    </form>
  </div>;
}
