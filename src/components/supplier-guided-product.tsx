'use client';
import { useMemo, useState } from 'react';
import { Check, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { api } from './ui';
import { BRAND_MODELS, BRANDS, PART_TYPES, marginOf, productName, suggestPrices, variantIssues, variantPayload, type VariantInput } from '@/lib/supplier-guided';

type Result = { name: string; ok: boolean; error?: string };
const emptyVariant = (quality: string): VariantInput => ({ quality, purchasePrice: '', price: '', wholesalePrice: '', stock: '', barcode: '' });

/**
 * Création guidée (Fixi Max) : type → marque → modèle(s) → qualités.
 * Chaque qualité cochée devient un produit, créé par l'API existante (POST /api/supplier/products).
 */
export function SupplierGuidedProduct({ products, onSaved }: { products: any[]; onSaved: () => void }) {
  const [typeId, setTypeId] = useState('ecran');
  const [brand, setBrand] = useState('Apple');
  const [model, setModel] = useState('iPhone 13');
  const [customModel, setCustomModel] = useState('');
  const [compat, setCompat] = useState<string[]>([]);
  const [variants, setVariants] = useState<VariantInput[]>([emptyVariant('OLED'), emptyVariant('Incell')]);
  const [more, setMore] = useState(false);
  const [extra, setExtra] = useState({ warrantyDays: '', location: '', minStock: '' });
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);

  const type = PART_TYPES.find(t => t.id === typeId) || PART_TYPES[0];
  const models = BRAND_MODELS[brand] || [];
  const finalModel = (customModel.trim() || model).trim();
  const existing = useMemo(() => new Set((products || []).map((p: any) => String(p.name || '').toLowerCase())), [products]);
  const grades = variants.map(v => v.quality);

  function pickType(id: string) {
    const t = PART_TYPES.find(x => x.id === id)!;
    setTypeId(id); setResults(null);
    // Garde les qualités encore valables pour ce type ; sinon propose la première.
    setVariants(v => { const kept = v.filter(x => t.qualities.includes(x.quality)); return kept.length ? kept : [emptyVariant(t.qualities[0])]; });
  }
  function pickBrand(b: string) { setBrand(b); setModel((BRAND_MODELS[b] || [])[0] || ''); setCustomModel(''); setCompat([]); setResults(null); }
  function toggleGrade(q: string) {
    setResults(null);
    setVariants(v => v.some(x => x.quality === q) ? v.filter(x => x.quality !== q) : [...v, emptyVariant(q)].sort((a, b) => type.qualities.indexOf(a.quality) - type.qualities.indexOf(b.quality)));
  }
  function toggleCompat(m: string) { setCompat(c => c.includes(m) ? c.filter(x => x !== m) : [...c, m]); }
  function setCell(i: number, k: keyof VariantInput, val: string) {
    setResults(null);
    setVariants(v => v.map((x, j) => {
      if (j !== i) return x;
      const next = { ...x, [k]: val };
      // Coût saisi : propose vente et gros si l'utilisateur ne les a pas encore tapés.
      if (k === 'purchasePrice') {
        const s = suggestPrices(Number(val.replace(',', '.')));
        if (!x.price || x.price === String(suggestPrices(Number(x.purchasePrice.replace(',', '.'))).price ?? '')) next.price = s.price != null ? String(s.price) : '';
        if (!x.wholesalePrice || x.wholesalePrice === String(suggestPrices(Number(x.purchasePrice.replace(',', '.'))).wholesalePrice ?? '')) next.wholesalePrice = s.wholesalePrice != null ? String(s.wholesalePrice) : '';
      }
      return next;
    }));
  }

  const rows = variants.map(v => { const name = productName(type.label, finalModel, v.quality); return { v, name, ...variantIssues(v, existing, name), margin: marginOf(Number(v.purchasePrice.replace(',', '.')), Number(v.price.replace(',', '.'))) }; });
  const ready = !!finalModel && rows.length > 0 && rows.every(r => !r.blocking.length);

  async function create() {
    if (!ready) return;
    setBusy(true); setResults(null);
    const out: Result[] = [];
    for (const r of rows) {
      try { await api('/api/supplier/products', { method: 'POST', body: JSON.stringify(variantPayload({ typeLabel: type.label, brand, model: finalModel, compat, v: r.v, ...extra })) }); out.push({ name: r.name, ok: true }); }
      catch (e: any) { out.push({ name: r.name, ok: false, error: e.message }); }
    }
    setResults(out); setBusy(false);
    if (out.some(x => x.ok)) {
      onSaved();
      // Les variantes créées sont retirées ; les échecs restent pour correction.
      setVariants(v => { const left = v.filter((_, i) => !out[i]?.ok); return left.length ? left : [emptyVariant(variants[0]?.quality || type.qualities[0])]; });
    }
  }

  const okCount = results?.filter(r => r.ok).length || 0;

  return <div className="fxm-gp">
    <div className="fxm-gp-step fxm-up">
      <div className="fxm-gp-title"><b>1</b>Type de pièce</div>
      <div className="fxm-gp-opts" role="group" aria-label="Type de pièce">
        {PART_TYPES.map(t => <button type="button" key={t.id} className={'fxm-opt' + (t.id === typeId ? ' on' : '')} aria-pressed={t.id === typeId} onClick={() => pickType(t.id)}>{t.label}</button>)}
      </div>
    </div>

    <div className="fxm-gp-step fxm-up" style={{ '--d': '.05s' } as any}>
      <div className="fxm-gp-title"><b>2</b>Marque et modèle</div>
      <div className="fxm-gp-opts" role="group" aria-label="Marque">
        {BRANDS.map(b => <button type="button" key={b} className={'fxm-opt' + (b === brand ? ' on' : '')} aria-pressed={b === brand} onClick={() => pickBrand(b)}>{b}</button>)}
      </div>
      <div className="fxm-gp-opts" role="group" aria-label="Modèle">
        {models.map(m => <button type="button" key={m} className={'fxm-opt fxm-opt--s' + (m === model && !customModel ? ' on' : '')} aria-pressed={m === model && !customModel} onClick={() => { setModel(m); setCustomModel(''); setCompat(c => c.filter(x => x !== m)); }}>{m}</button>)}
      </div>
      <label className="fxm-gp-field"><span>Autre modèle (facultatif)</span><input value={customModel} onChange={e => setCustomModel(e.target.value)} placeholder="Ex. Galaxy A05s, Spark Go 2024…" /></label>
      {models.length > 1 && <details className="fxm-gp-compat"><summary>Aussi compatible avec… {compat.length > 0 && <em>{compat.length}</em>}</summary>
        <div className="fxm-gp-opts">{models.filter(m => m !== finalModel).map(m => <button type="button" key={m} className={'fxm-opt fxm-opt--s' + (compat.includes(m) ? ' on' : '')} aria-pressed={compat.includes(m)} onClick={() => toggleCompat(m)}>{m}</button>)}</div>
      </details>}
    </div>

    <div className="fxm-gp-step fxm-up" style={{ '--d': '.1s' } as any}>
      <div className="fxm-gp-title"><b>3</b>Qualités <small>(une variante chacune)</small></div>
      <div className="fxm-gp-opts" role="group" aria-label="Qualités">
        {type.qualities.map(q => <button type="button" key={q} className={'fxm-opt' + (grades.includes(q) ? ' on' : '')} aria-pressed={grades.includes(q)} onClick={() => toggleGrade(q)}>{grades.includes(q) ? <Check size={14} /> : <Plus size={14} />}{q}</button>)}
      </div>
    </div>

    <div className="fxm-gp-step fxm-up" style={{ '--d': '.15s' } as any}>
      <div className="fxm-gp-title"><b>4</b>Prix et stock <small>tapez le coût : vente (+30 %) et gros (−5 %) sont proposés</small></div>
      <div className="fxm-gp-table" role="table" aria-label="Variantes à créer">
        <div className="fxm-gp-row fxm-gp-row--head" role="row"><span role="columnheader">Produit généré</span><span role="columnheader">Coût</span><span role="columnheader">Vente</span><span role="columnheader">Gros</span><span role="columnheader">Stock</span><span role="columnheader">Code-barres</span></div>
        {rows.map((r, i) => <div className="fxm-gp-row fxm-in" role="row" key={r.v.quality} style={{ '--d': `${i * 0.05}s` } as any}>
          <span role="cell" className="fxm-gp-name"><b>{r.name || '—'}</b>
            {r.blocking.filter(x => x !== 'prix de vente manquant' || r.v.purchasePrice || r.v.stock).map(x => <em key={x} className="bad">{x}</em>)}{r.warnings.map(x => <em key={x} className="warn">{x}</em>)}
            {!r.blocking.length && !r.warnings.length && r.margin != null && <em className="ok">marge {r.margin} %</em>}</span>
          <span role="cell" data-label="Coût"><input aria-label={`Coût ${r.name}`} inputMode="decimal" value={r.v.purchasePrice} onChange={e => setCell(i, 'purchasePrice', e.target.value)} placeholder="0" /></span>
          <span role="cell" data-label="Vente"><input aria-label={`Prix de vente ${r.name}`} inputMode="decimal" value={r.v.price} onChange={e => setCell(i, 'price', e.target.value)} placeholder="0" /></span>
          <span role="cell" data-label="Gros"><input aria-label={`Prix de gros ${r.name}`} inputMode="decimal" value={r.v.wholesalePrice} onChange={e => setCell(i, 'wholesalePrice', e.target.value)} placeholder="—" /></span>
          <span role="cell" data-label="Stock"><input aria-label={`Stock ${r.name}`} inputMode="numeric" value={r.v.stock} onChange={e => setCell(i, 'stock', e.target.value)} placeholder="0" /></span>
          <span role="cell" data-label="Code-barres"><input aria-label={`Code-barres ${r.name}`} value={r.v.barcode || ''} onChange={e => setCell(i, 'barcode', e.target.value)} placeholder="Scanner…" /></span>
        </div>)}
        {!rows.length && <div className="fxm-gp-empty">Cochez au moins une qualité à l’étape 3.</div>}
      </div>
      <button type="button" className="fxm-gp-more" onClick={() => setMore(m => !m)}>{more ? 'Masquer' : '+ Garantie, emplacement, stock minimum'} <small>(facultatif, pour toutes les variantes)</small></button>
      {more && <div className="fxm-gp-extra">
        <label className="fxm-gp-field"><span>Garantie (jours)</span><input inputMode="numeric" value={extra.warrantyDays} onChange={e => setExtra(x => ({ ...x, warrantyDays: e.target.value }))} placeholder="90" /></label>
        <label className="fxm-gp-field"><span>Emplacement</span><input value={extra.location} onChange={e => setExtra(x => ({ ...x, location: e.target.value }))} placeholder="Rayon A2" /></label>
        <label className="fxm-gp-field"><span>Stock minimum</span><input inputMode="numeric" value={extra.minStock} onChange={e => setExtra(x => ({ ...x, minStock: e.target.value }))} placeholder="3" /></label>
      </div>}
    </div>

    <div className="fxm-gp-foot">
      <div className="fxm-gp-summary"><Sparkles size={16} /><span>{rows.length ? <>{rows.length} produit(s) : <b>{rows.map(r => r.v.quality).join(' · ')}</b> pour <b>{finalModel || '—'}</b>{compat.length ? ` (+${compat.length} compatible(s))` : ''}</> : 'Aucune variante'}</span></div>
      <button type="button" className="btn fxm-btn-g" disabled={!ready || busy} onClick={create}>{busy ? <Loader2 size={17} className="ps-spin" /> : <Check size={17} />}{rows.length > 1 ? `Créer ${rows.length} variantes` : 'Créer le produit'}</button>
    </div>

    {results && <div className={'fxm-gp-result ' + (okCount === results.length ? 'ok' : 'warn')} role="status">
      {results.map(r => <div key={r.name}>{r.ok ? <Check size={15} /> : <X size={15} />}<b>{r.name}</b>{r.ok ? ' créé' : ` : ${r.error}`}</div>)}
    </div>}
  </div>;
}
