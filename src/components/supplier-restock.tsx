'use client';
import { useEffect, useState } from 'react';
import { TrendingUp, AlertTriangle } from 'lucide-react';

// Réapprovisionnement conseillé : quantités à racheter pour tenir 2 semaines, d'après les commandes des ateliers.
export function SupplierRestock({ onBuy }: { onBuy?: (p: any) => void }) {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => { fetch('/api/supplier/restock').then(r => r.ok ? r.json() : []).then(setRows).catch(() => setRows([])); }, []);
  if (!rows || !rows.length) return null;
  return <section className="fx-panel fx-restock">
    <div className="fx-panel-head"><h2><TrendingUp size={18} /> À racheter bientôt</h2><span className="fx-chip">{rows.length}</span></div>
    <p className="fx-panel-sub">D’après ce que vos clients commandent ces 8 dernières semaines, pour tenir 2 semaines.</p>
    <div className="fx-list">{rows.map(p => <div key={p.id} className={`fx-row ${p.urgent ? 'fx-row--danger' : 'fx-row--warning'}`}>
      {p.urgent ? <AlertTriangle /> : <TrendingUp />}
      <span className="fx-row-main"><b>{p.name}</b><small>{p.available} dispo · ~{p.avgPerWeek} / semaine{p.weeksLeft !== null ? ` · ${p.weeksLeft < 1 ? 'rupture dans moins d’une semaine' : `≈ ${p.weeksLeft} semaine(s) de stock`}` : ''}</small></span>
      <strong className="fx-restock-qty">+{p.suggested}</strong>
      {onBuy && <button type="button" className="btn btn-soft btn-sm" onClick={() => onBuy(p)}>Racheter</button>}
    </div>)}</div>
  </section>;
}
