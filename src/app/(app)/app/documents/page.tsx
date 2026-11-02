'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { api, useApi } from '@/components/ui';
import { FxSheet } from '@/components/fx-sheet';
import { dateOnly, money } from '@/lib/format';
import { CircleDollarSign, FilePlus2, FileText, Plus, Search, Trash2, FileCheck2, ChevronRight } from 'lucide-react';

const tl: Record<string, string> = { QUOTE: 'Devis', INVOICE: 'Facture', CREDIT_NOTE: 'Avoir' };
const sl: Record<string, [string, string]> = { DRAFT: ['Brouillon', 'muted'], SENT: ['Envoyé', 'info'], APPROVED: ['Accepté', 'ok'], REJECTED: ['Refusé', 'danger'], CONVERTED: ['Converti', 'muted'], PARTIALLY_PAID: ['Payé en partie', 'warning'], PAID: ['Payé', 'ok'], CANCELLED: ['Annulé', 'muted'], EXPIRED: ['Expiré', 'muted'] };
const blank = () => ({ type: 'QUOTE', clientId: '', repairId: '', discount: 0, taxRate: 0, notes: '', validUntil: '', lines: [{ description: '', quantity: 1, unitPrice: 0 }] });

// Devis & factures : ce qui reste à encaisser en tête, chaque document en une ligne lisible.
export default function Documents() {
  const [refresh, setRefresh] = useState(0);
  const { data: docs, loading } = useApi<any[]>('/api/documents', refresh);
  const { data: clients } = useApi<any[]>('/api/clients');
  const { data: repairs } = useApi<any[]>('/api/repairs?limit=300');
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [type, setType] = useState('ALL');
  const [f, setF] = useState<any>(blank());
  const all = useMemo(() => (docs || []).map((d: any) => {
    const source = d.repair?.payments?.length ? d.repair.payments : (d.payments || []);
    const paid = source.reduce((a: number, p: any) => a + (p.kind === 'REFUND' ? -Number(p.amount) : Number(p.amount)), 0);
    return { ...d, paid, balance: Math.max(0, Number(d.total) - paid) };
  }), [docs]);
  const unpaid = (d: any) => d.type === 'INVOICE' && d.balance > 0 && d.status !== 'CANCELLED';
  const rows = all.filter((d: any) => type === 'ALL' || (type === 'UNPAID' ? unpaid(d) : d.type === type))
    .filter((d: any) => !q || `${d.number} ${d.client?.fullName} ${d.repair?.code || ''}`.toLowerCase().includes(q.toLowerCase()));
  const k = { quotes: all.filter((x: any) => x.type === 'QUOTE' && ['DRAFT', 'SENT'].includes(x.status)).length, open: all.filter(unpaid).reduce((a: number, x: any) => a + x.balance, 0), unpaidCount: all.filter(unpaid).length, paid: all.filter((x: any) => x.type === 'INVOICE').reduce((a: number, x: any) => a + x.paid, 0) };
  const total = f.lines.reduce((a: number, l: any) => a + Number(l.quantity || 0) * Number(l.unitPrice || 0), 0) - Number(f.discount || 0);

  function line(i: number, key: string, v: any) { const lines = [...f.lines]; lines[i] = { ...lines[i], [key]: v }; setF({ ...f, lines }); }
  function pickRepair(id: string) {
    const r = (repairs || []).find((x: any) => x.id === id);
    if (!r) return setF({ ...f, repairId: id });
    setF({ ...f, repairId: id, clientId: r.clientId || r.client?.id || f.clientId, lines: [{ description: `Réparation ${r.code} — ${[r.brand, r.model].filter(Boolean).join(' ')}`, quantity: 1, unitPrice: Number(r.finalPrice || r.estimatedPrice || 0) }] });
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    try { const x = await api('/api/documents', { method: 'POST', body: JSON.stringify(f) }); setOpen(false); setF(blank()); setRefresh(v => v + 1); location.href = `/app/documents/${x.id}`; } catch (err: any) { alert(err.message); }
  }

  return <div className="fx-page">
    <div className="fx-hello"><div><h1>Devis & factures</h1><p>Créer, envoyer, encaisser et imprimer.</p></div>
      <button className="btn btn-primary" onClick={() => setOpen(true)}><FilePlus2 size={18} /> Nouveau document</button></div>

    <section className="fx-kpis" aria-label="Résumé">
      <button type="button" className={`fx-kpi ${k.open > 0 ? 'fx-kpi--due' : ''}`} onClick={() => setType('UNPAID')}><CircleDollarSign /><div><span>À encaisser</span><strong>{money(k.open)}</strong></div></button>
      <button type="button" className="fx-kpi" onClick={() => setType('QUOTE')}><FileCheck2 /><div><span>Devis en attente</span><strong>{k.quotes}</strong></div></button>
      <div className="fx-kpi"><FileText /><div><span>Encaissé factures</span><strong>{money(k.paid)}</strong></div></div>
    </section>

    <div className="fx-toolbar">
      <div className="fx-searchbar"><Search size={18} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Numéro, client, réparation…" aria-label="Rechercher un document" /></div>
      <div className="fx-filter-chips" role="group" aria-label="Filtrer">
        {[['ALL', 'Tous'], ['UNPAID', 'Non payées'], ['QUOTE', 'Devis'], ['INVOICE', 'Factures']].map(([v, l]) => <button type="button" key={v} aria-pressed={type === v} onClick={() => setType(v)} data-tone={v === 'UNPAID' ? 'danger' : undefined}>{l}{v === 'UNPAID' && k.unpaidCount > 0 && <b>{k.unpaidCount}</b>}</button>)}
      </div>
    </div>

    {loading && !docs ? <div className="card card-pad fx-skeleton" role="status" aria-label="Chargement"><i /><i /><i /></div> :
      <div className="fx-list">
        {rows.map((d: any) => { const [l, tone] = sl[d.status] || [d.status, 'muted']; return <Link key={d.id} href={`/app/documents/${d.id}`} className={`fx-row ${unpaid(d) ? 'fx-row--warning' : ''}`}>
          <FileText />
          <span className="fx-row-main"><b>{tl[d.type] || d.type} {d.number} · {d.client?.fullName}</b><small>{dateOnly(d.issuedAt)}{d.repair?.code ? ` · ${d.repair.code}` : ''}{d.type === 'INVOICE' ? ` · payé ${money(d.paid)}` : ''}</small></span>
          <span className="fx-doc-amount"><strong>{money(d.total)}</strong>{unpaid(d) && <small>reste {money(d.balance)}</small>}</span>
          <span className={`fx-chip fx-chip--${tone}`}>{l}</span>
          <ChevronRight size={18} />
        </Link>; })}
        {!rows.length && <div className="fx-empty"><b>{type === 'UNPAID' ? 'Tout est encaissé' : 'Aucun document'}</b><span>{type === 'UNPAID' ? 'Aucune facture ne reste à payer.' : 'Créez un devis ou une facture, avec ou sans réparation liée.'}</span>{type !== 'UNPAID' && <button className="btn btn-primary" onClick={() => setOpen(true)}><FilePlus2 size={18} /> Nouveau document</button>}</div>}
      </div>}

    <FxSheet open={open} onClose={() => setOpen(false)} side="bottom" title="Nouveau devis ou facture" label="Nouveau document">
      <form onSubmit={create} className="fx-form-stack">
        <div className="fx-segment" role="radiogroup" aria-label="Type">{[['QUOTE', 'Devis'], ['INVOICE', 'Facture']].map(([v, l]) => <button type="button" role="radio" key={v} aria-checked={f.type === v} onClick={() => setF({ ...f, type: v })}>{l}</button>)}</div>
        <label className="field"><span className="label">Réparation liée (remplit le client et la ligne)</span><select className="select" value={f.repairId} onChange={e => pickRepair(e.target.value)}><option value="">Aucune</option>{(repairs || []).map((r: any) => <option key={r.id} value={r.id}>{r.code} — {r.client?.fullName} — {r.brand} {r.model}</option>)}</select></label>
        <label className="field"><span className="label">Client *</span><select className="select" required value={f.clientId} onChange={e => setF({ ...f, clientId: e.target.value })}><option value="">Choisir…</option>{(clients || []).map((c: any) => <option key={c.id} value={c.id}>{c.fullName} — {c.phone}</option>)}</select></label>
        <div className="fx-lines">
          <div className="fx-lines-head"><b>Lignes</b><button type="button" className="btn btn-soft btn-sm" onClick={() => setF({ ...f, lines: [...f.lines, { description: '', quantity: 1, unitPrice: 0 }] })}><Plus size={15} /> Ajouter</button></div>
          {f.lines.map((l: any, i: number) => <div className="fx-line" key={i}>
            <input className="input" required value={l.description} onChange={e => line(i, 'description', e.target.value)} placeholder="Description" aria-label="Description" />
            <input className="input" type="number" min="0.001" step="0.001" value={l.quantity} onChange={e => line(i, 'quantity', Number(e.target.value))} aria-label="Quantité" />
            <input className="input" type="number" min="0" step="0.001" value={l.unitPrice} onChange={e => line(i, 'unitPrice', Number(e.target.value))} aria-label="Prix unitaire" />
            {f.lines.length > 1 && <button type="button" className="fx-icon-btn" aria-label="Supprimer la ligne" onClick={() => setF({ ...f, lines: f.lines.filter((_: any, n: number) => n !== i) })}><Trash2 size={16} /></button>}
          </div>)}
        </div>
        <div className="fx-form-grid">
          <label className="field"><span className="label">Remise</span><input className="input" type="number" min="0" step="0.001" value={f.discount} onChange={e => setF({ ...f, discount: Number(e.target.value) })} /></label>
          <label className="field"><span className="label">Taxe %</span><input className="input" type="number" min="0" step="0.01" value={f.taxRate} onChange={e => setF({ ...f, taxRate: Number(e.target.value) })} /></label>
          {f.type === 'QUOTE' && <label className="field span-2"><span className="label">Valable jusqu’au</span><input className="input" type="date" value={f.validUntil} onChange={e => setF({ ...f, validUntil: e.target.value })} /></label>}
          <label className="field span-2"><span className="label">Notes</span><textarea className="textarea" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></label>
        </div>
        <p className="fx-doc-total">Total hors taxe : <b>{money(Math.max(0, total))}</b></p>
        <button className="btn btn-primary btn-block">Créer {f.type === 'QUOTE' ? 'le devis' : 'la facture'}</button>
      </form>
    </FxSheet>
  </div>;
}
