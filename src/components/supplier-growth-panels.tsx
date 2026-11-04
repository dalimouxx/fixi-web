'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Check, MessageCircle, PackageCheck, ScanLine, Send, Truck, UserMinus, Wallet, X } from 'lucide-react';
import { money } from '@/lib/format';
import { applyScan, pickOrder, pickingDone, type PickLine } from '@/lib/commerce';

/** Clients qui décrochent : réguliers devenus silencieux, avec relance personnelle. */
export function SupplierChurn() {
  const [rows, setRows] = useState<any[]>([]); const [msgFor, setMsgFor] = useState<any>(null); const [text, setText] = useState(''); const [sent, setSent] = useState<Record<string, boolean>>({}); const [err, setErr] = useState('');
  useEffect(() => { fetch('/api/supplier/churn', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).then(setRows).catch(() => {}); }, []);
  if (!rows.length) return null;
  async function send() {
    setErr('');
    const r = await fetch('/api/supplier/churn', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ shopId: msgFor.shopId, message: text }) }); const j = await r.json();
    if (!r.ok) { setErr(j.error); return; } setSent(s => ({ ...s, [msgFor.shopId]: true })); setMsgFor(null); setText('');
  }
  return <section className="supplier-panel ch">
    <h3><UserMinus size={17} /> Clients qui décrochent <em>{rows.length}</em></h3>
    <p className="ch-sub">Ils commandaient régulièrement et n’ont rien commandé depuis plus de deux fois leur rythme habituel.</p>
    <ul>{rows.map(r => <li key={r.shopId}><div><b>{r.name}</b><small>{r.region || '—'} · commandait tous les {r.everyDays} j · rien depuis <strong>{r.silentDays} j</strong> · {money(r.total120)} sur 4 mois</small></div>
      {r.wa && <a className="btn btn-ghost btn-sm" href={r.wa} target="_blank" rel="noreferrer" title="WhatsApp"><MessageCircle size={14} /></a>}
      {sent[r.shopId] ? <span className="rm-sent"><Check size={14} /> Envoyé</span> : <button className="btn btn-soft btn-sm" onClick={() => { setMsgFor(r); setText(`Bonjour, ça fait un moment ! Nous avons reçu du nouveau stock : écrans, batteries, connecteurs. Livraison rapide chez ${r.name}.`); }}><Send size={14} /> Message</button>}</li>)}</ul>
    {msgFor && <div className="pm-back" onMouseDown={e => { if (e.target === e.currentTarget) setMsgFor(null); }}><div className="pm"><header><Send size={18} /><div><b>Message à {msgFor.name}</b><small>Reçu en notification dans Fixi</small></div><button onClick={() => setMsgFor(null)} aria-label="Fermer"><X size={18} /></button></header>
      <textarea className="input ch-text" value={text} maxLength={300} onChange={e => setText(e.target.value)} rows={4} />
      <small className="ch-tip">Astuce : lancez une promo sur une pièce qu’il achetait, il la verra en prix barré.</small>
      {err && <p className="pm-err">{err}</p>}<button className="pm-save pr-save" onClick={send}><Send size={17} /> Envoyer</button></div></div>}
  </section>;
}

/** Encaissements à venir face aux paiements à faire. */
export function SupplierCashForecast() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { fetch('/api/supplier/cash-forecast', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(setD).catch(() => {}); }, []);
  if (!d) return null;
  const cols: [string, string][] = [['overdue', 'En retard'], ['week', '7 jours'], ['month', 'Ce mois'], ['later', 'Plus tard']];
  return <section className="supplier-panel cf">
    <h3><Wallet size={17} /> Encaissements à venir</h3>
    <div className="cf-net"><span>Solde attendu sur 7 jours</span><b className={d.net7 < 0 ? 'neg' : ''}>{money(d.net7)}</b><small>retards + 7 jours + espèces en route et chez les livreurs − achats à payer</small></div>
    <div className="cf-grid">
      <div className="cf-col in"><h4><ArrowDownLeft size={15} /> À recevoir</h4>{cols.map(([k, l]) => <p key={k}><span>{l}</span><b>{money(d.incoming[k])}</b></p>)}<p><span><Truck size={13} /> En route (COD)</span><b>{money(d.codOnRoad)}</b></p><p><span>Chez les livreurs</span><b>{money(d.withDrivers)}</b></p></div>
      <div className="cf-col out"><h4><ArrowUpRight size={15} /> À payer (achats)</h4>{cols.map(([k, l]) => <p key={k}><span>{l}</span><b>{money(d.outgoing[k])}</b></p>)}</div>
    </div>
  </section>;
}

/** Préparation d'une commande au scanner : liste par emplacement, blocage si une pièce manque ou n'est pas la bonne. */
export function PickingDialog({ order, onClose, onReady }: { order: any; onClose: () => void; onReady: () => Promise<void> }) {
  const lines: PickLine[] = useMemo(() => pickOrder((order.items || []).map((i: any) => ({ itemId: i.id, productId: i.productId, name: i.product?.name || 'Pièce', quantity: Number(i.quantity), codes: [i.product?.barcode, i.product?.sku].filter(Boolean), location: i.product?.location || null }))), [order]);
  const [picked, setPicked] = useState<Record<string, number>>({}); const [manual, setManual] = useState(0); const [scans, setScans] = useState(0);
  const [code, setCode] = useState(''); const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null); const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  const done = pickingDone(lines, picked);
  const total = lines.reduce((a, l) => a + l.quantity, 0), got = lines.reduce((a, l) => a + Math.min(l.quantity, picked[l.itemId] || 0), 0);
  function scan(e: React.FormEvent) {
    e.preventDefault(); const r = applyScan(lines, picked, code); setCode('');
    if (r.ok) { setPicked(r.picked); setScans(x => x + 1); setFlash({ ok: true, text: lines.find(l => l.itemId === r.itemId)!.name }); try { navigator.vibrate?.(30); } catch {} }
    else { setFlash({ ok: false, text: r.error }); try { navigator.vibrate?.([80, 60, 80]); } catch {} }
    input.current?.focus();
  }
  async function ready() {
    setBusy(true);
    try { await fetch(`/api/supplier/orders/${order.id}/picking`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scanned: scans, manual }) }); await onReady(); onClose(); }
    finally { setBusy(false); }
  }
  return <div className="pm-back" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="pm pk">
      <header><PackageCheck size={18} /><div><b>Préparer {order.reference}</b><small>{order.shop?.name} · {got}/{total} pièce(s)</small></div><button onClick={onClose} aria-label="Fermer"><X size={18} /></button></header>
      <div className="pk-bar"><i style={{ width: (total ? got / total * 100 : 0) + '%' }} /></div>
      <form onSubmit={scan} className="pk-scan"><ScanLine size={18} /><input ref={input} value={code} onChange={e => setCode(e.target.value)} placeholder="Scannez chaque pièce" aria-label="Code-barres" /></form>
      {flash && <p className={'pk-flash ' + (flash.ok ? 'ok' : 'ko')}>{flash.ok ? <Check size={15} /> : <AlertTriangle size={15} />} {flash.text}</p>}
      <ul className="pk-list">{lines.map(l => { const n = picked[l.itemId] || 0, full = n >= l.quantity; return <li key={l.itemId} className={full ? 'full' : ''}>
        <span className="pk-loc">{l.location || '—'}</span><div><b>{l.name}</b><small>{l.codes[0] || 'sans code-barres'}</small></div><span className="pk-n">{n}/{l.quantity}</span>
        {!full && !l.codes.length && <button className="btn btn-ghost btn-sm" onClick={() => { setPicked(p => ({ ...p, [l.itemId]: l.quantity })); setManual(m => m + 1); }}>Valider</button>}
      </li>; })}</ul>
      <button className="pm-save pr-save" disabled={!done || busy} onClick={ready}><Truck size={17} /> {done ? 'Prête à livrer' : `Encore ${total - got} pièce(s) à scanner`}</button>
    </div>
  </div>;
}
