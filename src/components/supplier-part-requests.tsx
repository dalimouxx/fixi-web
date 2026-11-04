'use client';
import { useEffect, useMemo, useState } from 'react';
import { Check, Clock3, MapPin, MessageSquareQuote, Search, Send, X } from 'lucide-react';
import { money } from '@/lib/format';
import { DELAYS } from '@/lib/commerce';

/** Fournisseur : demandes de pièces des ateliers (région + nationales), réponse en 20 secondes. */
export function SupplierPartRequests({ products }: { products: any[] }) {
  const [rows, setRows] = useState<any[]>([]); const [n, setN] = useState(0); const [open, setOpen] = useState<any>(null);
  useEffect(() => { fetch('/api/supplier/part-requests', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).then(setRows).catch(() => {}); }, [n]);
  if (!rows.length) return null;
  const todo = rows.filter(r => !r.mine).length;
  return <section className="supplier-panel pr">
    <h3><MessageSquareQuote size={17} /> Demandes de pièces des ateliers {todo > 0 && <em>{todo} sans réponse</em>}</h3>
    <ul>{rows.map(r => <li key={r.id} className={r.mine ? 'done' : ''}>
      <div><b>{r.quantity} × {r.partName}{r.deviceModel ? ` · ${r.deviceModel}` : ''}</b><small><MapPin size={12} /> {r.shopName} · {r.region || '—'}{r.scope === 'ALL' ? ' · toute la Tunisie' : ''} · {r.offers} offre(s){r.note ? ` · « ${r.note} »` : ''}</small></div>
      {r.mine ? <span className="pr-mine"><Check size={14} /> {money(Number(r.mine.price))} · {DELAYS[r.mine.delay]}</span> : <button className="btn btn-primary btn-sm" onClick={() => setOpen(r)}><Send size={14} /> Répondre</button>}
    </li>)}</ul>
    {open && <QuoteDialog request={open} products={products} onClose={() => setOpen(null)} onDone={() => { setOpen(null); setN(x => x + 1); }} />}
  </section>;
}

function QuoteDialog({ request, products, onClose, onDone }: { request: any; products: any[]; onClose: () => void; onDone: () => void }) {
  const [q, setQ] = useState(request.partName.split(' ').slice(0, 3).join(' '));
  const [productId, setProductId] = useState(''); const [price, setPrice] = useState(''); const [qty, setQty] = useState(String(request.quantity)); const [delay, setDelay] = useState('TODAY');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const matches = useMemo(() => { const w = q.toLowerCase().split(/\s+/).filter(Boolean); return products.filter(p => p.active !== false && w.every((x: string) => `${p.name} ${p.sku} ${p.barcode || ''}`.toLowerCase().includes(x))).slice(0, 6); }, [q, products]);
  const chosen = products.find(p => p.id === productId);
  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try { const r = await fetch('/api/supplier/part-requests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ requestId: request.id, productId: productId || null, price, quantity: qty, delay }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); onDone(); }
    catch (x: any) { setErr(x.message); setBusy(false); }
  }
  return <div className="pm-back" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <form className="pm" onSubmit={send}>
      <header><MessageSquareQuote size={18} /><div><b>Répondre à {request.shopName}</b><small>{request.quantity} × {request.partName}{request.deviceModel ? ' · ' + request.deviceModel : ''}</small></div><button type="button" onClick={onClose} aria-label="Fermer"><X size={18} /></button></header>
      <label className="pm-field"><span>Dans mon catalogue</span><div className="pr-search"><Search size={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Chercher la pièce" /></div></label>
      <div className="pr-matches">{matches.map(p => <button type="button" key={p.id} aria-pressed={productId === p.id} onClick={() => setProductId(productId === p.id ? '' : p.id)}><b>{p.name}</b><small>{money(Number(p.retailPrice ?? p.price))} · {Number(p.stock) - Number(p.reservedStock || 0)} en stock</small></button>)}
        <button type="button" aria-pressed={!productId} onClick={() => setProductId('')}><b>Nouvelle fiche</b><small>créée à mon prix</small></button></div>
      <div className="pm-price">{chosen ? <p className="pr-note">Prix du catalogue : <b>{money(Number(chosen.retailPrice ?? chosen.price))}</b> (lancez une promo pour baisser le prix)</p> : <label><span>Mon prix (DT)</span><input value={price} onChange={e => setPrice(e.target.value)} inputMode="decimal" placeholder="0" /></label>}
        <label style={{ maxWidth: 110 }}><span>Quantité</span><input value={qty} onChange={e => setQty(e.target.value)} inputMode="numeric" /></label></div>
      <div className="pm-days">{Object.entries(DELAYS).map(([k, l]) => <button type="button" key={k} aria-pressed={delay === k} onClick={() => setDelay(k)}><Clock3 size={13} /> {l}</button>)}</div>
      {err && <p className="pm-err">{err}</p>}
      <button className="pm-save pr-save" disabled={busy}><Send size={17} /> Envoyer mon offre</button>
    </form>
  </div>;
}
