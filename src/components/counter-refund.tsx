'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Banknote, CreditCard, KeyRound, Minus, PackageCheck, Plus, Receipt, RotateCcw, Smartphone, WalletCards, X } from 'lucide-react';
import { api } from './ui';
import { CashSuccess } from './cash-success';
import { money, dateTime } from '@/lib/format';
import { priceRefund, refundState } from '@/lib/counter-sale';

const methods = [['CASH', 'Espèces', Banknote], ['D17', 'D17', Smartphone], ['FLOUCI', 'Flouci', Smartphone], ['CARD', 'Carte', CreditCard], ['BANK_TRANSFER', 'Virement', WalletCards]] as const;
const REASONS = ['Article défectueux', 'Ne convient pas', 'Erreur de caisse'];

/**
 * Remboursement d'une vente comptoir (Fixi Max) : choisir les articles rendus, les remettre en stock ou non,
 * le motif et le mode de remboursement. Le montant affiché est recalculé par le serveur.
 */
export function CounterRefund({ number, cur, role, onClose, onDone }: { number: string; cur?: string; role?: string; onClose: () => void; onDone: () => void }) {
  const [sale, setSale] = useState<any>(null);
  const [err, setErr] = useState('');
  const [qty, setQty] = useState<Record<string, number>>({});
  const [keep, setKeep] = useState<Record<string, boolean>>({});
  const [reason, setReason] = useState('');
  const [other, setOther] = useState('');
  const [method, setMethod] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<any>(null);

  useEffect(() => {
    let alive = true; setSale(null); setErr('');
    api<any>(`/api/counter-sales/${encodeURIComponent(number)}`).then(s => {
      if (!alive) return; setSale(s);
      setMethod(s.payments?.find((p: any) => p.kind !== 'REFUND')?.method || 'CASH');
    }).catch(e => alive && setErr(e.message));
    return () => { alive = false; };
  }, [number]);

  const lines = useMemo(() => (sale?.lines || []).map((l: any) => ({ id: l.id, name: l.name, quantity: l.quantity, returnedQuantity: l.returnedQuantity || 0, unitPrice: Number(l.unitPrice) })), [sale]);
  const req = lines.filter((l: any) => qty[l.id] > 0).map((l: any) => ({ lineId: l.id, quantity: qty[l.id], restock: keep[l.id] !== false }));
  const preview = useMemo(() => {
    if (!sale || !req.length) return null;
    try { return priceRefund({ subtotal: Number(sale.subtotal), total: Number(sale.total), refundedTotal: Number(sale.refundedTotal || 0) }, lines, req); } catch { return null; }
  }, [sale, lines, JSON.stringify(req)]);
  const state = sale ? refundState(Number(sale.total), Number(sale.refundedTotal || 0)) : 'NONE';
  const motive = reason === 'Autre' ? other.trim() : reason;
  const needPin = role !== 'ADMIN';

  function step(l: any, d: number) { const left = l.quantity - l.returnedQuantity; setQty(q => ({ ...q, [l.id]: Math.max(0, Math.min(left, (q[l.id] || 0) + d)) })); }
  // Un article défectueux ne retourne pas en vente ; les autres motifs le remettent en stock par défaut.
  function pickReason(r: string) { setReason(r); const back = r !== 'Article défectueux'; setKeep(Object.fromEntries(lines.map((l: any) => [l.id, back]))); }
  function all() { setQty(Object.fromEntries(lines.map((l: any) => [l.id, l.quantity - l.returnedQuantity]))); }

  async function submit() {
    if (!preview || busy) return;
    setBusy(true); setErr('');
    try {
      const r = await api<any>(`/api/counter-sales/${encodeURIComponent(sale.number)}/refund`, { method: 'POST', body: JSON.stringify({ lines: req, method, reason: motive, managerPin: needPin ? pin : undefined }) });
      setDone(r); onDone();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  if (done) return <CashSuccess amount={'− ' + money(done.amount, cur)} title="Remboursement effectué" subtitle={<>{done.number} · {done.lines.map((l: any) => `${l.quantity}× ${l.name}`).join(', ')}</>}>
    <Link className="btn fxm-btn-o" href={`/receipt/vente/${done.number}`} target="_blank"><Receipt size={16} /> Ticket mis à jour</Link>
    <button type="button" className="btn fxm-btn-g" onClick={onClose}>Terminer</button>
  </CashSuccess>;

  return <div className="fxm-rf fxm-in">
    <div className="fxm-panel-head"><h2><RotateCcw size={18} /> Remboursement {sale?.number || number}</h2><button type="button" className="btn btn-ghost btn-sm" onClick={onClose} style={{ marginInlineStart: 'auto' }} aria-label="Fermer"><X size={16} /></button></div>
    {!sale && !err && <div className="fxm-rf-skel" aria-busy="true" />}
    {sale && <>
      <div className="fxm-rf-meta"><span>{dateTime(sale.createdAt)}</span>{sale.client?.fullName && <span>{sale.client.fullName}</span>}<span>Payé <b className="fxm-num">{money(sale.total, cur)}</b></span>{Number(sale.refundedTotal) > 0 && <span className="fxm-rf-done">Déjà remboursé {money(sale.refundedTotal, cur)}</span>}</div>
      {state === 'FULL' ? <div className="fxm-cs-warn">Cette vente est déjà entièrement remboursée.</div> : <>
        <div className="fxm-rf-head"><span>Articles rendus</span><button type="button" className="btn btn-ghost btn-sm" onClick={all}>Tout rendre</button></div>
        <div className="fxm-cs-lines">
          {lines.map((l: any) => { const left = l.quantity - l.returnedQuantity; const n = qty[l.id] || 0;
            return <div key={l.id} className={'fxm-cs-line fxm-rf-line' + (n ? ' on' : '') + (!left ? ' off' : '')}>
              <div className="fxm-grow"><b>{l.name}</b><small>{l.quantity} vendu{l.quantity > 1 ? 's' : ''}{l.returnedQuantity ? ` · ${l.returnedQuantity} déjà rendu${l.returnedQuantity > 1 ? 's' : ''}` : ''} · {money(l.unitPrice, cur)}</small>
                {n > 0 && <label className="fxm-rf-keep"><input type="checkbox" checked={keep[l.id] !== false} onChange={e => setKeep(k => ({ ...k, [l.id]: e.target.checked }))} /><PackageCheck size={14} /> Remettre en stock</label>}</div>
              {left > 0 ? <div className="fxm-cs-step" role="group" aria-label={`Quantité rendue ${l.name}`}>
                <button type="button" aria-label="Moins" disabled={!n} onClick={() => step(l, -1)}><Minus size={15} /></button>
                <span className="fxm-num">{n}</span>
                <button type="button" aria-label="Plus" disabled={n >= left} onClick={() => step(l, 1)}><Plus size={15} /></button>
              </div> : <span className="fxm-rf-tag">Rendu</span>}
            </div>; })}
        </div>

        <div className="fxm-rf-head"><span>Motif</span></div>
        <div className="fxm-cs-cats" role="group" aria-label="Motif">{[...REASONS, 'Autre'].map(r => <button type="button" key={r} className={reason === r ? 'on' : ''} aria-pressed={reason === r} onClick={() => pickReason(r)}>{r}</button>)}</div>
        {reason === 'Autre' && <label className="fxm-cash-field"><span>Précisez</span><span className="fxm-cash-input"><input value={other} onChange={e => setOther(e.target.value)} placeholder="Ex. geste commercial" maxLength={200} /></span></label>}

        <div className="fxm-rf-head"><span>Rendre l’argent en</span></div>
        <div className="fxm-cash-methods" role="group" aria-label="Mode de remboursement">
          {methods.map(([v, l, I]) => <button key={v} type="button" aria-pressed={method === v} onClick={() => setMethod(v)} className={method === v ? 'on' : ''}><I /><span>{l}</span></button>)}
        </div>
        {needPin && <label className="fxm-cash-field"><span><KeyRound size={13} /> Code du gérant</span><span className="fxm-cash-input"><input type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6 chiffres" /></span></label>}

        <button type="button" className="fxm-cash-go refund" disabled={busy || !preview || motive.length < 3 || (needPin && pin.length !== 6)} onClick={submit}>
          <RotateCcw /><span>{busy ? 'Traitement…' : !preview ? 'Choisissez les articles' : motive.length < 3 ? 'Choisissez le motif' : 'Rembourser'}</span><b className="fxm-num">{preview ? money(preview.amount, cur) : '—'}</b>
        </button>
        {preview && Number(sale.discount) > 0 && <small className="fxm-rf-note">La remise de la vente ({money(sale.discount, cur)}) est déduite au prorata.</small>}
      </>}
    </>}
    {err && <div className="error" role="alert">{err}</div>}
  </div>;
}
