'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Boxes, Camera, Check, ChevronDown, Copy, Download, FileSpreadsheet, Loader2, PackagePlus, Plus, Rows3, ScanLine, Sparkles, Trash2, Upload, Zap } from 'lucide-react';
import { BarcodeCamera } from './barcode-camera';
import { api } from './ui';
import { money } from '@/lib/format';
import { compressProductImage } from '@/lib/image-compress';
import { CATEGORY_NAMES, checkRow, guessProduct, parseAmount, parsePasted, type QuickRow } from '@/lib/product-quick';

type Mode = 'quick' | 'series' | 'import';
const blank = { barcode: '', name: '', price: '', stock: '', purchasePrice: '', wholesalePrice: '', minStock: '', location: '', warrantyDays: '', category: '', brand: '', qualityGrade: '', sku: '', imageUrl: '' };
type Form = typeof blank;
const emptyRows = (n = 5): QuickRow[] => Array.from({ length: n }, () => ({ barcode: '', name: '', price: '', stock: '', purchasePrice: '' }));

export function SupplierProductStudio({ products, seed, onSaved, onRestock }: { products: any[]; seed?: { key: number; product: any } | null; onSaved: () => void; onRestock: (p: any) => void }) {
  const [mode, setMode] = useState<Mode>('quick');
  const [f, setF] = useState<Form>(blank);
  const [more, setMore] = useState(false);
  const [cam, setCam] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState<{ text: string; product?: any; kind: 'ok' | 'info' } | null>(null);
  const [last, setLast] = useState<any>(null);
  const [rows, setRows] = useState<QuickRow[]>(emptyRows());
  const [report, setReport] = useState<any>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const guess = useMemo(() => guessProduct(f.name), [f.name]);
  const categories = useMemo(() => [...new Set([...CATEGORY_NAMES, ...products.map(p => p.category).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'fr')), [products]);
  const margin = parseAmount(f.price) - parseAmount(f.purchasePrice);

  // « Dupliquer » depuis une carte produit : tout est repris sauf le code-barres et le SKU.
  useEffect(() => {
    if (!seed) return;
    const p = seed.product;
    setMode('quick'); setMore(true); setErr(''); setNote({ kind: 'info', text: `Variante de « ${p.name} » : changez le nom puis enregistrez.` });
    setF({ ...blank, name: p.name, price: String(Number(p.retailPrice ?? p.price) || ''), stock: '', purchasePrice: String(Number(p.purchasePrice || 0) || ''), wholesalePrice: p.wholesalePrice ? String(Number(p.wholesalePrice)) : '', minStock: p.minStock ? String(p.minStock) : '', location: p.location || '', warrantyDays: p.warrantyDays ? String(p.warrantyDays) : '', category: p.category || '', brand: p.brand || '', qualityGrade: p.qualityGrade || '', imageUrl: p.imageUrl || '' });
    setTimeout(() => { nameRef.current?.focus(); nameRef.current?.select(); }, 50);
  }, [seed?.key]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setF(p => ({ ...p, [k]: e.target.value })); setErr(''); };

  async function lookup(code: string) {
    const barcode = code.trim(); if (!barcode) return;
    setF(p => ({ ...p, barcode })); setNote(null); setErr('');
    try {
      const r = await api<any>('/api/supplier/products/lookup?barcode=' + encodeURIComponent(barcode));
      if (r.own) { setNote({ kind: 'info', text: `Déjà dans votre catalogue : ${r.own.name} (${r.own.stock} en stock).`, product: r.own }); return; }
      if (r.suggestion) {
        const s = r.suggestion;
        setF(p => ({ ...p, name: p.name || s.name, category: p.category || s.category || '', brand: p.brand || s.brand || '', qualityGrade: p.qualityGrade || s.qualityGrade || '', imageUrl: p.imageUrl || s.imageUrl || '' }));
        setNote({ kind: 'ok', text: 'Produit reconnu sur le réseau Fixi : nom et photo pré-remplis. Ajoutez votre prix.' });
      } else setNote({ kind: 'info', text: 'Nouveau code-barres : tapez le nom du produit.' });
      setTimeout(() => nameRef.current?.focus(), 30);
    } catch (e: any) { setErr(e.message); }
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    const bad = checkRow(f); if (bad) { setErr(bad); return; }
    setBusy(true); setErr('');
    try {
      const body: any = { ...f, price: parseAmount(f.price), stock: Number(f.stock || 0), purchasePrice: parseAmount(f.purchasePrice) || 0 };
      for (const k of ['wholesalePrice', 'minStock', 'warrantyDays'] as const) body[k] = f[k] === '' ? null : Number(String(f[k]).replace(',', '.'));
      if (!f.category) body.category = guess.category || ''; if (!f.brand) body.brand = guess.brand || ''; if (!f.qualityGrade) body.qualityGrade = guess.qualityGrade || '';
      const x = await api<any>('/api/supplier/products', { method: 'POST', body: JSON.stringify(body) });
      setLast(x); setNote({ kind: 'ok', text: `${x.name} ajouté · ${x.sku}` });
      // On garde catégorie/marque/coût pour enchaîner les produits proches.
      setF(p => ({ ...blank, category: p.category, brand: p.brand, qualityGrade: p.qualityGrade, location: p.location, warrantyDays: p.warrantyDays }));
      onSaved(); setTimeout(() => nameRef.current?.focus(), 30);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  function variant() {
    if (!last) return;
    setF({ ...blank, name: last.name, price: String(Number(last.retailPrice ?? last.price)), purchasePrice: Number(last.purchasePrice) ? String(Number(last.purchasePrice)) : '', category: last.category || '', brand: last.brand || '', qualityGrade: last.qualityGrade || '', imageUrl: last.imageUrl || '', location: last.location || '', warrantyDays: last.warrantyDays ? String(last.warrantyDays) : '' });
    setNote({ kind: 'info', text: 'Variante : modifiez le nom (modèle, couleur, qualité) puis enregistrez.' });
    setTimeout(() => { nameRef.current?.focus(); nameRef.current?.select(); }, 30);
  }

  // ---------- Saisie en série ----------
  const setCell = (i: number, k: keyof QuickRow, v: string) => setRows(r => { const n = r.slice(); n[i] = { ...n[i], [k]: v }; if (i === n.length - 1 && v) n.push({ barcode: '', name: '', price: '', stock: '', purchasePrice: '' }); return n; });
  function paste(i: number, e: React.ClipboardEvent) {
    const t = e.clipboardData.getData('text'); if (!t.includes('\t') && !t.includes('\n')) return;
    e.preventDefault();
    const add = parsePasted(t);
    setRows(r => { const n = r.slice(0, i).concat(add, r.slice(i).filter(x => x.name || x.price)); return n.concat(emptyRows(2)); });
  }
  const filled = rows.filter(r => r.name || r.price || r.barcode);
  const invalid = filled.filter(r => checkRow(r)).length;

  async function saveRows(source: string) {
    if (!filled.length) { setErr('Ajoutez au moins une ligne'); return; }
    if (invalid) { setErr(`${invalid} ligne(s) à corriger (en rouge)`); return; }
    setBusy(true); setErr(''); setReport(null);
    try {
      const r = await api<any>('/api/supplier/products/bulk', { method: 'POST', body: JSON.stringify({ rows: filled, source }) });
      setReport(r); onSaved();
      const failed = new Set(r.errors.map((x: any) => x.line - 1));
      setRows(filled.filter((_, i) => failed.has(i)).concat(emptyRows(3)));
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function importFile(file?: File | null) {
    if (!file) return;
    setBusy(true); setErr(''); setReport(null);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch('/api/supplier/products/parse', { method: 'POST', body: fd }); const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Fichier illisible');
      setRows(j.rows.concat(emptyRows(2))); setMode('import');
      setNote({ kind: 'info', text: `${j.rows.length} produit(s) lus${j.invalid ? ` · ${j.invalid} à corriger` : ''}. Vérifiez puis enregistrez.` });
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  const grid = <div className="ps-grid-wrap">
    <table className="ps-grid"><thead><tr><th>Code-barres</th><th>Nom *</th><th>Prix *</th><th>Stock</th><th>Coût</th><th /></tr></thead>
      <tbody>{rows.map((r, i) => { const e = (r.name || r.price || r.barcode) ? checkRow(r) : null; const g = r.name ? guessProduct(r.name) : null; return <tr key={i} className={e ? 'is-bad' : ''} title={e || ''}>
        <td><input value={r.barcode || ''} onChange={x => setCell(i, 'barcode', x.target.value)} onPaste={x => paste(i, x)} placeholder="Scanner…" /></td>
        <td><input value={r.name || ''} onChange={x => setCell(i, 'name', x.target.value)} onPaste={x => paste(i, x)} placeholder={i === 0 ? 'Écran iPhone 13 OLED' : ''} />{g && (g.category || g.brand) && <small>{[g.category, g.brand, g.qualityGrade].filter(Boolean).join(' · ')}</small>}</td>
        <td><input value={String(r.price ?? '')} onChange={x => setCell(i, 'price', x.target.value)} inputMode="decimal" placeholder="0" /></td>
        <td><input value={String(r.stock ?? '')} onChange={x => setCell(i, 'stock', x.target.value)} inputMode="numeric" placeholder="0" /></td>
        <td><input value={String(r.purchasePrice ?? '')} onChange={x => setCell(i, 'purchasePrice', x.target.value)} inputMode="decimal" placeholder="—" /></td>
        <td>{(r.name || r.price) ?  <button type="button" aria-label="Supprimer la ligne" onClick={() => setRows(x => x.filter((_, j) => j !== i))}><Trash2 size={14} /></button> : null}</td>
      </tr>; })}</tbody></table>
  </div>;

  return <section className="supplier-panel ps">
    <div className="ps-head"><div className="smart-kicker"><PackagePlus size={13} /> AJOUTER DES PRODUITS</div>
      <div className="ps-tabs" role="tablist">
        {([['quick', Zap, 'Rapide'], ['series', Rows3, 'En série'], ['import', FileSpreadsheet, 'Excel']] as const).map(([k, I, l]) => <button key={k} role="tab" aria-selected={mode === k} className={mode === k ? 'on' : ''} onClick={() => { setMode(k); setErr(''); setReport(null); if (k !== 'quick') setNote(null); }}><I size={15} /> {l}</button>)}
      </div>
    </div>

    {note && <div className={'ps-note ps-note--' + note.kind}>{note.kind === 'ok' ? <Check size={16} /> : <Sparkles size={16} />}<span>{note.text}</span>
      {note.product && <button className="btn btn-soft btn-sm" onClick={() => { onRestock(note.product); setNote(null); }}>+ Réapprovisionner</button>}
      {mode === 'quick' && last && note.kind === 'ok' && !note.product && <button className="btn btn-soft btn-sm" onClick={variant}><Copy size={14} /> Créer une variante</button>}</div>}

    {mode === 'quick' && <form onSubmit={save} className="ps-quick">
      <div className="ps-scan">
        <ScanLine size={18} /><input value={f.barcode} onChange={set('barcode')} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void lookup(f.barcode); } }} placeholder="Scanner ou taper le code-barres (facultatif)" aria-label="Code-barres" />
        <button type="button" className="ps-cam" onClick={() => setCam(true)} aria-label="Scanner avec la caméra"><Camera size={18} /></button>
      </div>
      <label className="ps-field ps-field--big"><span>Nom du produit</span><input ref={nameRef} value={f.name} onChange={set('name')} placeholder="Ex. Écran iPhone 13 OLED" autoFocus /></label>
      {(guess.category || guess.brand || guess.qualityGrade) && !f.category && <div className="ps-chips" aria-live="polite"><Sparkles size={13} />{[guess.category, guess.brand, guess.qualityGrade].filter(Boolean).map(x => <span key={x}>{x}</span>)}<small>détecté automatiquement</small></div>}
      <div className="ps-row">
        <label className="ps-field"><span>Prix de vente</span><div className="ps-money"><input value={f.price} onChange={set('price')} inputMode="decimal" placeholder="0" /><b>DT</b></div></label>
        <label className="ps-field"><span>Stock</span><div className="ps-stepper"><button type="button" onClick={() => setF(p => ({ ...p, stock: String(Math.max(0, Number(p.stock || 0) - 1)) }))}>−</button><input value={f.stock} onChange={set('stock')} inputMode="numeric" placeholder="0" /><button type="button" onClick={() => setF(p => ({ ...p, stock: String(Number(p.stock || 0) + 1) }))}>+</button></div></label>
      </div>
      <button type="button" className={'ps-more' + (more ? ' on' : '')} onClick={() => setMore(m => !m)} aria-expanded={more}>Plus d’options <small>coût, photo, catégorie…</small><ChevronDown size={16} /></button>
      {more && <div className="ps-extra">
        <div className="ps-row">
          <label className="ps-field"><span>Coût d’achat</span><input value={f.purchasePrice} onChange={set('purchasePrice')} inputMode="decimal" placeholder="0" /></label>
          <label className="ps-field"><span>Prix grossiste</span><input value={f.wholesalePrice} onChange={set('wholesalePrice')} inputMode="decimal" placeholder="—" /></label>
        </div>
        {Number.isFinite(margin) && parseAmount(f.purchasePrice) > 0 && <div className={'ps-margin' + (margin < 0 ? ' neg' : '')}>Marge {money(margin)} · {Math.round(margin / Math.max(parseAmount(f.price), 0.001) * 100)} %</div>}
        <div className="ps-row">
          <label className="ps-field"><span>Catégorie</span><input list="ps-cats" value={f.category} onChange={set('category')} placeholder={guess.category || 'Automatique'} /></label>
          <label className="ps-field"><span>Marque</span><input value={f.brand} onChange={set('brand')} placeholder={guess.brand || 'Automatique'} /></label>
        </div>
        <datalist id="ps-cats">{categories.map(c => <option key={c} value={c} />)}</datalist>
        <div className="ps-row ps-row--3">
          <label className="ps-field"><span>Qualité</span><input value={f.qualityGrade} onChange={set('qualityGrade')} placeholder={guess.qualityGrade || '—'} /></label>
          <label className="ps-field"><span>Stock minimum</span><input value={f.minStock} onChange={set('minStock')} inputMode="numeric" placeholder="0" /></label>
          <label className="ps-field"><span>Garantie (jours)</span><input value={f.warrantyDays} onChange={set('warrantyDays')} inputMode="numeric" placeholder="0" /></label>
        </div>
        <div className="ps-row">
          <label className="ps-field"><span>Emplacement</span><input value={f.location} onChange={set('location')} placeholder="Ex. Tiroir A3" /></label>
          <label className="ps-field"><span>SKU</span><input value={f.sku} onChange={set('sku')} placeholder="Automatique" /></label>
        </div>
        <label className="ps-photo">{f.imageUrl ? <img src={f.imageUrl} alt="" /> : <Boxes size={22} />}<span><b>{f.imageUrl ? 'Changer la photo' : 'Ajouter une photo'}</b><small>Appareil photo ou galerie</small></span>
          <input type="file" accept="image/*" capture="environment" onChange={async e => { const file = e.target.files?.[0]; if (file) { try { const imageUrl = await compressProductImage(file); setF(p => ({ ...p, imageUrl })); } catch (x: any) { setErr(x.message); } } }} /></label>
      </div>}
      {err && <div className="ps-err" role="alert">{err}</div>}
      <button className="ps-save" disabled={busy}>{busy ? <Loader2 size={18} className="ps-spin" /> : <Plus size={18} />} Ajouter le produit <kbd>Entrée</kbd></button>
    </form>}

    {mode === 'series' && <div className="ps-series">
      <p className="ps-help">Une ligne = un produit. <b>Tab</b> pour passer à la case suivante. Vous pouvez <b>coller</b> directement des lignes copiées depuis Excel.</p>
      {grid}
    </div>}

    {mode === 'import' && <div className="ps-series">
      <div className="ps-import">
        <a className="btn btn-soft" href="/api/supplier/products/template"><Download size={16} /> Modèle Excel</a>
        <label className="ps-drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void importFile(e.dataTransfer.files?.[0]); }}>
          <Upload size={20} /><span><b>Choisir un fichier Excel ou CSV</b><small>ou le glisser ici · colonnes : code-barres, nom, prix, stock, coût</small></span>
          <input ref={fileRef} type="file" accept=".xlsx,.csv,.txt" onChange={e => void importFile(e.target.files?.[0])} />
        </label>
      </div>
      {filled.length > 0 && grid}
    </div>}

    {mode !== 'quick' && <>
      {report && <div className="ps-report"><Check size={16} /> {report.created} créé(s) · {report.updated} mis à jour{report.errors.length ? ` · ${report.errors.length} à corriger ci-dessous` : ''}</div>}
      {err && <div className="ps-err" role="alert">{err}</div>}
      <div className="ps-foot"><span>{filled.length} ligne(s){invalid ? ` · ${invalid} à corriger` : ''}</span>
        <button className="ps-save" disabled={busy || !filled.length} onClick={() => void saveRows(mode === 'import' ? 'excel' : 'serie')}>{busy ? <Loader2 size={18} className="ps-spin" /> : <Check size={18} />} Enregistrer {filled.length || ''} produit(s)</button></div>
    </>}

    {cam && <BarcodeCamera kicker="NOUVEAU PRODUIT" title="Scanner le produit" text="Fixi vérifie votre catalogue puis le réseau pour pré-remplir la fiche." submitLabel="Valider" onClose={() => setCam(false)} onDetected={code => { setCam(false); void lookup(code); }} />}
  </section>;
}
