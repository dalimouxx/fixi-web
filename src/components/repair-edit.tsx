'use client';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Plus, Save, X } from 'lucide-react';
import { humanError } from '@/lib/human-error';
import { issuesTotal } from '@/lib/repair-issues';

/** Corriger une réparation après la réception (modèle, pannes et prix, n° de série, couleur). */
export function RepairEditButton({ r, onSaved }: { r: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}><Pencil size={15} /> Modifier</button>
    {open && <RepairEditDialog r={r} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); onSaved(); }} />}
  </>;
}

function RepairEditDialog({ r, onClose, onSaved }: { r: any; onClose: () => void; onSaved: () => void }) {
  const initial = Array.isArray(r.issues) && r.issues.length ? r.issues : [{ name: r.reportedIssue, price: r.estimatedPrice != null ? Number(r.estimatedPrice) : null }];
  const [issues, setIssues] = useState<{ name: string; price: number | null }[]>(initial);
  const [f, setF] = useState({ brand: r.brand || '', model: r.model || '', serialNumber: r.serialNumber || '', color: r.color || '' });
  const [extra, setExtra] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const total = issuesTotal(issues);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  function addIssue() { const n = extra.trim(); if (n.length < 2 || issues.some(i => i.name.toLowerCase() === n.toLowerCase())) return; setIssues([...issues, { name: n, price: null }]); setExtra(''); }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      if (!issues.length) throw new Error('Gardez au moins une panne');
      const r2 = await fetch('/api/repairs/' + encodeURIComponent(r.code), { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...f, issues, estimatedPrice: total }) });
      const j = await r2.json().catch(() => ({})); if (!r2.ok) throw new Error(j.error);
      onSaved();
    } catch (x) { setErr(humanError(x)); setBusy(false); }
  }
  return createPortal(<div className="dpf-back" role="dialog" aria-modal="true" aria-label="Modifier la réparation" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <form className="dpf spe" onSubmit={save}>
      <header><Pencil size={19} /><div><b>Modifier {r.code}</b><small>Le client garde le même code de suivi. La modification est notée dans le journal.</small></div><button type="button" className="fx-icon-btn" onClick={onClose} aria-label="Fermer"><X size={16} /></button></header>
      <div className="spe-grid">
        <label className="field"><span className="label">Marque</span><input className="input" value={f.brand} onChange={set('brand')} /></label>
        <label className="field"><span className="label">Modèle *</span><input className="input" required value={f.model} onChange={set('model')} /></label>
        <label className="field"><span className="label">IMEI / n° de série</span><input className="input" value={f.serialNumber} onChange={set('serialNumber')} /></label>
        <label className="field"><span className="label">Couleur</span><input className="input" value={f.color} onChange={set('color')} /></label>
      </div>
      <div className="field"><span className="label">Pannes et prix</span>
        <div className="fx-issue-picked">{issues.map(i => <span key={i.name} className="fx-issue-pill"><b>{i.name}</b><input inputMode="decimal" placeholder="prix" aria-label={'Prix ' + i.name} value={i.price ?? ''} onChange={e => { const v = e.target.value.replace(/[^0-9.,]/g, ''); setIssues(issues.map(x => x.name === i.name ? { ...x, price: v === '' ? null : Number(v.replace(',', '.')) } : x)); }} /><small>DT</small><button type="button" aria-label={'Retirer ' + i.name} onClick={() => setIssues(issues.filter(x => x.name !== i.name))}>×</button></span>)}
          <small className="fx-issue-sum">{total != null ? 'Total estimé ' + total + ' DT' : 'Prix à définir'}</small></div>
        <div className="re-add"><input className="input" value={extra} onChange={e => setExtra(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addIssue(); } }} placeholder="Ajouter une panne (ex. Batterie)" /><button type="button" className="btn btn-soft" onClick={addIssue}><Plus size={15} /> Ajouter</button></div>
      </div>
      {err && <p className="error" role="alert">{err}</p>}
      <div className="spe-actions"><span /><button className="btn btn-primary" disabled={busy}><Save size={16} /> Enregistrer</button></div>
    </form>
  </div>, document.body);
}
