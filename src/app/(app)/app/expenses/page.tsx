'use client';
import { useMemo, useState } from 'react';
import { Plus, ReceiptText, Home, Zap, Wifi, Users, Truck, Megaphone, ShoppingBag, MoreHorizontal, CalendarDays } from 'lucide-react';
import { api, useApi } from '@/components/ui';
import { FxSheet } from '@/components/fx-sheet';
import { dateOnly, money } from '@/lib/format';

const cats: [string, any][] = [['Loyer', Home], ['Électricité', Zap], ['Internet', Wifi], ['Salaires', Users], ['Transport', Truck], ['Marketing', Megaphone], ['Achat divers', ShoppingBag], ['Autre', MoreHorizontal]];
const iconOf = (c: string) => (cats.find(x => x[0] === c) || cats[7])[1];
const blank = () => ({ category: 'Autre', label: '', amount: '', expenseDate: new Date().toISOString().slice(0, 10), note: '', fromCash: false });

// Dépenses : ajout en trois touchers (catégorie, montant, enregistrer), total du mois en tête.
export default function Expenses() {
  const [refresh, setRefresh] = useState(0);
  const [open, setOpen] = useState(false);
  const { data, loading } = useApi<any[]>('/api/expenses', refresh);
  const [f, setF] = useState<any>(blank());
  const [editId, setEditId] = useState<string | null>(null);
  const rows = data || [];
  const now = new Date();
  const monthRows = rows.filter(x => { const d = new Date(x.expenseDate); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
  const month = monthRows.reduce((a, x) => a + Number(x.amount), 0);
  const byCat = useMemo(() => { const m: Record<string, number> = {}; for (const x of monthRows) m[x.category] = (m[x.category] || 0) + Number(x.amount); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 4); }, [monthRows]);
  const groups = useMemo(() => { const g: Record<string, any[]> = {}; for (const x of rows) { const k = new Date(x.expenseDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); (g[k] ||= []).push(x); } return Object.entries(g); }, [rows]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editId) await api('/api/expenses/' + editId, { method: 'PATCH', body: JSON.stringify({ category: f.category, label: f.label || f.category, amount: f.amount, expenseDate: f.expenseDate, note: f.note }) });
      else await api('/api/expenses', { method: 'POST', body: JSON.stringify({ ...f, label: f.label || f.category }) });
      close(); setRefresh(x => x + 1);
    } catch (err: any) { alert(err.message); }
  }
  function close() { setOpen(false); setEditId(null); setF(blank()); }
  function openEdit(x: any) { setEditId(x.id); setF({ category: x.category, label: x.label, amount: String(Number(x.amount)), expenseDate: String(x.expenseDate).slice(0, 10), note: x.note || '', fromCash: !!x.cashSession }); setOpen(true); }
  async function remove() {
    if (!editId || !confirm('Supprimer cette dépense ?')) return;
    try { await api('/api/expenses/' + editId, { method: 'DELETE' }); close(); setRefresh(x => x + 1); } catch (err: any) { alert(err.message); }
  }

  return <div className="fx-page">
    <div className="fx-hello"><div><h1>Dépenses</h1><p>Ce qui sort de l’atelier, pour connaître votre vrai bénéfice.</p></div>
      <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={18} /> Ajouter une dépense</button></div>

    <section className="fx-panel fx-expense-month">
      <div><span>Ce mois-ci</span><strong>{money(month)}</strong><small>{monthRows.length} dépense{monthRows.length > 1 ? 's' : ''}</small></div>
      {byCat.length > 0 && <ul>{byCat.map(([c, v]) => { const I = iconOf(c); return <li key={c}><I size={16} /><span>{c}</span><b>{money(v)}</b><i style={{ width: `${Math.max(6, Math.round(v / month * 100))}%` }} /></li>; })}</ul>}
    </section>

    {loading && !data ? <div className="card card-pad fx-skeleton" role="status" aria-label="Chargement"><i /><i /><i /></div> :
      groups.length ? groups.map(([k, list]) => <section key={k} className="fx-panel" style={{ marginTop: 12 }}>
        <div className="fx-panel-head"><h2 className="fx-cap">{k}</h2><strong>{money(list.reduce((a: number, x: any) => a + Number(x.amount), 0))}</strong></div>
        <div className="fx-list">{list.map((x: any) => { const I = iconOf(x.category); return <div key={x.id} className="fx-row"><I /><span className="fx-row-main" role="button" tabIndex={0} style={{ cursor: 'pointer' }} title="Modifier ou supprimer" onClick={() => openEdit(x)} onKeyDown={e => { if (e.key === 'Enter') openEdit(x); }}><b>{x.label}</b><small>{x.category} · {dateOnly(x.expenseDate)}{x.cashSession ? ' · sorti de la caisse' : ''}{x.note ? ` · ${x.note}` : ''}</small></span><strong className="fx-amount">−{money(x.amount)}</strong></div>; })}</div>
      </section>) : <div className="fx-empty" style={{ marginTop: 12 }}><b>Aucune dépense</b><span>Loyer, électricité, transport… ajoutez-les pour voir votre bénéfice réel.</span><button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={18} /> Ajouter une dépense</button></div>}

    <FxSheet open={open} onClose={close} side="bottom" title={editId ? 'Modifier la dépense' : 'Nouvelle dépense'} label="Dépense">
      <form onSubmit={save} className="fx-form-stack">
        <div className="fx-cat-grid" role="radiogroup" aria-label="Catégorie">{cats.map(([c, I]) => <button type="button" role="radio" key={c} aria-checked={f.category === c} onClick={() => setF({ ...f, category: c })}><I size={20} /><span>{c}</span></button>)}</div>
        <label className="field"><span className="label">Montant *</span><input className="input fx-input-big" required type="number" inputMode="decimal" step="0.001" min="0.001" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} placeholder="0" /></label>
        <label className="field"><span className="label">Libellé</span><input className="input" value={f.label} onChange={e => setF({ ...f, label: e.target.value })} placeholder={f.category} /></label>
        <label className="field"><span className="label"><CalendarDays size={14} /> Date</span><input type="date" className="input" value={f.expenseDate} onChange={e => setF({ ...f, expenseDate: e.target.value })} /></label>
        {!editId && <label className="fx-check"><input type="checkbox" checked={!!f.fromCash} onChange={e => setF({ ...f, fromCash: e.target.checked })} /><span><b>Payée avec l’argent de la caisse</b><small>Déduite du montant attendu à la fermeture.</small></span></label>}
        <button className="btn btn-primary btn-block"><ReceiptText size={18} /> Enregistrer</button>
        {editId && <button type="button" className="btn btn-ghost btn-block fx-danger-text" onClick={remove}>Supprimer la dépense</button>}
      </form>
    </FxSheet>
  </div>;
}
