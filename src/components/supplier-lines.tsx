'use client';
import { useEffect, useMemo, useState } from 'react';
import { Layers, Loader2, Plus, Printer, Search, Wallet } from 'lucide-react';
import { money } from '@/lib/format';
import { humanError } from '@/lib/human-error';

/**
 * Lignes de produits (ex. « MG » : produits d'un importateur en dépôt-vente).
 * Chaque ligne a ses ventes, son bénéfice, sa recette par jour, le dû de ses clients et, en dépôt-vente,
 * ce que le fournisseur doit au propriétaire. Un panier mélangé est séparé automatiquement.
 */
const today = () => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Africa/Tunis' }).format(new Date());
const shift = (d: string, days: number) => new Date(new Date(d + 'T12:00:00Z').getTime() + days * 86400000).toISOString().slice(0, 10);
const frDay = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });

async function call(url: string, init?: RequestInit) {
  const r = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Erreur');
  return j;
}

export function SupplierLines({ canEdit, canPay }: { canEdit: boolean; canPay: boolean }) {
  const [data, setData] = useState<{ ownProducts: number; lines: any[] } | null>(null);
  const [line, setLine] = useState('all');
  const [from, setFrom] = useState(today()), [to, setTo] = useState(today());
  const [rep, setRep] = useState<any>(null), [busy, setBusy] = useState(false), [err, setErr] = useState(''), [msg, setMsg] = useState('');
  const [n, setN] = useState(0);
  const [form, setForm] = useState({ name: '', tag: '', consignment: true });
  const [pay, setPay] = useState({ amount: '', method: 'CASH', note: '' });

  useEffect(() => { call('/api/supplier/lines').then(setData).catch(e => setErr(humanError(e))); }, [n]);
  useEffect(() => {
    setBusy(true); setErr('');
    call(`/api/supplier/lines/report?line=${encodeURIComponent(line)}&from=${from}&to=${to}`).then(setRep).catch(e => { setRep(null); setErr(humanError(e)); }).finally(() => setBusy(false));
  }, [line, from, to, n]);

  const current = data?.lines.find(l => l.id === line);
  const label = line === 'all' ? 'Toutes les lignes' : line === 'own' ? 'Mes produits' : current ? `${current.tag} · ${current.name}` : '';

  async function createLine(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setMsg('');
    try { const x = await call('/api/supplier/lines', { method: 'POST', body: JSON.stringify(form) }); setForm({ name: '', tag: '', consignment: true }); setMsg(`Ligne ${x.tag} créée. Rangez-y ses produits ci-dessous.`); setLine(x.id); setN(v => v + 1); }
    catch (x) { setErr(humanError(x)); }
  }
  async function payOwner(e: React.FormEvent) {
    e.preventDefault(); if (!current) return; setErr(''); setMsg('');
    try {
      const x = await call(`/api/supplier/lines/${current.id}/payment`, { method: 'POST', body: JSON.stringify(pay) });
      setPay({ amount: '', method: 'CASH', note: '' });
      setMsg(`Paiement de ${money(x.amount)} à ${current.tag} enregistré${x.fromCash ? ' (sorti de la caisse ouverte)' : ''}.`); setN(v => v + 1);
    } catch (x) { setErr(humanError(x)); }
  }

  return <section className="supplier-panel sl-lines">
    <div className="supplier-section-head"><div><b><Layers size={16} /> Lignes de produits</b><span>Vos produits et ceux d’un importateur (ex. MG) séparés : ventes, bénéfice, recette du jour, dû des clients. Un panier mélangé est séparé automatiquement.</span></div>
      <button type="button" className="btn btn-soft btn-sm no-print" onClick={() => window.print()}><Printer size={15} /> Imprimer</button></div>

    <div className="sl-chips no-print" role="tablist" aria-label="Choisir la ligne">
      {[['all', 'Tout'], ['own', `Mes produits${data ? ' · ' + data.ownProducts : ''}`], ...(data?.lines || []).map(l => [l.id, `${l.tag} · ${l.products}${l.consignment ? ' · dépôt-vente' : ''}${l.active ? '' : ' (inactive)'}`])].map(([id, t]) =>
        <button key={id} type="button" role="tab" aria-selected={line === id} className={line === id ? 'active' : ''} onClick={() => setLine(id)}>{t}</button>)}
    </div>

    <div className="sl-period no-print">
      <label>Du <input className="input" type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} /></label>
      <label>au <input className="input" type="date" value={to} min={from} onChange={e => setTo(e.target.value)} /></label>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setFrom(today()); setTo(today()); }}>Aujourd’hui</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setFrom(shift(today(), -6)); setTo(today()); }}>7 jours</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setFrom(today().slice(0, 8) + '01'); setTo(today()); }}>Ce mois</button>
    </div>

    {err && <p className="error" role="alert">{err}</p>}
    {msg && <p className="sl-ok" role="status">{msg}</p>}

    <h3 className="sl-title">{label} — {from === to ? frDay(from) : `du ${frDay(from)} au ${frDay(to)}`} {busy && <Loader2 size={15} className="ps-spin" />}</h3>
    {rep && <>
      <div className="sl-kpis">
        <div><span>Ventes</span><b>{money(rep.totals.sales)}</b><small>{rep.totals.count} vente(s)</small></div>
        <div><span>Encaissé (recette)</span><b>{money(rep.totals.collected)}</b><small>règlements de dettes compris</small></div>
        <div><span>Bénéfice</span><b>{money(rep.totals.profit)}</b><small>coût {money(rep.totals.cost)}</small></div>
        <div><span>Dû des clients</span><b>{money(rep.totals.due)}</b><small>aujourd’hui, toutes dates</small></div>
      </div>

      {rep.consignment && current && <div className="sl-owed">
        <div><Wallet size={18} /><div><b>À payer à {current.tag} : {money(rep.consignment.owed)}</b>
          <small>Vendu depuis le début au prix convenu : {money(rep.consignment.soldCost)} · déjà payé : {money(rep.consignment.paid)} · sur la période : {money(rep.consignment.periodCost)}</small></div></div>
        {canPay && <form className="sl-pay no-print" onSubmit={payOwner}>
          <input className="input" inputMode="decimal" placeholder="Montant (DT)" value={pay.amount} onChange={e => setPay({ ...pay, amount: e.target.value })} required />
          <select className="input" value={pay.method} onChange={e => setPay({ ...pay, method: e.target.value })}><option value="CASH">Espèces (sort de la caisse)</option><option value="TRANSFER">Virement</option><option value="CHEQUE">Chèque</option><option value="D17">D17</option></select>
          <input className="input" placeholder="Note (facultatif)" value={pay.note} onChange={e => setPay({ ...pay, note: e.target.value })} />
          <button className="btn btn-primary btn-sm">Payer {current.tag}</button>
        </form>}
      </div>}

      <div className="sl-grid">
        <div className="table-wrap"><table className="table"><thead><tr><th>Jour</th><th className="num">Ventes</th><th className="num">Encaissé</th><th className="num">Bénéfice</th></tr></thead>
          <tbody>{rep.days.length ? rep.days.map((d: any) => <tr key={d.date}><td>{frDay(d.date)}</td><td className="num">{money(d.sales)}</td><td className="num">{money(d.collected)}</td><td className="num">{money(d.profit)}</td></tr>)
            : <tr><td colSpan={4} className="muted">Aucune vente ni encaissement sur la période.</td></tr>}</tbody></table></div>
        <div className="table-wrap"><table className="table"><thead><tr><th>Client qui doit</th><th className="num">Dû</th></tr></thead>
          <tbody>{rep.customers.length ? rep.customers.slice(0, 30).map((c: any) => <tr key={c.id || 'comptoir'}><td>{c.name}</td><td className="num">{money(c.due)}</td></tr>)
            : <tr><td colSpan={2} className="muted">Aucun client ne doit rien sur cette ligne.</td></tr>}</tbody></table></div>
      </div>
    </>}

    {canEdit && <div className="sl-manage no-print">
      <AssignProducts lines={data?.lines || []} onDone={(t: string) => { setMsg(t); setN(v => v + 1); }} onError={(t: string) => setErr(t)} />
      <form className="sl-new" onSubmit={createLine}>
        <b><Plus size={15} /> Nouvelle ligne</b>
        <input className="input" placeholder="Nom (ex. Importateur MG)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
        <input className="input" placeholder="Étiquette (ex. MG)" maxLength={12} value={form.tag} onChange={e => setForm({ ...form, tag: e.target.value.toUpperCase() })} required />
        <label className="sl-check"><input type="checkbox" checked={form.consignment} onChange={e => setForm({ ...form, consignment: e.target.checked })} /> Dépôt-vente : je paie seulement ce que je vends</label>
        <button className="btn btn-primary btn-sm">Créer la ligne</button>
      </form>
    </div>}
  </section>;
}

/** Ranger des produits dans une ligne : recherche par nom, code-barres ou référence, puis cases à cocher. */
function AssignProducts({ lines, onDone, onError }: { lines: any[]; onDone: (t: string) => void; onError: (t: string) => void }) {
  const [products, setProducts] = useState<any[]>([]), [q, setQ] = useState(''), [sel, setSel] = useState<Set<string>>(new Set()), [target, setTarget] = useState('');
  useEffect(() => { fetch('/api/supplier/products').then(r => r.ok ? r.json() : []).then(j => setProducts(Array.isArray(j) ? j : j.rows || j.products || [])).catch(() => {}); }, []);
  const tagOf = useMemo(() => new Map(lines.map(l => [l.id, l.tag])), [lines]);
  const list = useMemo(() => { const t = q.trim().toLowerCase(); return products.filter(p => p.active !== false && (!t || [p.name, p.barcode, p.sku].some(v => String(v || '').toLowerCase().includes(t)))).slice(0, 60); }, [products, q]);
  async function apply() {
    if (!sel.size || !target) return;
    try {
      const j = await call('/api/supplier/lines/assign', { method: 'POST', body: JSON.stringify({ productIds: [...sel], lineId: target }) });
      setProducts(ps => ps.map(p => sel.has(p.id) ? { ...p, lineId: target === 'own' ? null : target } : p)); setSel(new Set());
      onDone(`${j.updated} produit(s) rangé(s) dans ${target === 'own' ? 'Mes produits' : tagOf.get(target)}.`);
    } catch (x) { onError(humanError(x)); }
  }
  return <div className="sl-assign">
    <b>Ranger des produits dans une ligne</b>
    <div className="sl-assign-bar">
      <label className="global-search"><Search size={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Nom, code-barres ou référence…" /></label>
      <select className="input" value={target} onChange={e => setTarget(e.target.value)}><option value="">Ranger dans…</option><option value="own">Mes produits</option>{lines.filter(l => l.active).map(l => <option key={l.id} value={l.id}>{l.tag} · {l.name}</option>)}</select>
      <button type="button" className="btn btn-primary btn-sm" disabled={!sel.size || !target} onClick={apply}>Ranger {sel.size || ''}</button>
    </div>
    <div className="sl-assign-list">{list.map(p => <label key={p.id} className={sel.has(p.id) ? 'on' : ''}>
      <input type="checkbox" checked={sel.has(p.id)} onChange={() => setSel(s => { const x = new Set(s); x.has(p.id) ? x.delete(p.id) : x.add(p.id); return x; })} />
      <span>{p.name}<small>{[p.barcode, p.sku].filter(Boolean).join(' · ')}</small></span>
      <em>{p.lineId ? tagOf.get(p.lineId) || '?' : 'Mes produits'}</em>
    </label>)}{!list.length && <p className="muted">Aucun produit trouvé.</p>}</div>
  </div>;
}
