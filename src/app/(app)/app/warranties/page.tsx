'use client';
import Link from 'next/link';
import { useState } from 'react';
import { HeartHandshake, Plus, ShieldCheck, CheckCircle2, Clock3, Search } from 'lucide-react';
import { api, useApi } from '@/components/ui';
import { FxSheet } from '@/components/fx-sheet';
import { dateOnly, dateTime } from '@/lib/format';

const status: Record<string, [string, string]> = { OPEN: ['Ouvert', 'danger'], IN_REVIEW: ['En traitement', 'warning'], RESOLVED: ['Résolu', 'ok'], REJECTED: ['Refusé', 'muted'] };
const daysLeft = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);

// Garanties & retours : ce qui revient à l'atelier, et ce qui est encore couvert.
export default function Warranties() {
  const [refresh, setRefresh] = useState(0);
  const { data, loading } = useApi<any>('/api/warranties', refresh);
  const [tab, setTab] = useState<'claims' | 'active'>('claims');
  const [open, setOpen] = useState(false);
  const [repairId, setRepairId] = useState('');
  const [issue, setIssue] = useState('');
  const [q, setQ] = useState('');
  const [closing, setClosing] = useState<{ id: string; status: string } | null>(null);
  const [resolution, setResolution] = useState('');
  const claims = data?.claims || [];
  const active = (data?.warranties || []).filter((x: any) => x.warrantyActive);
  const openClaims = claims.filter((x: any) => ['OPEN', 'IN_REVIEW'].includes(x.status));
  const match = (s: string) => !q || s.toLowerCase().includes(q.toLowerCase());

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try { await api('/api/warranties', { method: 'POST', body: JSON.stringify({ repairId, issue }) }); setOpen(false); setIssue(''); setRepairId(''); setTab('claims'); setRefresh(x => x + 1); } catch (err: any) { alert(err.message); }
  }
  async function update(id: string, s: string, res = '') {
    try { await api(`/api/warranties/${id}`, { method: 'PATCH', body: JSON.stringify({ status: s, resolution: res }) }); setClosing(null); setResolution(''); setRefresh(x => x + 1); } catch (err: any) { alert(err.message); }
  }

  return <div className="fx-page">
    <div className="fx-hello"><div><h1>Garanties & retours</h1><p>Un client revient avec un problème ? Ouvrez un retour en 2 touchers.</p></div>
      <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={18} /> Nouveau retour</button></div>

    <section className="fx-kpis" aria-label="Résumé">
      <button type="button" className={`fx-kpi ${openClaims.length ? 'fx-kpi--due' : ''}`} onClick={() => setTab('claims')}><HeartHandshake /><div><span>Retours à traiter</span><strong>{openClaims.length}</strong></div></button>
      <button type="button" className="fx-kpi" onClick={() => setTab('active')}><ShieldCheck /><div><span>Garanties actives</span><strong>{active.length}</strong></div></button>
      <div className="fx-kpi"><CheckCircle2 /><div><span>Retours résolus</span><strong>{claims.filter((x: any) => x.status === 'RESOLVED').length}</strong></div></div>
    </section>

    <div className="fx-toolbar">
      <div className="fx-filter-chips" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'claims'} aria-pressed={tab === 'claims'} onClick={() => setTab('claims')}>Retours {openClaims.length > 0 && <b>{openClaims.length}</b>}</button>
        <button type="button" role="tab" aria-selected={tab === 'active'} aria-pressed={tab === 'active'} onClick={() => setTab('active')}>Garanties actives</button>
      </div>
      <div className="fx-searchbar"><Search size={18} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Client, code, appareil…" aria-label="Rechercher" /></div>
    </div>

    {loading && !data ? <div className="card card-pad fx-skeleton" role="status" aria-label="Chargement"><i /><i /><i /></div> : tab === 'claims' ?
      <div className="fx-list">
        {claims.filter((c: any) => match(`${c.repair.code} ${c.repair.client.fullName} ${c.issue}`)).map((c: any) => { const [l, tone] = status[c.status] || [c.status, 'muted']; return <div key={c.id} className={`fx-row fx-claim fx-row--${tone === 'ok' ? 'ok' : tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : ''}`}>
          <HeartHandshake />
          <Link href={`/app/repairs/${c.repair.code}`} className="fx-row-main"><b>{c.repair.client.fullName} · {c.issue}</b><small><span className="mono">{c.repair.code}</span> · {dateTime(c.createdAt)}{c.resolution ? ` · ${c.resolution}` : ''}</small></Link>
          <span className={`fx-chip fx-chip--${tone}`}>{l}</span>
          {['OPEN', 'IN_REVIEW'].includes(c.status) && <div className="fx-claim-actions">
            {c.status === 'OPEN' && <button className="btn btn-ghost btn-sm" onClick={() => update(c.id, 'IN_REVIEW')}><Clock3 size={15} /> Je m’en occupe</button>}
            <button className="btn btn-soft btn-sm" onClick={() => setClosing({ id: c.id, status: 'RESOLVED' })}>Résolu</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setClosing({ id: c.id, status: 'REJECTED' })}>Refuser</button>
          </div>}
        </div>; })}
        {!claims.length && <div className="fx-empty"><b>Aucun retour</b><span>Quand un client revient sous garantie, ouvrez un retour ici pour le suivre.</span></div>}
      </div> :
      <div className="fx-list">
        {active.filter((r: any) => match(`${r.code} ${r.client.fullName} ${r.brand} ${r.model}`)).map((r: any) => { const left = daysLeft(r.warrantyExpiresAt); return <Link key={r.id} href={`/app/repairs/${r.code}`} className={`fx-row ${left <= 7 ? 'fx-row--warning' : 'fx-row--ok'}`}>
          <ShieldCheck /><span className="fx-row-main"><b>{r.client.fullName} · {[r.brand, r.model].filter(Boolean).join(' ')}</b><small><span className="mono">{r.code}</span> · rendu le {dateOnly(r.deliveredAt)} · jusqu’au {dateOnly(r.warrantyExpiresAt)}</small></span>
          <span className={`fx-chip ${left <= 7 ? 'fx-chip--warning' : 'fx-chip--ok'}`}>{left} j</span>
        </Link>; })}
        {!active.length && <div className="fx-empty"><b>Aucune garantie en cours</b><span>Les appareils rendus apparaissent ici pendant leur garantie.</span></div>}
      </div>}

    <FxSheet open={open} onClose={() => setOpen(false)} side="bottom" title="Nouveau retour sous garantie" label="Nouveau retour">
      <form onSubmit={create} className="fx-form-stack">
        <label className="field"><span className="label">Appareil sous garantie *</span><select className="select" required value={repairId} onChange={e => setRepairId(e.target.value)}><option value="">Choisir…</option>{active.map((r: any) => <option key={r.id} value={r.id}>{r.client.fullName} — {r.brand} {r.model} ({r.code})</option>)}</select></label>
        {!active.length && <p className="fx-form-hint">Aucun appareil n’est encore sous garantie.</p>}
        <label className="field"><span className="label">Ce qui ne va pas *</span><textarea className="textarea" required value={issue} onChange={e => setIssue(e.target.value)} placeholder="Ex. l’écran clignote depuis hier" /></label>
        <button className="btn btn-primary btn-block">Ouvrir le retour</button>
      </form>
    </FxSheet>

    <FxSheet open={!!closing} onClose={() => setClosing(null)} side="bottom" title={closing?.status === 'RESOLVED' ? 'Retour résolu' : 'Refuser le retour'} label="Clore le retour">
      <form onSubmit={e => { e.preventDefault(); if (closing) update(closing.id, closing.status, resolution); }} className="fx-form-stack">
        <label className="field"><span className="label">{closing?.status === 'RESOLVED' ? 'Qu’avez-vous fait ?' : 'Pourquoi ?'}</span><textarea className="textarea" required value={resolution} onChange={e => setResolution(e.target.value)} placeholder={closing?.status === 'RESOLVED' ? 'Ex. écran remplacé gratuitement' : 'Ex. choc visible, hors garantie'} /></label>
        <button className="btn btn-primary btn-block">Enregistrer</button>
      </form>
    </FxSheet>
  </div>;
}
