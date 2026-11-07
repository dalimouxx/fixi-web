'use client';
import { useState } from 'react';
import { humanError } from '@/lib/human-error';
import { createPortal } from 'react-dom';
import { Camera, CheckCircle2, Loader2, PenLine, ShieldCheck, X } from 'lucide-react';

const fmt = (d?: string | null) => d ? new Date(d).toLocaleString('fr-TN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

/** Bouton « Preuve de livraison » : photo de remise, signature, réceptionnaire et code vérifié. */
export function ShopDeliveryProof({ order, url, compact }: { order: any; url: string; compact?: boolean }) {
  const [open, setOpen] = useState(false); const [d, setD] = useState<any>(null); const [err, setErr] = useState('');
  const dl = order?.delivery;
  if (!dl?.deliveredAt) return null;
  async function show() {
    setOpen(true); setErr('');
    if (d) return;
    try { const r = await fetch(url, { cache: 'no-store' }); const j = await r.json(); if (!r.ok) throw new Error(j.error); setD(j); } catch (e: any) { setErr(humanError(e) || 'Preuve indisponible'); }
  }
  return <>
    <button type="button" className={'btn btn-sm ' + (compact ? 'btn-ghost' : 'btn-soft') + ' dpf-btn'} onClick={show}>
      {dl.hasProof ? <Camera size={14} /> : <ShieldCheck size={14} />} Preuve de livraison
    </button>
    {open && createPortal(<div className="dpf-back" role="dialog" aria-modal="true" aria-label="Preuve de livraison" onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="dpf">
        <header><CheckCircle2 size={20} /><div><b>Remise confirmée</b><small>{order.reference}{d ? ` · ${d.companyName} → ${d.shopName}` : ''}</small></div><button type="button" className="fx-icon-btn" onClick={() => setOpen(false)} aria-label="Fermer"><X size={16} /></button></header>
        {!d && !err && <p className="dpf-load"><Loader2 size={18} className="ps-spin" /> Chargement…</p>}
        {err && <p className="pm-err">{err}</p>}
        {d && <>
          <dl>
            <div><dt>Livré le</dt><dd>{fmt(d.deliveredAt)}</dd></div>
            <div><dt>Livreur</dt><dd>{d.driverName || '—'}</dd></div>
            <div><dt>Reçu par</dt><dd>{d.recipientName || '—'}{d.recipientPhone ? ' · ' + d.recipientPhone : ''}</dd></div>
            <div><dt>Code de remise</dt><dd>{d.codeVerified ? '✅ vérifié' : '—'}</dd></div>
          </dl>
          <div className="dpf-media">
            {d.proofUrl ? <figure><a href={d.proofUrl} target="_blank" rel="noreferrer"><img src={d.proofUrl} alt="Photo prise par le livreur à la remise" /></a><figcaption><Camera size={13} /> Photo à la remise</figcaption></figure> : <p className="dpf-none"><Camera size={16} /> Pas de photo prise à la remise.</p>}
            {d.signatureUrl && <figure className="dpf-sign"><img src={d.signatureUrl} alt="Signature du réceptionnaire" /><figcaption><PenLine size={13} /> Signature</figcaption></figure>}
          </div>
        </>}
      </div>
    </div>, document.body)}
  </>;
}
