'use client';
import { useEffect, useState } from 'react';
import { Handshake, Send, Truck } from 'lucide-react';
import { money } from '@/lib/format';

/** Livreurs partenaires : partager mes livreurs (prix par course) et confier une commande prête à un livreur d'un autre fournisseur. */
export function SupplierPartnerCouriers({ orders, onChanged }: { orders: any[]; onChanged: () => void }) {
  const [mine, setMine] = useState<any>(null); const [pool, setPool] = useState<any>(null); const [n, setN] = useState(0); const [err, setErr] = useState(''); const [pick, setPick] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch('/api/supplier/drivers/share', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(setMine).catch(() => {});
    fetch('/api/supplier/partner-couriers', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(setPool).catch(() => {});
  }, [n]);
  if (!mine) return null;
  const ready = orders.filter(o => o.status === 'READY_FOR_DELIVERY' && !o.delivery?.driverAccountId);
  async function call(url: string, method: string, body: any) { setErr(''); const r = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) { setErr(j.error); return false; } setN(x => x + 1); onChanged(); return true; }
  return <section className="supplier-panel pc">
    <h3><Handshake size={17} /> Livreurs partenaires</h3>
    {!mine.allowed ? <p className="pc-off">Inclus dans l’abonnement Fixi Fournisseur actif : partagez vos livreurs avec d’autres fournisseurs de votre région, ou confiez-leur vos courses.</p> : <>
      <div className="pc-grid">
        <div><h4>Mes livreurs disponibles pour d’autres fournisseurs</h4>
          {mine.drivers.length ? mine.drivers.map((d: any) => <form key={d.id} className="pc-row" onSubmit={e => { e.preventDefault(); const fee = (e.currentTarget.elements.namedItem('fee') as HTMLInputElement).value; void call('/api/supplier/drivers/share', 'PATCH', { id: d.id, sharedCourier: !d.sharedCourier, courierFee: fee }); }}>
            <b>{d.fullName}</b><input name="fee" defaultValue={d.courierFee || ''} inputMode="decimal" placeholder="Prix/course" aria-label="Prix par course (DT)" /><button className={'btn btn-sm ' + (d.sharedCourier ? 'btn-soft' : 'btn-ghost')}>{d.sharedCourier ? 'Partagé ✓' : 'Partager'}</button></form>) : <p className="pc-off">Aucun livreur dans votre équipe.</p>}
        </div>
        <div><h4>Confier une commande prête</h4>
          {!ready.length ? <p className="pc-off">Aucune commande prête sans livreur.</p> : !pool?.couriers?.length ? <p className="pc-off">Aucun livreur partenaire disponible dans votre région pour le moment.</p>
            : ready.slice(0, 8).map(o => <div key={o.id} className="pc-row"><b>{o.reference}<small>{o.shop?.name}</small></b>
              <select className="input" value={pick[o.id] || ''} onChange={e => setPick(p => ({ ...p, [o.id]: e.target.value }))}><option value="">Livreur…</option>{pool.couriers.map((c: any) => <option key={c.id} value={c.id}>{c.name} · {c.company} · {money(c.fee)}</option>)}</select>
              <button className="btn btn-primary btn-sm" disabled={!pick[o.id]} onClick={() => call('/api/supplier/partner-couriers', 'POST', { orderId: o.id, driverId: pick[o.id] })}><Send size={14} /></button></div>)}
          <small className="pc-note"><Truck size={12} /> Course partenaire : pas d’encaissement par le livreur, la course est réglée directement au livreur.</small>
        </div>
      </div>
      {err && <p className="rm-err">{err}</p>}
    </>}
  </section>;
}
