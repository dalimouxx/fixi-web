'use client';
import { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, XCircle, Clock3, Search, Phone, AlertTriangle, CalendarCheck, MessageCircle, ExternalLink } from 'lucide-react';
import { api, useApi } from '@/components/ui';
import { waLink } from '@/lib/whatsapp-link';

const st: Record<string, [string, string]> = { PENDING: ['À confirmer', 'warning'], CONFIRMED: ['Confirmé', 'info'], COMPLETED: ['Terminé', 'ok'], CANCELLED: ['Annulé', 'muted'] };
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const dayLabel = (d: Date) => {
  const t = new Date(); t.setHours(0, 0, 0, 0); const x = new Date(d); x.setHours(0, 0, 0, 0);
  const diff = Math.round((x.getTime() - t.getTime()) / 86400000);
  if (diff === 0) return 'Aujourd’hui'; if (diff === 1) return 'Demain'; if (diff === -1) return 'Hier';
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
};
const hour = (d: Date) => new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(d);

// Rendez-vous : un agenda par jour, confirmation et rappel WhatsApp en un toucher.
export default function Appointments() {
  const [r, setR] = useState(0), [filter, setFilter] = useState('UPCOMING'), [q, setQ] = useState('');
  const { data, loading } = useApi<any[]>('/api/appointments', r);
  const { data: shop } = useApi<any>('/api/settings', r);
  async function setStatus(id: string, status: string) { try { await api('/api/appointments', { method: 'PATCH', body: JSON.stringify({ id, status }) }); setR(x => x + 1); } catch (e: any) { alert(e.message); } }
  const now = Date.now();
  const all = data || [];
  const active = (x: any) => ['PENDING', 'CONFIRMED'].includes(x.status);
  const rows = useMemo(() => all.filter(x => (filter === 'UPCOMING' ? active(x) : filter === 'ALL' || x.status === filter) && (!q || [x.fullName, x.phone, x.service, x.device].join(' ').toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt)), [all, filter, q]);
  const groups = useMemo(() => { const g = new Map<string, { label: string; list: any[] }>(); for (const x of rows) { const d = new Date(x.scheduledAt); const k = dayKey(d); if (!g.has(k)) g.set(k, { label: dayLabel(d), list: [] }); g.get(k)!.list.push(x); } return [...g.values()]; }, [rows]);
  const pending = all.filter(x => x.status === 'PENDING').length;
  const today = all.filter(x => active(x) && dayKey(new Date(x.scheduledAt)) === dayKey(new Date())).length;
  const late = all.filter(x => active(x) && new Date(x.scheduledAt).getTime() < now).length;
  const kiosk = shop?.slug ? `/kiosk?shop=${encodeURIComponent(shop.slug)}` : '/kiosk';
  const remind = (x: any) => waLink(x.phone, `Bonjour ${x.fullName}, nous vous attendons ${dayLabel(new Date(x.scheduledAt)).toLowerCase()} à ${hour(new Date(x.scheduledAt))} pour ${x.service}${x.device ? ` (${x.device})` : ''}. ${shop?.name || ''}`);

  return <div className="fx-page">
    <div className="fx-hello"><div><h1>Rendez-vous</h1><p>Les demandes reçues depuis votre page et la borne de l’atelier.</p></div>
      <a className="btn btn-ghost" target="_blank" rel="noreferrer" href={kiosk}><ExternalLink size={18} /> Borne de prise de rendez-vous</a></div>

    <section className="fx-kpis" aria-label="Résumé">
      <button type="button" className={`fx-kpi ${pending ? 'fx-kpi--due' : ''}`} onClick={() => setFilter('PENDING')}><Clock3 /><div><span>À confirmer</span><strong>{pending}</strong></div></button>
      <button type="button" className="fx-kpi" onClick={() => setFilter('UPCOMING')}><CalendarCheck /><div><span>Aujourd’hui</span><strong>{today}</strong></div></button>
      <div className={`fx-kpi ${late ? 'fx-kpi--due' : ''}`}><AlertTriangle /><div><span>En retard</span><strong>{late}</strong></div></div>
    </section>

    <div className="fx-toolbar">
      <div className="fx-filter-chips" role="group" aria-label="Filtrer">
        {[['UPCOMING', 'À venir'], ['PENDING', 'À confirmer'], ['COMPLETED', 'Terminés'], ['CANCELLED', 'Annulés'], ['ALL', 'Tous']].map(([k, l]) => <button type="button" key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}{k === 'PENDING' && pending > 0 && <b>{pending}</b>}</button>)}
      </div>
      <div className="fx-searchbar"><Search size={18} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Client, service, appareil…" aria-label="Rechercher un rendez-vous" /></div>
    </div>

    {loading && !data ? <div className="card card-pad fx-skeleton" role="status" aria-label="Chargement"><i /><i /><i /></div> :
      groups.length ? groups.map(g => <section key={g.label} className="fx-panel" style={{ marginTop: 12 }}>
        <div className="fx-panel-head"><h2 className="fx-cap">{g.label}</h2><span className="fx-chip">{g.list.length}</span></div>
        <div className="fx-list">{g.list.map(x => { const d = new Date(x.scheduledAt); const overdue = active(x) && d.getTime() < now; const [l, tone] = st[x.status] || [x.status, 'muted']; return <div key={x.id} className={`fx-row fx-appt ${overdue ? 'fx-row--danger' : x.status === 'PENDING' ? 'fx-row--warning' : ''}`}>
          <span className="fx-appt-time">{hour(d)}</span>
          <span className="fx-row-main"><b>{x.fullName} · {x.service}</b><small>{x.device || 'Appareil non précisé'} · <span className="mono">{x.phone}</span>{overdue ? ' · en retard' : ''}</small></span>
          <span className={`fx-chip fx-chip--${tone}`}>{l}</span>
          <div className="fx-appt-actions">
            {x.status === 'PENDING' && <button className="btn btn-primary btn-sm" onClick={() => setStatus(x.id, 'CONFIRMED')}><CheckCircle2 size={15} /> Confirmer</button>}
            {x.status === 'CONFIRMED' && <button className="btn btn-soft btn-sm" onClick={() => setStatus(x.id, 'COMPLETED')}><CheckCircle2 size={15} /> Client venu</button>}
            {active(x) && <a className="btn btn-ghost btn-sm" href={remind(x)} target="_blank" rel="noreferrer"><MessageCircle size={15} /> Rappel</a>}
            <a className="fx-icon-btn" href={`tel:${x.phone}`} aria-label={`Appeler ${x.fullName}`}><Phone size={16} /></a>
            {active(x) && <button className="fx-icon-btn" onClick={() => { if (confirm('Annuler ce rendez-vous ?')) setStatus(x.id, 'CANCELLED'); }} aria-label="Annuler le rendez-vous"><XCircle size={16} /></button>}
          </div>
        </div>; })}</div>
      </section>) : <div className="fx-empty" style={{ marginTop: 12 }}><b>Aucun rendez-vous</b><span>Partagez votre borne ou votre page pour recevoir des demandes.</span><a className="btn btn-primary" target="_blank" rel="noreferrer" href={kiosk}><CalendarDays size={18} /> Ouvrir la borne</a></div>}
  </div>;
}
