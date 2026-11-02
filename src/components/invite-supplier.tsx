'use client';
import { useCallback, useEffect, useState } from 'react';
import { UserPlus, MessageCircle, Copy, CheckCircle2, Clock3 } from 'lucide-react';
import { FxSheet } from './fx-sheet';
import { api } from './ui';
import { waLink } from '@/lib/whatsapp-link';
import { dateOnly } from '@/lib/format';

const statusLabel: Record<string, string> = { SENT: 'Invitation envoyée', REQUESTED: 'A demandé son espace', CONVERTED: 'Sur Fixi', DECLINED: 'Refusée' };

// L'atelier invite son fournisseur habituel par WhatsApp, en un clic.
export function InviteSupplierButton({ className = 'btn btn-soft' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ supplierName: '', supplierPhone: '' });
  const [res, setRes] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const load = useCallback(() => { fetch('/api/supplier-invites', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).then(setRows).catch(() => {}); }, []);
  useEffect(() => { if (open) load(); }, [open, load]);
  const close = useCallback(() => { setOpen(false); setRes(null); setError(''); }, []);
  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { const x = await api('/api/supplier-invites', { method: 'POST', body: JSON.stringify(f) }); setRes(x); load(); }
    catch (err: any) { setError(err.message); } finally { setBusy(false); }
  }
  return <>
    <button type="button" className={className} onClick={() => setOpen(true)}><UserPlus size={18} /> Inviter mon fournisseur</button>
    <FxSheet open={open} onClose={close} side="bottom" title="Inviter mon fournisseur" subtitle="Il reçoit un lien WhatsApp pour demander son espace Fixi." label="Inviter un fournisseur">
      {!res ? <form className="fx-form-stack" onSubmit={create}>
        <label className="field"><span className="label">Nom du fournisseur</span><input className="input" required minLength={2} value={f.supplierName} onChange={e => setF({ ...f, supplierName: e.target.value })} placeholder="Ex. Pièces Sud Distribution" /></label>
        <label className="field"><span className="label">Son numéro WhatsApp</span><input className="input" type="tel" inputMode="tel" value={f.supplierPhone} onChange={e => setF({ ...f, supplierPhone: e.target.value })} placeholder="21 555 497" /></label>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Préparation…' : 'Préparer l’invitation'}</button>
      </form> : <div className="fx-form-stack">
        <div className="fx-invite-preview">{res.message}</div>
        <a className="btn btn-success btn-block" href={waLink(res.phone || '', res.message)} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Envoyer par WhatsApp</a>
        <button type="button" className="btn btn-ghost btn-block" onClick={() => { navigator.clipboard?.writeText(res.link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }); }}><Copy size={16} /> {copied ? 'Lien copié' : 'Copier le lien'}</button>
        <button type="button" className="btn btn-ghost btn-block" onClick={() => { setRes(null); setF({ supplierName: '', supplierPhone: '' }); }}>Inviter un autre fournisseur</button>
      </div>}
      {rows.length > 0 && <div className="fx-invite-list"><h3>Mes invitations</h3>
        {rows.map(x => <div key={x.id} className="fx-row"><span className="fx-row-main"><b>{x.supplierName}</b><small>{dateOnly(x.createdAt)}</small></span>
          <span className={`fx-chip ${x.status === 'CONVERTED' ? 'fx-chip--ok' : ''}`}>{x.status === 'CONVERTED' ? <CheckCircle2 size={14} /> : <Clock3 size={14} />} {statusLabel[x.status] || x.status}</span></div>)}
      </div>}
    </FxSheet>
  </>;
}
