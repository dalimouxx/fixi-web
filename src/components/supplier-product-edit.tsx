'use client';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Save, Trash2, X } from 'lucide-react';
import { humanError } from '@/lib/human-error';

const num = (v: unknown) => v === null || v === undefined || v === '' ? '' : String(Number(v));

/** Fournisseur : modifier un produit existant (nom, code-barres, prix, catégorie…) ou le supprimer / l'archiver. */
export function SupplierProductEditDialog({ product, canSeeCost, onClose, onSaved }: { product: any; canSeeCost: boolean; onClose: () => void; onSaved: (msg: string) => void }) {
  const [f, setF] = useState({
    name: product.name || '', barcode: product.barcode || '', sku: product.sku || '', category: product.category || '', brand: product.brand || '', qualityGrade: product.qualityGrade || '',
    retailPrice: num(product.retailPrice ?? product.price), wholesalePrice: num(product.wholesalePrice), minimumPrice: num(product.minimumPrice), purchasePrice: num(product.purchasePrice),
    location: product.location || '', minStock: num(product.minStock), warrantyDays: num(product.warrantyDays), minOrderQty: num(product.minOrderQty || 1),
  });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const money = (v: string) => v.trim() === '' ? null : Number(v.replace(',', '.'));
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const body: any = { id: product.id, name: f.name, barcode: f.barcode, sku: f.sku, qualityGrade: f.qualityGrade, location: f.location,
        price: money(f.retailPrice), retailPrice: money(f.retailPrice), wholesalePrice: money(f.wholesalePrice), minimumPrice: money(f.minimumPrice),
        minStock: f.minStock === '' ? 0 : Number(f.minStock), warrantyDays: f.warrantyDays === '' ? 0 : Number(f.warrantyDays), minOrderQty: f.minOrderQty === '' ? 1 : Number(f.minOrderQty) };
      if (canSeeCost && f.purchasePrice !== '') body.purchasePrice = money(f.purchasePrice);
      if (f.name.trim().length < 2) throw new Error('Nom du produit requis');
      if (body.price === null || !(body.price >= 0)) throw new Error('Prix de vente requis');
      const r = await fetch('/api/supplier/products', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error);
      const r2 = await fetch('/api/supplier/products/' + product.id, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ category: f.category, brand: f.brand }) });
      if (!r2.ok) throw new Error((await r2.json().catch(() => ({}))).error);
      onSaved(`« ${f.name} » enregistré.`);
    } catch (x) { setErr(humanError(x)); setBusy(false); }
  }
  async function remove() {
    if (!confirm(`Supprimer « ${product.name} » ?\n\nS’il a déjà été vendu, commandé ou acheté, il sera archivé : caché du catalogue et de la caisse, historique et factures intacts.`)) return;
    setBusy(true); setErr('');
    try { const r = await fetch('/api/supplier/products/' + product.id, { method: 'DELETE' }); const j = await r.json(); if (!r.ok) throw new Error(j.error); onSaved(j.message); }
    catch (x) { setErr(humanError(x)); setBusy(false); }
  }
  return createPortal(<div className="dpf-back" role="dialog" aria-modal="true" aria-label="Modifier le produit" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <form className="dpf spe" onSubmit={save}>
      <header><Pencil size={19} /><div><b>Modifier le produit</b><small>{product.sku} · stock {product.stock} (changez le stock avec « Entrée de stock » ou « Inventaire »)</small></div><button type="button" className="fx-icon-btn" onClick={onClose} aria-label="Fermer"><X size={16} /></button></header>
      <div className="spe-grid">
        <label className="field spe-wide"><span className="label">Nom *</span><input className="input" required value={f.name} onChange={set('name')} /></label>
        <label className="field"><span className="label">Code-barres</span><input className="input" value={f.barcode} onChange={set('barcode')} placeholder="Vide = code court automatique" /></label>
        <label className="field"><span className="label">Référence (SKU)</span><input className="input" value={f.sku} onChange={set('sku')} /></label>
        <label className="field"><span className="label">Catégorie</span><input className="input" value={f.category} onChange={set('category')} /></label>
        <label className="field"><span className="label">Marque</span><input className="input" value={f.brand} onChange={set('brand')} /></label>
        <label className="field"><span className="label">Qualité</span><input className="input" value={f.qualityGrade} onChange={set('qualityGrade')} placeholder="Original, OLED, Incell…" /></label>
        <label className="field"><span className="label">Prix détail (DT) *</span><input className="input" inputMode="decimal" required value={f.retailPrice} onChange={set('retailPrice')} /></label>
        <label className="field"><span className="label">Prix grossiste (DT)</span><input className="input" inputMode="decimal" value={f.wholesalePrice} onChange={set('wholesalePrice')} /></label>
        <label className="field"><span className="label">Prix minimum (DT)</span><input className="input" inputMode="decimal" value={f.minimumPrice} onChange={set('minimumPrice')} /></label>
        {canSeeCost && <label className="field"><span className="label">Coût d’achat (DT)</span><input className="input" inputMode="decimal" value={f.purchasePrice} onChange={set('purchasePrice')} /></label>}
        <label className="field"><span className="label">Emplacement</span><input className="input" value={f.location} onChange={set('location')} placeholder="Rayon A2" /></label>
        <label className="field"><span className="label">Stock d’alerte</span><input className="input" type="number" min={0} value={f.minStock} onChange={set('minStock')} /></label>
        <label className="field"><span className="label">Garantie (jours)</span><input className="input" type="number" min={0} value={f.warrantyDays} onChange={set('warrantyDays')} /></label>
        <label className="field"><span className="label">Commande minimum</span><input className="input" type="number" min={1} value={f.minOrderQty} onChange={set('minOrderQty')} /></label>
      </div>
      {err && <p className="error" role="alert">{err}</p>}
      <div className="spe-actions">
        <button type="button" className="btn btn-ghost fx-danger-text" disabled={busy} onClick={remove}><Trash2 size={16} /> Supprimer</button>
        <button className="btn btn-primary" disabled={busy}><Save size={16} /> Enregistrer</button>
      </div>
    </form>
  </div>, document.body);
}
