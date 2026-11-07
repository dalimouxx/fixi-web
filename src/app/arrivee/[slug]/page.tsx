'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, Smartphone } from 'lucide-react';
import '@/app/fixi-astuces.css';

const ISSUES = ['Écran cassé', 'Batterie', 'Ne charge plus', 'Ne s’allume pas', 'Vitre arrière', 'Caméra', 'Son / micro', 'Logiciel', 'Tombé dans l’eau'];
const BRANDS = ['Samsung', 'Apple', 'Xiaomi', 'Oppo', 'Infinix', 'Tecno', 'Realme', 'Huawei', 'Honor', 'Autre'];

/** Page publique (QR du comptoir) : le client s'enregistre lui-même pendant qu'il attend. */
export default function SelfCheckIn() {
  const { slug } = useParams<{ slug: string }>();
  const [shop, setShop] = useState<any>(null);
  const [f, setF] = useState({ fullName: '', phone: '', brand: '', model: '', issue: '', consent: false });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [done, setDone] = useState<any>(null);
  useEffect(() => { fetch(`/api/public/checkin/${slug}`).then(r => r.ok ? r.json() : null).then(setShop).catch(() => {}); }, [slug]);
  const ok = f.fullName.trim().length >= 2 && f.phone.replace(/\D/g, '').length >= 8 && f.issue.trim().length >= 2 && f.consent;
  async function send(e: React.FormEvent) {
    e.preventDefault(); if (!ok) return; setBusy(true); setErr('');
    try { const r = await fetch(`/api/public/checkin/${slug}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Envoi impossible'); setDone(j); }
    catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }
  return <main className="ci-page" style={{ '--shop': shop?.brandColor || '#ff3d77' } as any}>
    <header className="ci-head">{shop?.logoDataUrl ? <img src={shop.logoDataUrl} alt="" /> : <span className="ci-logo"><Smartphone size={22} /></span>}<div><b>{shop?.name || 'Atelier'}</b><small>Enregistrement rapide</small></div></header>
    {done ? <section className="ci-card ci-done"><CheckCircle2 size={52} /><h1>Merci {f.fullName.split(' ')[0]} !</h1><p>Vous êtes enregistré{done.position > 1 ? ` · ${done.position - 1} personne(s) avant vous` : ''}. Gardez votre téléphone avec vous : l’atelier vous appelle au comptoir.</p></section> :
    <form className="ci-card" onSubmit={send}>
      <h1>Bienvenue 👋</h1><p>Gagnez du temps : remplissez ceci pendant que vous patientez.</p>
      <label><span>Nom et prénom</span><input value={f.fullName} onChange={e => setF({ ...f, fullName: e.target.value })} autoComplete="name" /></label>
      <label><span>Téléphone</span><input value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} inputMode="tel" autoComplete="tel" placeholder="20 123 456" /></label>
      <span className="ci-label">Marque</span><div className="ci-chips">{BRANDS.map(b => <button type="button" key={b} aria-pressed={f.brand === b} onClick={() => setF({ ...f, brand: b })}>{b}</button>)}</div>
      <label><span>Modèle (si vous le connaissez)</span><input value={f.model} onChange={e => setF({ ...f, model: e.target.value })} placeholder="Galaxy A54, iPhone 13…" /></label>
      <span className="ci-label">Le problème</span><div className="ci-chips">{ISSUES.map(x => <button type="button" key={x} aria-pressed={f.issue === x} onClick={() => setF({ ...f, issue: x })}>{x}</button>)}</div>
      <label><span>Précisions</span><input value={ISSUES.includes(f.issue) ? '' : f.issue} onChange={e => setF({ ...f, issue: e.target.value })} placeholder="Ou décrivez le problème" /></label>
      <label className="ci-consent"><input type="checkbox" checked={f.consent} onChange={e => setF({ ...f, consent: e.target.checked })} /> J’accepte que l’atelier utilise mon numéro pour le suivi de ma réparation.</label>
      {err && <p className="ci-err" role="alert">{err}</p>}
      <button className="ci-go" disabled={!ok || busy}>{busy ? 'Envoi…' : 'Je m’enregistre'}</button>
    </form>}
    <footer className="ci-foot">Propulsé par Fixi</footer>
  </main>;
}
