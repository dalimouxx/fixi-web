'use client';
import { useEffect, useState } from 'react';
import { humanError } from '@/lib/human-error';
import { Award, Check, Loader2, PackageX, RotateCcw, Truck, X } from 'lucide-react';
import { money } from '@/lib/format';

const REASON: Record<string, string> = { DEFECTIVE: 'Pièce défectueuse', WRONG_PART: 'Mauvaise pièce', EXCHANGE: 'Échange' };

/** Reprises demandées par les ateliers : accepter (livreur), refuser, puis réception → avoir automatique. */
export function SupplierReturnPickups({ onChanged }: { onChanged?: () => void }) {
  const [d, setD] = useState<{ rows: any[]; drivers: any[] } | null>(null); const [n, setN] = useState(0); const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  useEffect(() => { fetch('/api/supplier/return-pickups', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(setD).catch(() => {}); }, [n]);
  if (!d?.rows.length) return null;
  async function patch(body: any) { const r = await fetch('/api/supplier/return-pickups', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); }
  async function receive(p: any) {
    setBusy(p.id); setErr('');
    try {
      let returnId: string | null = null;
      const items = (p.items as any[]).filter(i => i.saleItemId);
      if (p.saleId && items.length) {
        // Avoir sans remboursement : il réduit le solde de l'atelier. Pièce défectueuse non remise en stock.
        const r = await fetch('/api/supplier/advanced', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'RETURN', type: 'SALE_RETURN', sourceSaleId: p.saleId, refund: 0, note: 'Reprise livreur · ' + REASON[p.reason], items: items.map(i => ({ saleItemId: i.saleItemId, quantity: i.quantity, reason: REASON[p.reason], condition: p.reason === 'DEFECTIVE' ? 'DEFECTUEUX' : 'BON', restock: p.reason !== 'DEFECTIVE' })) }) });
        const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Avoir impossible'); returnId = j.id || null;
      }
      await patch({ id: p.id, action: 'complete', returnId }); setN(x => x + 1); onChanged?.();
    } catch (e: any) { setErr(humanError(e)); } finally { setBusy(''); }
  }
  return <section className="supplier-panel rp">
    <h3><RotateCcw size={17} /> Reprises chez les ateliers <em>{d.rows.length}</em></h3>
    {err && <p className="rm-err">{err}</p>}
    <ul>{d.rows.map(p => <li key={p.id}>
      <span className={'rp-st rp-' + p.status.toLowerCase()}>{p.status === 'REQUESTED' ? 'À valider' : p.status === 'ACCEPTED' ? (p.mode === 'SHOP_DROPOFF' ? 'Dépôt atelier attendu' : 'Au livreur') : 'Pièce reçue'}</span>
      <div><b>{p.shop.name} · {REASON[p.reason]}{p.mode === 'SHOP_DROPOFF' ? ' · dépôt par l’atelier' : ''}</b><small>{(p.items as any[]).map(i => `${i.quantity} × ${i.name}`).join(', ')}{p.note ? ` · « ${p.note} »` : ''}</small></div>
      {p.proofUrl && <a href={p.proofUrl} target="_blank" rel="noreferrer"><img className="rp-proof" src={p.proofUrl} alt="Photo de la pièce reprise" /></a>}
      {p.status === 'ACCEPTED' && p.mode === 'SHOP_DROPOFF' && <button className="btn btn-primary btn-sm" disabled={busy === p.id} onClick={async () => { const code = window.prompt('Code de reprise donné par l’atelier (4 chiffres)') || ''; if (!code) return; setBusy(p.id); setErr(''); try { await patch({ id: p.id, action: 'receive', code }); setN(x => x + 1); } catch (e: any) { setErr(humanError(e)); } finally { setBusy(''); } }}><Check size={14} /> Pièce déposée · saisir le code</button>}{p.status === 'REQUESTED' && p.mode === 'SHOP_DROPOFF' && <button className="btn btn-primary btn-sm" onClick={async () => { try { await patch({ id: p.id, action: 'accept' }); setN(x => x + 1); } catch (e: any) { setErr(humanError(e)); } }}>Accepter le dépôt</button>}{p.status === 'REQUESTED' && p.mode === 'SHOP_DROPOFF' && <button className="btn btn-ghost btn-sm" onClick={async () => { const note = window.prompt('Motif du refus (envoyé à l’atelier)') || ''; try { await patch({ id: p.id, action: 'reject', note }); setN(x => x + 1); } catch (e: any) { setErr(humanError(e)); } }}><X size={14} /> Refuser</button>}{p.status === 'REQUESTED' && p.mode !== 'SHOP_DROPOFF' && <><select className="input rp-driver" defaultValue="" onChange={e => (e.target as any).dataset.v = e.target.value} id={'drv-' + p.id}><option value="">Prochain livreur</option>{d.drivers.map(x => <option key={x.id} value={x.id}>{x.fullName}</option>)}</select>
        <button className="btn btn-primary btn-sm" onClick={async () => { try { await patch({ id: p.id, action: 'accept', driverAccountId: (document.getElementById('drv-' + p.id) as HTMLSelectElement)?.value || null }); setN(x => x + 1); } catch (e: any) { setErr(humanError(e)); } }}><Truck size={14} /> Accepter</button>
        <button className="btn btn-ghost btn-sm" onClick={async () => { const note = window.prompt('Motif du refus (envoyé à l’atelier)') || ''; try { await patch({ id: p.id, action: 'reject', note }); setN(x => x + 1); } catch (e: any) { setErr(humanError(e)); } }}><X size={14} /></button></>}
      {p.status === 'COLLECTED' && <button className="btn btn-primary btn-sm" disabled={busy === p.id} onClick={() => receive(p)}>{busy === p.id ? <Loader2 size={14} className="ps-spin" /> : <Check size={14} />} Reçue · créer l’avoir</button>}
    </li>)}</ul>
  </section>;
}

/** Classement des livreurs et prime par livraison. */
export function SupplierDriverBoard() {
  const [d, setD] = useState<any>(null); const [days, setDays] = useState(7); const [bonus, setBonus] = useState(''); const [saved, setSaved] = useState(false);
  useEffect(() => { fetch('/api/supplier/driver-stats?days=' + days, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(x => { if (x) { setD(x); setBonus(String(x.bonusPerDelivery || '')); } }).catch(() => {}); }, [days, saved]);
  if (!d?.rows.length) return null;
  return <section className="supplier-panel db">
    <header><h3><Award size={17} /> Performance des livreurs</h3><div className="ps-tabs">{[1, 7, 30].map(x => <button key={x} className={days === x ? 'on' : ''} onClick={() => setDays(x)}>{x === 1 ? 'Aujourd’hui' : x + ' jours'}</button>)}</div></header>
    <div className="db-table"><div className="db-row db-h"><span>#</span><span>Livreur</span><span>Livrées</span><span>Échecs</span><span>Réussite</span><span>Temps moyen</span><span>Km</span><span>Prime</span></div>
      {d.rows.map((r: any, i: number) => <div className="db-row" key={r.driverId}><span className={'db-rank r' + i}>{i + 1}</span><b>{r.name}</b><span>{r.delivered}</span><span>{r.failed}</span><span><i className="db-bar"><i style={{ width: r.successPct + '%' }} /></i>{r.successPct} %</span><span>{r.avgMinutes != null ? r.avgMinutes + ' min' : '—'}</span><span>{r.km}</span><span>{r.bonus ? money(r.bonus) : '—'}</span></div>)}</div>
    <form className="db-bonus" onSubmit={async e => { e.preventDefault(); const r = await fetch('/api/supplier/driver-stats', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bonusPerDelivery: bonus || 0 }) }); if (r.ok) setSaved(s => !s); }}>
      <label>Prime par livraison réussie (DT)<input value={bonus} onChange={e => setBonus(e.target.value)} inputMode="decimal" placeholder="0 = pas de prime" /></label><button className="btn btn-soft btn-sm">Enregistrer</button>
      <small>Le livreur voit sa prime du jour et de la semaine dans son application.</small>
    </form>
  </section>;
}

/** Atelier : demander la reprise d'une pièce d'une commande livrée. */
export function ReturnRequestDialog({ order, onClose, onDone }: { order: any; onClose: () => void; onDone: () => void }) {
  const [itemId, setItemId] = useState(order.items?.[0]?.id || ''); const [qty, setQty] = useState('1'); const [reason, setReason] = useState('DEFECTIVE'); const [mode, setMode] = useState<'DRIVER' | 'SHOP_DROPOFF'>('DRIVER'); const [note, setNote] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const item = order.items.find((i: any) => i.id === itemId);
  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try { const r = await fetch('/api/marketplace/returns', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId: order.id, items: [{ itemId, quantity: qty }], reason, note, mode }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); onDone(); onClose(); }
    catch (x: any) { setErr(humanError(x)); setBusy(false); }
  }
  return <div className="pm-back" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <form className="pm" onSubmit={send}>
      <header><PackageX size={18} /><div><b>Retourner une pièce</b><small>{order.reference} · {order.company.name}</small></div><button type="button" onClick={onClose} aria-label="Fermer"><X size={18} /></button></header>
      <label className="pm-field"><span>Pièce</span><select className="input" value={itemId} onChange={e => { setItemId(e.target.value); setQty('1'); }}>{order.items.map((i: any) => <option key={i.id} value={i.id}>{i.product.name} (×{i.quantity})</option>)}</select></label>
      <div className="pm-days">{Object.entries(REASON).map(([k, l]) => <button type="button" key={k} aria-pressed={reason === k} onClick={() => setReason(k)}>{l}</button>)}</div>
      <label className="pm-field"><span>Quantité</span><input value={qty} onChange={e => setQty(e.target.value.replace(/\D/g, ''))} inputMode="numeric" max={item?.quantity} /></label>
      <div className="pm-field"><span>Qui apporte la pièce ?</span><div className="pm-days rp-mode"><button type="button" aria-pressed={mode === 'DRIVER'} onClick={() => setMode('DRIVER')}><Truck size={14} /> Le livreur la récupère</button><button type="button" aria-pressed={mode === 'SHOP_DROPOFF'} onClick={() => setMode('SHOP_DROPOFF')}><PackageX size={14} /> Je la dépose moi-même</button></div></div>
      <label className="pm-field"><span>Précision</span><input value={note} onChange={e => setNote(e.target.value)} maxLength={300} placeholder="Ex. pas d’image, tactile mort…" /></label>
      {err && <p className="pm-err">{err}</p>}
      <button className="pm-save pr-save" disabled={busy}><RotateCcw size={17} /> Demander la reprise</button>
      <small className="ch-tip">{mode === 'DRIVER' ? 'Le livreur la récupère à son prochain passage.' : 'Vous la déposez chez le fournisseur.'} Un code de reprise à 4 chiffres s’affichera dans « Mes reprises » : donnez-le seulement au moment de la remise. L’avoir est ensuite déduit de votre solde.</small>
    </form>
  </div>;
}
