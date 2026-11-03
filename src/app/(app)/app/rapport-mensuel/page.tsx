'use client';
import { useEffect, useState } from 'react';
import { Printer, FileSpreadsheet, Wallet, TrendingUp, Wrench, PackageCheck, ReceiptText } from 'lucide-react';
import { useApi } from '@/components/ui';
import { money } from '@/lib/format';
import { monthLabel, previousMonth } from '@/lib/monthly-report';

const METHOD: Record<string, string> = { CASH: 'Espèces', CARD: 'Carte', BANK_TRANSFER: 'Virement', FLOUCI: 'Flouci', ONLINE: 'En ligne', D17: 'D17', OTHER: 'Autre' };
const months = () => Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });

// Rapport du mois : à imprimer en PDF ou à envoyer au comptable (fichier Excel).
export default function MonthlyReport() {
  const [m, setM] = useState(previousMonth());
  useEffect(() => { const q = new URLSearchParams(location.search).get('m'); if (q && /^\d{4}-\d{2}$/.test(q)) setM(q); }, []);
  const { data, loading, error } = useApi<any>(`/api/reports/monthly?m=${m}`);
  const s = data?.summary;
  const maxIssue = Math.max(1, ...(s?.topIssues || []).map((x: any) => x.count));
  return <div className="fx-page fx-report">
    <div className="fx-hello no-print"><div><h1>Rapport du mois</h1><p>À imprimer en PDF ou à envoyer à votre comptable.</p></div>
      <div className="fx-report-actions">
        <select className="select" value={m} onChange={e => setM(e.target.value)} aria-label="Mois">{months().map(x => <option key={x} value={x}>{monthLabel(x)}</option>)}</select>
        <button className="btn btn-ghost" onClick={() => window.print()}><Printer size={18} /> PDF</button>
        <a className="btn btn-primary" href={`/api/export/accounting?m=${m}`}><FileSpreadsheet size={18} /> Fichier comptable (Excel)</a>
      </div></div>
    {error && <div className="error">{error}</div>}
    {loading && !data ? <div className="card card-pad fx-skeleton" role="status" aria-label="Chargement"><i /><i /><i /></div> : s && <>
      <header className="fx-report-head"><b>{data.shop?.name}</b><h2 className="fx-cap">{monthLabel(m)}</h2></header>
      <section className="fx-kpis fx-kpis--4">
        <div className="fx-kpi"><Wallet /><div><span>Encaissé</span><strong>{money(s.revenue)}</strong></div></div>
        <div className="fx-kpi"><TrendingUp /><div><span>Bénéfice estimé</span><strong>{money(s.profit)}</strong><small>dépenses {money(s.expenseTotal)} · pièces {money(s.partsCost)}</small></div></div>
        <div className="fx-kpi"><Wrench /><div><span>Appareils reçus</span><strong>{s.received}</strong></div></div>
        <div className="fx-kpi"><PackageCheck /><div><span>Rendus</span><strong>{s.delivered}</strong><small>ticket moyen {money(s.avgTicket)}</small></div></div>
      </section>
      <div className="fx-grid-2">
        <section className="fx-panel"><div className="fx-panel-head"><h2>Pannes les plus fréquentes</h2></div>
          <div className="fx-bars">{s.topIssues.map((x: any) => <div key={x.label}><span>{x.label}</span><i><b style={{ width: `${Math.round(x.count / maxIssue * 100)}%` }} /></i><strong>{x.count}</strong></div>)}{!s.topIssues.length && <p className="fx-panel-sub">Pas encore assez de réparations ce mois-ci.</p>}</div></section>
        <section className="fx-panel"><div className="fx-panel-head"><h2>Techniciens</h2></div>
          <div className="fx-list">{s.technicians.map((t: any) => <div key={t.name} className="fx-row"><Wrench /><span className="fx-row-main"><b>{t.name}</b><small>appareils rendus</small></span><strong>{t.count}</strong></div>)}{!s.technicians.length && <p className="fx-panel-sub">Aucun appareil rendu.</p>}</div></section>
      </div>
      <section className="fx-panel" style={{ marginTop: 12 }}><div className="fx-panel-head"><h2>Encaissements par mode</h2><span className="fx-chip"><ReceiptText size={14} /> TVA facturée {money(s.taxTotal)}</span></div>
        <div className="fx-list">{Object.entries(s.byMethod).map(([k, v]: any) => <div key={k} className="fx-row"><Wallet /><span className="fx-row-main"><b>{METHOD[k] || k}</b></span><strong>{money(v)}</strong></div>)}</div></section>
      <p className="fx-report-foot">Rapport généré par Fixi le {new Date().toLocaleDateString('fr-FR')}. Bénéfice estimé = encaissé − dépenses − coût des pièces des appareils rendus.</p>
    </>}
  </div>;
}
