// FIXI Caisse — écrans de gestion du fournisseur, selon les droits du rôle connecté (table fournie par le serveur).
import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Archive, BadgePercent, Ban, Boxes, Check, FileText, KeyRound, Pencil, Plus, Printer, RefreshCw, RotateCcw, Search, ShieldCheck, Trash2, Truck, UserPlus, Warehouse } from 'lucide-react';
import { Modal, dt } from './dialogs';
import { findByCode } from './stock-in';
import { LinesPage } from './lines';
import { payFr, statusFr } from './codes';

export type Perm = 'sell' | 'cash' | 'discount' | 'refund' | 'customers' | 'customerPay' | 'customerView' | 'productCreate' | 'stockIn' | 'inventory' | 'productEdit' | 'productPrice' | 'productArchive' | 'promo' | 'masters' | 'priceTiers' | 'seeCost' | 'purchases' | 'vendors' | 'vendorPay' | 'expenses' | 'documents' | 'quotes' | 'orders' | 'ordersPrepare' | 'deliveryAssign' | 'driverCash' | 'reports' | 'reportsStock' | 'reportsOwnCash' | 'team' | 'warehouses';
export const ALL_PERMS: Perm[] = ['sell', 'cash', 'discount', 'refund', 'customers', 'customerPay', 'customerView', 'productCreate', 'stockIn', 'inventory', 'productEdit', 'productPrice', 'productArchive', 'promo', 'masters', 'priceTiers', 'seeCost', 'purchases', 'vendors', 'vendorPay', 'expenses', 'documents', 'quotes', 'orders', 'ordersPrepare', 'deliveryAssign', 'driverCash', 'reports', 'reportsStock', 'reportsOwnCash', 'team', 'warehouses'];
export type ManagePage = 'gestion' | 'achats' | 'depenses' | 'documents' | 'livraison' | 'rapports' | 'lignes' | 'equipe' | 'depots' | 'droits';

/** Page → droits (au moins un) pour l'afficher dans le menu. */
export const PAGE_PERMS: Record<string, Perm[] | null> = {
  caisse: ['sell'], historique: ['sell', 'reports'], retours: ['sell'], session: ['cash'], clients: ['customers', 'customerView'], dettes: ['customerPay', 'customerView'],
  commandes: ['orders'], livreurs: ['driverCash'], produits: null, stock: null, inventaire: ['inventory'], entree: ['stockIn'],
  gestion: ['productEdit', 'promo', 'masters'], achats: ['purchases', 'vendorPay'], depenses: ['expenses'], documents: ['documents', 'quotes'], livraison: ['deliveryAssign'],
  rapports: ['reports', 'reportsStock'], lignes: ['reports'], equipe: ['team'], depots: ['warehouses'], droits: null,
};
export const pageAllowed = (page: string, perms: Perm[]) => { const need = PAGE_PERMS[page]; return !need || need.some(p => perms.includes(p)); };

const api = <T = any,>(method: string, path: string, body?: unknown) => invoke<T>('supplier_api', { method, path, body: body ?? null });
const num = (v: string) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
const date = (v: string) => v ? new Date(v).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
type Ctx = { perms: Perm[]; products: any[]; customers: any[]; demo: boolean; onError: (m: string) => void; onMessage: (m: string) => void; onCatalogChanged: () => void; onOpenPage?: (p: string) => void };
const has = (c: Ctx, p: Perm) => c.perms.includes(p);
function DemoNote() { return <section className="v5-card v6-inv-start"><ShieldCheck size={34} /><h2>Disponible une fois connecté</h2><p className="v5-hint">Ce module lit et modifie vos vraies données FIXI : connectez la caisse à votre compte fournisseur.</p></section>; }
function useLoad<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null); const [err, setErr] = useState(''); const [n, setN] = useState(0);
  useEffect(() => { if (!path) return; let stop = false; setErr(''); api<T>('GET', path).then(d => { if (!stop) setData(d); }).catch(e => { if (!stop) setErr(String(e)); }); return () => { stop = true; }; }, [path, n, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, err, reload: () => setN(x => x + 1) };
}

/* ------------------------------------------------------------------ Code gérant */
export function ApprovalDialog({ perm, reason, onDone }: { perm: 'discount' | 'refund'; reason: string; onDone: (token: string | null) => void }) {
  const [pin, setPin] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try { const r = await api<{ token: string; approverName: string }>('POST', '/api/supplier/approval', { perm, pin, reason }); onDone(r.token); }
    catch (x) { setErr(String(x).replace(/ \(HTTP \d+\)$/, '')); setBusy(false); setPin(''); }
  }
  return <Modal title="Code gérant" icon={<KeyRound size={19} />} onClose={() => onDone(null)}>
    <p className="v5-hint">{reason.replace(/^.*?: /, '')}</p>
    <p className="v5-hint">{perm === 'discount' ? 'Remise au-delà de la limite autorisée.' : 'Remboursement réservé au gérant.'} Le gérant tape son code sur cette caisse : l’action est notée avec son nom.</p>
    <form className="v6-form" onSubmit={go}>
      <label className="v5-field"><span>Code gérant (4 à 6 chiffres)</span><input autoFocus type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} /></label>
      {err && <div className="v5-alert v5-alert--danger" role="alert">{err}</div>}
      <button className="v5-btn v5-btn--primary v5-btn--lg" disabled={busy || pin.length < 4}><Check size={18} /> Autoriser</button>
    </form>
  </Modal>;
}

/* ------------------------------------------------------------------ Produits & prix */
function ProductsAdmin(c: Ctx) {
  const { data, err, reload } = useLoad<any[]>('/api/supplier/products');
  const [q, setQ] = useState(''); const [archived, setArchived] = useState(false);
  const [edit, setEdit] = useState<any>(null); const [promo, setPromo] = useState<any>(null); const [tier, setTier] = useState<any>(null);
  const rows = useMemo(() => (data || []).filter(p => (archived ? p.active === false : p.active !== false) && [p.name, p.sku, p.barcode, p.category, p.brand].join(' ').toLowerCase().includes(q.toLowerCase())).slice(0, 300), [data, q, archived]);
  const changed = (m: string) => { c.onMessage(m); reload(); c.onCatalogChanged(); };
  async function remove(p: any) {
    if (!confirm(`Supprimer « ${p.name} » ?\n\nS’il a déjà été vendu, commandé ou acheté, il sera archivé (caché, historique gardé).`)) return;
    try { const r = await api('DELETE', '/api/supplier/products/' + p.id); changed(r.message); } catch (e) { c.onError(String(e)); }
  }
  async function restore(p: any) { try { await api('PATCH', '/api/supplier/products/' + p.id, { active: true }); changed(`« ${p.name} » restauré.`); } catch (e) { c.onError(String(e)); } }
  async function barcodes() { try { const r = await api('POST', '/api/supplier/products/barcodes'); changed(`${r.generated} code(s)-barres créé(s) (ex. 0000A04).`); } catch (e) { c.onError(String(e)); } }
  const missing = (data || []).filter(p => !p.barcode && p.active !== false).length;
  return <section className="v5-stack">
    <div className="v5-scan"><Search size={20} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Nom, code-barres, SKU, catégorie…" />
      <div className="v5-seg" role="group"><button aria-pressed={!archived} onClick={() => setArchived(false)}>Actifs</button><button aria-pressed={archived} onClick={() => setArchived(true)}><Archive size={14} /> Archivés</button></div>
      {missing > 0 && has(c, 'productEdit') && <button className="v5-btn v5-btn--ghost" onClick={() => void barcodes()}>Codes-barres manquants ({missing})</button>}</div>
    {err && <div className="v5-alert v5-alert--danger">{err}</div>}
    {has(c, 'masters') && <MastersPanel {...c} />}
    <div className="v5-card"><div className="v5-table-wrap"><table className="v5-table"><thead><tr><th>Produit</th><th className="num">Détail</th><th className="num">Gros</th>{has(c, 'seeCost') && <th className="num">Coût</th>}<th className="num">Stock</th><th className="act"></th></tr></thead><tbody>
      {rows.map(p => <tr key={p.id}><td><b>{p.name}</b><small className="v5-mono">{p.barcode || p.sku}{p.category ? ' · ' + p.category : ''}{p.qualityGrade ? ' · ' + p.qualityGrade : ''}</small></td>
        <td className="num">{dt(Number(p.retailPrice ?? p.price))}</td><td className="num">{p.wholesalePrice != null ? dt(Number(p.wholesalePrice)) : '—'}</td>
        {has(c, 'seeCost') && <td className="num">{dt(Number(p.averageCost || p.purchasePrice || 0))}</td>}<td className="num">{p.stock}</td>
        <td className="act v6-row-actions">{archived ? has(c, 'productArchive') && <button className="v5-btn v5-btn--ghost v5-btn--sm" onClick={() => void restore(p)}><RotateCcw size={14} /> Restaurer</button> : <>
          {has(c, 'productEdit') && <button className="v5-icon-btn" title="Modifier" aria-label={'Modifier ' + p.name} onClick={() => setEdit(p)}><Pencil size={15} /></button>}
          {has(c, 'promo') && <button className="v5-icon-btn" title="Promotion" aria-label={'Promo ' + p.name} onClick={() => setPromo(p)}><BadgePercent size={15} /></button>}
          {has(c, 'priceTiers') && <button className="v5-icon-btn" title="Prix par quantité" aria-label={'Paliers ' + p.name} onClick={() => setTier(p)}><Boxes size={15} /></button>}
          {has(c, 'productArchive') && <button className="v5-icon-btn" title="Supprimer / archiver" aria-label={'Supprimer ' + p.name} onClick={() => void remove(p)}><Trash2 size={15} /></button>}</>}</td></tr>)}
      {!rows.length && <tr><td colSpan={6} className="v5-hint">{data ? 'Aucun produit.' : 'Chargement…'}</td></tr>}
    </tbody></table></div></div>
    {edit && <ProductEdit p={edit} c={c} onClose={() => setEdit(null)} onSaved={m => { setEdit(null); changed(m); }} />}
    {promo && <PromoDialog p={promo} c={c} onClose={() => setPromo(null)} onSaved={m => { setPromo(null); changed(m); }} />}
    {tier && <TierDialog p={tier} c={c} onClose={() => setTier(null)} onSaved={m => { setTier(null); changed(m); }} />}
  </section>;
}

function ProductEdit({ p, c, onClose, onSaved }: { p: any; c: Ctx; onClose: () => void; onSaved: (m: string) => void }) {
  const s = (v: unknown) => v == null ? '' : String(v);
  const [f, setF] = useState({ name: s(p.name), barcode: s(p.barcode), sku: s(p.sku), qualityGrade: s(p.qualityGrade), location: s(p.location), retailPrice: s(p.retailPrice ?? p.price), wholesalePrice: s(p.wholesalePrice), minimumPrice: s(p.minimumPrice), purchasePrice: s(p.purchasePrice), minStock: s(p.minStock), warrantyDays: s(p.warrantyDays), category: s(p.category), brand: s(p.brand) });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [lines, setLines] = useState<any[]>([]), [lineId, setLineId] = useState<string>(p.lineId || 'own');
  useEffect(() => { api('GET', '/api/supplier/lines').then((j: any) => setLines(j?.lines || [])).catch(() => {}); }, []);
  const price = has(c, 'productPrice');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const body: any = { id: p.id, name: f.name, barcode: f.barcode, sku: f.sku, qualityGrade: f.qualityGrade, location: f.location, minStock: Number(f.minStock || 0), warrantyDays: Number(f.warrantyDays || 0) };
      if (price) { const r = num(f.retailPrice); if (!(r >= 0)) throw new Error('Prix de détail requis'); Object.assign(body, { price: r, retailPrice: r, wholesalePrice: f.wholesalePrice === '' ? null : num(f.wholesalePrice), minimumPrice: f.minimumPrice === '' ? null : num(f.minimumPrice) }); }
      if (has(c, 'seeCost') && f.purchasePrice !== '') body.purchasePrice = num(f.purchasePrice);
      await api('PATCH', '/api/supplier/products', body);
      await api('PATCH', '/api/supplier/products/' + p.id, { category: f.category, brand: f.brand, ...(lines.length ? { lineId } : {}) });
      onSaved(`« ${f.name} » enregistré.`);
    } catch (x) { setErr(String(x).replace(/^Error: /, '')); setBusy(false); }
  }
  return <Modal title="Modifier le produit" icon={<Pencil size={19} />} onClose={onClose} wide>
    <p className="v5-hint">Stock actuel : {p.stock}. Le stock se change avec « Entrée de stock » ou « Inventaire ».</p>
    <form className="v6-form v6-grid3" onSubmit={save}>
      <label className="v5-field v6-span3"><span>Nom</span><input required value={f.name} onChange={set('name')} /></label>
      <label className="v5-field"><span>Code-barres</span><input value={f.barcode} onChange={set('barcode')} placeholder="Vide = code court (0000A04)" /></label>
      <label className="v5-field"><span>SKU</span><input value={f.sku} onChange={set('sku')} /></label>
      <label className="v5-field"><span>Qualité</span><input value={f.qualityGrade} onChange={set('qualityGrade')} /></label>
      <label className="v5-field"><span>Catégorie</span><input value={f.category} onChange={set('category')} /></label>
      <label className="v5-field"><span>Marque</span><input value={f.brand} onChange={set('brand')} /></label>
      {lines.length > 0 && <label className="v5-field"><span>Ligne de produits</span><select className="v5-input" value={lineId} onChange={e => setLineId(e.target.value)}><option value="own">Mes produits</option>{lines.filter((l: any) => l.active || l.id === lineId).map((l: any) => <option key={l.id} value={l.id}>{l.tag} · {l.name}</option>)}</select></label>}
      <label className="v5-field"><span>Emplacement</span><input value={f.location} onChange={set('location')} /></label>
      <label className="v5-field"><span>Prix détail (DT)</span><input disabled={!price} inputMode="decimal" value={f.retailPrice} onChange={set('retailPrice')} /></label>
      <label className="v5-field"><span>Prix gros (DT)</span><input disabled={!price} inputMode="decimal" value={f.wholesalePrice} onChange={set('wholesalePrice')} /></label>
      <label className="v5-field"><span>Prix minimum (DT)</span><input disabled={!price} inputMode="decimal" value={f.minimumPrice} onChange={set('minimumPrice')} /></label>
      {has(c, 'seeCost') && <label className="v5-field"><span>Coût d’achat (DT)</span><input inputMode="decimal" value={f.purchasePrice} onChange={set('purchasePrice')} /></label>}
      <label className="v5-field"><span>Stock d’alerte</span><input type="number" min={0} value={f.minStock} onChange={set('minStock')} /></label>
      <label className="v5-field"><span>Garantie (jours)</span><input type="number" min={0} value={f.warrantyDays} onChange={set('warrantyDays')} /></label>
      {!price && <p className="v5-hint v6-span3">Les prix de vente sont réservés au gérant.</p>}
      {err && <div className="v5-alert v5-alert--danger v6-span3" role="alert">{err}</div>}
      <button className="v5-btn v5-btn--primary v5-btn--lg v6-span3" disabled={busy}><Check size={18} /> Enregistrer</button>
    </form>
  </Modal>;
}

function PromoDialog({ p, c, onClose, onSaved }: { p: any; c: Ctx; onClose: () => void; onSaved: (m: string) => void }) {
  const [price, setPrice] = useState(''); const [days, setDays] = useState('7'); const [notify, setNotify] = useState(true); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function save(e: React.FormEvent) { e.preventDefault(); setBusy(true); setErr(''); try { await api('POST', '/api/supplier/promos', { productId: p.id, promoPrice: num(price), days: Number(days), notify }); onSaved(`Promo lancée sur « ${p.name} ».`); } catch (x) { setErr(String(x)); setBusy(false); } }
  return <Modal title={'Promotion · ' + p.name} icon={<BadgePercent size={19} />} onClose={onClose}>
    <p className="v5-hint">Prix actuel : {dt(Number(p.retailPrice ?? p.price))}. Les ateliers voient le badge promo sur la marketplace.</p>
    <form className="v6-form" onSubmit={save}>
      <div className="v6-form-2"><label className="v5-field"><span>Prix promo (DT)</span><input autoFocus inputMode="decimal" required value={price} onChange={e => setPrice(e.target.value)} /></label>
        <label className="v5-field"><span>Durée (jours)</span><input type="number" min={1} max={60} value={days} onChange={e => setDays(e.target.value)} /></label></div>
      <label className="v6-check"><input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} /> Prévenir les ateliers clients</label>
      {err && <div className="v5-alert v5-alert--danger">{err}</div>}
      <button className="v5-btn v5-btn--primary v5-btn--lg" disabled={busy || !(num(price) > 0)}><Check size={18} /> Lancer la promo</button>
    </form>
  </Modal>;
}

function TierDialog({ p, c, onClose, onSaved }: { p: any; c: Ctx; onClose: () => void; onSaved: (m: string) => void }) {
  const [minQty, setMinQty] = useState('10'); const [price, setPrice] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function save(e: React.FormEvent) { e.preventDefault(); setBusy(true); setErr(''); try { await api('POST', '/api/supplier/advanced', { action: 'PRICE_TIER', productId: p.id, name: `À partir de ${minQty}`, minQty: Number(minQty), unitPrice: num(price) }); onSaved(`Palier ajouté : ${minQty} pièces et plus à ${price} DT.`); } catch (x) { setErr(String(x)); setBusy(false); } }
  return <Modal title={'Prix par quantité · ' + p.name} icon={<Boxes size={19} />} onClose={onClose}>
    <form className="v6-form" onSubmit={save}>
      <div className="v6-form-2"><label className="v5-field"><span>À partir de (pièces)</span><input type="number" min={2} value={minQty} onChange={e => setMinQty(e.target.value)} /></label>
        <label className="v5-field"><span>Prix unitaire (DT)</span><input autoFocus inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} /></label></div>
      {err && <div className="v5-alert v5-alert--danger">{err}</div>}
      <button className="v5-btn v5-btn--primary v5-btn--lg" disabled={busy || !(num(price) >= 0) || price === ''}><Check size={18} /> Ajouter le palier</button>
    </form>
  </Modal>;
}

function MastersPanel(c: Ctx) {
  const { data, reload } = useLoad<any>('/api/supplier/master-data');
  const [name, setName] = useState(''); const [kind, setKind] = useState<'CATEGORY' | 'BRAND'>('CATEGORY');
  async function add(e: React.FormEvent) { e.preventDefault(); if (name.trim().length < 2) return; try { await api('POST', '/api/supplier/master-data', { action: kind, name: name.trim() }); setName(''); reload(); c.onMessage((kind === 'CATEGORY' ? 'Catégorie' : 'Marque') + ' ajoutée.'); } catch (x) { c.onError(String(x)); } }
  return <details className="v5-card v6-masters"><summary><b>Catégories & marques</b> <small>{(data?.categories || []).length} catégories · {(data?.brands || []).length} marques</small></summary>
    <form className="v6-inline" onSubmit={add}><div className="v5-seg"><button type="button" aria-pressed={kind === 'CATEGORY'} onClick={() => setKind('CATEGORY')}>Catégorie</button><button type="button" aria-pressed={kind === 'BRAND'} onClick={() => setKind('BRAND')}>Marque</button></div>
      <input className="v5-input" value={name} onChange={e => setName(e.target.value)} placeholder={kind === 'CATEGORY' ? 'Ex. Écrans' : 'Ex. Samsung'} /><button className="v5-btn v5-btn--primary v5-btn--sm"><Plus size={15} /> Ajouter</button></form>
    <div className="v6-chips">{[...(data?.categories || []), ...(data?.brands || [])].slice(0, 80).map((x: any) => <span key={x.id} className={'v5-chip' + (x.active === false ? ' is-muted' : '')}>{x.name}</span>)}</div>
  </details>;
}

/* ------------------------------------------------------------------ Achats & fournisseurs */
function Purchases(c: Ctx) {
  const erp = useLoad<any>('/api/supplier/erp'); const adv = useLoad<any>(has(c, 'vendors') ? '/api/supplier/advanced' : null);
  const [tab, setTab] = useState<'new' | 'due' | 'vendors'>(has(c, 'purchases') ? 'new' : 'due');
  const [lines, setLines] = useState<{ id: string; qty: number; cost: string }[]>([]); const [scan, setScan] = useState('');
  const [vendor, setVendor] = useState(''); const [ref, setRef] = useState(''); const [paid, setPaid] = useState(''); const [method, setMethod] = useState('CASH'); const [busy, setBusy] = useState(false);
  const rows = lines.map(l => ({ l, p: c.products.find(x => x.id === l.id) })).filter(r => r.p);
  const total = rows.reduce((a, r) => a + r.l.qty * (num(r.l.cost) || 0), 0);
  function add() { const v = scan.trim(); setScan(''); if (!v) return; const p = findByCode(c.products, v) || c.products.find(x => x.name.toLowerCase().includes(v.toLowerCase())); if (!p) { c.onError('Produit introuvable : ' + v); return; } setLines(ls => ls.some(x => x.id === p.id) ? ls.map(x => x.id === p.id ? { ...x, qty: x.qty + 1 } : x) : [{ id: p.id, qty: 1, cost: '' }, ...ls]); }
  async function save() {
    if (!rows.length || !vendor.trim()) { c.onError('Choisissez le fournisseur et au moins un article.'); return; }
    if (rows.some(r => !(num(r.l.cost) >= 0) || r.l.cost === '')) { c.onError('Indiquez le coût d’achat de chaque ligne.'); return; }
    const p = Math.min(total, num(paid || '0') || 0);
    if (!confirm(`Enregistrer l’achat de ${dt(total)} chez ${vendor} ?${p < total ? `\nReste à payer : ${dt(total - p)}` : ''}\nLe stock sera augmenté.`)) return;
    setBusy(true);
    try { const r = await api('POST', '/api/supplier/erp', { action: 'PURCHASE', vendorName: vendor.trim(), reference: ref.trim() || undefined, items: rows.map(r => ({ productId: r.p.id, quantity: r.l.qty, unitCost: num(r.l.cost) })), paid: p, method }); c.onMessage(`Achat ${r.reference} enregistré : stock mis à jour.`); setLines([]); setRef(''); setPaid(''); erp.reload(); c.onCatalogChanged(); }
    catch (e) { c.onError(String(e)); } finally { setBusy(false); }
  }
  const dues = (erp.data?.purchases || []).filter((x: any) => x.status !== 'CANCELLED' && Number(x.total) - Number(x.paid) > 0.0009);
  async function pay(x: any) {
    const left = Number(x.total) - Number(x.paid); const v = prompt(`Paiement à ${x.vendorName} (${x.reference}) — reste ${left.toFixed(3)} DT. Montant :`, left.toFixed(3)); if (!v) return;
    try { await api('POST', '/api/supplier/erp', { action: 'PURCHASE_PAYMENT', purchaseId: x.id, amount: num(v), method: 'CASH' }); c.onMessage('Paiement fournisseur enregistré.'); erp.reload(); } catch (e) { c.onError(String(e)); }
  }
  return <section className="v5-stack">
    <div className="v5-seg" role="group">{has(c, 'purchases') && <button aria-pressed={tab === 'new'} onClick={() => setTab('new')}>Nouvel achat</button>}<button aria-pressed={tab === 'due'} onClick={() => setTab('due')}>Je dois ({dues.length})</button>{has(c, 'vendors') && <button aria-pressed={tab === 'vendors'} onClick={() => setTab('vendors')}>Mes fournisseurs</button>}</div>
    {tab === 'new' && <>
      <div className="v5-card v6-grid3">
        <label className="v5-field"><span>Fournisseur (grossiste)</span><input list="v6-vendors" value={vendor} onChange={e => setVendor(e.target.value)} placeholder="Nom du grossiste" /><datalist id="v6-vendors">{(adv.data?.vendors || []).map((v: any) => <option key={v.id} value={v.name} />)}</datalist></label>
        <label className="v5-field"><span>N° de facture / bon</span><input value={ref} onChange={e => setRef(e.target.value)} placeholder="Facultatif" /></label>
        <label className="v5-field"><span>Payé maintenant (DT)</span><div className="v6-inline"><input inputMode="decimal" value={paid} onChange={e => setPaid(e.target.value)} placeholder="0 = à crédit" /><select value={method} onChange={e => setMethod(e.target.value)}><option value="CASH">Espèces</option><option value="BANK_TRANSFER">Virement</option><option value="CHECK">Chèque</option></select></div></label>
      </div>
      <div className="v5-scan"><Search size={20} /><input value={scan} onChange={e => setScan(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} placeholder="Scannez ou tapez le produit acheté" /><button className="v5-btn v5-btn--primary" onClick={add}><Plus size={17} /> Ajouter</button></div>
      <div className="v5-card"><div className="v5-table-wrap"><table className="v5-table"><thead><tr><th>Produit</th><th className="num">Quantité</th><th className="num">Coût unitaire (DT)</th><th className="num">Total</th><th className="act"></th></tr></thead><tbody>
        {rows.map(r => <tr key={r.p.id}><td><b>{r.p.name}</b><small className="v5-mono">{r.p.barcode || r.p.sku}</small></td><td className="num"><input className="v5-input v6-in-cost" type="number" min={1} value={r.l.qty} onChange={e => setLines(ls => ls.map(x => x.id === r.p.id ? { ...x, qty: Math.max(1, Math.trunc(Number(e.target.value) || 1)) } : x))} /></td>
          <td className="num"><input className="v5-input v6-in-cost" inputMode="decimal" value={r.l.cost} onChange={e => setLines(ls => ls.map(x => x.id === r.p.id ? { ...x, cost: e.target.value } : x))} /></td><td className="num">{dt(r.l.qty * (num(r.l.cost) || 0))}</td>
          <td className="act"><button className="v5-icon-btn" aria-label="Retirer" onClick={() => setLines(ls => ls.filter(x => x.id !== r.p.id))}><Trash2 size={15} /></button></td></tr>)}
        {!rows.length && <tr><td colSpan={5} className="v5-hint">Scannez les produits de la facture du grossiste.</td></tr>}
      </tbody></table></div></div>
      <div className="v6-actions"><b>Total {dt(total)}</b><button className="v5-btn v5-btn--primary" disabled={busy || !rows.length} onClick={() => void save()}><Check size={17} /> Enregistrer l’achat</button></div>
    </>}
    {tab === 'due' && <div className="v5-card"><div className="v5-table-wrap"><table className="v5-table"><thead><tr><th>Achat</th><th>Fournisseur</th><th className="num">Total</th><th className="num">Reste</th><th className="act"></th></tr></thead><tbody>
      {dues.map((x: any) => <tr key={x.id}><td><b className="v5-mono">{x.reference}</b><small>{date(x.createdAt)}</small></td><td>{x.vendorName}</td><td className="num">{dt(Number(x.total))}</td><td className="num"><b>{dt(Number(x.total) - Number(x.paid))}</b></td>
        <td className="act">{has(c, 'vendorPay') && <button className="v5-btn v5-btn--ghost v5-btn--sm" onClick={() => void pay(x)}>Payer</button>}</td></tr>)}
      {!dues.length && <tr><td colSpan={5} className="v5-hint">{erp.data ? 'Rien à payer aux fournisseurs.' : 'Chargement…'}</td></tr>}</tbody></table></div></div>}
    {tab === 'vendors' && <Vendors c={c} vendors={adv.data?.vendors || []} reload={adv.reload} />}
  </section>;
}

function Vendors({ c, vendors, reload }: { c: Ctx; vendors: any[]; reload: () => void }) {
  const [f, setF] = useState({ name: '', phone: '', address: '', taxId: '' });
  async function add(e: React.FormEvent) { e.preventDefault(); try { await api('POST', '/api/supplier/advanced', { action: 'VENDOR', ...f }); setF({ name: '', phone: '', address: '', taxId: '' }); reload(); c.onMessage('Fournisseur ajouté.'); } catch (x) { c.onError(String(x)); } }
  return <section className="v5-stack">
    <form className="v5-card v6-grid4" onSubmit={add}><input className="v5-input" required placeholder="Nom *" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /><input className="v5-input" placeholder="Téléphone" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /><input className="v5-input" placeholder="Adresse" value={f.address} onChange={e => setF({ ...f, address: e.target.value })} /><button className="v5-btn v5-btn--primary"><Plus size={15} /> Ajouter</button></form>
    <div className="v5-card"><div className="v5-table-wrap"><table className="v5-table"><thead><tr><th>Fournisseur</th><th>Téléphone</th><th>Adresse</th></tr></thead><tbody>
      {vendors.map(v => <tr key={v.id}><td><b>{v.name}</b></td><td>{v.phone || '—'}</td><td>{v.address || '—'}</td></tr>)}{!vendors.length && <tr><td colSpan={3} className="v5-hint">Aucun fournisseur enregistré.</td></tr>}
    </tbody></table></div></div>
  </section>;
}

/* ------------------------------------------------------------------ Dépenses */
function Expenses(c: Ctx) {
  const erp = useLoad<any>('/api/supplier/erp');
  const cats = ['Loyer', 'Électricité', 'Transport', 'Salaires', 'Internet', 'Emballage', 'Marketing', 'Général'];
  const [f, setF] = useState({ category: 'Transport', label: '', amount: '', method: 'CASH', note: '' }); const [busy, setBusy] = useState(false);
  async function add(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await api('POST', '/api/supplier/erp', { action: 'EXPENSE', ...f, label: f.label || f.category, amount: num(f.amount) }); c.onMessage('Dépense enregistrée.'); setF({ ...f, label: '', amount: '', note: '' }); erp.reload(); }
    catch (x) { c.onError(String(x)); } finally { setBusy(false); }
  }
  const rows = (erp.data?.expenses || []).slice(0, 100); const month = rows.filter((x: any) => new Date(x.expenseDate || x.createdAt).getMonth() === new Date().getMonth()).reduce((a: number, x: any) => a + Number(x.amount), 0);
  return <section className="v5-stack">
    <form className="v5-card v6-stack" onSubmit={add}>
      <div className="v6-chips">{cats.map(k => <button type="button" key={k} className={'v5-chip' + (f.category === k ? ' is-ok' : '')} onClick={() => setF({ ...f, category: k })}>{k}</button>)}</div>
      <div className="v6-grid4"><input className="v5-input" placeholder={'Libellé (' + f.category + ')'} value={f.label} onChange={e => setF({ ...f, label: e.target.value })} /><input className="v5-input" required inputMode="decimal" placeholder="Montant (DT)" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} />
        <select className="v5-input" value={f.method} onChange={e => setF({ ...f, method: e.target.value })}><option value="CASH">Espèces (caisse)</option><option value="BANK_TRANSFER">Virement</option><option value="CARD">Carte</option></select>
        <button className="v5-btn v5-btn--primary" disabled={busy || !(num(f.amount) > 0)}><Plus size={15} /> Enregistrer</button></div>
      <small className="v5-hint">Une dépense en espèces est déduite de votre caisse ouverte.</small>
    </form>
    <div className="v5-kpis"><div className="v5-kpi"><span>Ce mois-ci</span><b>{dt(month)}</b></div></div>
    <div className="v5-card"><div className="v5-table-wrap"><table className="v5-table"><thead><tr><th>Dépense</th><th>Catégorie</th><th>Mode</th><th className="num">Montant</th></tr></thead><tbody>
      {rows.map((x: any) => <tr key={x.id}><td><b>{x.label}</b><small>{date(x.expenseDate || x.createdAt)}</small></td><td>{x.category}</td><td>{payFr(x.method)}</td><td className="num">{dt(Number(x.amount))}</td></tr>)}
      {!rows.length && <tr><td colSpan={4} className="v5-hint">{erp.data ? 'Aucune dépense.' : 'Chargement…'}</td></tr>}</tbody></table></div></div>
  </section>;
}

/* ------------------------------------------------------------------ Factures & devis */
const DOC_LABEL: Record<string, string> = { QUOTE: 'Devis', PROFORMA: 'Proforma', DELIVERY_NOTE: 'Bon de livraison', PURCHASE_ORDER: 'Bon de commande', RECEIPT: 'Reçu' };
function Documents(c: Ctx) {
  const { data, err, reload } = useLoad<any>('/api/supplier/documents');
  const [open, setOpen] = useState(false); const [print, setPrint] = useState<any>(null);
  const rows: any[] = Array.isArray(data) ? data : (data?.rows || []);
  const itemsOf = (id: string) => (data?.items || []).filter((i: any) => i.documentId === id);
  async function convert(d: any, target: string) { try { const r = await api('POST', `/api/supplier/documents/${d.id}/convert`, { target }); c.onMessage(`${DOC_LABEL[d.type] || d.type} ${d.reference} → ${r.reference || target}.`); reload(); } catch (e) { c.onError(String(e)); } }
  async function status(d: any, s: string) { try { await api('PATCH', '/api/supplier/documents', { id: d.id, status: s }); reload(); } catch (e) { c.onError(String(e)); } }
  useEffect(() => { if (!print) return; document.body.dataset.printMode = 'doc'; const done = () => { delete document.body.dataset.printMode; setPrint(null); }; window.addEventListener('afterprint', done, { once: true }); setTimeout(() => window.print(), 150); return () => window.removeEventListener('afterprint', done); }, [print]);
  return <section className="v5-stack">
    <div className="v6-actions"><button className="v5-btn v5-btn--ghost" onClick={reload}><RefreshCw size={15} /> Actualiser</button><button className="v5-btn v5-btn--primary" onClick={() => setOpen(true)}><FileText size={16} /> Nouveau devis / document</button></div>
    {err && <div className="v5-alert v5-alert--danger">{err}</div>}
    <div className="v5-card"><div className="v5-table-wrap"><table className="v5-table"><thead><tr><th>Document</th><th>Client</th><th>Statut</th><th className="num">Total</th><th className="act"></th></tr></thead><tbody>
      {rows.slice(0, 200).map(d => <tr key={d.id}><td><b>{DOC_LABEL[d.type] || d.type}</b><small className="v5-mono">{d.reference} · {date(d.createdAt)}</small></td><td>{d.partyName || '—'}</td><td><span className="v5-chip">{statusFr(d.status)}</span></td><td className="num">{dt(Number(d.total))}</td>
        <td className="act v6-row-actions"><button className="v5-icon-btn" title="Imprimer" aria-label="Imprimer" onClick={() => setPrint({ ...d, items: itemsOf(d.id) })}><Printer size={15} /></button>
          {d.type === 'QUOTE' && !['CONVERTED', 'CANCELLED'].includes(d.status) && <><button className="v5-btn v5-btn--ghost v5-btn--sm" title="Le devis devient une vente facturée (stock et dette client mis à jour)" onClick={() => { if (confirm('Transformer ce devis en vente facturée ? Le stock sera déduit.')) void convert(d, 'SALE'); }}>→ Vente</button><button className="v5-btn v5-btn--ghost v5-btn--sm" onClick={() => void convert(d, 'DELIVERY_NOTE')}>→ BL</button></>}
          {!['CONVERTED', 'CANCELLED'].includes(d.status) && <button className="v5-icon-btn" title="Annuler" aria-label="Annuler" onClick={() => { if (confirm('Annuler ce document ?')) void status(d, 'CANCELLED'); }}><Ban size={15} /></button>}</td></tr>)}
      {!rows.length && <tr><td colSpan={5} className="v5-hint">{data ? 'Aucun document.' : 'Chargement…'}</td></tr>}</tbody></table></div></div>
    {open && <DocumentDialog c={c} onClose={() => setOpen(false)} onSaved={m => { setOpen(false); c.onMessage(m); reload(); }} />}
    {print && <div className="v6-doc-print"><h1>{DOC_LABEL[print.type] || print.type} {print.reference}</h1><p>{date(print.createdAt)} · {print.partyName || ''} {print.partyPhone || ''}</p>
      <table><thead><tr><th>Désignation</th><th>Qté</th><th>P.U.</th><th>Total</th></tr></thead><tbody>{(print.items || []).map((i: any, k: number) => <tr key={k}><td>{i.name}</td><td>{i.quantity}</td><td>{Number(i.unitPrice).toFixed(3)}</td><td>{(Number(i.unitPrice) * i.quantity).toFixed(3)}</td></tr>)}</tbody></table>
      <p><b>Total : {Number(print.total).toFixed(3)} DT</b></p></div>}
  </section>;
}

function DocumentDialog({ c, onClose, onSaved }: { c: Ctx; onClose: () => void; onSaved: (m: string) => void }) {
  const types = has(c, 'documents') ? ['QUOTE', 'PROFORMA', 'DELIVERY_NOTE', 'PURCHASE_ORDER'] : ['QUOTE'];
  const [type, setType] = useState('QUOTE'); const [customerId, setCustomerId] = useState(''); const [party, setParty] = useState(''); const [days, setDays] = useState('15');
  const [lines, setLines] = useState<{ id: string; qty: number; price: string }[]>([]); const [scan, setScan] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const rows = lines.map(l => ({ l, p: c.products.find(x => x.id === l.id) })).filter(r => r.p); const total = rows.reduce((a, r) => a + r.l.qty * (num(r.l.price) || 0), 0);
  function add() { const v = scan.trim(); setScan(''); const p = findByCode(c.products, v) || c.products.find(x => x.name.toLowerCase().includes(v.toLowerCase())); if (!p) return; setLines(ls => ls.some(x => x.id === p.id) ? ls.map(x => x.id === p.id ? { ...x, qty: x.qty + 1 } : x) : [...ls, { id: p.id, qty: 1, price: String(p.price) }]); }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!rows.length) return; setBusy(true); setErr('');
    try { const r = await api('POST', '/api/supplier/documents', { type, customerId: customerId || undefined, partyName: party || undefined, validUntil: type === 'QUOTE' ? new Date(Date.now() + Number(days || 15) * 86400000).toISOString() : undefined, items: rows.map(r => ({ productId: r.p.id, quantity: r.l.qty, unitPrice: num(r.l.price) })) }); onSaved(`${DOC_LABEL[type]} ${r.reference} créé.`); }
    catch (x) { setErr(String(x)); setBusy(false); }
  }
  return <Modal title="Nouveau document" icon={<FileText size={19} />} onClose={onClose} wide>
    <form className="v6-form" onSubmit={save}>
      <div className="v5-seg">{types.map(t => <button type="button" key={t} aria-pressed={type === t} onClick={() => setType(t)}>{DOC_LABEL[t]}</button>)}</div>
      <div className="v6-grid3"><label className="v5-field"><span>Client</span><select value={customerId} onChange={e => setCustomerId(e.target.value)}><option value="">— Saisir un nom —</option>{c.customers.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        {!customerId && <label className="v5-field"><span>Nom du client</span><input value={party} onChange={e => setParty(e.target.value)} /></label>}
        {type === 'QUOTE' && <label className="v5-field"><span>Valable (jours)</span><input type="number" min={1} value={days} onChange={e => setDays(e.target.value)} /></label>}</div>
      <div className="v5-scan"><Search size={18} /><input value={scan} onChange={e => setScan(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder="Scannez ou tapez un produit puis Entrée" /></div>
      <div className="v5-table-wrap"><table className="v5-table"><tbody>{rows.map(r => <tr key={r.p.id}><td>{r.p.name}</td><td className="num"><input className="v5-input v6-in-cost" type="number" min={1} value={r.l.qty} onChange={e => setLines(ls => ls.map(x => x.id === r.p.id ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x))} /></td><td className="num"><input className="v5-input v6-in-cost" inputMode="decimal" value={r.l.price} onChange={e => setLines(ls => ls.map(x => x.id === r.p.id ? { ...x, price: e.target.value } : x))} /></td><td className="act"><button type="button" className="v5-icon-btn" onClick={() => setLines(ls => ls.filter(x => x.id !== r.p.id))}><Trash2 size={14} /></button></td></tr>)}</tbody></table></div>
      {err && <div className="v5-alert v5-alert--danger">{err}</div>}
      <button className="v5-btn v5-btn--primary v5-btn--lg" disabled={busy || !rows.length}><Check size={18} /> Créer · {dt(total)}</button>
    </form>
  </Modal>;
}

/* ------------------------------------------------------------------ Livraison */
function Delivery(c: Ctx) {
  const orders = useLoad<any[]>('/api/supplier/orders'); const drivers = useLoad<any[]>('/api/supplier/drivers');
  const ready = (orders.data || []).filter((o: any) => ['CONFIRMED', 'PREPARING', 'READY_FOR_DELIVERY'].includes(o.status) && !o.delivery?.driverAccountId);
  const onRoad = (orders.data || []).filter((o: any) => ['READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY'].includes(o.status) && o.delivery?.driverAccountId);
  const list: any[] = Array.isArray(drivers.data) ? drivers.data : ((drivers.data as any)?.drivers || []);
  async function assign(o: any, driverAccountId: string) { if (!driverAccountId) return; try { await api('POST', '/api/supplier/delivery/assign', { orderId: o.id, driverAccountId }); c.onMessage(`${o.reference} confiée au livreur.`); orders.reload(); } catch (e) { c.onError(String(e)); } }
  return <section className="v5-stack">
    <div className="v5-kpis"><div className="v5-kpi"><span>À attribuer</span><b>{ready.length}</b></div><div className="v5-kpi"><span>En livraison</span><b>{onRoad.length}</b></div><div className="v5-kpi"><span>Livreurs</span><b>{list.filter(d => d.isActive !== false).length}</b></div></div>
    <div className="v5-card"><div className="v5-table-wrap"><table className="v5-table"><thead><tr><th>Commande</th><th>Atelier</th><th>Statut</th><th className="num">Total</th><th>Livreur</th></tr></thead><tbody>
      {ready.map((o: any) => <tr key={o.id}><td><b className="v5-mono">{o.reference}</b><small>{date(o.createdAt)}</small></td><td>{o.shop?.name}<small>{o.shop?.region}</small></td><td><span className="v5-chip">{statusFr(o.status)}</span></td><td className="num">{dt(Number(o.total))}</td>
        <td><select className="v5-input" defaultValue="" onChange={e => void assign(o, e.target.value)}><option value="">Choisir…</option>{list.filter(d => d.isActive !== false).map(d => <option key={d.id} value={d.id}>{d.fullName}</option>)}</select></td></tr>)}
      {onRoad.map((o: any) => <tr key={o.id} className="is-muted"><td><b className="v5-mono">{o.reference}</b></td><td>{o.shop?.name}</td><td><span className="v5-chip is-ok">{o.status === 'OUT_FOR_DELIVERY' ? 'En route' : 'Attribuée'}</span></td><td className="num">{dt(Number(o.total))}</td><td><Truck size={14} /> {o.delivery?.driverName || '—'}</td></tr>)}
      {!ready.length && !onRoad.length && <tr><td colSpan={5} className="v5-hint">{orders.data ? 'Aucune commande à livrer.' : 'Chargement…'}</td></tr>}</tbody></table></div></div>
  </section>;
}

/* ------------------------------------------------------------------ Rapports & bénéfice */
function Reports(c: Ctx) {
  const [days, setDays] = useState(30);
  const { data, err } = useLoad<any>('/api/supplier/reports?days=' + days, [days]);
  const m = data?.metrics || {}; const full = has(c, 'reports'); const cost = has(c, 'seeCost');
  return <section className="v5-stack">
    <div className="v5-seg" role="group">{[1, 7, 30, 90].map(d => <button key={d} aria-pressed={days === d} onClick={() => setDays(d)}>{d === 1 ? 'Aujourd’hui' : d + ' jours'}</button>)}</div>
    {err && <div className="v5-alert v5-alert--danger">{err}</div>}
    {full && <div className="v5-kpis"><div className="v5-kpi"><span>Chiffre d’affaires</span><b>{dt(m.revenue || 0)}</b></div>{cost && <div className="v5-kpi is-ok"><span>Marge brute</span><b>{dt(m.grossProfit || 0)}</b></div>}<div className="v5-kpi"><span>Dépenses</span><b>{dt(m.expenses || 0)}</b></div>{cost && <div className="v5-kpi"><span>Bénéfice net</span><b>{dt(m.netProfit || 0)}</b></div>}<div className="v5-kpi"><span>Clients me doivent</span><b>{dt(m.receivables || 0)}</b></div><div className="v5-kpi"><span>Je dois</span><b>{dt(m.payables || 0)}</b></div></div>}
    {cost && <div className="v5-kpis"><div className="v5-kpi"><span>Stock au coût</span><b>{dt(m.stockCost || 0)}</b></div><div className="v5-kpi"><span>Stock au prix de vente</span><b>{dt(m.stockRetail || 0)}</b></div></div>}
    {full && <div className="v5-card"><h3 className="v6-h3">Meilleures ventes</h3><div className="v5-table-wrap"><table className="v5-table"><thead><tr><th>Produit</th><th className="num">Qté</th><th className="num">CA</th>{cost && <th className="num">Marge</th>}</tr></thead><tbody>
      {(data?.topProducts || []).slice(0, 15).map((x: any, i: number) => <tr key={i}><td><b>{x.name}</b></td><td className="num">{x.quantity}</td><td className="num">{dt(x.revenue)}</td>{cost && <td className="num">{dt(x.profit || 0)}</td>}</tr>)}</tbody></table></div></div>}
    <div className="v5-card"><h3 className="v6-h3">Stock bas</h3><div className="v5-table-wrap"><table className="v5-table"><tbody>{(data?.lowStock || []).slice(0, 20).map((x: any, i: number) => <tr key={i}><td>{x.name}</td><td className="num">{x.stock}</td></tr>)}{!(data?.lowStock || []).length && <tr><td className="v5-hint">{data ? 'Aucun produit en stock bas.' : 'Chargement…'}</td></tr>}</tbody></table></div></div>
    {(data?.deadStock || []).length > 0 && <div className="v5-card"><h3 className="v6-h3">Stock dormant</h3><div className="v5-table-wrap"><table className="v5-table"><tbody>{data.deadStock.slice(0, 15).map((x: any, i: number) => <tr key={i}><td>{x.name}</td><td className="num">{x.stock}</td></tr>)}</tbody></table></div></div>}
  </section>;
}

/* ------------------------------------------------------------------ Équipe */
const ROLES: [string, string][] = [['ADMIN', 'Administrateur'], ['MANAGER', 'Responsable'], ['STOCK', 'Magasinier'], ['SALES', 'Vendeur'], ['CASHIER', 'Caissier'], ['ACCOUNTANT', 'Comptable'], ['DELIVERY_MANAGER', 'Responsable livraison']];
function Team(c: Ctx) {
  const { data, err, reload } = useLoad<any[]>('/api/supplier/accounts');
  const [f, setF] = useState({ fullName: '', login: '', password: '', role: 'CASHIER', phone: '' }); const [busy, setBusy] = useState(false);
  async function add(e: React.FormEvent) { e.preventDefault(); setBusy(true); try { await api('POST', '/api/supplier/accounts', f); c.onMessage(`${f.fullName} ajouté(e).`); setF({ fullName: '', login: '', password: '', role: 'CASHIER', phone: '' }); reload(); } catch (x) { c.onError(String(x)); } finally { setBusy(false); } }
  async function patch(a: any, body: any, msg: string) { try { await api('PATCH', '/api/supplier/accounts', { id: a.id, ...body }); c.onMessage(msg); reload(); } catch (x) { c.onError(String(x)); } }
  return <section className="v5-stack">
    <form className="v5-card v6-grid3" onSubmit={add}>
      <input className="v5-input" required placeholder="Nom et prénom" value={f.fullName} onChange={e => setF({ ...f, fullName: e.target.value })} />
      <input className="v5-input" required placeholder="Identifiant de connexion" value={f.login} onChange={e => setF({ ...f, login: e.target.value })} />
      <input className="v5-input" required type="password" minLength={6} placeholder="Mot de passe (6+)" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} />
      <select className="v5-input" value={f.role} onChange={e => setF({ ...f, role: e.target.value })}>{ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <input className="v5-input" placeholder="Téléphone" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} />
      <button className="v5-btn v5-btn--primary" disabled={busy}><UserPlus size={16} /> Ajouter l’employé</button>
    </form>
    {err && <div className="v5-alert v5-alert--danger">{err}</div>}
    <div className="v5-card"><div className="v5-table-wrap"><table className="v5-table"><thead><tr><th>Employé</th><th>Rôle</th><th>Statut</th><th className="act"></th></tr></thead><tbody>
      {(data || []).map(a => <tr key={a.id} className={a.isActive ? '' : 'is-muted'}><td><b>{a.fullName}</b><small className="v5-mono">{a.login}{a.phone ? ' · ' + a.phone : ''}</small></td>
        <td>{a.role === 'OWNER' ? 'Propriétaire' : <select className="v5-input" value={a.role} onChange={e => void patch(a, { role: e.target.value }, `Rôle de ${a.fullName} modifié.`)}>{ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}</td>
        <td><span className={'v5-chip' + (a.isActive ? ' is-ok' : '')}>{a.isActive ? 'Actif' : 'Désactivé'}</span></td>
        <td className="act v6-row-actions">{a.role !== 'OWNER' && <><button className="v5-btn v5-btn--ghost v5-btn--sm" onClick={() => { const p = prompt(`Nouveau mot de passe pour ${a.fullName} (6 caractères minimum) :`); if (p && p.length >= 6) void patch(a, { password: p }, 'Mot de passe changé.'); }}>Mot de passe</button>
          <button className="v5-btn v5-btn--ghost v5-btn--sm" onClick={() => void patch(a, { isActive: !a.isActive }, a.isActive ? `${a.fullName} désactivé(e).` : `${a.fullName} réactivé(e).`)}>{a.isActive ? 'Désactiver' : 'Réactiver'}</button></>}</td></tr>)}
    </tbody></table></div></div>
  </section>;
}

/* ------------------------------------------------------------------ Dépôts */
function Warehouses(c: Ctx) {
  const { data, reload } = useLoad<any>('/api/supplier/advanced');
  const [f, setF] = useState({ name: '', code: '' }); const [t, setT] = useState({ productId: '', fromWarehouseId: '', toWarehouseId: '', quantity: '1' });
  const whs: any[] = data?.warehouses || []; const ws: any[] = data?.warehouseStock || [];
  async function add(e: React.FormEvent) { e.preventDefault(); try { await api('POST', '/api/supplier/advanced', { action: 'WAREHOUSE', ...f }); setF({ name: '', code: '' }); reload(); c.onMessage('Dépôt ajouté.'); } catch (x) { c.onError(String(x)); } }
  async function transfer(e: React.FormEvent) { e.preventDefault(); try { await api('POST', '/api/supplier/advanced', { action: 'WAREHOUSE_TRANSFER', ...t, quantity: Number(t.quantity) }); reload(); c.onMessage('Transfert enregistré.'); } catch (x) { c.onError(String(x)); } }
  const name = (id: string) => c.products.find(p => p.id === id)?.name || id;
  return <section className="v5-stack">
    <form className="v5-card v6-grid3" onSubmit={add}><input className="v5-input" required placeholder="Nom du dépôt" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /><input className="v5-input" required placeholder="Code (ex. SFX)" value={f.code} onChange={e => setF({ ...f, code: e.target.value })} /><button className="v5-btn v5-btn--primary"><Warehouse size={16} /> Ajouter un dépôt</button></form>
    {whs.length >= 2 && <form className="v5-card v6-grid4" onSubmit={transfer}>
      <select className="v5-input" required value={t.productId} onChange={e => setT({ ...t, productId: e.target.value })}><option value="">Produit…</option>{c.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <select className="v5-input" required value={t.fromWarehouseId} onChange={e => setT({ ...t, fromWarehouseId: e.target.value })}><option value="">De…</option>{whs.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
      <select className="v5-input" required value={t.toWarehouseId} onChange={e => setT({ ...t, toWarehouseId: e.target.value })}><option value="">Vers…</option>{whs.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
      <div className="v6-inline"><input className="v5-input" type="number" min={1} value={t.quantity} onChange={e => setT({ ...t, quantity: e.target.value })} /><button className="v5-btn v5-btn--primary">Transférer</button></div></form>}
    {whs.map(w => <div key={w.id} className="v5-card"><h3 className="v6-h3"><Warehouse size={16} /> {w.name} <small className="v5-mono">{w.code}</small></h3>
      <div className="v5-table-wrap"><table className="v5-table"><tbody>{ws.filter(x => x.warehouseId === w.id && x.quantity > 0).slice(0, 50).map(x => <tr key={x.id}><td>{name(x.productId)}</td><td className="num">{x.quantity}</td></tr>)}</tbody></table></div></div>)}
    {!whs.length && <p className="v5-hint">{data ? 'Un seul lieu de stock pour l’instant : ajoutez un dépôt pour suivre le stock par adresse.' : 'Chargement…'}</p>}
  </section>;
}

/* ------------------------------------------------------------------ Mes droits & code gérant */
function Rights(c: Ctx) {
  const { data, reload } = useLoad<any>('/api/supplier/permissions');
  const [pin, setPin] = useState(''); const [limit, setLimit] = useState('');
  useEffect(() => { if (data) setLimit(String(data.discountLimitPct)); }, [data]);
  async function savePin(remove = false) { try { await api('PATCH', '/api/supplier/permissions', { approvalPin: remove ? null : pin }); setPin(''); reload(); c.onMessage(remove ? 'Code gérant retiré.' : 'Code gérant enregistré.'); } catch (x) { c.onError(String(x)); } }
  async function saveLimit() { try { await api('PATCH', '/api/supplier/permissions', { discountLimitPct: Number(limit) }); reload(); c.onMessage('Limite de remise enregistrée.'); } catch (x) { c.onError(String(x)); } }
  const labels: Record<string, string> = { sell: 'Vendre', discount: 'Remise sans limite', refund: 'Rembourser', customers: 'Clients', productCreate: 'Créer des pièces', stockIn: 'Entrée de stock', inventory: 'Inventaire', productEdit: 'Modifier les produits', productPrice: 'Changer les prix', productArchive: 'Archiver', promo: 'Promotions', seeCost: 'Voir les coûts', purchases: 'Achats', expenses: 'Dépenses', documents: 'Factures & devis', quotes: 'Devis', orders: 'Commandes', deliveryAssign: 'Attribuer les livreurs', driverCash: 'Recettes livreurs', reports: 'Rapports', team: 'Équipe', warehouses: 'Dépôts' };
  return <section className="v5-stack">
    <div className="v5-card"><h3 className="v6-h3"><ShieldCheck size={17} /> Mon rôle : {data?.roleLabel || '…'}</h3>
      <div className="v6-chips">{Object.entries(labels).map(([k, l]) => <span key={k} className={'v5-chip ' + (c.perms.includes(k as Perm) ? 'is-ok' : 'is-muted')}>{c.perms.includes(k as Perm) ? '✓' : '✗'} {l}</span>)}</div>
      {data && !c.perms.includes('discount') && <p className="v5-hint">Remise maximale sans code gérant : <b>{data.discountLimitPct} %</b>. Au-delà, et pour un remboursement, le gérant tape son code sur la caisse.</p>}</div>
    {data?.canApprove && <div className="v5-card"><h3 className="v6-h3"><KeyRound size={17} /> Mon code gérant</h3>
      <p className="v5-hint">{data.hasApprovalPin ? 'Votre code est actif.' : 'Créez un code de 4 à 6 chiffres : vous le taperez sur la caisse pour autoriser une remise ou un remboursement.'} {data.approvers} gérant(s) ont un code.</p>
      <div className="v6-inline"><input className="v5-input" type="password" inputMode="numeric" maxLength={6} placeholder="Nouveau code (4 à 6 chiffres)" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} /><button className="v5-btn v5-btn--primary" disabled={pin.length < 4} onClick={() => void savePin()}>Enregistrer</button>{data.hasApprovalPin && <button className="v5-btn v5-btn--ghost" onClick={() => void savePin(true)}>Retirer</button>}</div></div>}
    {data && ['OWNER', 'ADMIN'].includes(data.role) && <div className="v5-card"><h3 className="v6-h3">Remise maximale des vendeurs et caissiers</h3>
      <div className="v6-inline"><input className="v5-input v6-in-cost" type="number" min={0} max={100} value={limit} onChange={e => setLimit(e.target.value)} /><span>%</span><button className="v5-btn v5-btn--primary" onClick={() => void saveLimit()}>Enregistrer</button></div></div>}
  </section>;
}

/* ------------------------------------------------------------------ Routeur */
export function ManageModule({ page, ...c }: Ctx & { page: ManagePage }) {
  if (c.demo && page !== 'droits') return <DemoNote />;
  switch (page) {
    case 'gestion': return <ProductsAdmin {...c} />;
    case 'achats': return <Purchases {...c} />;
    case 'depenses': return <Expenses {...c} />;
    case 'documents': return <Documents {...c} />;
    case 'livraison': return <Delivery {...c} />;
    case 'rapports': return <Reports {...c} />;
    case 'lignes': return <LinesPage canCount={has(c, 'inventory')} onError={c.onError} onMessage={c.onMessage} onOpenInventory={() => c.onOpenPage?.('inventaire')} />;
    case 'equipe': return <Team {...c} />;
    case 'depots': return <Warehouses {...c} />;
    case 'droits': return c.demo ? <DemoNote /> : <Rights {...c} />;
  }
}
