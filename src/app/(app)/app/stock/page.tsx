'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Minus, Boxes, TriangleAlert, Wallet, PackageOpen, ScanBarcode } from 'lucide-react';
import { BarcodeCamera } from '@/components/barcode-camera';
import { gs1Valid, normalizeBarcode } from '@/lib/barcode';
import { api, useApi } from '@/components/ui';
import { FxSheet } from '@/components/fx-sheet';
import { RestockPanel } from '@/components/restock-panel';
import { money } from '@/lib/format';

const empty = { sku: '', barcode: '', name: '', category: '', quantity: 0, minQuantity: 2, purchasePrice: 0, salePrice: 0, supplierId: '' };

// Stock : ce qui reste, ce qu'il faut racheter, et un ajustement en un toucher.
export default function Stock() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | string>('all');
  useEffect(() => { const v = new URLSearchParams(window.location.search).get('q'); if (v) setQ(v); }, []);
  const [refresh, setRefresh] = useState(0);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const archived = filter === 'archived';
  const { data, loading, error } = useApi<any[]>(`/api/stock?q=${encodeURIComponent(q)}${archived ? '&archived=1' : ''}`, refresh);
  const suppliers = useApi<any[]>('/api/suppliers').data || [];
  const [f, setF] = useState<any>(empty);
  const [scan, setScan] = useState<'field' | 'search' | null>(null);
  const code = normalizeBarcode(f.barcode); const codeOk = code ? gs1Valid(code) : null;
  const rows = data || [];
  const low = rows.filter(x => x.quantity <= x.minQuantity);
  const value = rows.reduce((a, x) => a + Number(x.quantity) * Number(x.purchasePrice || 0), 0);
  const cats = useMemo(() => [...new Set(rows.map(x => x.category).filter(Boolean))].slice(0, 8) as string[], [rows]);
  const shown = rows.filter(x => filter === 'all' || archived ? true : filter === 'low' ? x.quantity <= x.minQuantity : x.category === filter);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (edit) await api(`/api/stock/${edit.id}`, { method: 'PATCH', body: JSON.stringify(f) });
      else await api('/api/stock', { method: 'POST', body: JSON.stringify(f) });
      setOpen(false); setEdit(null); setF(empty); setRefresh(x => x + 1);
    } catch (err: any) { alert(err.message); }
  }
  async function remove(x: any) {
    if (!confirm(`Supprimer « ${x.name} » ?\n\nS’il a déjà servi (ventes, réparations, achats), il sera archivé : caché partout, mais son historique reste juste.`)) return;
    try { const r: any = await api(`/api/stock/${x.id}`, { method: 'DELETE' }); setOpen(false); setEdit(null); setF(empty); setRefresh(v => v + 1); alert(r.message); } catch (err: any) { alert(err.message); }
  }
  async function restore(x: any) {
    try { await api(`/api/stock/${x.id}`, { method: 'PATCH', body: JSON.stringify({ active: true }) }); setRefresh(v => v + 1); } catch (err: any) { alert(err.message); }
  }
  async function adjust(x: any, d: number) {
    try { await api(`/api/stock/${x.id}`, { method: 'PATCH', body: JSON.stringify({ quantity: Math.max(0, x.quantity + d) }) }); setRefresh(v => v + 1); } catch (err: any) { alert(err.message); }
  }
  function openEdit(x: any) { setEdit(x); setF({ sku: x.sku, barcode: x.barcode || '', name: x.name, category: x.category || '', quantity: x.quantity, minQuantity: x.minQuantity, purchasePrice: Number(x.purchasePrice || 0), salePrice: Number(x.salePrice || 0), supplierId: x.supplierId || '' }); setOpen(true); }

  return <div className="fx-page">
    <div className="fx-hello"><div><h1>Stock</h1><p>Vos pièces, ce qu’il faut racheter, la valeur au coût.</p></div>
      <button className="btn btn-primary" onClick={() => { setEdit(null); setF(empty); setOpen(true); }}><Plus size={18} /> Nouvelle pièce</button></div>

    <RestockPanel />

    <section className="fx-kpis" aria-label="Résumé du stock">
      <div className="fx-kpi"><Boxes /><div><span>Pièces</span><strong>{rows.length}</strong></div></div>
      <button type="button" className={`fx-kpi ${low.length ? 'fx-kpi--due' : ''}`} onClick={() => setFilter('low')}><TriangleAlert /><div><span>À racheter</span><strong>{low.length}</strong></div></button>
      <div className="fx-kpi"><Wallet /><div><span>Valeur au coût</span><strong>{money(value)}</strong></div></div>
    </section>

    <div className="fx-toolbar">
      <div className="fx-searchbar"><Search size={18} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Nom, référence ou code-barres…" aria-label="Rechercher une pièce" /><button type="button" className="fx-searchbar-scan" onClick={() => setScan('search')} aria-label="Scanner un code-barres"><ScanBarcode size={18} /></button></div>
      <div className="fx-filter-chips" role="group" aria-label="Filtrer">
        <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Tout</button>
        <button type="button" aria-pressed={filter === 'low'} onClick={() => setFilter('low')} data-tone="danger">À racheter {low.length > 0 && <b>{low.length}</b>}</button>
        {cats.map(c => <button type="button" key={c} aria-pressed={filter === c} onClick={() => setFilter(c)}>{c}</button>)}
        <button type="button" aria-pressed={archived} onClick={() => setFilter(archived ? 'all' : 'archived')}>Archivés</button>
      </div>
    </div>

    {error && <div className="error">{error}</div>}
    {loading && !data ? <div className="card card-pad fx-skeleton" role="status" aria-label="Chargement"><i /><i /><i /></div> :
      <div className="fx-list fx-stock-list">
        {shown.map(x => { const isLow = x.quantity <= x.minQuantity; return <div key={x.id} className={`fx-row fx-stock-row ${isLow ? 'fx-row--danger' : ''}`}>
          <button type="button" className="fx-row-main" onClick={() => openEdit(x)}><b>{x.name}</b><small><span className="mono">{x.sku}</span>{x.barcode ? <span className="mono"> · {x.barcode}</span> : null}{x.category ? ` · ${x.category}` : ''} · vente {money(x.salePrice)}{x.supplier?.name ? ` · ${x.supplier.name}` : ''}</small></button>
          <div className="fx-stepper-qty" role="group" aria-label={`Quantité de ${x.name}`}>
            <button type="button" onClick={() => adjust(x, -1)} disabled={x.quantity <= 0} aria-label="Retirer une pièce"><Minus size={16} /></button>
            <b className={isLow ? 'is-low' : ''}>{x.quantity}</b>
            <button type="button" onClick={() => adjust(x, 1)} aria-label="Ajouter une pièce"><Plus size={16} /></button>
          </div>
          {archived && <button type="button" className="btn btn-soft btn-sm" onClick={() => restore(x)}>Restaurer</button>}
          {isLow && !archived && <Link href={`/app/suppliers?q=${encodeURIComponent(x.name)}`} className="btn btn-soft btn-sm fx-stock-order"><PackageOpen size={15} /> Commander</Link>}
        </div>; })}
        {!shown.length && <div className="fx-empty"><b>{filter === 'low' ? 'Rien à racheter' : 'Aucune pièce'}</b><span>{filter === 'low' ? 'Toutes vos pièces sont au-dessus du seuil d’alerte.' : 'Ajoutez vos pièces pour suivre le stock et la marge.'}</span>{filter !== 'low' && <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={18} /> Nouvelle pièce</button>}</div>}
      </div>}

    <FxSheet open={open} onClose={() => { setOpen(false); setEdit(null); }} side="bottom" title={edit ? 'Modifier la pièce' : 'Nouvelle pièce'} label="Fiche pièce">
      <form onSubmit={save} className="fx-form-grid">
        <label className="field span-2"><span className="label">Nom *</span><input className="input" required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Écran Galaxy A54 OLED" /></label>
        <label className="field"><span className="label">Référence *</span><input className="input" required value={f.sku} onChange={e => setF({ ...f, sku: e.target.value })} /></label>
        <label className="field"><span className="label">Code-barres</span><span className="fx-input-scan"><input className="input" inputMode="numeric" value={f.barcode} onChange={e => setF({ ...f, barcode: e.target.value })} placeholder="Scannez l’emballage" /><button type="button" className="btn btn-soft btn-sm" onClick={() => setScan('field')} aria-label="Scanner avec la caméra"><ScanBarcode size={17} /></button></span>
          {codeOk === false && <small className="fx-form-hint warn">Clé de contrôle incorrecte : vérifiez le code (il sera quand même enregistré).</small>}</label>
        <label className="field"><span className="label">Catégorie</span><input className="input" list="fx-stock-cats" value={f.category} onChange={e => setF({ ...f, category: e.target.value })} /><datalist id="fx-stock-cats">{cats.map(c => <option key={c} value={c} />)}</datalist></label>
        <label className="field"><span className="label">Quantité</span><input className="input" type="number" min="0" value={f.quantity} onChange={e => setF({ ...f, quantity: Number(e.target.value) })} /></label>
        <label className="field"><span className="label">Alerte à partir de</span><input className="input" type="number" min="0" value={f.minQuantity} onChange={e => setF({ ...f, minQuantity: Number(e.target.value) })} /></label>
        <label className="field"><span className="label">Prix d’achat</span><input className="input" type="number" step="0.001" min="0" value={f.purchasePrice} onChange={e => setF({ ...f, purchasePrice: Number(e.target.value) })} /></label>
        <label className="field"><span className="label">Prix de vente</span><input className="input" type="number" step="0.001" min="0" value={f.salePrice} onChange={e => setF({ ...f, salePrice: Number(e.target.value) })} /></label>
        <label className="field span-2"><span className="label">Fournisseur</span><select className="select" value={f.supplierId} onChange={e => setF({ ...f, supplierId: e.target.value })}><option value="">Aucun</option>{suppliers.map((s: any) => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
        {f.salePrice > 0 && f.purchasePrice > 0 && <p className="span-2 fx-form-hint">Marge : {money(f.salePrice - f.purchasePrice)} par pièce ({Math.round((1 - f.purchasePrice / f.salePrice) * 100)} %)</p>}
        <button className="btn btn-primary btn-block span-2">{edit ? 'Enregistrer' : 'Ajouter la pièce'}</button>
        {edit && <button type="button" className="btn btn-ghost btn-block span-2 fx-danger-text" onClick={() => remove(edit)}>Supprimer la pièce</button>}
      </form>
    </FxSheet>
  {scan && <BarcodeCamera kicker="STOCK" title={scan === 'field' ? 'Scanner le code-barres' : 'Retrouver une pièce'} text="Présentez le code-barres de l’emballage devant la caméra." submitLabel={scan === 'field' ? 'Utiliser ce code' : 'Chercher'} onDetected={(c: string) => { if (scan === 'field') setF((x: any) => ({ ...x, barcode: c })); else setQ(c); setScan(null); }} onClose={() => setScan(null)} />}
  </div>;
}
