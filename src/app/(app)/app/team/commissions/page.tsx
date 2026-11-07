'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Percent } from 'lucide-react';
import { api, useApi } from '@/components/ui';
import { money } from '@/lib/format';
import '@/app/fixi-astuces.css';

const shift = (ym: string, d: number) => { const [y, m] = ym.split('-').map(Number); const x = new Date(Date.UTC(y, m - 1 + d, 1)); return x.toISOString().slice(0, 7); };

/** Commissions des techniciens : calculées seules sur la marge des réparations rendues. */
export default function Commissions() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); const [n, setN] = useState(0); const [msg, setMsg] = useState('');
  const { data } = useApi<any>(`/api/commissions?month=${month}`, n);
  async function setRate(id: string, v: string) { setMsg(''); try { await api(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify({ commissionRate: v === '' ? null : Number(v.replace(',', '.')) }) }); setN(x => x + 1); setMsg('Taux enregistré.'); } catch (e: any) { setMsg(e.message); } }
  const label = new Date(month + '-01T12:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return <div className="fx-page fxm-com">
    <div className="fx-hello"><div><h1>Commissions des techniciens</h1><p>Un pourcentage de la marge (prix payé − coût des pièces) des réparations <b>rendues</b> dans le mois.</p></div>
      <div className="fxm-com-month"><button className="btn btn-ghost btn-sm" onClick={() => setMonth(shift(month, -1))} aria-label="Mois précédent"><ChevronLeft size={16} /></button><b>{label}</b><button className="btn btn-ghost btn-sm" onClick={() => setMonth(shift(month, 1))} aria-label="Mois suivant"><ChevronRight size={16} /></button></div></div>
    <section className="fx-panel"><table className="fxm-com-tab"><thead><tr><th>Technicien</th><th>Réparations</th><th>Encaissé</th><th>Pièces</th><th>Marge</th><th>Taux</th><th>Commission</th></tr></thead>
      <tbody>{(data?.rows || []).map((r: any) => <tr key={r.id}><td><b>{r.fullName}</b></td><td>{r.count}</td><td>{money(r.revenue)}</td><td>{money(r.parts)}</td><td>{money(r.margin)}</td>
        <td><span className="fxm-com-rate"><input className="input" inputMode="decimal" defaultValue={r.rate || ''} placeholder="0" onBlur={e => { if (e.target.value !== String(r.rate || '')) void setRate(r.id, e.target.value); }} aria-label={`Taux ${r.fullName}`} /><Percent size={14} /></span></td>
        <td><strong>{money(r.commission)}</strong></td></tr>)}</tbody>
      <tfoot><tr><td colSpan={6}>Total à verser</td><td><strong>{money(data?.total || 0)}</strong></td></tr></tfoot></table>
      {data && !data.rows.length && <p className="page-sub">Aucun technicien actif.</p>}
      {msg && <p className="page-sub" role="status">{msg}</p>}
    </section>
  </div>;
}
