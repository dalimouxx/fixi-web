'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BadgeCheck, Phone, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { dateTime } from '@/lib/format';
import { humanError } from '@/lib/human-error';
import { SupportAccessButton } from './support-access';

const TABS: [string, string][] = [['PENDING', 'À vérifier'], ['NONE', 'Sans dossier'], ['REJECTED', 'Refusés'], ['VERIFIED', 'Vérifiés']];

/** Fixi Control → Vérifications : documents des ateliers, validation ou refus. */
export function ControlVerifications() {
  const [status, setStatus] = useState('PENDING'); const [n, setN] = useState(0);
  const [data, setData] = useState<any>(null); const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { fetch('/api/platform/verifications?status=' + status, { cache: 'no-store' }).then(r => r.json()).then(setData).catch(() => setData({ rows: [] })); }, [status, n]);
  return <section className="control-content cv">
    <div className="section-toolbar"><div><h2>Vérification des ateliers</h2><p>Un atelier non vérifié ne voit pas les produits des fournisseurs. Contrôlez les documents puis validez.</p></div>
      <div className="fx-seg">{TABS.map(([k, l]) => <button key={k} aria-pressed={status === k} onClick={() => setStatus(k)}>{l}{data?.counts?.[k] ? ` (${data.counts[k]})` : ''}</button>)}</div></div>
    <div className="cv-list">{(data?.rows || []).map((r: any) => <article key={r.id} className="cv-row">
      <div><b>{r.name}</b><small>{r.region}{r.city ? ' · ' + r.city : ''} · inscrit le {dateTime(r.createdAt)}</small>
        <small>{r.file ? `${r.file.legalName} · ${r.file.ownerName} · MF ${r.file.taxId} · envoyé ${dateTime(r.file.submittedAt)}` : 'Aucun document envoyé'}</small>
        <small className="cv-act">Activité : {r._count.repairs} réparation(s) · {r._count.clients} client(s) · {r._count.supplierMarketplaceOrders} commande(s){r.verificationNote ? ' · refus : ' + r.verificationNote : ''}</small></div>
      <div className="cv-btns">{r.phone && <a className="btn btn-ghost btn-sm" href={'tel:' + r.phone}><Phone size={14} /> {r.phone}</a>}
        <SupportAccessButton kind="SHOP" id={r.id} name={r.name} compact defaultReason="Vérification de l’atelier" />
        <button className="btn btn-primary btn-sm" onClick={() => setOpen(r.id)}>{r.file ? 'Voir le dossier' : 'Décider'}</button></div>
    </article>)}{data && !data.rows?.length && <p className="muted">Aucun atelier dans cette liste.</p>}</div>
    {open && <VerificationDialog shopId={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); setN(x => x + 1); }} />}
  </section>;
}

function VerificationDialog({ shopId, onClose, onDone }: { shopId: string; onClose: () => void; onDone: () => void }) {
  const [d, setD] = useState<any>(null); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [zoom, setZoom] = useState('');
  useEffect(() => { fetch('/api/platform/verifications?shopId=' + shopId, { cache: 'no-store' }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setD(j); }).catch(x => setErr(humanError(x) || 'Dossier indisponible')); }, [shopId]);
  async function decide(decision: string) {
    if (decision === 'REJECTED' && note.trim().length < 3) { setErr('Écrivez le motif du refus (il est envoyé à l’atelier).'); return; }
    setBusy(true); setErr('');
    try { const r = await fetch('/api/platform/verifications', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ shopId, decision, note }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); onDone(); }
    catch (x) { setErr(humanError(x)); setBusy(false); }
  }
  const f = d?.file, s = d?.shop;
  return createPortal(<div className="dpf-back" role="dialog" aria-modal="true" aria-label="Dossier de vérification" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="dpf cv-dlg">
      <header><ShieldCheck size={20} /><div><b>{s?.name || 'Dossier'}</b><small>{s ? `${s.region}${s.city ? ' · ' + s.city : ''} · ${s.phone || '—'} · ${s._count.repairs} réparation(s), ${s._count.clients} client(s)` : 'Chargement…'}</small></div><button type="button" className="fx-icon-btn" onClick={onClose} aria-label="Fermer"><X size={16} /></button></header>
      {f ? <>
        <dl>
          <div><dt>Raison sociale</dt><dd>{f.legalName}</dd></div><div><dt>Gérant</dt><dd>{f.ownerName}</dd></div>
          <div><dt>Matricule fiscal</dt><dd>{f.taxId}</dd></div><div><dt>RNE</dt><dd>{f.tradeRegister || '—'}</dd></div>
          <div className="cv-span"><dt>Adresse</dt><dd>{f.address}{f.city ? ', ' + f.city : ''}</dd></div>
        </dl>
        <div className="cv-docs">{[[f.documentUrl, 'Patente / RNE'], [f.facadeUrl, 'Façade'], [f.insideUrl, 'Intérieur']].filter(x => x[0]).map(([u, l]) => <figure key={l} onClick={() => setZoom(u)}><img src={u} alt={l} /><figcaption>{l}</figcaption></figure>)}</div>
      </> : d && <p className="muted">Aucun document envoyé. Vous pouvez quand même valider un atelier que vous connaissez (après appel ou visite).</p>}
      <label className="label" htmlFor="cv-note">Note / motif du refus</label>
      <input id="cv-note" className="input" maxLength={300} value={note} onChange={e => setNote(e.target.value)} placeholder="Ex. photo de la patente illisible" />
      {err && <p className="error">{err}</p>}
      <div className="cv-decide">
        <button className="btn btn-success" disabled={busy || !d} onClick={() => decide('VERIFIED')}><BadgeCheck size={16} /> Confirmer : atelier vérifié</button>
        <button className="btn btn-danger" disabled={busy || !d} onClick={() => decide('REJECTED')}><ShieldAlert size={16} /> Refuser</button>
        {s?.verificationStatus === 'VERIFIED' && <button className="btn btn-ghost" disabled={busy} onClick={() => decide('NONE')}>Retirer la vérification</button>}
      </div>
    </div>
    {zoom && <div className="fx-problem-shot" onClick={() => setZoom('')}><img src={zoom} alt="Document" /></div>}
  </div>, document.body);
}
