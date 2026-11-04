'use client';
import { useEffect, useState } from 'react';
import { Award, Camera, Check, MapPin, Phone, RotateCcw } from 'lucide-react';
import { money } from '@/lib/format';

const REASON: Record<string, string> = { DEFECTIVE: 'défectueuse', WRONG_PART: 'mauvaise pièce', EXCHANGE: 'échange' };

async function compress(file: File) {
  return new Promise<string>((res, rej) => { const img = new Image(); const u = URL.createObjectURL(file); img.onload = () => { const k = Math.min(1, 900 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k; c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL('image/jpeg', .72)); }; img.onerror = rej; img.src = u; });
}

/** Livreur : mes chiffres du jour / de la semaine (avec prime) et pièces à reprendre chez les ateliers. */
export function DriverExtras() {
  const [stats, setStats] = useState<any>(null); const [pickups, setPickups] = useState<any[]>([]); const [n, setN] = useState(0); const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  useEffect(() => {
    fetch('/api/delivery/stats', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(setStats).catch(() => {});
    fetch('/api/delivery/pickups', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).then(setPickups).catch(() => {});
  }, [n]);
  async function collect(p: any, file?: File) {
    setBusy(p.id); setErr('');
    try { const proofUrl = file ? await compress(file) : null; const r = await fetch('/api/delivery/pickups', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: p.id, proofUrl }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); setN(x => x + 1); }
    catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  }
  const t = stats?.today, w = stats?.week;
  return <>
    {w && <section className="dx-stats" aria-label="Mes chiffres">
      <div><Award size={18} /><b>{t?.delivered || 0}</b><span>aujourd’hui</span></div>
      <div><b>{w.delivered}</b><span>7 jours</span></div>
      <div><b>{w.successPct} %</b><span>réussite</span></div>
      <div><b>{w.km}</b><span>km</span></div>
      {stats.bonusPerDelivery > 0 && <div className="dx-bonus"><b>{money(w.bonus)}</b><span>prime 7 j · {money(t?.bonus || 0)} aujourd’hui</span></div>}
    </section>}
    {pickups.length > 0 && <section className="dx-pick">
      <h2 className="dv-h2"><RotateCcw size={18} /> À reprendre <em>{pickups.length}</em></h2>
      {err && <p className="rm-err">{err}</p>}
      {pickups.map(p => <article key={p.id}>
        <div><b>{p.shop.name}</b><small><MapPin size={12} /> {p.shop.address || p.shop.region || '—'}</small><small>{(p.items as any[]).map(i => `${i.quantity} × ${i.name}`).join(', ')} · {REASON[p.reason]}</small></div>
        <div className="dx-actions">{p.shop.phone && <a className="btn btn-ghost btn-sm" href={'tel:' + p.shop.phone} aria-label="Appeler"><Phone size={15} /></a>}
          <label className="btn btn-primary btn-sm dx-cam">{busy === p.id ? '…' : <><Camera size={15} /> Reprise faite</>}<input type="file" accept="image/*" capture="environment" onChange={e => collect(p, e.target.files?.[0])} /></label>
          <button className="btn btn-soft btn-sm" onClick={() => collect(p)} disabled={busy === p.id}><Check size={15} /> Sans photo</button></div>
      </article>)}
    </section>}
  </>;
}
