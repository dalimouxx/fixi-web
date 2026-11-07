'use client';
import Link from 'next/link';
import { useState } from 'react';
import { BookOpenCheck, Plus, Search, Smartphone, TrendingUp, Wallet, BatteryMedium } from 'lucide-react';
import { useApi } from '@/components/ui';
import { money, dateOnly } from '@/lib/format';
import { conditionLabel, deviceTitle } from '@/lib/used-devices';
import '@/app/fixi-occasion.css';

const TABS = [['IN_STOCK', 'En stock'], ['RESERVED', 'Réservés'], ['SOLD', 'Vendus'], ['', 'Tous']] as const;

/** Téléphones d'occasion : achetés aux particuliers, étiquetés, revendus. */
export default function UsedDevices() {
  const [status, setStatus] = useState<string>('IN_STOCK'); const [q, setQ] = useState('');
  const { data } = useApi<any>(`/api/used-devices?status=${status}&q=${encodeURIComponent(q)}`);
  const k = data?.kpis || {};
  return <div className="fx-page fxm-occ">
    <div className="fx-hello"><div><h1>Téléphones d’occasion</h1><p>Achat avec la pièce d’identité du vendeur, IMEI vérifié, étiquette et revente avec garantie.</p></div>
      <div className="fxm-occ-actions"><Link className="btn btn-ghost" href="/occasion/registre" target="_blank"><BookOpenCheck size={17} /> Registre</Link><Link className="btn btn-primary" href="/app/occasion/nouveau"><Plus size={18} /> Acheter un téléphone</Link></div></div>
    <section className="fx-kpis" aria-label="Résumé">
      <div className="fx-kpi"><Smartphone /><div><span>En stock</span><strong>{k.inStock ?? '—'}</strong></div></div>
      <div className="fx-kpi"><Wallet /><div><span>Payé aux vendeurs</span><strong>{money(k.stockCost || 0)}</strong></div></div>
      <div className="fx-kpi"><TrendingUp /><div><span>Marge du mois</span><strong>{money(k.marginMonth || 0)}</strong><small>{k.soldMonth || 0} vendu(s)</small></div></div>
    </section>
    <div className="fxm-occ-bar">
      <div className="fxm-seg" role="tablist">{TABS.map(([v, l]) => <button key={l} role="tab" aria-selected={status === v} className={status === v ? 'on' : ''} onClick={() => setStatus(v)}>{l}</button>)}</div>
      <div className="fx-searchbar"><Search size={18} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Modèle, IMEI, numéro OCC, vendeur…" aria-label="Rechercher" /></div>
    </div>
    <div className="fxm-occ-grid">
      {(data?.rows || []).map((d: any, i: number) => <Link key={d.id} href={`/app/occasion/${d.id}`} className={'fxm-occ-card fxm-in st-' + d.status} style={{ '--d': `${Math.min(i, 12) * 0.03}s` } as any}>
        <div className="fxm-occ-top"><span className="fxm-occ-num">{d.number}</span><em className={'fxm-occ-st st-' + d.status}>{({ IN_STOCK: 'En stock', RESERVED: 'Réservé', SOLD: 'Vendu', RETURNED: 'Retourné' } as any)[d.status]}</em></div>
        <b>{deviceTitle(d)}</b>
        <small>{conditionLabel(d.condition)}{d.color ? ` · ${d.color}` : ''}</small>
        {d.batteryHealth != null && <span className={'fxm-occ-bat' + (d.batteryHealth < 80 ? ' low' : '')}><BatteryMedium size={14} /> {d.batteryHealth} %</span>}
        <div className="fxm-occ-foot"><span>Achat {money(d.purchasePrice)}</span><strong>{d.status === 'SOLD' ? money(d.soldPrice) : d.askingPrice ? money(d.askingPrice) : 'Prix à fixer'}</strong></div>
        <small className="fxm-occ-date">{d.status === 'SOLD' ? `Vendu le ${dateOnly(d.soldAt)}` : `Acheté le ${dateOnly(d.purchasedAt)}`}</small>
      </Link>)}
      {data && !data.rows.length && <div className="fx-empty"><b>Aucun téléphone ici</b><span>Achetez un téléphone à un particulier : Fixi vérifie l’IMEI et prépare l’attestation et l’étiquette.</span><Link className="btn btn-primary btn-sm" href="/app/occasion/nouveau"><Plus size={16} /> Acheter un téléphone</Link></div>}
    </div>
  </div>;
}
