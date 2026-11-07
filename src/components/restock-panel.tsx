'use client';
import Link from 'next/link';
import { PackageOpen, TrendingDown } from 'lucide-react';
import { useApi } from './ui';
import '@/app/fixi-astuces.css';

/** Stock : « Vous vendez 12 verres trempés par semaine, il en reste 3 » + commande chez le fournisseur. */
export function RestockPanel() {
  const { data } = useApi<any>('/api/stock/restock');
  const rows = data?.rows || [];
  if (!rows.length) return null;
  return <section className="rs-panel fxm-in" aria-label="À recommander">
    <div className="rs-head"><TrendingDown size={18} /><b>À recommander bientôt</b><small>d’après vos 4 dernières semaines</small></div>
    <div className="rs-list">{rows.map((x: any) => <div key={x.id} className={'rs-row u' + x.urgency}>
      <div className="rs-main"><b>{x.name}</b><small>{x.sentence}</small></div>
      <Link className="btn btn-soft btn-sm" href={`/app/suppliers?q=${encodeURIComponent(x.name)}`}><PackageOpen size={15} /> Commander {x.suggested}</Link>
    </div>)}</div>
  </section>;
}
