'use client';
import { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Layers, Loader2, Plus, Printer, Search, Wallet } from 'lucide-react';
import { money } from '@/lib/format';
import { humanError } from '@/lib/human-error';

/**
 * Lignes de produits (ex. « SL » = produits du fournisseur, « MG » = produits d'un importateur en dépôt-vente).
 * Pour chaque ligne seule : ventes, pièces vendues, encaissé, dû des clients, rapport par jour et par dates,
 * stock (liste, quantités, valeur au coût), inventaire de la ligne. Bénéfice : seulement le barème par catégorie
 * saisi par le fournisseur (jamais prix − coût). Un panier mélangé est séparé automatiquement.
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

export function SupplierLines({ canEdit, canPay, onOpenInventory }: { canEdit: boolean; canPay: boolean; onOpenInventory?: () => void }) {
  const [data, setData] = useState<{ ownTag: string | null; ownProducts: number; lines: any[] } | null>(null);
  const [line, setLine] = useState('all');
  const [from, setFrom] = useState(today()), [to, setTo] = useState(today());
  const [rep, setRep] = useState<any>(null), [busy, setBusy] = useState(false), [err, setErr] = useState(''), [msg, setMsg] = useState('');
  const [n, setN] = useState(0);
  const [form, setForm] = useState({ name: '', tag: '', consignment: true });
  const [pay, setPay] = useState({ amount: '', method: 'CASH', note: '' });
  const [ownTag, setOwnTag] = useState('');
  const [scale, setScale] = useState<Record<string, string>>({});
  const [q, setQ] = useState('');
  const [split, setSplit] = useState<any[] | null>(null);
  useEffect(() => { if (line !== 'all') { setSplit(null); return; } call(`/api/supplier/lines/report?line=split&from=${from}&to=${to}`).then(j => setSplit(j.split)).catch(() => setSplit(null)); }, [line, from, to, n]);

  useEffect(() => { call('/api/supplier/lines').then(j => { setData(j); setOwnTag(j.ownTag || ''); }).catch(e => setErr(humanError(e))); }, [n]);
  useEffect(() => {
    setBusy(true); setErr('');
    call(`/api/supplier/lines/report?line=${encodeURIComponent(line)}&from=${from}&to=${to}`).then(setRep).catch(e => { setRep(null); setErr(humanError(e)); }).finally(() => setBusy(false));
  }, [line, from, to, n]);

  const current = data?.lines.find(l => l.id === line);
  const ownName = data?.ownTag || 'Mes produits';
  const label = line === 'all' ? 'Toutes les lignes' : line === 'own' ? ownName : current ? `${current.tag} · ${current.name}` : '';
  useEffect(() => { const c = current?.commissions || {}; setScale(Object.fromEntries((current?.categories || []).map((k: string) => [k, c[k] === undefined ? '' : String(c[k])]))); }, [current?.id, n]);
  const stockRows = useMemo(() => { const t = q.trim().toLowerCase(); return (rep?.stock?.items || []).filter((p: any) => !t || [p.name, p.barcode, p.sku, p.category].some(v => String(v || '').toLowerCase().includes(t))); }, [rep, q]);
  const showProfit = !!rep?.hasScale;

  const act = async (f: () => Promise<string>) => { setErr(''); setMsg(''); try { setMsg(await f()); setN(v => v + 1); } catch (x) { setErr(humanError(x)); } };
  const createLine = (e: React.FormEvent) => { e.preventDefault(); act(async () => { const x = await call('/api/supplier/lines', { method: 'POST', body: JSON.stringify(form) }); setForm({ name: '', tag: '', consignment: true }); setLine(x.id); return `Ligne ${x.tag} créée. Rangez-y ses produits ci-dessous.`; }); };
  const saveOwn = (e: React.FormEvent) => { e.preventDefault(); act(async () => { const x = await call('/api/supplier/lines', { method: 'PATCH', body: JSON.stringify({ ownTag }) }); return `Vos propres produits s’appellent maintenant « ${x.ownTag || 'Mes produits'} ».`; }); };
  const saveScale = (e: React.FormEvent) => { e.preventDefault(); if (!current) return; act(async () => { await call(`/api/supplier/lines/${current.id}`, { method: 'PATCH', body: JSON.stringify({ commissions: scale }) }); return `Barème de ${current.tag} enregistré.`; }); };
  const payOwner = (e: React.FormEvent) => { e.preventDefault(); if (!current) return; act(async () => { const x = await call(`/api/supplier/lines/${current.id}/payment`, { method: 'POST', body: JSON.stringify(pay) }); setPay({ amount: '', method: 'CASH', note: '' }); return `Paiement de ${money(x.amount)} à ${current.tag} enregistré${x.fromCash ? ' (sorti de la caisse ouverte)' : ''}.`; }); };
  const removeLine = () => { if (!current || !window.confirm(`Supprimer la ligne ${current.tag} ? Ses produits reviennent dans « ${ownName} ».`)) return; act(async () => { const x = await call(`/api/supplier/lines/${current.id}`, { method: 'DELETE' }); setLine('all'); return x.deleted ? `Ligne ${x.tag} supprimée (${x.productsMoved} produit(s) remis dans ${ownName}).` : `Ligne ${x.tag} désactivée : des paiements lui ont déjà été versés (historique gardé). ${x.productsMoved} produit(s) remis dans ${ownName}.`; }); };
  const startCount = () => act(async () => { await call('/api/supplier/advanced', { method: 'POST', body: JSON.stringify({ action: 'STOCK_COUNT_START', lineId: line, reference: 'INV-' + (line === 'own' ? (data?.ownTag || 'MOI') : current?.tag || 'L') + '-' + Date.now() }) }); onOpenInventory?.(); return `Inventaire de ${label} démarré : comptez les produits dans « Comptage du stock ».`; });

  return <section className="supplier-panel sl-lines">
    <div className="supplier-section-head"><div><b><Layers size={16} /> Lignes de produits</b><span>Chaque partie seule : ventes, pièces vendues, encaissé, dû des clients, stock et inventaire. Un panier mélangé est séparé automatiquement.</span></div>
      <button type="button" className="btn btn-soft btn-sm no-print" onClick={() => window.print()}><Printer size={15} /> Imprimer</button></div>

    <div className="sl-chips no-print" role="tablist" aria-label="Choisir la ligne">
      {([['all', 'Tout', null, false, true], ['own', ownName, data ? data.ownProducts : null, false, true], ...(data?.lines || []).map(l => [l.id, l.tag, l.products, l.consignment, l.active])] as [string, string, number | null, boolean, boolean][]).map(([id, t, count, consignment, active]) =>
        <button key={id} type="button" role="tab" aria-selected={line === id} className={line === id ? 'active' : ''} onClick={() => setLine(id)}><span>{t}</span>{count !== null && <span> · {count}</span>}{consignment && <span> · <span>dépôt-vente</span></span>}{!active && <span> <span>(inactive)</span></span>}</button>)}
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
    {split && split.length > 1 && <div className="table-wrap sl-split"><table className="table"><caption>Chaque partie seule</caption><thead><tr><th>Ligne</th><th className="num">Ventes</th><th className="num">Pièces</th><th className="num">Encaissé</th><th className="num">Dû des clients</th><th className="num">Stock</th><th className="num">Valeur du stock</th><th className="num">À payer</th></tr></thead>
      <tbody>{split.map((r: any) => <tr key={r.id}><td><button type="button" className="sl-split-tag" onClick={() => setLine(r.id)}>{r.id === 'own' ? (r.ownTag || 'Mes produits') : r.tag}</button></td><td className="num">{money(r.totals.sales)}</td><td className="num">{r.totals.units}</td><td className="num">{money(r.totals.collected)}</td><td className="num">{money(r.totals.due)}</td><td className="num">{r.stock.quantity}</td><td className="num">{money(r.stock.value)}</td><td className="num">{r.owed === null ? '—' : money(r.owed)}</td></tr>)}</tbody></table></div>}
    {rep && <>
      <div className="sl-kpis">
        <div><span>Ventes</span><b>{money(rep.totals.sales)}</b><small>{rep.totals.count} vente(s)</small></div>
        <div><span>Pièces vendues</span><b>{rep.totals.units}</b><small>sur la période</small></div>
        <div><span>Encaissé (recette)</span><b>{money(rep.totals.collected)}</b><small>règlements de dettes compris</small></div>
        <div><span>Dû des clients</span><b>{money(rep.totals.due)}</b><small>aujourd’hui, toutes dates</small></div>
        {showProfit && <div><span>Bénéfice (barème)</span><b>{money(rep.totals.profit)}</b><small>pièces × votre barème</small></div>}
      </div>

      {rep.consignment && current && <div className="sl-owed">
        <div><Wallet size={18} /><div><b>À payer à {current.tag} : {money(rep.consignment.owed)}</b>
          <small>Dû sur les pièces vendues : {money(rep.consignment.sold)} · retours : − {money(rep.consignment.returned)} · déjà payé : − {money(rep.consignment.paid)}<span>{showProfit ? ' · calcul : prix de vente − votre barème' : ' · calcul : prix convenu (coût) de chaque pièce'}</span></small></div></div>
        {canPay && <form className="sl-pay no-print" onSubmit={payOwner}>
          <input className="input" inputMode="decimal" placeholder="Montant (DT)" value={pay.amount} onChange={e => setPay({ ...pay, amount: e.target.value })} required />
          <select className="input" value={pay.method} onChange={e => setPay({ ...pay, method: e.target.value })}><option value="CASH">Espèces (sort de la caisse)</option><option value="TRANSFER">Virement</option><option value="CHEQUE">Chèque</option><option value="D17">D17</option></select>
          <input className="input" placeholder="Note (facultatif)" value={pay.note} onChange={e => setPay({ ...pay, note: e.target.value })} />
          <button className="btn btn-primary btn-sm">Payer {current.tag}</button>
        </form>}
      </div>}

      <div className="sl-grid">
        <div className="table-wrap"><table className="table"><thead><tr><th>Jour</th><th className="num">Ventes</th><th className="num">Pièces</th><th className="num">Encaissé</th>{showProfit && <th className="num">Bénéfice</th>}</tr></thead>
          <tbody>{rep.days.length ? rep.days.map((d: any) => <tr key={d.date}><td>{frDay(d.date)}</td><td className="num">{money(d.sales)}</td><td className="num">{d.units}</td><td className="num">{money(d.collected)}</td>{showProfit && <td className="num">{money(d.profit)}</td>}</tr>)
            : <tr><td colSpan={showProfit ? 5 : 4} className="muted">Aucune vente ni encaissement sur la période.</td></tr>}</tbody></table></div>
        <div className="table-wrap"><table className="table"><thead><tr><th>Client qui doit</th><th className="num">Dû</th></tr></thead>
          <tbody>{rep.customers.length ? rep.customers.slice(0, 50).map((c: any) => <tr key={c.id || 'comptoir'}><td>{c.name}</td><td className="num">{money(c.due)}</td></tr>)
            : <tr><td colSpan={2} className="muted">Aucun client ne doit rien sur cette ligne.</td></tr>}</tbody></table></div>
      </div>

      <div className="sl-stock">
        <div className="sl-stock-head">
          <b>Stock — {label}</b>
          <span>{rep.stock.products} produit(s) · {rep.stock.quantity} pièce(s) · valeur au coût {money(rep.stock.value)}</span>
          {canEdit && line !== 'all' && <button type="button" className="btn btn-soft btn-sm no-print" onClick={startCount}><ClipboardCheck size={15} /> Inventaire de cette ligne</button>}
        </div>
        <label className="global-search no-print"><Search size={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Chercher un produit de la ligne…" /></label>
        <div className="table-wrap"><table className="table"><thead><tr><th>Produit</th><th>Catégorie</th><th className="num">Stock</th><th className="num">Prix</th><th className="num">Coût</th><th className="num">Valeur</th></tr></thead>
          <tbody>{stockRows.length ? stockRows.slice(0, 300).map((p: any) => <tr key={p.id}><td>{p.name}<small className="muted sl-code">{[p.barcode, p.sku].filter(Boolean).join(' · ')}</small></td><td>{p.category || '—'}</td><td className="num">{p.stock}</td><td className="num">{money(p.price)}</td><td className="num">{money(p.cost)}</td><td className="num">{money(p.value)}</td></tr>)
            : <tr><td colSpan={6} className="muted">Aucun produit.</td></tr>}</tbody></table></div>
      </div>
    </>}

    {canEdit && current && <div className="sl-remove no-print"><button type="button" className="btn btn-ghost btn-sm" onClick={removeLine}>Supprimer la ligne {current.tag}</button><small className="muted">Ligne créée par erreur ? Ses produits reviennent dans « {ownName} ».</small></div>}
    {canEdit && current && (current.categories || []).length > 0 && <form className="sl-scale no-print" onSubmit={saveScale}>
      <b>Barème de bénéfice — {current.tag}</b>
      <small><span>Votre bénéfice par pièce vendue, par catégorie (ex. Écrans : 2 DT). Laissez vide pour utiliser le prix convenu (coût) de chaque produit.</span>{current.consignment && <> <span>Le reste du prix de vente revient à</span> {current.tag}.</>}</small>
      <div className="sl-scale-grid">{(current.categories || []).map((k: string) => <label key={k}><span>{k}</span><input className="input" inputMode="decimal" placeholder="—" value={scale[k] ?? ''} onChange={e => setScale({ ...scale, [k]: e.target.value })} /> DT</label>)}</div>
      <button className="btn btn-primary btn-sm">Enregistrer le barème</button>
    </form>}

    {canEdit && <div className="sl-manage no-print">
      <AssignProducts lines={data?.lines || []} ownName={ownName} onDone={(t: string) => { setMsg(t); setN(v => v + 1); }} onError={(t: string) => setErr(t)} />
      <div className="sl-side">
        <form className="sl-new" onSubmit={saveOwn}>
          <b>Nom de vos propres produits</b>
          <input className="input" placeholder="Ex. SL" maxLength={12} value={ownTag} onChange={e => setOwnTag(e.target.value.toUpperCase())} />
          <button className="btn btn-soft btn-sm">Enregistrer</button>
        </form>
        <form className="sl-new" onSubmit={createLine}>
          <b><Plus size={15} /> Nouvelle ligne</b>
          <input className="input" placeholder="Nom (ex. Importateur MG)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <input className="input" placeholder="Étiquette (ex. MG)" maxLength={12} value={form.tag} onChange={e => setForm({ ...form, tag: e.target.value.toUpperCase() })} required />
          <label className="sl-check"><input type="checkbox" checked={form.consignment} onChange={e => setForm({ ...form, consignment: e.target.checked })} /> Dépôt-vente : je paie seulement ce que je vends</label>
          <button className="btn btn-primary btn-sm">Créer la ligne</button>
        </form>
      </div>
    </div>}
  </section>;
}

/** Ranger des produits dans une ligne : recherche par nom, code-barres ou référence, puis cases à cocher. */
function AssignProducts({ lines, ownName, onDone, onError }: { lines: any[]; ownName: string; onDone: (t: string) => void; onError: (t: string) => void }) {
  const [products, setProducts] = useState<any[]>([]), [q, setQ] = useState(''), [sel, setSel] = useState<Set<string>>(new Set()), [target, setTarget] = useState('');
  useEffect(() => { fetch('/api/supplier/products').then(r => r.ok ? r.json() : []).then(j => setProducts(Array.isArray(j) ? j : [])).catch(() => {}); }, []);
  const tagOf = useMemo(() => new Map(lines.map(l => [l.id, l.tag])), [lines]);
  const list = useMemo(() => { const t = q.trim().toLowerCase(); return products.filter(p => p.active !== false && (!t || [p.name, p.barcode, p.sku].some(v => String(v || '').toLowerCase().includes(t)))).slice(0, 60); }, [products, q]);
  async function apply() {
    if (!sel.size || !target) return;
    try {
      const j = await call('/api/supplier/lines/assign', { method: 'POST', body: JSON.stringify({ productIds: [...sel], lineId: target }) });
      setProducts(ps => ps.map(p => sel.has(p.id) ? { ...p, lineId: target === 'own' ? null : target } : p)); setSel(new Set());
      onDone(`${j.updated} produit(s) rangé(s) dans ${target === 'own' ? ownName : tagOf.get(target)}.`);
    } catch (x) { onError(humanError(x)); }
  }
  return <div className="sl-assign">
    <b>Ranger des produits dans une ligne</b>
    <small className="muted">À faire avant de vendre : un produit compte dans sa ligne à partir du jour où il y est rangé.</small>
    <div className="sl-assign-bar">
      <label className="global-search"><Search size={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Nom, code-barres ou référence…" /></label>
      <select className="input" value={target} onChange={e => setTarget(e.target.value)}><option value="">Ranger dans…</option><option value="own">{ownName}</option>{lines.filter(l => l.active).map(l => <option key={l.id} value={l.id}>{l.tag} · {l.name}</option>)}</select>
      <button type="button" className="btn btn-primary btn-sm" disabled={!sel.size || !target} onClick={apply}>Ranger {sel.size || ''}</button>
    </div>
    <div className="sl-assign-list">{list.map(p => <label key={p.id} className={sel.has(p.id) ? 'on' : ''}>
      <input type="checkbox" checked={sel.has(p.id)} onChange={() => setSel(s => { const x = new Set(s); x.has(p.id) ? x.delete(p.id) : x.add(p.id); return x; })} />
      <span>{p.name}<small>{[p.barcode, p.sku].filter(Boolean).join(' · ')}</small></span>
      <em>{p.lineId ? tagOf.get(p.lineId) || '?' : ownName}</em>
    </label>)}{!list.length && <p className="muted">Aucun produit trouvé.</p>}</div>
  </div>;
}
