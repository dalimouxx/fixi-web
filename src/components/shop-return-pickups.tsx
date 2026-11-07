'use client';
import { useEffect, useState } from 'react';
import { humanError } from '@/lib/human-error';
import { KeyRound, PackageX, RotateCcw, Truck, X } from 'lucide-react';
import { pickupStep } from '@/lib/return-pickup';

const REASON: Record<string, string> = { DEFECTIVE: 'Pièce défectueuse', WRONG_PART: 'Mauvaise pièce', EXCHANGE: 'Échange' };

/** Atelier : mes reprises en cours, avec le code à donner au moment de la remise. */
export function ShopReturnPickups({ refresh = 0 }: { refresh?: number }) {
  const [rows, setRows] = useState<any[] | null>(null); const [n, setN] = useState(0); const [err, setErr] = useState('');
  useEffect(() => { fetch('/api/marketplace/returns', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).then(setRows).catch(() => setRows([])); }, [n, refresh]);
  const open = (rows || []).filter(r => ['REQUESTED', 'ACCEPTED', 'COLLECTED'].includes(r.status));
  const recent = (rows || []).filter(r => !['REQUESTED', 'ACCEPTED', 'COLLECTED'].includes(r.status)).slice(0, 3);
  if (!open.length && !recent.length) return null;
  async function cancel(id: string) {
    setErr('');
    const r = await fetch('/api/marketplace/returns', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, action: 'cancel' }) });
    const j = await r.json().catch(() => ({})); if (!r.ok) setErr(humanError(j.error || 'Annulation impossible')); setN(x => x + 1);
  }
  return <section className="srp">
    <h2><RotateCcw size={17} /> Mes reprises {open.length > 0 && <em>{open.length}</em>}</h2>
    {err && <p className="pm-err">{err}</p>}
    {[...open, ...recent].map(p => {
      const waiting = p.status === 'ACCEPTED' || p.status === 'REQUESTED';
      return <article key={p.id} className={'srp-row srp-' + p.status.toLowerCase()}>
        <span className="srp-ico">{p.mode === 'SHOP_DROPOFF' ? <PackageX size={18} /> : <Truck size={18} />}</span>
        <div><b>{(p.items as any[]).map(i => `${i.quantity} × ${i.name}`).join(', ')}</b>
          <small>{p.company?.name}{p.orderReference ? ' · ' + p.orderReference : ''} · {REASON[p.reason] || p.reason}</small>
          <small className="srp-step">{pickupStep(p)}{p.mode === 'SHOP_DROPOFF' && p.status === 'ACCEPTED' && p.company?.address ? ' · ' + p.company.address : ''}</small></div>
        {waiting && p.handoverCode && <div className="srp-code" title="À donner seulement au moment de la remise de la pièce"><KeyRound size={14} /><span>Code de reprise</span><b>{p.handoverCode}</b></div>}
        {p.status === 'REQUESTED' && <button className="btn btn-ghost btn-sm" onClick={() => void cancel(p.id)}><X size={14} /> Annuler</button>}
      </article>;
    })}
    {open.some(p => p.handoverCode) && <small className="srp-tip">🔐 Donnez le code {open.some(p => p.mode === 'SHOP_DROPOFF') ? 'au livreur ou au fournisseur' : 'au livreur'} seulement quand il prend la pièce : c’est votre preuve de remise.</small>}
  </section>;
}
