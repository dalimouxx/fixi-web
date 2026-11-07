// FIXI Caisse — mode ATELIER : vente comptoir d'accessoires (coques, câbles, chargeurs…) et retours client.
// Même API que le web (/api/counter-sales) : prix, stock, remise et remboursement sont recalculés par le serveur.
import { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ArrowLeftRight, Banknote, CheckCircle2, CreditCard, KeyRound, Minus, PackageCheck, PackageSearch, Plus, RotateCcw, ScanBarcode, Smartphone, Trash2, X } from 'lucide-react';
import { dt } from './dialogs';
import { defaultSettings, readJson, SETTINGS_KEY, type Settings } from './storage';

const req = <T,>(method: string, path: string, body?: unknown) => invoke<T>('atelier_request', { method, path, body: body ?? null });
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const METHODS = [['CASH', Banknote, 'Espèces'], ['CARD', CreditCard, 'Carte'], ['D17', Smartphone, 'D17'], ['BANK_TRANSFER', ArrowLeftRight, 'Virement']] as const;
export const METHOD_LABEL: Record<string, string> = { CASH: 'Espèces', CARD: 'Carte', D17: 'D17', FLOUCI: 'Flouci', BANK_TRANSFER: 'Virement', OTHER: 'Autre' };
const REASONS = ['Article défectueux', 'Ne convient pas', 'Erreur de caisse'];

// ---- Hors ligne : catalogue en cache + file des ventes à envoyer (référence unique = jamais de doublon) ----
const ITEMS_KEY = 'fixi-atelier-cs-items', QUEUE_KEY = 'fixi-atelier-cs-queue';
export type QueuedSale = { clientRef: string; createdAt: string; body: any; total: number; label: string; error?: string };
export const isNetworkError = (e: unknown) => /^Erreur réseau|error sending request|dns|timed? ?out|connect/i.test(String(e));
export function newClientRef() { return 'W' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
export function readQueue(): QueuedSale[] { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; } }
function writeQueue(q: QueuedSale[]) { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch {} }
/** Envoie les ventes en attente ; garde celles refusées par le serveur avec la raison (stock, caisse fermée…). */
export async function flushQueue(): Promise<{ sent: number; left: number }> {
  let q = readQueue(); let sent = 0;
  for (const item of q) {
    try { await req('POST', '/api/counter-sales', { ...item.body, clientRef: item.clientRef }); q = q.filter(x => x.clientRef !== item.clientRef); sent++; }
    catch (e) { if (isNetworkError(e)) break; q = q.map(x => x.clientRef === item.clientRef ? { ...x, error: String(e).replace(/ \(HTTP \d+\)$/, '') } : x); }
    writeQueue(q);
  }
  return { sent, left: q.length };
}

type Item = { id: string; sku: string; barcode?: string | null; name: string; category: string | null; quantity: number; minQuantity: number; salePrice: number };
export type SalePrint = { kind: 'vente' | 'retour'; number: string; lines: { name: string; quantity: number; total: number }[]; total: number; discount?: number; method: string; received?: number; change?: number; offline?: boolean };

/** Numéro de ticket : « 42 » devient « V-000042 ». */
export function ticketNumber(raw: string) { const t = raw.trim().toUpperCase(); return /^\d+$/.test(t) ? 'V-' + t.padStart(6, '0') : t; }

/** Aperçu du remboursement (le serveur fait foi) : remise au prorata, solde exact au dernier retour. */
export function refundPreview(sale: any, qty: Record<string, number>) {
  const lines = (sale?.lines || []) as any[];
  const picked = lines.filter(l => (qty[l.id] || 0) > 0);
  if (!picked.length) return 0;
  const remaining = r3(Number(sale.total) - Number(sale.refundedTotal || 0));
  const allBack = lines.every(l => l.quantity - (l.returnedQuantity || 0) === (qty[l.id] || 0));
  if (allBack) return remaining;
  const ratio = Number(sale.subtotal) > 0 ? Number(sale.total) / Number(sale.subtotal) : 0;
  return r3(Math.min(remaining, picked.reduce((a, l) => a + Number(l.unitPrice) * qty[l.id], 0) * ratio));
}

export function CounterSaleTab({ manager, onSold, onError }: { manager: boolean; onSold: (p: SalePrint, msg: string) => void; onError: (e: unknown) => void }) {
  const [q, setQ] = useState(''); const [data, setData] = useState<any>(null); const [n, setN] = useState(0);
  const [cart, setCart] = useState<Record<string, { item: Item; qty: number }>>({});
  const [discount, setDiscount] = useState(''); const [method, setMethod] = useState('CASH'); const [received, setReceived] = useState('');
  const [busy, setBusy] = useState(false); const [refund, setRefund] = useState<string | null>(null); const [find, setFind] = useState('');
  const scanRef = useRef<HTMLInputElement>(null);
  const settings = useMemo(() => ({ ...defaultSettings, ...readJson<Partial<Settings>>(SETTINGS_KEY, {}) }), []);

  const [offline, setOffline] = useState(false); const [queue, setQueue] = useState<QueuedSale[]>(() => readQueue());
  useEffect(() => { const t = setTimeout(() => {
    req<any>('GET', '/api/counter-sales?q=' + encodeURIComponent(q)).then(d => { setData(d); setOffline(false); if (!q) try { localStorage.setItem(ITEMS_KEY, JSON.stringify({ items: d.items, shop: d.shop, role: d.role })); } catch {} })
      .catch(e => { if (!isNetworkError(e)) { onError(e); return; } setOffline(true); try { const c = JSON.parse(localStorage.getItem(ITEMS_KEY) || 'null'); if (c) { const words = q.toLowerCase(); setData({ ...c, sales: [], items: c.items.filter((i: any) => !words || `${i.name} ${i.sku} ${i.barcode || ''} ${i.category || ''}`.toLowerCase().includes(words)) }); } } catch {} });
  }, 200); return () => clearTimeout(t); }, [q, n]);
  // Retour d'Internet : envoi automatique des ventes en attente (toutes les 30 s et dès que le réseau revient).
  useEffect(() => { const run = () => { if (!readQueue().length) return; void flushQueue().then(r => { setQueue(readQueue()); if (r.sent) { setOffline(false); setN(x => x + 1); } }); };
    run(); const t = setInterval(run, 30_000); window.addEventListener('online', run); return () => { clearInterval(t); window.removeEventListener('online', run); }; }, []);
  const items: Item[] = useMemo(() => (data?.items || []).map((x: any) => ({ ...x, salePrice: Number(x.salePrice) })), [data]);
  const lines = Object.values(cart);
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const subtotal = r3(lines.reduce((a, l) => a + l.item.salePrice * l.qty, 0));
  const cap = manager ? subtotal : Math.min(subtotal, Number(data?.shop?.cashierMaxDiscount || 0));
  const disc = r3(Math.max(0, Math.min(cap, Number(discount.replace(',', '.')) || 0)));
  const total = r3(subtotal - disc);
  const got = method === 'CASH' ? (Number(received.replace(',', '.')) || total) : total;
  const change = method === 'CASH' ? Math.max(0, r3(got - total)) : 0;
  const short = method === 'CASH' && got + 0.0001 < total;
  const needSession = method === 'CASH' && !!data?.shop?.cashRequireSession && data?.sessionOpen === false;

  function add(it: Item, d = 1) { setCart(c => { const next = Math.max(0, Math.min(it.quantity, (c[it.id]?.qty || 0) + d)); const x = { ...c }; if (next) x[it.id] = { item: it, qty: next }; else delete x[it.id]; return x; }); }
  // Douchette : la référence (code-barres) exacte ajoute l'article ; sinon, la liste filtrée reste affichée.
  // La douchette tape plus vite que la recherche : on interroge le serveur avec le code exact.
  async function scan() {
    const code = q.trim(); if (!code) return;
    const exact = (list: Item[]) => list.find(i => (i.barcode || '').toUpperCase() === code.toUpperCase()) || list.find(i => i.sku.toUpperCase() === code.toUpperCase());
    let hit = exact(items);
    if (!hit) { try { const r = await req<any>('GET', '/api/counter-sales?q=' + encodeURIComponent(code)); const list = (r.items || []).map((x: any) => ({ ...x, salePrice: Number(x.salePrice) })); hit = exact(list) || (list.length === 1 ? list[0] : undefined); } catch (x) { if (!isNetworkError(x)) { onError(x); return; } setOffline(true); try { const c = JSON.parse(localStorage.getItem(ITEMS_KEY) || 'null'); hit = c ? exact((c.items || []).map((x: any) => ({ ...x, salePrice: Number(x.salePrice) }))) : undefined; } catch {} } }
    if (hit && hit.quantity > 0) { add(hit); setQ(''); }
    else if (hit) onError(`${hit.name} : rupture de stock`);
  }
  function reset() { setCart({}); setDiscount(''); setReceived(''); requestAnimationFrame(() => scanRef.current?.focus()); }

  async function sell() {
    if (!lines.length || busy || short || needSession) return; setBusy(true);
    try {
      const body = { lines: lines.map(l => ({ itemId: l.item.id, quantity: l.qty })), discount: disc, splits: [{ method, amount: total, receivedAmount: method === 'CASH' ? got : total }], clientRef: newClientRef() };
      let r: any;
      try { r = await req<any>('POST', '/api/counter-sales', body); }
      catch (e) {
        if (!isNetworkError(e) || method !== 'CASH') throw e; // hors ligne : espèces seulement (la carte/D17 doivent être confirmées en ligne)
        const ticket = 'HL-' + body.clientRef.slice(-6).toUpperCase();
        const qd: QueuedSale = { clientRef: body.clientRef, createdAt: new Date().toISOString(), body, total, label: lines.map(l => `${l.qty}× ${l.item.name}`).join(', ') };
        writeQueue([...readQueue(), qd]); setQueue(readQueue()); setOffline(true);
        r = { number: ticket, lines: lines.map(l => ({ name: l.item.name, quantity: l.qty, total: l.item.salePrice * l.qty })), total, discount: disc, change, offline: true };
      }
      if (method === 'CASH' && settings.drawerPrinter) void invoke('cash_drawer_open', { printer: settings.drawerPrinter }).catch(() => {});
      onSold({ kind: 'vente', number: r.number, lines: r.lines.map((l: any) => ({ name: l.name, quantity: l.quantity, total: Number(l.total) })), total: Number(r.total), discount: Number(r.discount), method, received: method === 'CASH' ? got : undefined, change: Number(r.change), offline: !!r.offline }, r.offline ? `Hors ligne : vente ${r.number} gardée sur ce PC (${dt(Number(r.total))}). Elle sera envoyée dès le retour d’Internet.` : `Vente ${r.number} encaissée : ${dt(Number(r.total))}${Number(r.change) > 0 ? ` · monnaie ${dt(Number(r.change))}` : ''}.`);
      reset(); setN(x => x + 1);
    } catch (x) { onError(x); setN(x => x + 1); } finally { setBusy(false); }
  }

  return <div className="at-split at-cs">
    <section className="v5-card at-list">
      {(offline || queue.length > 0) && <div className={'at-cs-offline' + (queue.some(x => x.error) ? ' is-error' : '')} role="status">
        <b>{offline ? 'Hors ligne' : 'Ventes à envoyer'}</b>
        <span>{offline ? 'Catalogue en mémoire · ventes en espèces gardées sur ce PC' : ''}{queue.length ? `${offline ? ' · ' : ''}${queue.length} vente(s) en attente (${dt(queue.reduce((a, x) => a + x.total, 0))})` : ''}</span>
        {queue.some(x => x.error) && <small>{queue.filter(x => x.error).map(x => `${x.label} : ${x.error}`).join(' · ')}</small>}
        {queue.length > 0 && <button type="button" className="v5-btn v5-btn--ghost v5-btn--sm" onClick={() => void flushQueue().then(() => { setQueue(readQueue()); setN(x => x + 1); })}>Envoyer maintenant</button>}
      </div>}
      <div className="v5-search"><ScanBarcode size={17} /><input ref={scanRef} autoFocus value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void scan(); if (e.key === 'Escape') setQ(''); }} placeholder="Scannez ou cherchez : coque, câble, code-barres…" /></div>
      <div className="at-cs-grid">
        {items.map(it => { const inCart = cart[it.id]?.qty || 0; const out = it.quantity <= 0;
          return <button key={it.id} className={'v5-product' + (inCart ? ' is-in-cart' : '')} disabled={out || inCart >= it.quantity} onClick={() => add(it)}>
            {inCart > 0 && <span className="v5-product-qty">{inCart}</span>}
            <span className="at-cs-cat">{it.category || 'Autres'}</span><strong>{it.name}</strong><small className="v5-mono">{it.sku}</small>
            <span className="v5-product-foot"><b>{dt(it.salePrice)}</b><span className={'v5-stock ' + (out ? 'is-out' : it.quantity <= Math.max(1, it.minQuantity) ? 'is-low' : '')}>{out ? 'Rupture' : it.quantity}</span></span>
          </button>; })}
      </div>
      {data && !items.length && <div className="v5-empty"><PackageSearch size={34} /><h3>{q ? 'Aucun article' : 'Aucun accessoire à vendre'}</h3><p>{q ? 'Essayez un autre mot ou scannez la référence.' : 'Ajoutez vos accessoires avec un prix de vente dans Fixi (Pièces → Mon stock).'}</p></div>}
    </section>

    <section className="v5-card at-pay">
      {refund ? <Refund number={refund} manager={manager} onClose={() => setRefund(null)} onDone={(p, msg) => { setRefund(null); setN(x => x + 1); onSold(p, msg); }} onError={onError} /> : lines.length ? <>
        <div className="at-cs-head"><h2>Panier <small>{count}</small></h2><button className="v5-btn v5-btn--ghost v5-btn--sm" onClick={reset}><Trash2 size={15} /> Vider</button></div>
        <div className="at-cs-lines">{lines.map(({ item, qty }) => <div key={item.id} className="at-cs-line">
          <span><b>{item.name}</b><small>{dt(item.salePrice)} l’unité</small></span>
          <span className="at-cs-step"><button aria-label="Retirer un" onClick={() => add(item, -1)}><Minus size={14} /></button><b>{qty}</b><button aria-label="Ajouter un" disabled={qty >= item.quantity} onClick={() => add(item, 1)}><Plus size={14} /></button></span>
          <strong>{dt(item.salePrice * qty)}</strong>
        </div>)}</div>
        <label className="v5-field"><span>Remise (DT){!manager && cap < subtotal ? ` · max ${dt(cap)}` : ''}</span><input inputMode="decimal" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" /></label>
        <div className="at-total"><span>À payer{disc ? ` · remise ${dt(disc)}` : ''}</span><b>{dt(total)}</b></div>
        <div className="at-methods" role="radiogroup" aria-label="Moyen de paiement">{METHODS.map(([k, I, l]) => <button key={k} type="button" aria-pressed={method === k} onClick={() => setMethod(k)}><I size={16} /> {l}</button>)}</div>
        {method === 'CASH' && <div className="at-cs-cash"><label className="v5-field"><span>Le client donne</span><input inputMode="decimal" value={received} onChange={e => setReceived(e.target.value)} placeholder={String(total)} /></label>
          <div className={'at-cs-change' + (short ? ' is-short' : '')}><span>{short ? 'Il manque' : 'Monnaie à rendre'}</span><b>{dt(short ? total - got : change)}</b></div></div>}
        {needSession && <p className="v5-alert v5-alert--danger" role="alert"><span>La caisse n’est pas ouverte dans Fixi : ouvrez la session pour encaisser en espèces, ou choisissez un autre moyen.</span></p>}
        <button className="v5-btn v5-btn--primary v5-btn--lg v5-pay" disabled={busy || short || needSession} onClick={sell}><CheckCircle2 size={18} /> {busy ? 'Encaissement…' : `Encaisser ${dt(total)}`}</button>
      </> : <>
        <div className="v5-empty"><ScanBarcode size={40} /><h3>Panier vide</h3><p>Scannez un accessoire ou touchez-le dans la liste.</p></div>
        <form className="at-cs-find" onSubmit={e => { e.preventDefault(); if (find.trim()) { setRefund(ticketNumber(find)); setFind(''); } }}>
          <label className="v5-field"><span><RotateCcw size={14} /> Retour client : numéro du ticket</span><input value={find} onChange={e => setFind(e.target.value)} placeholder="V-000042 ou 42" /></label>
          <button className="v5-btn v5-btn--ghost" disabled={!find.trim()}>Ouvrir</button></form>
        {data?.sales?.length > 0 && <div className="at-cs-today"><h3>Ventes du jour <small>{dt(Number(data.todayTotal || 0))}</small></h3>
          {data.sales.slice(0, 10).map((s: any) => { const full = Number(s.refundedTotal || 0) + 0.0005 >= Number(s.total); return <button key={s.id} className="at-row" disabled={full} onClick={() => setRefund(s.number)} title={full ? 'Déjà remboursée' : 'Retour client'}>
            <RotateCcw size={16} /><span><b>{s.number}</b><small>{s.lines.map((l: any) => `${l.quantity}× ${l.name}`).join(', ')}{Number(s.refundedTotal) > 0 ? (full ? ' · remboursée' : ' · retour partiel') : ''}</small></span><strong>{dt(Number(s.total))}</strong></button>; })}
        </div>}
      </>}
    </section>
  </div>;
}

function Refund({ number, manager, onClose, onDone, onError }: { number: string; manager: boolean; onClose: () => void; onDone: (p: SalePrint, msg: string) => void; onError: (e: unknown) => void }) {
  const [sale, setSale] = useState<any>(null); const [qty, setQty] = useState<Record<string, number>>({}); const [keep, setKeep] = useState<Record<string, boolean>>({});
  const [reason, setReason] = useState(''); const [method, setMethod] = useState('CASH'); const [pin, setPin] = useState(''); const [busy, setBusy] = useState(false);
  const settings = useMemo(() => ({ ...defaultSettings, ...readJson<Partial<Settings>>(SETTINGS_KEY, {}) }), []);
  useEffect(() => { req<any>('GET', `/api/counter-sales/${encodeURIComponent(number)}`).then(s => { setSale(s); setMethod(s.payments?.find((p: any) => p.kind !== 'REFUND')?.method || 'CASH'); }).catch(e => { onError(e); onClose(); }); }, [number]);
  const amount = refundPreview(sale, qty);
  function pick(r: string) { setReason(r); const back = r !== 'Article défectueux'; setKeep(Object.fromEntries((sale?.lines || []).map((l: any) => [l.id, back]))); }
  async function submit() {
    if (!amount || reason.length < 3 || busy) return; setBusy(true);
    try {
      const body = { lines: (sale.lines as any[]).filter(l => qty[l.id] > 0).map(l => ({ lineId: l.id, quantity: qty[l.id], restock: keep[l.id] !== false })), reason, method, managerPin: manager ? undefined : pin };
      const r = await req<any>('POST', `/api/counter-sales/${encodeURIComponent(sale.number)}/refund`, body);
      if (method === 'CASH' && settings.drawerPrinter) void invoke('cash_drawer_open', { printer: settings.drawerPrinter }).catch(() => {});
      onDone({ kind: 'retour', number: r.number, lines: r.lines.map((l: any) => ({ name: l.name, quantity: l.quantity, total: Number(l.gross) })), total: Number(r.amount), method }, `Retour ${r.number} : ${dt(Number(r.amount))} rendu (${METHOD_LABEL[method] || method}).`);
    } catch (x) { onError(x); } finally { setBusy(false); }
  }
  if (!sale) return <div className="v5-empty"><RotateCcw size={34} /><h3>Recherche du ticket {number}…</h3></div>;
  return <div className="at-cs-refund">
    <div className="at-cs-head"><h2><RotateCcw size={18} /> Retour {sale.number}</h2><button className="v5-icon-btn" aria-label="Fermer" onClick={onClose}><X size={16} /></button></div>
    <p className="v5-hint">{new Date(sale.createdAt).toLocaleString('fr-FR')} · payé {dt(Number(sale.total))}{Number(sale.refundedTotal) > 0 ? ` · déjà remboursé ${dt(Number(sale.refundedTotal))}` : ''}</p>
    <div className="at-cs-lines">{(sale.lines as any[]).map(l => { const left = l.quantity - (l.returnedQuantity || 0); const n = qty[l.id] || 0;
      return <div key={l.id} className={'at-cs-line' + (n ? ' on' : '')}>
        <span><b>{l.name}</b><small>{l.quantity} vendu(s){l.returnedQuantity ? ` · ${l.returnedQuantity} déjà rendu(s)` : ''}</small>
          {n > 0 && <label className="at-cs-keep"><input type="checkbox" checked={keep[l.id] !== false} onChange={e => setKeep(k => ({ ...k, [l.id]: e.target.checked }))} /><PackageCheck size={14} /> Remettre en stock</label>}</span>
        {left > 0 ? <span className="at-cs-step"><button aria-label="Moins" disabled={!n} onClick={() => setQty(q => ({ ...q, [l.id]: n - 1 }))}><Minus size={14} /></button><b>{n}</b><button aria-label="Plus" disabled={n >= left} onClick={() => setQty(q => ({ ...q, [l.id]: n + 1 }))}><Plus size={14} /></button></span> : <small>Rendu</small>}
      </div>; })}</div>
    <div className="at-chips">{[...REASONS, 'Autre'].map(r => <button key={r} type="button" aria-pressed={reason === r} onClick={() => pick(r)}>{r}</button>)}</div>
    <div className="at-methods" role="radiogroup" aria-label="Rendre l’argent en">{METHODS.map(([k, I, l]) => <button key={k} type="button" aria-pressed={method === k} onClick={() => setMethod(k)}><I size={16} /> {l}</button>)}</div>
    {!manager && <label className="v5-field"><span><KeyRound size={14} /> Code du gérant</span><input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6 chiffres" /></label>}
    <button className="v5-btn v5-btn--primary v5-btn--lg at-cs-refund-go" disabled={busy || !amount || reason.length < 3 || (!manager && pin.length !== 6)} onClick={submit}><RotateCcw size={18} /> {busy ? 'Remboursement…' : !amount ? 'Choisissez les articles' : reason ? `Rembourser ${dt(amount)}` : 'Choisissez le motif'}</button>
    <button className="v5-btn v5-btn--ghost" onClick={onClose}><X size={15} /> Annuler</button>
  </div>;
}
