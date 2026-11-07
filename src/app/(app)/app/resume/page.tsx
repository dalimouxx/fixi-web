'use client';
import { useEffect, useState } from 'react';
import { AlarmClock, Banknote, MessageCircle, PackageCheck, ShoppingBag, Smartphone, Wrench } from 'lucide-react';
import { useApi } from '@/components/ui';
import { money } from '@/lib/format';
import { waLink } from '@/lib/whatsapp-link';
import '@/app/fixi-astuces.css';

/** Résumé du jour pour le gérant (envoyé chaque soir en notification), partageable sur WhatsApp. */
export default function DaySummaryPage() {
  const [day, setDay] = useState('');
  useEffect(() => { const q = new URLSearchParams(window.location.search).get('jour'); if (q) setDay(q); }, []);
  const { data: s } = useApi<any>(`/api/day-summary${day ? `?jour=${day}` : ''}`);
  if (!s) return <div className="fx-page"><div className="card card-pad fx-skeleton" role="status"><i /><i /><i /></div></div>;
  const cur = s.currency;
  return <div className="fx-page fxm-sum">
    <div className="fx-hello"><div><h1>Résumé du jour</h1><p>Envoyé automatiquement chaque soir en notification (Paramètres → Règles atelier).</p></div>
      <div className="fxm-sum-tools"><input type="date" className="input" value={s.day} onChange={e => setDay(e.target.value)} aria-label="Jour" /><a className="btn btn-success" href={waLink(s.ownerPhone || '', s.text)} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Envoyer sur WhatsApp</a></div></div>
    <section className="fxm-sum-hero fxm-in"><span>Encaissé</span><b>{money(s.net, cur)}</b><small>{s.count} paiement(s){Object.entries(s.byMethod || {}).map(([k, v]: any) => ` · ${({ CASH: 'espèces', CARD: 'carte', D17: 'D17', FLOUCI: 'Flouci', BANK_TRANSFER: 'virement' } as any)[k] || k} ${money(v, cur)}`).join('')}</small></section>
    <section className="fx-kpis">
      <div className="fx-kpi"><Wrench /><div><span>Reçus aujourd’hui</span><strong>{s.received}</strong></div></div>
      <div className="fx-kpi"><PackageCheck /><div><span>Rendus</span><strong>{s.delivered}</strong></div></div>
      <div className={`fx-kpi ${s.readyOver3Days ? 'fx-kpi--due' : ''}`}><Smartphone /><div><span>À rendre</span><strong>{s.readyToCollect}</strong>{s.readyOver3Days > 0 && <small>{s.readyOver3Days} depuis +3 j</small>}</div></div>
      <div className={`fx-kpi ${s.overdue ? 'fx-kpi--due' : ''}`}><AlarmClock /><div><span>En retard</span><strong>{s.overdue}</strong></div></div>
      <div className="fx-kpi"><ShoppingBag /><div><span>Ventes comptoir</span><strong>{money(s.counterSales.total, cur)}</strong><small>{s.counterSales.count} vente(s){s.usedSold ? ` · ${s.usedSold} occasion(s)` : ''}</small></div></div>
      <div className="fx-kpi"><Banknote /><div><span>Caisse</span><strong>{s.cashOpen ? money(s.expectedCash || 0, cur) : 'Fermée'}</strong>{s.cashOpen && <small>espèces attendues</small>}</div></div>
    </section>
    <pre className="fxm-sum-text">{s.text}</pre>
  </div>;
}
