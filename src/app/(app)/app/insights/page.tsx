'use client';
import Link from 'next/link';
import { useState } from 'react';
import { AlertTriangle, ArrowRight, PackageSearch, Star, Target, TrendingUp, TrendingDown, ShieldCheck, Plus, Trash2, Sparkles, PackageOpen } from 'lucide-react';
import { api, useApi } from '@/components/ui';
import { FxSheet } from '@/components/fx-sheet';
import { money, dateOnly } from '@/lib/format';

const scoreNames: Record<string, string> = { profitability: 'Rentabilité', satisfaction: 'Satisfaction', speed: 'Rapidité', stock: 'Stock', quality: 'Qualité' };
const goalTypes: Record<string, string> = { REVENUE: 'Chiffre d’affaires', REPAIRS: 'Réparations', PROFIT: 'Bénéfice', SATISFACTION: 'Satisfaction' };
const risk: Record<string, [string, string]> = { CRITICAL: ['Rupture proche', 'danger'], HIGH: ['À surveiller', 'warning'], MEDIUM: ['Correct', 'info'], LOW: ['OK', 'ok'] };

// Analyses : d'abord ce qu'il faut faire, puis les chiffres qui l'expliquent.
export default function Insights() {
  const { data, error } = useApi<any>('/api/smart/insights');
  const { data: forecast } = useApi<any[]>('/api/smart/stock-forecast');
  const { data: goals, reload: reloadGoals } = useApi<any[]>('/api/goals');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({ type: 'REVENUE', label: 'Objectif du mois', target: 10000, startsAt: new Date().toISOString().slice(0, 10), endsAt: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) });
  async function createGoal(e: React.FormEvent) { e.preventDefault(); try { await api('/api/goals', { method: 'POST', body: JSON.stringify(f) }); setOpen(false); reloadGoals(); } catch (err: any) { alert(err.message); } }
  async function del(id: string) { if (confirm('Supprimer cet objectif ?')) { await api('/api/goals/' + id, { method: 'DELETE' }); reloadGoals(); } }
  if (error) return <div className="fx-page"><div className="error">{error}</div></div>;
  if (!data) return <div className="fx-page"><div className="card card-pad fx-skeleton" role="status" aria-label="Analyse des données"><i /><i /><i /></div></div>;
  const up = data.revenue.change >= 0;
  const toOrder = (forecast || []).filter((x: any) => ['CRITICAL', 'HIGH'].includes(x.risk));

  return <div className="fx-page">
    <div className="fx-hello"><div><h1>Analyses</h1><p>Ce qui va bien, ce qu’il faut corriger, et quoi racheter.</p></div>
      <Link className="btn btn-ghost" href="/app/brain"><Sparkles size={18} /> Poser une question</Link></div>

    <section className="fx-kpis fx-kpis--4" aria-label="Chiffres clés">
      <div className="fx-kpi">{up ? <TrendingUp /> : <TrendingDown />}<div><span>Encaissé 7 jours</span><strong>{money(data.revenue.current7)}</strong><small className={up ? 'fx-up' : 'fx-down'}>{up ? '+' : ''}{data.revenue.change} % vs semaine passée</small></div></div>
      <div className="fx-kpi"><Star /><div><span>Note clients</span><strong>{Number(data.avgRating || 0).toFixed(1)} / 5</strong><small>{data.feedbackCount} avis</small></div></div>
      <div className={`fx-kpi ${data.lowStock ? 'fx-kpi--due' : ''}`}><PackageSearch /><div><span>Stock faible</span><strong>{data.lowStock}</strong></div></div>
      <div className={`fx-kpi ${data.openWarranty ? 'fx-kpi--due' : ''}`}><ShieldCheck /><div><span>Retours ouverts</span><strong>{data.openWarranty}</strong></div></div>
    </section>

    <div className="fx-grid-2">
      <section className="fx-panel" aria-labelledby="todo-ins">
        <div className="fx-panel-head"><h2 id="todo-ins">À faire</h2></div>
        <div className="fx-list">
          {data.insights.map((x: any, i: number) => <Link href={x.action} key={i} className={`fx-row ${x.severity === 'danger' ? 'fx-row--danger' : x.severity === 'warning' ? 'fx-row--warning' : x.severity === 'success' ? 'fx-row--ok' : ''}`}><AlertTriangle /><span className="fx-row-main"><b>{x.title}</b><small>{x.text}</small></span><ArrowRight size={18} className="fx-flip" /></Link>)}
          {!data.insights.length && <div className="fx-empty fx-empty--small"><span>Rien à signaler : tout va bien.</span></div>}
        </div>
      </section>
      <section className="fx-panel fx-score" aria-labelledby="score-ins">
        <div className="fx-panel-head"><h2 id="score-ins">Santé de l’atelier</h2><strong className="fx-score-big">{data.score.overall}<small>/100</small></strong></div>
        <div className="fx-bars">{Object.entries(data.score).filter(([k]) => k !== 'overall').map(([k, v]: any) => <div key={k}><span>{scoreNames[k] || k}</span><i><b style={{ width: `${v}%` }} data-tone={v < 40 ? 'danger' : v < 70 ? 'warning' : 'ok'} /></i><strong>{v}</strong></div>)}</div>
      </section>
    </div>

    <section className="fx-panel" style={{ marginTop: 12 }} aria-labelledby="fc-ins">
      <div className="fx-panel-head"><h2 id="fc-ins">Pièces à racheter bientôt</h2></div>
      <p className="fx-panel-sub">Calculé sur ce que vous avez utilisé ces 90 derniers jours.</p>
      <div className="fx-list">
        {(toOrder.length ? toOrder : (forecast || []).slice(0, 6)).slice(0, 12).map((x: any) => { const [l, tone] = risk[x.risk] || [x.risk, 'muted']; return <div key={x.id} className={`fx-row fx-row--${tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : ''}`}>
          <PackageSearch /><span className="fx-row-main"><b>{x.name}</b><small>En stock {x.quantity} · utilisé {x.consumed90} en 90 j · {x.daysToStockout === null ? 'pas assez de données' : `rupture dans ~${x.daysToStockout} j`}</small></span>
          <span className={`fx-chip fx-chip--${tone}`}>{l}</span>
          {x.recommendedOrder > 0 && <Link className="btn btn-soft btn-sm" href={`/app/suppliers?q=${encodeURIComponent(x.name)}`}><PackageOpen size={15} /> Commander {x.recommendedOrder}</Link>}
        </div>; })}
        {!(forecast || []).length && <div className="fx-empty fx-empty--small"><span>Pas encore assez d’historique de stock.</span></div>}
      </div>
    </section>

    <section className="fx-panel" style={{ marginTop: 12 }} aria-labelledby="goals-ins">
      <div className="fx-panel-head"><h2 id="goals-ins">Objectifs</h2><button className="btn btn-soft btn-sm" onClick={() => setOpen(true)}><Plus size={15} /> Ajouter</button></div>
      <div className="fx-list">
        {(goals || []).map((g: any) => <div className="fx-row" key={g.id}><Target /><span className="fx-row-main"><b>{g.label} · {g.type === 'REVENUE' || g.type === 'PROFIT' ? money(g.target) : Number(g.target)}</b><small>{goalTypes[g.type] || g.type} · {dateOnly(g.startsAt)} → {dateOnly(g.endsAt)}</small></span><button className="fx-icon-btn" onClick={() => del(g.id)} aria-label={`Supprimer ${g.label}`}><Trash2 size={16} /></button></div>)}
        {!goals?.length && <div className="fx-empty fx-empty--small"><span>Fixez un objectif du mois pour motiver l’équipe.</span></div>}
      </div>
    </section>

    <FxSheet open={open} onClose={() => setOpen(false)} side="bottom" title="Nouvel objectif" label="Nouvel objectif">
      <form onSubmit={createGoal} className="fx-form-grid">
        <label className="field span-2"><span className="label">Type</span><select className="select" value={f.type} onChange={e => setF({ ...f, type: e.target.value })}>{Object.entries(goalTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="field span-2"><span className="label">Nom</span><input className="input" value={f.label} onChange={e => setF({ ...f, label: e.target.value })} /></label>
        <label className="field span-2"><span className="label">Cible</span><input className="input" type="number" min="0.1" step="0.1" value={f.target} onChange={e => setF({ ...f, target: Number(e.target.value) })} /></label>
        <label className="field"><span className="label">Début</span><input className="input" type="date" value={f.startsAt} onChange={e => setF({ ...f, startsAt: e.target.value })} /></label>
        <label className="field"><span className="label">Fin</span><input className="input" type="date" value={f.endsAt} onChange={e => setF({ ...f, endsAt: e.target.value })} /></label>
        <button className="btn btn-primary btn-block span-2">Créer l’objectif</button>
      </form>
    </FxSheet>
  </div>;
}
