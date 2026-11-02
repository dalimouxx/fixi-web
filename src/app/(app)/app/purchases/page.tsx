'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Plus, Trash2, PackagePlus, Truck, PackageOpen } from 'lucide-react';
import { api, useApi } from '@/components/ui';
import { FxSheet } from '@/components/fx-sheet';
import { dateOnly, money } from '@/lib/format';

const blank = () => ({ supplierId: '', reference: '', notes: '', items: [{ inventoryItemId: '', quantity: 1, unitCost: 0 }] });

// Achats hors Fixi (pièces achetées au comptoir, chez un grossiste…) : la réception remet le stock à jour.
export default function Purchases() {
  const [refresh, setRefresh] = useState(0);
  const [open, setOpen] = useState(false);
  const { data, loading } = useApi<any[]>('/api/purchases', refresh);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [stock, setStock] = useState<any[]>([]);
  const [f, setF] = useState<any>(blank());
  useEffect(() => { fetch('/api/suppliers').then(r => r.ok ? r.json() : []).then(setSuppliers).catch(() => {}); fetch('/api/stock').then(r => r.ok ? r.json() : []).then(setStock).catch(() => {}); }, [refresh]);
  const rows = data || [];
  const month = rows.filter(p => { const d = new Date(p.createdAt), n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); }).reduce((a, p) => a + Number(p.total || 0), 0);
  const total = f.items.reduce((a: number, x: any) => a + Number(x.quantity) * Number(x.unitCost), 0);
  function item(i: number, k: string, v: any) { const a = [...f.items]; a[i] = { ...a[i], [k]: v }; setF({ ...f, items: a }); }
  async function save(e: React.FormEvent) { e.preventDefault(); try { await api('/api/purchases', { method: 'POST', body: JSON.stringify(f) }); setOpen(false); setF(blank()); setRefresh(x => x + 1); } catch (err: any) { alert(err.message); } }

  return <div className="fx-page">
    <div className="fx-hello"><div><h1>Achats</h1><p>Pièces achetées hors Fixi : à la réception, le stock est mis à jour.</p></div>
      <button className="btn btn-primary" onClick={() => setOpen(true)}><PackagePlus size={18} /> Recevoir un achat</button></div>

    <section className="fx-kpis" aria-label="Résumé">
      <div className="fx-kpi"><PackagePlus /><div><span>Achats ce mois</span><strong>{money(month)}</strong></div></div>
      <div className="fx-kpi"><Truck /><div><span>Réceptions</span><strong>{rows.length}</strong></div></div>
      <Link href="/app/suppliers" className="fx-kpi"><PackageOpen /><div><span>Commander sur Fixi</span><strong className="fx-kpi-link">Fournisseurs →</strong></div></Link>
    </section>

    {loading && !data ? <div className="card card-pad fx-skeleton" role="status" aria-label="Chargement"><i /><i /></div> :
      <div className="fx-list" style={{ marginTop: 12 }}>
        {rows.map(p => <div key={p.id} className="fx-row"><Truck /><span className="fx-row-main"><b>{p.supplier?.name || 'Fournisseur non renseigné'} · {p.items.length} article{p.items.length > 1 ? 's' : ''}</b><small><span className="mono">{p.reference}</span> · {dateOnly(p.createdAt)}</small></span><strong className="fx-amount">{money(p.total)}</strong></div>)}
        {!rows.length && <div className="fx-empty"><b>Aucun achat enregistré</b><span>Quand vous achetez des pièces au comptoir ou chez un grossiste, enregistrez-les ici pour garder le stock juste.</span><button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={18} /> Recevoir un achat</button></div>}
      </div>}

    <FxSheet open={open} onClose={() => setOpen(false)} side="bottom" title="Recevoir un achat" label="Recevoir un achat">
      <form onSubmit={save} className="fx-form-stack">
        <div className="fx-form-grid">
          <label className="field"><span className="label">Fournisseur</span><select className="select" value={f.supplierId} onChange={e => setF({ ...f, supplierId: e.target.value })}><option value="">Non renseigné</option>{suppliers.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
          <label className="field"><span className="label">Référence (facture, bon)</span><input className="input" value={f.reference} onChange={e => setF({ ...f, reference: e.target.value })} placeholder="Automatique si vide" /></label>
        </div>
        <div className="fx-lines">
          <div className="fx-lines-head"><b>Pièces reçues</b><button type="button" className="btn btn-soft btn-sm" onClick={() => setF({ ...f, items: [...f.items, { inventoryItemId: '', quantity: 1, unitCost: 0 }] })}><Plus size={15} /> Ajouter</button></div>
          {f.items.map((it: any, i: number) => <div className="fx-line" key={i}>
            <select className="select" required value={it.inventoryItemId} aria-label="Pièce" onChange={e => { const id = e.target.value; const x = stock.find(s => s.id === id); const a = [...f.items]; a[i] = { ...a[i], inventoryItemId: id, unitCost: x ? Number(x.purchasePrice) : a[i].unitCost }; setF({ ...f, items: a }); }}><option value="">Choisir la pièce…</option>{stock.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}</select>
            <input className="input" type="number" min="1" value={it.quantity} aria-label="Quantité" onChange={e => item(i, 'quantity', Number(e.target.value))} />
            <input className="input" type="number" step="0.001" min="0" value={it.unitCost} aria-label="Prix unitaire" onChange={e => item(i, 'unitCost', Number(e.target.value))} />
            {f.items.length > 1 && <button type="button" className="fx-icon-btn" aria-label="Retirer la ligne" onClick={() => setF({ ...f, items: f.items.filter((_: any, j: number) => j !== i) })}><Trash2 size={16} /></button>}
          </div>)}
          {!stock.length && <p className="fx-form-hint" style={{ color: 'var(--fx-muted)' }}>Ajoutez d’abord vos pièces dans <Link href="/app/stock">Stock</Link>.</p>}
        </div>
        <p className="fx-doc-total">Total : <b>{money(total)}</b></p>
        <button className="btn btn-primary btn-block"><PackagePlus size={18} /> Recevoir et mettre le stock à jour</button>
      </form>
    </FxSheet>
  </div>;
}
