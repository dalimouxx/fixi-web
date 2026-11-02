'use client';
import { useState } from 'react';
import { MessageCircle, Printer, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApi } from '@/components/ui';
import { money, dateOnly } from '@/lib/format';

function shift(date: string, days: number) {
  const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10);
}

export default function EndOfDay() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const { data: d, loading, error } = useApi<any>(`/api/reports/end-of-day?date=${date}`);
  const cur = d?.currency || 'DT';
  const text = d ? [
    `📊 ${d.shopName} — fin de journée ${dateOnly(d.date)}`,
    `💰 Encaissé : ${money(d.collected, cur)}`,
    ...Object.entries(d.byMethod || {}).map(([k, v]) => `   • ${k} : ${money(v as number, cur)}`),
    `🧾 Dépenses : ${money(d.spent, cur)}`,
    `✅ Net du jour : ${money(d.net, cur)}`,
    `📥 Appareils reçus : ${d.received}`,
    `📤 Appareils rendus : ${d.delivered}`,
    `🔔 Prêts à récupérer : ${d.readyCount} (${money(d.readyToCollect, cur)} à encaisser)`,
  ].join('\n') : '';

  async function share() {
    if (navigator.share) { try { await navigator.share({ title: 'Fin de journée', text }); return; } catch {} }
    await navigator.clipboard?.writeText(text).catch(() => {});
  }

  return <div className="fx-page">
    <div className="fx-eod">
      <div className="fx-hello">
        <div><h1>Fin de journée</h1><p>Le résumé à vérifier et à envoyer avant de fermer.</p></div>
        <div className="toolbar" style={{ gap: 6 }}>
          <button type="button" className="fx-icon-btn" onClick={() => setDate(shift(date, -1))} aria-label="Jour précédent"><ChevronLeft size={18} /></button>
          <input type="date" className="input" value={date} max={today} onChange={e => e.target.value && setDate(e.target.value)} style={{ width: 170 }} aria-label="Date du rapport" />
          <button type="button" className="fx-icon-btn" onClick={() => setDate(shift(date, 1))} disabled={date >= today} aria-label="Jour suivant"><ChevronRight size={18} /></button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {loading && !d && <div className="card card-pad">Calcul du résumé…</div>}
      {d && <div className="fx-eod-card">
        <div className="fx-eod-head"><h1>{d.shopName}</h1><p>{dateOnly(d.date)}</p></div>
        <div className="fx-eod-net"><span>Net du jour (encaissé − dépenses)</span><strong>{money(d.net, cur)}</strong></div>
        <div className="fx-eod-rows">
          <div><span>Encaissé</span><b>{money(d.collected, cur)}</b></div>
          <div><span>Dépenses</span><b>{money(d.spent, cur)}</b></div>
          {Object.entries(d.byMethod || {}).map(([k, v]) => <div key={k}><span>dont {k}</span><b>{money(v as number, cur)}</b></div>)}
          <div><span>Appareils reçus</span><b>{d.received}</b></div>
          <div><span>Appareils rendus</span><b>{d.delivered}</b></div>
          <div><span>Prêts à récupérer</span><b>{d.readyCount}</b></div>
          <div><span>Reste à encaisser sur les prêts</span><b>{money(d.readyToCollect, cur)}</b></div>
        </div>
        <div className="fx-eod-actions">
          <a className="btn btn-primary" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Envoyer sur WhatsApp</a>
          <button type="button" className="btn btn-ghost" onClick={share}><Share2 size={18} /> Partager / copier</button>
          <button type="button" className="btn btn-ghost" onClick={() => window.print()}><Printer size={18} /> Imprimer</button>
        </div>
      </div>}
    </div>
  </div>;
}
