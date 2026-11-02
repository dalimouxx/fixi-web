'use client';
import Link from 'next/link';
import { useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  PlusCircle, Banknote, PackageCheck, PackageOpen, Wrench, Boxes, Link2, AlertTriangle, Clock3, ShieldCheck,
  CreditCard, Wallet, Hourglass, CheckCircle2, ChevronRight, Moon, SlidersHorizontal, Smartphone,
} from 'lucide-react';
import { FixiSmartWidgets } from '@/components/fixi-smart-widgets';
import { StatusBadge, useApi, useRealtimeRefresh } from '@/components/ui';
import { money, dateTime } from '@/lib/format';
import { useUiMode } from '@/lib/ui-mode';
import { GettingStarted } from '@/components/getting-started';
import { useI18n } from '@/components/language-provider';

type Tile = { href: string; icon: any; title: string; sub: string; count?: number; variant?: 'primary' | 'ready' };

export default function Dashboard() {
  const { data, loading, error, reload } = useApi<any>('/api/dashboard');
  useRealtimeRefresh(useCallback(() => reload(), []));
  const { advanced, setMode } = useUiMode('atelier');
  const { lang } = useI18n();
  const today = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-TN' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  if (loading && !data) return <div className="fx-page" role="status" aria-live="polite">
    <div className="fx-hello"><div><h1>Que voulez-vous faire ?</h1><p>Chargement de votre atelier…</p></div></div>
    <div className="fx-tiles">{[1, 2, 3, 4].map(x => <div className="fx-tile" key={x} aria-hidden="true" style={{ opacity: .5 }} />)}</div>
  </div>;
  if (error || !data) return <div className="fx-page"><div className="fx-panel" role="alert" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
    <AlertTriangle size={26} color="var(--fx-danger)" /><div style={{ flex: 1 }}><b>Accueil indisponible</b><div className="page-sub">{String(error || 'Impossible de charger votre atelier.')}</div></div>
    <button type="button" className="btn btn-primary" onClick={() => reload()}>Réessayer</button></div></div>;

  const perm = data.permissions || {};
  const counts = data.statusCounts || {};
  const active = Object.entries(counts).filter(([k]) => !['DELIVERED', 'CANCELLED'].includes(k)).reduce((a, [, v]) => a + Number(v), 0);
  const waiting = Number(counts.WAITING_PART || 0);
  const ready = Number(data.ready || 0);
  const canReceive = perm.cash || perm.finance || perm.warranty; // ADMIN, RECEPTION, CASHIER
  const isTech = perm.stock && !perm.finance && !perm.profit;

  const tiles: Tile[] = isTech ? [
    { href: '/app/repairs', icon: Wrench, title: 'Mes réparations', sub: `${active} en cours`, variant: 'primary' },
    { href: '/app/repairs', icon: PackageCheck, title: 'Appareils prêts', sub: 'À contrôler avant remise', count: ready, variant: 'ready' },
    { href: '/app/stock', icon: Boxes, title: 'Mon stock', sub: 'Pièces disponibles' },
    { href: '/app/compatibility', icon: Link2, title: 'Pièce compatible ?', sub: 'Vérifier un modèle' },
  ] : [
    ...(canReceive ? [{ href: '/app/repairs/new', icon: PlusCircle, title: 'Nouvelle réparation', sub: 'Un client dépose un appareil', variant: 'primary' as const }] : []),
    ...(perm.cash ? [{ href: '/app/cashier', icon: Banknote, title: 'Encaisser', sub: 'Rendre un appareil et encaisser' }] : []),
    { href: perm.cash ? '/app/cashier' : '/app/repairs', icon: PackageCheck, title: 'Appareils prêts', sub: 'À rendre aux clients', count: ready, variant: 'ready' },
    ...(!perm.cash || perm.profit ? [{ href: '/app/suppliers', icon: PackageOpen, title: 'Commander une pièce', sub: 'Chez vos fournisseurs' }] : [{ href: '/app/repairs', icon: Wrench, title: 'Réparations', sub: `${active} en cours` }]),
  ];
  if (!isTech && tiles.length < 4) tiles.push({ href: '/app/repairs', icon: Wrench, title: 'Réparations', sub: `${active} en cours` });
  tiles.splice(4);

  const kpis = [
    perm.finance ? { icon: Wallet, label: 'Caisse du jour', value: money(data.todayRevenue) } : { icon: Hourglass, label: 'Attente pièce', value: waiting },
    { icon: Wrench, label: 'En cours', value: active },
    { icon: PackageCheck, label: 'À rendre', value: ready },
  ];

  const todo = [
    waiting > 0 && { href: '/app/repairs', icon: Clock3, tone: 'warning', count: waiting, title: 'réparation(s) attendent une pièce', sub: 'Commandez-la chez votre fournisseur' },
    ready > 0 && { href: perm.cash ? '/app/cashier' : '/app/repairs', icon: PackageCheck, tone: 'ok', count: ready, title: 'appareil(s) prêt(s) à rendre', sub: 'Prévenez le client sur WhatsApp' },
    perm.stock && data.lowStock > 0 && { href: '/app/stock', icon: Boxes, tone: 'danger', count: data.lowStock, title: 'pièce(s) presque épuisée(s)', sub: 'À racheter' },
    perm.warranty && data.openWarranty > 0 && { href: '/app/warranties', icon: ShieldCheck, tone: 'warning', count: data.openWarranty, title: 'retour(s) sous garantie', sub: 'À examiner' },
    perm.cash && !data.cashOpen && { href: '/app/cash-sessions', icon: CreditCard, tone: 'warning', title: 'La caisse est fermée', sub: 'Ouvrez-la avant d’encaisser' },
  ].filter(Boolean) as any[];

  return <div className="fx-page">
    <div className="fx-hello">
      <div><h1>Que voulez-vous faire ?</h1><p style={{ textTransform: 'capitalize' }}>{today}</p></div>
      {perm.finance && <Link href="/app/fin-de-journee" className="btn btn-ghost"><Moon size={18} /> Fin de journée</Link>}
    </div>

    {perm.profit && <GettingStarted repairCount={Object.values(counts).reduce((a: number, v: any) => a + Number(v), 0)} />}

    <nav className="fx-tiles" aria-label="Actions principales">
      {tiles.map(t => { const Icon = t.icon; return <Link key={t.title} href={t.href} className={`fx-tile ${t.variant ? 'fx-tile--' + t.variant : ''}`}>
        <span className="fx-tile-icon"><Icon /></span>
        {typeof t.count === 'number' && t.count > 0 && <span className="fx-tile-count" aria-label={`${t.count} en attente`}>{t.count}</span>}
        <span><b>{t.title}</b><small>{t.sub}</small></span>
      </Link>; })}
    </nav>

    <section className="fx-kpis" aria-label="Chiffres du jour">
      {kpis.map(k => { const Icon = k.icon; return <div className="fx-kpi" key={k.label}><Icon /><div><span>{k.label}</span><strong>{k.value}</strong></div></div>; })}
    </section>

    <div className="fx-grid-2">
      <section className="fx-panel" aria-labelledby="todo-title">
        <div className="fx-panel-head"><h2 id="todo-title">À faire maintenant</h2></div>
        <div className="fx-list">
          {todo.length ? todo.map((t, i) => { const Icon = t.icon; return <Link key={i} href={t.href} className={`fx-row fx-row--${t.tone}`}><Icon /><span className="fx-row-main"><b>{t.count != null && <>{t.count} </>}{t.title}</b><small>{t.sub}</small></span><ChevronRight size={18} /></Link>; })
            : <div className="fx-row fx-row--ok"><CheckCircle2 /><span className="fx-row-main"><b>Rien d’urgent</b><small>Tout est à jour dans l’atelier.</small></span></div>}
        </div>
      </section>
      <section className="fx-panel" aria-labelledby="recent-title">
        <div className="fx-panel-head"><h2 id="recent-title">Derniers appareils</h2><Link href="/app/repairs" className="btn btn-ghost btn-sm">Tout voir</Link></div>
        <div className="fx-list">
          {(data.recent || []).slice(0, 6).map((r: any) => <Link key={r.id} href={`/app/repairs/${r.code}`} className="fx-row">
            <Smartphone /><span className="fx-row-main"><b>{[r.brand, r.model].filter(Boolean).join(' ')}</b><small>{r.client?.fullName} · {dateTime(r.updatedAt)}</small></span><StatusBadge status={r.status} />
          </Link>)}
          {!data.recent?.length && <div className="fx-row"><Smartphone /><span className="fx-row-main"><b>Aucun appareil pour l’instant</b><small>Commencez par « Nouvelle réparation ».</small></span></div>}
        </div>
      </section>
    </div>

    {advanced ? <>
      <div style={{ marginTop: 24 }}>
        <FixiSmartWidgets area="atelier" subtitle="Tous les indicateurs de l’atelier."
          widgets={[
            ...(perm.finance ? [{ id: 'atelier-revenue', label: "Encaissements aujourd'hui", value: money(data.todayRevenue), description: 'Paiements enregistrés', icon: 'finance' as const, accent: 'success' as const, href: '/app/payments' }] : []),
            { id: 'atelier-active', label: 'Réparations en cours', value: active, description: `${counts.DIAGNOSIS || 0} diagnostics · ${counts.IN_REPAIR || 0} en réparation`, icon: 'repairs', href: '/app/repairs' },
            ...(perm.profit ? [{ id: 'atelier-profit', label: 'Résultat du mois', value: money(data.grossProfit), description: 'Encaissé − pièces − dépenses', icon: 'finance' as const, accent: 'info' as const, href: '/app/insights' }] : []),
            ...(perm.profit ? [{ id: 'atelier-expenses', label: 'Dépenses du mois', value: money(data.monthExpenses), description: 'Toutes catégories', icon: 'alert' as const, href: '/app/expenses' }] : []),
          ]} />
      </div>
      {perm.finance && <section className="fx-panel" style={{ marginTop: 12 }}>
        <div className="fx-panel-head"><h2>Encaissements du mois</h2><strong>{money(data.monthRevenue)}</strong></div>
        <div style={{ height: 240 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.series || []}>
          <defs><linearGradient id="fxFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c2500a" stopOpacity={.18} /><stop offset="100%" stopColor="#c2500a" stopOpacity={0} /></linearGradient></defs>
          <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={48} /><Tooltip />
          <Area type="monotone" dataKey="value" stroke="#c2500a" strokeWidth={2.5} fill="url(#fxFill)" isAnimationActive={false} />
        </AreaChart></ResponsiveContainer></div>
      </section>}
    </> : perm.profit && <div className="fx-advanced-note"><SlidersHorizontal size={18} /><span>Graphiques, bénéfice du mois et analyses sont disponibles en Mode Avancé.</span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode('advanced')}>Afficher</button></div>}
  </div>;
}
