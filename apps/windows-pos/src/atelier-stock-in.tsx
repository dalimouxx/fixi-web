import { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Check, Minus, PackagePlus, Plus, ScanBarcode, Trash2, X } from 'lucide-react';
import { findByCode } from './stock-in';
import { readJson, writeJson } from './storage';

const req = <T,>(method: string, path: string, body?: unknown) => invoke<T>('atelier_request', { method, path, body: body ?? null });
type Item = { id: string; sku: string; barcode?: string | null; name: string; quantity: number; purchasePrice: number; salePrice: number };
type Line = { id: string; qty: number; cost: string };
const KEY = 'fixi-atelier-stock-in';
const dt = (n: number) => n.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' DT';

/** Caisse atelier : entrée de stock au scanner (pièces et accessoires reçus). Réservée au gérant. */
export function AtelierStockIn({ manager, onDone, onError }: { manager: boolean; onDone: (msg: string) => void; onError: (e: unknown) => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [lines, setLines] = useState<Line[]>(() => readJson<Line[]>(KEY, []));
  const [scan, setScan] = useState(''); const [busy, setBusy] = useState(false); const [last, setLast] = useState('');
  const [create, setCreate] = useState<{ code: string; name: string; price: string; cost: string; qty: string } | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const load = () => req<any[]>('GET', '/api/stock').then(r => setItems((r || []).map(x => ({ ...x, purchasePrice: Number(x.purchasePrice || 0), salePrice: Number(x.salePrice || 0) })))).catch(onError);
  useEffect(() => { if (manager) void load(); }, [manager]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { writeJson(KEY, lines); }, [lines]);
  const rows = useMemo(() => lines.map(l => ({ l, p: items.find(x => x.id === l.id) })).filter(r => r.p) as { l: Line; p: Item }[], [lines, items]);
  const units = rows.reduce((a, r) => a + r.l.qty, 0), value = rows.reduce((a, r) => a + r.l.qty * (Number(r.l.cost.replace(',', '.')) || 0), 0);
  function add(p: Item, n = 1) { setLast(p.id); setLines(ls => { const i = ls.findIndex(x => x.id === p.id); if (i < 0) return [{ id: p.id, qty: n, cost: String(p.purchasePrice || '') }, ...ls]; const c = [...ls]; c[i] = { ...c[i], qty: c[i].qty + n }; return c; }); }
  const set = (id: string, patch: Partial<Line>) => setLines(ls => ls.map(x => x.id === id ? { ...x, ...patch } : x));
  function onScan() {
    const v = scan.trim(); setScan(''); if (!v) return;
    const p = findByCode(items, v);
    if (p) { add(p); ref.current?.focus(); return; }
    setCreate({ code: v.toUpperCase().replace(/\s+/g, ''), name: '', price: '', cost: '', qty: '1' });
  }
  async function createItem(e: React.FormEvent) {
    e.preventDefault(); if (!create) return; setBusy(true);
    try {
      const sku = 'ACC-' + Date.now().toString(36).toUpperCase().slice(-6);
      const x = await req<any>('POST', '/api/stock', { sku, barcode: create.code, name: create.name.trim(), quantity: 0, minQuantity: 1, purchasePrice: Number(create.cost.replace(',', '.')) || 0, salePrice: Number(create.price.replace(',', '.')) || 0 });
      const it: Item = { ...x, purchasePrice: Number(x.purchasePrice || 0), salePrice: Number(x.salePrice || 0) };
      setItems(a => [it, ...a]); add(it, Math.max(1, Math.trunc(Number(create.qty) || 1))); setCreate(null);
    } catch (x) { onError(x); } finally { setBusy(false); ref.current?.focus(); }
  }
  async function validate() {
    if (!rows.length) return;
    if (!window.confirm(`Valider l’entrée de ${units} pièce(s) (${rows.length} article(s)) dans le stock ?`)) return;
    setBusy(true);
    try {
      const r = await req<any>('POST', '/api/purchases', { notes: 'Entrée de stock depuis la caisse', items: rows.map(r => ({ inventoryItemId: r.p.id, quantity: r.l.qty, unitCost: Number(r.l.cost.replace(',', '.')) || r.p.purchasePrice || 0 })) });
      setLines([]); await load(); onDone(`Entrée ${r.reference || ''} validée : +${units} pièce(s) en stock.`);
    } catch (x) { onError(x); } finally { setBusy(false); }
  }
  if (!manager) return <section className="v5-card v6-inv-start"><PackagePlus size={36} /><h2>Entrée de stock</h2><p className="v5-hint">Réservée au gérant de l’atelier.</p></section>;
  return <section className="v5-stack">
    <div className="v5-scan"><ScanBarcode size={22} /><input ref={ref} autoFocus placeholder="Scannez ou tapez le code (ex. 0000A04) : 1 scan = +1 pièce" value={scan} onChange={e => setScan(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') onScan(); }} /><button className="v5-btn v5-btn--primary" onClick={onScan}><Plus size={18} /> Ajouter</button></div>
    <div className="v5-kpis"><div className="v5-kpi"><span>Articles</span><b>{rows.length}</b></div><div className="v5-kpi"><span>Pièces</span><b>{units}</b></div><div className="v5-kpi"><span>Valeur d’achat</span><b>{dt(value)}</b></div></div>
    {create && <form className="v5-card at-in-new" onSubmit={createItem}>
      <header><PackagePlus size={18} /><b>Nouvel article · code {create.code}</b><button type="button" className="v5-icon-btn" aria-label="Annuler" onClick={() => setCreate(null)}><X size={15} /></button></header>
      <div className="at-in-grid">
        <label className="v5-field"><span>Nom</span><input autoFocus required minLength={2} value={create.name} onChange={e => setCreate({ ...create, name: e.target.value })} placeholder="Ex. Écran Samsung A04" /></label>
        <label className="v5-field"><span>Quantité reçue</span><input type="number" min={1} value={create.qty} onChange={e => setCreate({ ...create, qty: e.target.value })} /></label>
        <label className="v5-field"><span>Coût d’achat (DT)</span><input inputMode="decimal" value={create.cost} onChange={e => setCreate({ ...create, cost: e.target.value })} /></label>
        <label className="v5-field"><span>Prix de vente (DT)</span><input inputMode="decimal" value={create.price} onChange={e => setCreate({ ...create, price: e.target.value })} /></label>
      </div>
      <button className="v5-btn v5-btn--primary" disabled={busy || create.name.trim().length < 2}><Check size={16} /> Créer et ajouter à l’entrée</button>
    </form>}
    <div className="v5-card">{rows.length === 0 ? <p className="v5-hint">Scannez le premier article reçu. Code inconnu ? La caisse propose de créer l’article.</p> :
      <div className="v5-table-wrap"><table className="v5-table"><thead><tr><th>Article</th><th className="num">Stock actuel</th><th className="num">Quantité reçue</th><th className="num">Coût d’achat (DT)</th><th className="act"></th></tr></thead><tbody>
        {rows.map(r => <tr key={r.p.id} className={r.p.id === last ? 'is-selected' : ''}><td><b>{r.p.name}</b><small className="v5-mono">{r.p.barcode || r.p.sku}</small></td><td className="num">{r.p.quantity} → <b>{r.p.quantity + r.l.qty}</b></td>
          <td className="num"><div className="v5-stepper v6-inv-step"><button aria-label="Moins" onClick={() => set(r.p.id, { qty: Math.max(1, r.l.qty - 1) })}><Minus size={14} /></button><input type="number" min={1} value={r.l.qty} onChange={e => set(r.p.id, { qty: Math.max(1, Math.trunc(Number(e.target.value) || 1)) })} aria-label={'Quantité ' + r.p.name} /><button aria-label="Plus" onClick={() => set(r.p.id, { qty: r.l.qty + 1 })}><Plus size={14} /></button></div></td>
          <td className="num"><input className="v5-input v6-in-cost" inputMode="decimal" value={r.l.cost} onChange={e => set(r.p.id, { cost: e.target.value.replace(/[^0-9.,]/g, '') })} aria-label={'Coût ' + r.p.name} /></td>
          <td className="act"><button className="v5-icon-btn" aria-label="Retirer" onClick={() => setLines(ls => ls.filter(x => x.id !== r.p.id))}><Trash2 size={15} /></button></td></tr>)}
      </tbody></table></div>}</div>
    <div className="v6-actions"><button className="v5-btn v5-btn--ghost" disabled={busy || !rows.length} onClick={() => { if (window.confirm('Vider cette entrée de stock ?')) setLines([]); }}>Vider</button>
      <button className="v5-btn v5-btn--primary" disabled={busy || !rows.length} onClick={() => void validate()}><Check size={17} /> Valider l’entrée de stock</button></div>
  </section>;
}
