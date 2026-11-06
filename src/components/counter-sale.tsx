'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Banknote, CheckCircle2, CreditCard, Minus, PackageSearch, Plus, Receipt, RotateCcw, ScanBarcode, Search, ShoppingBag, Smartphone, Trash2, UserRound, WalletCards } from 'lucide-react';
import { api, useApi } from './ui';
import { EmptyState } from './ui-states';
import { CashSuccess } from './cash-success';
import { money } from '@/lib/format';
import { refundState, round3, saleNumber } from '@/lib/counter-sale';
import { CounterRefund } from './counter-refund';
import { BarcodeCamera } from './barcode-camera';
import { matchScan } from '@/lib/barcode';

const methods = [['CASH', 'Espèces', Banknote], ['D17', 'D17', Smartphone], ['FLOUCI', 'Flouci', Smartphone], ['CARD', 'Carte', CreditCard], ['BANK_TRANSFER', 'Virement', WalletCards]] as const;
type Item = { id: string; sku: string; name: string; category: string | null; quantity: number; minQuantity: number; salePrice: number };

/**
 * Vente comptoir (Fixi Max) : accessoires du stock atelier vendus sans réparation.
 * Le serveur recalcule prix, stock et remise ; l'écran ne fait que préparer le panier.
 */
export function CounterSalePanel() {
  const [q, setQ] = useState('');
  const [refresh, setRefresh] = useState(0);
  // Petite attente : la douchette tape 13 chiffres d'un coup, une seule requête suffit.
  const [dq, setDq] = useState('');
  useEffect(() => { const t = setTimeout(() => setDq(q), 220); return () => clearTimeout(t); }, [q]);
  const { data } = useApi<any>(`/api/counter-sales?q=${encodeURIComponent(dq)}`, refresh);
  const [cat, setCat] = useState('');
  const [cart, setCart] = useState<Record<string, { item: Item; qty: number }>>({});
  const [discount, setDiscount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [received, setReceived] = useState('');
  const [client, setClient] = useState({ phone: '', fullName: '' });
  const [showClient, setShowClient] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState<any>(null);
  const [refundFor, setRefundFor] = useState<string | null>(null);
  const [find, setFind] = useState('');
  const [camera, setCamera] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const cur = data?.shop?.currency;

  const items: Item[] = useMemo(() => (data?.items || []).map((x: any) => ({ ...x, salePrice: Number(x.salePrice) })), [data]);
  const cats = useMemo(() => [...new Set(items.map(i => i.category || 'Autres'))], [items]);
  const shown = cat ? items.filter(i => (i.category || 'Autres') === cat) : items;
  const lines = Object.values(cart);
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const subtotal = round3(lines.reduce((a, l) => a + l.item.salePrice * l.qty, 0));
  const cap = data?.role === 'ADMIN' ? subtotal : Math.min(subtotal, Number(data?.shop?.cashierMaxDiscount || 0));
  const disc = round3(Math.max(0, Math.min(cap, Number(String(discount).replace(',', '.')) || 0)));
  const total = round3(subtotal - disc);
  const got = method === 'CASH' ? Number(String(received || total).replace(',', '.')) || 0 : total;
  const change = method === 'CASH' ? Math.max(0, round3(got - total)) : 0;
  const short = method === 'CASH' && got + 0.0001 < total;
  const needSession = method === 'CASH' && !!data?.shop?.cashRequireSession && data?.sessionOpen === false;

  function add(it: Item, d = 1) {
    setMsg(''); setDone(null);
    setCart(c => {
      const cur = c[it.id]?.qty || 0; const next = Math.max(0, Math.min(it.quantity, cur + d));
      const copy = { ...c }; if (next) copy[it.id] = { item: it, qty: next }; else delete copy[it.id]; return copy;
    });
  }
  /** Douchette ou caméra : code-barres ou référence exacte → article ajouté, sinon la recherche reste affichée. */
  async function scanned(raw: string) {
    let hit = matchScan(items, raw);
    if (!hit) { try { const r = await api<any>(`/api/counter-sales?q=${encodeURIComponent(raw)}`); hit = matchScan((r.items || []).map((x: any) => ({ ...x, salePrice: Number(x.salePrice) })), raw); } catch {} }
    if (hit && hit.quantity > 0) { add(hit); setQ(''); setMsg(''); }
    else if (hit) setMsg(`${hit.name} : rupture de stock`);
    else { setQ(raw); setMsg(`Aucun article avec le code ${raw}`); }
  }
  function reset() { setCart({}); setDiscount(''); setReceived(''); setClient({ phone: '', fullName: '' }); setShowClient(false); setMsg(''); setShowCart(false); }

  async function sell() {
    if (!lines.length || busy || short) return;
    setBusy(true); setMsg('');
    try {
      const r = await api<any>('/api/counter-sales', { method: 'POST', body: JSON.stringify({
        lines: lines.map(l => ({ itemId: l.item.id, quantity: l.qty })), discount: disc,
        splits: [{ method, amount: total, receivedAmount: method === 'CASH' ? got : total }],
        client: client.phone ? client : undefined,
      }) });
      setDone(r); reset(); setRefresh(x => x + 1);
    } catch (e: any) { setMsg(e.message); setRefresh(x => x + 1); } finally { setBusy(false); }
  }

  return <div className={`fxm-cash-grid fxm-cs ${showCart || refundFor ? 'has-selection' : ''}`}>
    <section className="fxm-card fxm-up fxm-cash-list" style={{ '--d': '.06s' } as any} aria-label="Articles">
      <label className="fxm-search"><Search size={17} aria-hidden="true" /><span className="fxm-sr">Rechercher un article</span><input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && q.trim()) { e.preventDefault(); void scanned(q.trim()); } }} placeholder="Scannez ou cherchez : coque, chargeur, code-barres…" autoFocus /><button type="button" className="fx-searchbar-scan" onClick={() => setCamera(true)} aria-label="Scanner avec la caméra"><ScanBarcode size={18} /></button></label>
      {!count && <button type="button" className="btn fxm-btn-o btn-sm fx-mobile-only fxm-cs-returns" onClick={() => setShowCart(true)}><RotateCcw size={15} /> Ventes du jour et retours</button>}
      {cats.length > 1 && <div className="fxm-cs-cats" role="group" aria-label="Catégories">
        <button type="button" className={!cat ? 'on' : ''} aria-pressed={!cat} onClick={() => setCat('')}>Tout <small>{items.length}</small></button>
        {cats.map(c => <button type="button" key={c} className={cat === c ? 'on' : ''} aria-pressed={cat === c} onClick={() => setCat(c)}>{c} <small>{items.filter(i => (i.category || 'Autres') === c).length}</small></button>)}
      </div>}
      <div className="fxm-cs-grid">
        {shown.map((it, i) => { const inCart = cart[it.id]?.qty || 0; const out = it.quantity <= 0; const low = !out && it.quantity <= Math.max(1, it.minQuantity);
          return <button type="button" key={it.id} disabled={out || inCart >= it.quantity} onClick={() => add(it)} className={'fxm-cs-item fxm-in' + (inCart ? ' on' : '')} style={{ '--d': `${0.05 + Math.min(i, 12) * 0.03}s` } as any} aria-label={`${it.name}, ${money(it.salePrice, cur)}, stock ${it.quantity}`}>
            {inCart > 0 && <span className="fxm-cs-qty" aria-hidden="true">{inCart}</span>}
            <span className="fxm-cs-cat">{it.category || 'Autres'}</span>
            <b>{it.name}</b>
            <small className="fxm-mono">{it.sku}</small>
            <span className="fxm-cs-foot"><b className="fxm-num">{money(it.salePrice, cur)}</b><span className={'fxm-cs-stock' + (out ? ' out' : low ? ' low' : '')}>{out ? 'Rupture' : `${it.quantity} en stock`}</span></span>
          </button>; })}
      </div>
      {data && !shown.length && <EmptyState icon={PackageSearch} title={q ? 'Aucun article trouvé' : 'Aucun article à vendre'} text={q ? 'Essayez un autre mot ou une référence.' : 'Ajoutez vos accessoires dans le stock avec un prix de vente pour les vendre ici.'} action={<Link className="btn btn-soft btn-sm" href="/app/stock">Ouvrir le stock</Link>} />}
      {count > 0 && <button type="button" className="fxm-cs-mobilebar fx-mobile-only" onClick={() => setShowCart(true)}><ShoppingBag size={18} /><span>{count} article(s)</span><b className="fxm-num">{money(total, cur)}</b></button>}
    </section>

    <section className="fxm-card fxm-up fxm-cash-main" style={{ '--d': '.12s' } as any} aria-label="Ticket de vente">
      {(showCart || refundFor) && <button type="button" className="btn btn-ghost btn-sm fx-mobile-only cash-back" onClick={() => { setShowCart(false); setRefundFor(null); }}>← Articles</button>}
      <div className="fxm-panel-head"><h2>Ticket</h2>{count > 0 && <span className="fxm-badge-hot">{count}</span>}{count > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={reset} style={{ marginInlineStart: 'auto' }}><Trash2 size={15} /> Vider</button>}</div>

      {refundFor ? <CounterRefund number={refundFor} cur={cur} role={data?.role} onClose={() => setRefundFor(null)} onDone={() => setRefresh(x => x + 1)} /> : lines.length ? <>
        <div className="fxm-cs-lines">
          {lines.map(({ item, qty }) => <div className="fxm-cs-line fxm-in" key={item.id}>
            <div className="fxm-grow"><b>{item.name}</b><small>{money(item.salePrice, cur)} l’unité</small></div>
            <div className="fxm-cs-step" role="group" aria-label={`Quantité ${item.name}`}>
              <button type="button" aria-label="Retirer un" onClick={() => add(item, -1)}><Minus size={15} /></button>
              <span className="fxm-num">{qty}</span>
              <button type="button" aria-label="Ajouter un" disabled={qty >= item.quantity} onClick={() => add(item, 1)}><Plus size={15} /></button>
            </div>
            <b className="fxm-num fxm-cs-line-total">{money(item.salePrice * qty, cur)}</b>
          </div>)}
        </div>

        <div className="fxm-cs-extra">
          <label className="fxm-cash-field"><span>Remise {data?.role !== 'ADMIN' && cap < subtotal ? <em>(max {money(cap, cur)})</em> : null}</span><span className="fxm-cash-input"><input inputMode="decimal" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" /><em>{cur || 'DT'}</em></span></label>
          {showClient ? <div className="fxm-cs-client">
            <label className="fxm-cash-field"><span>Téléphone client</span><span className="fxm-cash-input"><input inputMode="tel" value={client.phone} onChange={e => setClient(c => ({ ...c, phone: e.target.value }))} placeholder="Facultatif" /></span></label>
            <label className="fxm-cash-field"><span>Nom</span><span className="fxm-cash-input"><input value={client.fullName} onChange={e => setClient(c => ({ ...c, fullName: e.target.value }))} placeholder="Facultatif" /></span></label>
          </div> : <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowClient(true)}><UserRound size={15} /> Ajouter le client (facultatif)</button>}
        </div>

        <div className="fxm-cash-totals">
          <div><span>Sous-total</span><b className="fxm-num">{money(subtotal, cur)}</b></div>
          <div><span>Remise</span><b className="fxm-num">{disc ? '− ' + money(disc, cur) : '—'}</b></div>
          <div className="due"><span>À payer</span><b className="fxm-num fxm-gt">{money(total, cur)}</b></div>
        </div>

        <div className="fxm-cash-methods" role="group" aria-label="Mode de paiement">
          {methods.map(([v, l, I]) => <button key={v} type="button" aria-pressed={method === v} onClick={() => setMethod(v)} className={method === v ? 'on' : ''}><I /><span>{l}</span></button>)}
        </div>
        {method === 'CASH' && <div className="fxm-cash-cash">
          <label className="fxm-cash-field"><span>Montant reçu</span><span className="fxm-cash-input"><input inputMode="decimal" value={received} onChange={e => setReceived(e.target.value)} placeholder={String(total)} /><em>{cur || 'DT'}</em></span></label>
          <div className="fxm-cash-change"><span>{short ? 'Il manque' : 'Monnaie à rendre'}</span><b className="fxm-num">{money(short ? total - got : change, cur)}</b></div>
          <div className="fxm-cash-notes" role="group" aria-label="Billets reçus">
            <button type="button" onClick={() => setReceived(String(total))}>Exact</button>
            {[5, 10, 20, 50].map(n => <button type="button" key={n} onClick={() => setReceived(v => String(round3((Number(v || 0)) + n)))}>+{n}</button>)}
            <button type="button" onClick={() => setReceived('')}>Effacer</button>
          </div>
        </div>}

        {needSession && <div className="fxm-cs-warn" role="alert">La caisse n’est pas ouverte : ouvrez la session pour encaisser en espèces, ou choisissez un autre mode. <Link href="/app/cash-sessions">Ouvrir la caisse</Link></div>}
        <button type="button" className="fxm-cash-go" disabled={busy || short || needSession || !(total >= 0) || !lines.length} onClick={sell}><CheckCircle2 /><span>{busy ? 'Traitement…' : 'Encaisser la vente'}</span><b className="fxm-num">{money(total, cur)}</b></button>
      </> : !done && !showCart && <div className="fxm-cash-empty">
        <span className="fxm-ico fxm-ico--o" style={{ width: 72, height: 72, borderRadius: 24 }}><ShoppingBag size={32} /></span>
        <h2>Panier vide</h2>
        <p>Touchez un article à gauche pour l’ajouter. Le stock est mis à jour à l’encaissement.</p>
      </div>}
      {msg && <div className="error" role="alert">{msg}</div>}

      {!refundFor && !lines.length && !done && <form className="fxm-rf-find" onSubmit={e => { e.preventDefault(); const t = find.trim().toUpperCase(); if (!t) return; setRefundFor(/^\d+$/.test(t) ? saleNumber(Number(t)) : t); setFind(''); }}>
        <label className="fxm-cash-field"><span><RotateCcw size={13} /> Retour client : numéro du ticket</span><span className="fxm-cash-input"><input value={find} onChange={e => setFind(e.target.value)} placeholder="V-000042 ou 42" /></span></label>
        <button type="submit" className="btn fxm-btn-o" disabled={!find.trim()}>Ouvrir</button>
      </form>}

      {data?.sales?.length > 0 && !refundFor && !lines.length && !done && <div className="fxm-cs-today">
        <div className="fxm-panel-head"><h2>Ventes du jour</h2><span className="fxm-num">{money(data.todayTotal, cur)}</span></div>
        {data.sales.slice(0, 8).map((s: any) => { const st = refundState(Number(s.total), Number(s.refundedTotal || 0)); return <div key={s.id} className="fxm-cs-sale">
          <button type="button" className="fxm-cs-sale-main" onClick={() => setRefundFor(s.number)} disabled={st === 'FULL'} title={st === 'FULL' ? 'Déjà remboursée' : 'Rembourser des articles'}>
            <span className="fxm-mono">{s.number}</span><span className="fxm-grow">{s.lines.map((l: any) => `${l.quantity}× ${l.name}`).join(', ')}</span>
            {st !== 'NONE' && <em className={'fxm-rf-badge ' + st.toLowerCase()}>{st === 'FULL' ? 'Remboursée' : 'Retour partiel'}</em>}
            <b className="fxm-num">{money(s.total, cur)}</b>
          </button>
          <Link href={`/receipt/vente/${s.number}`} target="_blank" className="fxm-cs-sale-ticket" aria-label={`Ticket ${s.number}`} title="Ticket"><Receipt size={15} /></Link>
        </div>; })}
      </div>}

      {done && !refundFor && <CashSuccess amount={money(done.total, cur)} title="Vente encaissée" subtitle={<>{done.number}{done.change > 0 ? <> · monnaie {money(done.change, cur)}</> : null}</>}>
        <Link className="btn fxm-btn-o" href={`/receipt/vente/${done.number}`} target="_blank"><Receipt size={16} /> Imprimer le ticket</Link>
        <button type="button" className="btn fxm-btn-g" onClick={() => setDone(null)}>Nouvelle vente</button>
      </CashSuccess>}
    </section>
    {camera && <BarcodeCamera kicker="VENTE COMPTOIR" title="Scanner un accessoire" text="Présentez le code-barres de l’emballage : l’article est ajouté au panier." submitLabel="Ajouter" onDetected={(c: string) => { setCamera(false); void scanned(c); }} onClose={() => setCamera(false)} />}
  </div>;
}
