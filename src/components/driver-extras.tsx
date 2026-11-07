'use client';
import { useEffect, useState } from 'react';
import { humanError } from '@/lib/human-error';
import { Award, Camera, Check, KeyRound, MapPin, Phone, RotateCcw } from 'lucide-react';
import { money } from '@/lib/format';

const REASON: Record<string, string> = { DEFECTIVE: 'défectueuse', WRONG_PART: 'mauvaise pièce', EXCHANGE: 'échange' };

async function compress(file: File) {
  return new Promise<string>((res, rej) => { const img = new Image(); const u = URL.createObjectURL(file); img.onload = () => { const k = Math.min(1, 900 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k; c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL('image/jpeg', .72)); }; img.onerror = rej; img.src = u; });
}

/** Reprise d'une pièce chez l'atelier : code à 4 chiffres donné par l'atelier + photo facultative. */
export function PickupCollect({ pickup, onDone, inline }: { pickup: any; onDone: () => void; inline?: boolean }) {
  const [code, setCode] = useState(''); const [photo, setPhoto] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [ok, setOk] = useState(false);
  async function send() {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/delivery/pickups', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: pickup.id, code, proofUrl: photo || null }) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Reprise non enregistrée');
      setOk(true); onDone();
    } catch (e: any) { setErr(humanError(e)); } finally { setBusy(false); }
  }
  if (ok) return <p className="dx-pick-ok"><Check size={15} /> Pièce reprise. Rapportez-la au dépôt.</p>;
  return <div className={'dx-collect' + (inline ? ' is-inline' : '')}>
    <b><RotateCcw size={15} /> Reprise à faire ici : {(pickup.items as any[]).map(i => `${i.quantity} × ${i.name}`).join(', ')} <em>({REASON[pickup.reason] || pickup.reason})</em></b>
    <div className="dx-collect-row">
      {pickup.needsCode && <label className="dx-code"><KeyRound size={14} /><input inputMode="numeric" maxLength={4} placeholder="Code atelier" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} aria-label="Code de reprise à 4 chiffres donné par l’atelier" /></label>}
      <label className={'btn btn-ghost btn-sm dx-cam' + (photo ? ' is-on' : '')}><Camera size={15} /> {photo ? 'Photo ✓' : 'Photo'}<input type="file" accept="image/*" capture="environment" onChange={async e => { const f = e.target.files?.[0]; if (f) setPhoto(await compress(f)); }} /></label>
      <button type="button" className="btn btn-primary btn-sm" disabled={busy || (pickup.needsCode && code.length !== 4)} onClick={send}>{busy ? '…' : <><Check size={15} /> Pièce reprise</>}</button>
    </div>
    {pickup.needsCode && <small>L’atelier voit ce code dans Fournisseurs → Mes reprises. Il le donne quand il vous remet la pièce.</small>}
    {err && <p className="rm-err">{err}</p>}
  </div>;
}

/** Livreur : mes chiffres du jour / de la semaine (avec prime) et pièces à reprendre chez les ateliers. */
export function DriverExtras({ refresh = 0 }: { refresh?: number }) {
  const [stats, setStats] = useState<any>(null); const [pickups, setPickups] = useState<any[]>([]); const [n, setN] = useState(0);
  useEffect(() => {
    fetch('/api/delivery/stats', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(setStats).catch(() => {});
    fetch('/api/delivery/pickups', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).then(setPickups).catch(() => {});
  }, [n, refresh]);
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
      {pickups.map(p => <article key={p.id}>
        <div><b>{p.shop.name}</b><small><MapPin size={12} /> {p.shop.address || p.shop.region || '—'}</small><small>{(p.items as any[]).map(i => `${i.quantity} × ${i.name}`).join(', ')} · {REASON[p.reason]}</small></div>
        <div className="dx-actions">{p.shop.phone && <a className="btn btn-ghost btn-sm" href={'tel:' + p.shop.phone} aria-label="Appeler"><Phone size={15} /></a>}</div>
        <PickupCollect pickup={p} onDone={() => setN(x => x + 1)} />
      </article>)}
    </section>}
  </>;
}
