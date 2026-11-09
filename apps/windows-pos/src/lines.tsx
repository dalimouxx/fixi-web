// Lignes de produits dans la caisse (ex. SL = produits du fournisseur, MG = produits d'un importateur en dépôt-vente) :
// chaque partie seule — ventes, pièces, encaissé, dû des clients, rapport par jour, stock, inventaire de la ligne.
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ClipboardCheck, Layers, Printer, RefreshCw } from 'lucide-react';

const money = (n: number) => '‎' + new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(Number(n) || 0) + ' DT';
const today = () => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Africa/Tunis' }).format(new Date());
const api = (path: string) => invoke<any>('supplier_api', { method: 'GET', path, body: null });

export function LinesPage({ canCount, onError, onMessage, onOpenInventory }: { canCount: boolean; onError: (m: string) => void; onMessage: (m: string) => void; onOpenInventory: () => void }) {
  const [line, setLine] = useState('all'), [from, setFrom] = useState(today()), [to, setTo] = useState(today());
  const [split, setSplit] = useState<any[]>([]), [rep, setRep] = useState<any>(null), [busy, setBusy] = useState(false), [n, setN] = useState(0);
  useEffect(() => {
    setBusy(true);
    Promise.all([api(`/api/supplier/lines/report?line=split&from=${from}&to=${to}`), api(`/api/supplier/lines/report?line=${encodeURIComponent(line)}&from=${from}&to=${to}`)])
      .then(([s, r]) => { setSplit(s.split || []); setRep(r); }).catch(e => onError(String(e))).finally(() => setBusy(false));
  }, [line, from, to, n]);
  const name = (r: any) => r.id === 'own' ? (r.ownTag || 'Mes produits') : r.tag;
  const label = line === 'all' ? 'Toutes les lignes' : name(split.find(r => r.id === line) || { id: line });
  async function startCount() {
    try { await invoke('supplier_stock_count', { request: { action: 'STOCK_COUNT_START', lineId: line, reference: 'INV-WIN-' + label + '-' + Date.now(), note: 'Inventaire ' + label + ' depuis FIXI Caisse' } }); onMessage('Inventaire de ' + label + ' démarré.'); onOpenInventory(); }
    catch (e) { onError(String(e)); }
  }
  return <section className="v5-card v6-lines">
    <header className="v6-lines-head"><h2><Layers size={20} /> Lignes de produits</h2>
      <div className="v6-inline"><label>Du <input className="v5-input" type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} /></label><label>au <input className="v5-input" type="date" value={to} min={from} onChange={e => setTo(e.target.value)} /></label>
        <button className="v5-btn v5-btn--ghost v5-btn--sm" onClick={() => { setFrom(today()); setTo(today()); }}>Aujourd’hui</button>
        <button className="v5-btn v5-btn--ghost v5-btn--sm" onClick={() => setN(x => x + 1)} disabled={busy}><RefreshCw size={14} /></button>
        <button className="v5-btn v5-btn--ghost v5-btn--sm" onClick={() => window.print()}><Printer size={14} /> Imprimer</button></div></header>

    <table className="v5-table v6-lines-split"><thead><tr><th>Ligne</th><th className="num">Ventes</th><th className="num">Pièces</th><th className="num">Encaissé</th><th className="num">Dû des clients</th><th className="num">Stock</th><th className="num">Valeur du stock</th><th className="num">À payer</th></tr></thead>
      <tbody>{split.map(r => <tr key={r.id} className={line === r.id ? 'is-on' : ''}><td><button className={'v6-line-tag' + (r.id === 'own' ? ' is-own' : '')} onClick={() => setLine(r.id)}>{name(r)}</button></td><td className="num">{money(r.totals.sales)}</td><td className="num">{r.totals.units}</td><td className="num">{money(r.totals.collected)}</td><td className="num">{money(r.totals.due)}</td><td className="num">{r.stock.quantity}</td><td className="num">{money(r.stock.value)}</td><td className="num">{r.owed === null ? '—' : money(r.owed)}</td></tr>)}
        <tr className={line === 'all' ? 'is-on' : ''}><td><button className="v6-line-tag is-all" onClick={() => setLine('all')}>Tout</button></td><td colSpan={7} /></tr></tbody></table>

    {rep && <>
      <h3 className="v6-h3">{label}</h3>
      <div className="v6-grid4">
        <div className="v5-stat"><span>Ventes</span><b>{money(rep.totals.sales)}</b><small>{rep.totals.count} vente(s)</small></div>
        <div className="v5-stat"><span>Pièces vendues</span><b>{rep.totals.units}</b></div>
        <div className="v5-stat"><span>Encaissé</span><b>{money(rep.totals.collected)}</b></div>
        <div className="v5-stat"><span>Dû des clients</span><b>{money(rep.totals.due)}</b></div>
        {rep.hasScale && <div className="v5-stat"><span>Bénéfice (barème)</span><b>{money(rep.totals.profit)}</b></div>}
        {rep.consignment && <div className="v5-stat is-owed"><span>À payer à {label}</span><b>{money(rep.consignment.owed)}</b><small>vendu {money(rep.consignment.sold)} · retours {money(rep.consignment.returned)} · payé {money(rep.consignment.paid)}</small></div>}
      </div>
      <div className="v6-grid2">
        <table className="v5-table"><thead><tr><th>Jour</th><th className="num">Ventes</th><th className="num">Pièces</th><th className="num">Encaissé</th></tr></thead>
          <tbody>{rep.days.length ? rep.days.map((d: any) => <tr key={d.date}><td>{d.date.split('-').reverse().join('/')}</td><td className="num">{money(d.sales)}</td><td className="num">{d.units}</td><td className="num">{money(d.collected)}</td></tr>) : <tr><td colSpan={4}>Aucune vente sur la période.</td></tr>}</tbody></table>
        <table className="v5-table"><thead><tr><th>Client qui doit</th><th className="num">Dû</th></tr></thead>
          <tbody>{rep.customers.length ? rep.customers.slice(0, 40).map((c: any) => <tr key={c.id || 'c'}><td>{c.name}</td><td className="num">{money(c.due)}</td></tr>) : <tr><td colSpan={2}>Aucun client ne doit rien.</td></tr>}</tbody></table>
      </div>
      <div className="v6-lines-head"><h3 className="v6-h3">Stock — {label} · {rep.stock.products} produit(s) · {rep.stock.quantity} pièce(s) · {money(rep.stock.value)}</h3>
        {canCount && line !== 'all' && <button className="v5-btn v5-btn--primary v5-btn--sm" onClick={startCount}><ClipboardCheck size={14} /> Inventaire de cette ligne</button>}</div>
      <table className="v5-table"><thead><tr><th>Produit</th><th>Catégorie</th><th className="num">Stock</th><th className="num">Prix</th><th className="num">Coût</th><th className="num">Valeur</th></tr></thead>
        <tbody>{rep.stock.items.slice(0, 400).map((p: any) => <tr key={p.id}><td>{p.name}<small className="v5-mono"> {p.barcode || p.sku}</small></td><td>{p.category || '—'}</td><td className="num">{p.stock}</td><td className="num">{money(p.price)}</td><td className="num">{money(p.cost)}</td><td className="num">{money(p.value)}</td></tr>)}</tbody></table>
    </>}
  </section>;
}
