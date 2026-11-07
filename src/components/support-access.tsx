'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { History, LifeBuoy, Loader2, X } from 'lucide-react';
import { dateTime } from '@/lib/format';

const REASONS = ['Problème signalé par le client', 'Bug à reproduire', 'Aide à la configuration', 'Correction de données', 'Formation à distance'];

/** Bouton « Accéder » de Fixi Control : ouvre la boutique ou le fournisseur en mode support (1 h, motif obligatoire, journalisé). */
export function SupportAccessButton({ kind, id, name, compact, defaultReason }: { kind: 'SHOP' | 'SUPPLIER'; id: string; name: string; compact?: boolean; defaultReason?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(defaultReason || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const r = await fetch('/api/platform/support-access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, id, reason }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Accès impossible');
      location.href = j.url;
    } catch (x: any) { setErr(x.message); setBusy(false); }
  }
  return <>
    <button type="button" className={'btn btn-sm ' + (compact ? 'btn-ghost' : 'btn-soft') + ' fx-support-btn'} onClick={() => setOpen(true)} title={`Ouvrir l’espace de ${name} pour régler un problème`}><LifeBuoy size={14} /> Accéder</button>
    {open && createPortal(<div className="fx-support-modal" role="dialog" aria-modal="true" aria-label="Accès support" onClick={e => { if (e.target === e.currentTarget && !busy) setOpen(false); }}>
      <form className="fx-support-card" onSubmit={go}>
        <header><LifeBuoy size={20} /><div><b>Accès support</b><small>{kind === 'SHOP' ? 'Boutique' : 'Fournisseur'} · {name}</small></div><button type="button" className="fx-icon-btn" aria-label="Fermer" onClick={() => setOpen(false)}><X size={16} /></button></header>
        <p>Vous ouvrez son espace avec les droits du gérant pendant <b>1 heure</b>. {kind === 'SHOP' ? 'La boutique est prévenue et l’accès est noté dans son journal.' : 'L’accès est noté dans le journal du fournisseur.'}</p>
        <label className="label" htmlFor="fx-support-reason">Motif de l’intervention</label>
        <input id="fx-support-reason" className="input" autoFocus required minLength={5} maxLength={300} value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex. : la caisse ne s’ouvre pas" />
        <div className="fx-support-chips">{REASONS.map(r => <button type="button" key={r} aria-pressed={reason === r} onClick={() => setReason(r)}>{r}</button>)}</div>
        {err && <div className="error" role="alert">{err}</div>}
        <button className="btn btn-primary btn-block" disabled={busy || reason.trim().length < 5}>{busy ? <Loader2 size={16} className="ps-spin" /> : <LifeBuoy size={16} />} Ouvrir en mode support</button>
      </form>
    </div>, document.body)}
  </>;
}

/** Journal des 50 derniers accès support. */
export function SupportJournal() {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => { fetch('/api/platform/support-access', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).then(setRows).catch(() => setRows([])); }, []);
  const state = (r: any) => r.endedAt ? 'Terminé' : new Date(r.expiresAt).getTime() < Date.now() ? 'Expiré' : 'En cours';
  return <div className="control-panel span2 fx-support-journal">
    <div className="panel-head"><div><h3><History /> Journal des accès support</h3><p>Qui est entré chez qui, pourquoi et combien de temps.</p></div></div>
    {rows === null ? <p className="muted">Chargement…</p> : rows.length === 0 ? <p className="muted">Aucun accès support pour l’instant.</p> :
      <div className="fx-support-rows">{rows.map(r => <div key={r.id} className="tool-row"><div><strong>{r.kind === 'SHOP' ? 'Boutique' : 'Fournisseur'} · {r.targetName}</strong><small>{dateTime(r.startedAt)} · {r.adminName} · {r.reason}</small></div><span className={`status-pill ${state(r) === 'En cours' ? 'active' : 'paused'}`}>{state(r)}</span></div>)}</div>}
  </div>;
}
