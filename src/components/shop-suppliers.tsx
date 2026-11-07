'use client';
import { useEffect, useState } from 'react';
import { Pencil, Phone, Plus, Trash2, Truck, X } from 'lucide-react';
import { api } from './ui';

/** Atelier : mes fournisseurs (hors Fixi) — ajouter, corriger, supprimer. */
export function ShopSuppliersPanel({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<any[]>([]); const [n, setN] = useState(0);
  const [f, setF] = useState<any>(null); const [err, setErr] = useState('');
  useEffect(() => { fetch('/api/suppliers', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).then(setRows).catch(() => {}); }, [n]);
  const done = () => { setF(null); setN(x => x + 1); onChanged?.(); };
  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    try { if (f.id) await api('/api/suppliers/' + f.id, { method: 'PATCH', body: JSON.stringify(f) }); else await api('/api/suppliers', { method: 'POST', body: JSON.stringify(f) }); done(); }
    catch (x: any) { setErr(x.message); }
  }
  async function remove(x: any) {
    const used = x._count?.items || x._count?.purchases;
    if (!confirm(`Supprimer « ${x.name} » ?${used ? `\n\n${x._count.items} pièce(s) et ${x._count.purchases} achat(s) gardent leur historique, sans fournisseur.` : ''}`)) return;
    try { await api('/api/suppliers/' + x.id, { method: 'DELETE' }); done(); } catch (e: any) { alert(e.message); }
  }
  return <section className="fx-panel ssp">
    <div className="fx-panel-head"><h2 className="fx-cap"><Truck size={16} /> Mes fournisseurs</h2><button type="button" className="btn btn-soft btn-sm" onClick={() => setF({ name: '', phone: '', email: '', address: '', notes: '' })}><Plus size={15} /> Ajouter</button></div>
    {f && <form className="ssp-form" onSubmit={save}>
      <input className="input" required autoFocus placeholder="Nom *" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
      <input className="input" placeholder="Téléphone" value={f.phone || ''} onChange={e => setF({ ...f, phone: e.target.value })} />
      <input className="input" placeholder="E-mail" value={f.email || ''} onChange={e => setF({ ...f, email: e.target.value })} />
      <input className="input" placeholder="Adresse" value={f.address || ''} onChange={e => setF({ ...f, address: e.target.value })} />
      <div className="ssp-btns"><button className="btn btn-primary btn-sm">{f.id ? 'Enregistrer' : 'Ajouter'}</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => setF(null)}><X size={14} /></button></div>
      {err && <p className="error">{err}</p>}
    </form>}
    <div className="fx-list">{rows.map(x => <div key={x.id} className="fx-row">
      <span className="fx-row-main"><b>{x.name}</b><small>{[x.phone, x.address].filter(Boolean).join(' · ') || '—'} · {x._count?.items || 0} pièce(s) · {x._count?.purchases || 0} achat(s)</small></span>
      {x.phone && <a className="btn btn-ghost btn-sm" href={'tel:' + x.phone} aria-label="Appeler"><Phone size={14} /></a>}
      <button type="button" className="btn btn-ghost btn-sm" aria-label={'Modifier ' + x.name} onClick={() => setF({ ...x })}><Pencil size={14} /></button>
      <button type="button" className="btn btn-ghost btn-sm fx-danger-text" aria-label={'Supprimer ' + x.name} onClick={() => remove(x)}><Trash2 size={14} /></button>
    </div>)}{!rows.length && <p className="muted">Aucun fournisseur. Ajoutez ceux chez qui vous achetez hors Fixi.</p>}</div>
  </section>;
}
