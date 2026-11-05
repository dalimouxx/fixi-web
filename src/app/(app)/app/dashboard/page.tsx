'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  PlusCircle, Banknote, PackageCheck, PackageOpen, Wrench, Boxes, Link2, AlertTriangle, Clock3, ShieldCheck,
  CreditCard, Wallet, Hourglass, CheckCircle2, ChevronRight, Moon, SlidersHorizontal, Smartphone, MessageCircle, BellRing, Sparkles,
} from 'lucide-react';
import { FixiSmartWidgets } from '@/components/fixi-smart-widgets';
import { StatusBadge, useApi, useRealtimeRefresh } from '@/components/ui';
import { money, dateTime } from '@/lib/format';
import { useUiMode } from '@/lib/ui-mode';
import { GettingStarted } from '@/components/getting-started';
import { useI18n } from '@/components/language-provider';
import { api } from '@/components/ui';
import { waLink } from '@/lib/whatsapp-link';
import { daySummary } from '@/lib/day-summary';
import { FixiLoader } from '@/components/fixi-loader';
import { CountUp, Sparkline, Ring } from '@/components/fixi-max-charts';

type Tile = { href: string; icon: any; title: string; sub: string; count?: number; variant?: 'primary' | 'ready' };

export default function Dashboard() {
  const { data, loading, error, reload } = useApi<any>('/api/dashboard');
  useRealtimeRefresh(useCallback(() => reload(), []));
  const { advanced, setMode } = useUiMode('atelier');
  const { lang } = useI18n();
  const today = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-TN' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  if (loading && !data) return <FixiLoader label="Chargement de votre atelier…" />;
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
    (data.pickups || []).some((x: any) => x.stage > 0) && { href: '#pickup-title', icon: BellRing, tone: 'warning', count: (data.pickups || []).filter((x: any) => x.stage > 0).length, title: 'client(s) à relancer', sub: 'Appareils prêts non récupérés' },
    data.installmentsDue > 0 && { href: '/app/cashier', icon: CreditCard, tone: 'warning', count: data.installmentsDue, title: 'échéance(s) à encaisser', sub: 'Paiements en plusieurs fois' },
    ready > 0 && { href: perm.cash ? '/app/cashier' : '/app/repairs', icon: PackageCheck, tone: 'ok', count: ready, title: 'appareil(s) prêt(s) à rendre', sub: 'Prévenez le client sur WhatsApp' },
    perm.stock && data.lowStock > 0 && { href: '/app/stock', icon: Boxes, tone: 'danger', count: data.lowStock, title: 'pièce(s) presque épuisée(s)', sub: 'À racheter' },
    perm.warranty && data.openWarranty > 0 && { href: '/app/warranties', icon: ShieldCheck, tone: 'warning', count: data.openWarranty, title: 'retour(s) sous garantie', sub: 'À examiner' },
    perm.cash && !data.cashOpen && { href: '/app/cash-sessions', icon: CreditCard, tone: 'warning', title: 'La caisse est fermée', sub: 'Ouvrez-la avant d’encaisser' },
  ].filter(Boolean) as any[];

  const tone: Record<string, string> = { ok: 'g', warning: 'y', danger: 'p' };
  const kpiCards = [
    { icon: Wrench, label: 'En cours', value: active, sub: waiting ? `${waiting} en attente de pièce` : 'Atelier à jour', subTone: waiting ? 'warn' : 'muted', ico: 'v', href: '/app/repairs' },
    { icon: PackageCheck, label: 'Prêts à rendre', value: ready, sub: ready ? 'Prévenir sur WhatsApp' : 'Aucun en attente', subTone: 'muted', ico: 'g', href: perm.cash ? '/app/cashier' : '/app/repairs' },
    perm.stock ? { icon: Boxes, label: 'Stock bas', value: data.lowStock ?? 0, sub: data.lowStock ? 'À racheter' : 'Stock suffisant', subTone: data.lowStock ? 'bad' : 'muted', ico: 'y', href: '/app/stock' }
      : { icon: Hourglass, label: 'Attente pièce', value: waiting, sub: 'Chez vos fournisseurs', subTone: 'muted', ico: 'y', href: '/app/suppliers' },
    perm.warranty ? { icon: ShieldCheck, label: 'Retours garantie', value: data.openWarranty ?? 0, sub: data.openWarranty ? 'À examiner' : 'Aucun retour', subTone: data.openWarranty ? 'warn' : 'muted', ico: 'p', href: '/app/warranties' }
      : { icon: Clock3, label: 'Échéances', value: data.installmentsDue ?? 0, sub: 'Paiements en plusieurs fois', subTone: 'muted', ico: 'p', href: '/app/cashier' },
  ];
  const series: { date: string; value: number }[] = (data.series || []).slice(-14);
  const margin = perm.profit && Number(data.monthRevenue) > 0 ? Math.max(0, Math.min(100, Math.round(Number(data.grossProfit) / Number(data.monthRevenue) * 100))) : null;

  return <div className="fx-page fxm-dash">
    <header className="fxm-dash-head fxm-up">
      <div>
        <span className="fxm-live-pill"><span className="fxm-live" aria-hidden="true" />En direct · {today}</span>
        <h1 className="fxm-gt">Que voulez-vous faire ?</h1>
        <p className="fxm-dash-sub" aria-live="polite">{daySummary({ lang, ready, waiting, active, revenue: perm.finance ? money(data.todayRevenue) : null, pickups: (data.pickups || []).filter((x: any) => x.stage > 0).length })}</p>
      </div>
      {perm.finance && <Link href="/app/fin-de-journee" className="btn fxm-btn-o"><Moon size={18} /> Fin de journée</Link>}
    </header>

    {perm.finance && <div className="fxm-dash-row">
      <section className="fxm-ba fxm-up" style={{ '--d': '.06s', flex: '2 1 460px' } as any} aria-label="Encaissé aujourd'hui">
        <div className="fxm-ba-in fxm-hero-cash">
          <div>
            <div className="fxm-kick">Encaissé aujourd’hui</div>
            <div className="fxm-big"><CountUp value={Number(data.todayRevenue) || 0} format={money} /></div>
            <div className="fxm-chips"><span className="fxm-chip">Ce mois : {money(data.monthRevenue)}</span>{data.cashOpen === false && <Link href="/app/cash-sessions" className="fxm-chip fxm-chip--warn">Caisse fermée</Link>}</div>
          </div>
          <Sparkline points={series.map(x => Number(x.value) || 0)} />
        </div>
      </section>
      {margin !== null && <section className="fxm-card fxm-hov fxm-up fxm-ring-card" style={{ '--d': '.12s' } as any} aria-label="Marge du mois">
        <Ring pct={margin} />
        <div><div className="fxm-kick fxm-kick--muted">Résultat du mois</div><div className="fxm-mid">{money(data.grossProfit)}</div><div className="fxm-small">Encaissé − pièces − dépenses · {margin} % de marge</div></div>
      </section>}
    </div>}

    <section className="fxm-dash-row" aria-label="Chiffres du jour">
      {kpiCards.map((k, i) => { const Icon = k.icon; return <Link key={k.label} href={k.href} className="fxm-card fxm-hov fxm-kpi fxm-up" style={{ '--d': `${0.18 + i * 0.06}s` } as any}>
        <span className={`fxm-ico fxm-ico--${k.ico}`} style={{ animationDelay: `${i * 0.5}s` }}><Icon /></span>
        <span><span className="fxm-kpi-l">{k.label}</span><span className="fxm-kpi-v"><CountUp value={Number(k.value) || 0} /></span><span className={`fxm-kpi-d fxm-tone-${k.subTone}`}>{k.sub}</span></span>
      </Link>; })}
    </section>

    {perm.profit && new Date().getDate() <= 7 && <Link href="/app/rapport-mensuel" className="fxm-card fxm-hov fxm-banner fxm-up"><span className="fxm-ico fxm-ico--p fxm-ico--s"><Sparkles /></span><span className="fxm-grow"><b>Le rapport du mois dernier est prêt</b><small>Encaissé, bénéfice, pannes et techniciens · PDF et fichier pour le comptable</small></span><ChevronRight size={18} /></Link>}

    {perm.profit && <GettingStarted repairCount={Object.values(counts).reduce((a: number, v: any) => a + Number(v), 0)} />}

    <nav className="fxm-dash-row" aria-label="Actions principales">
      {tiles.map((t, i) => { const Icon = t.icon; return <Link key={t.title} href={t.href} className={`fxm-card fxm-hov fxm-qa fxm-up ${t.variant === 'primary' ? 'fxm-qa--primary' : ''}`} style={{ '--d': `${0.3 + i * 0.05}s` } as any}>
        <span className={`fxm-ico ${t.variant === 'primary' ? 'fxm-ico--w' : t.variant === 'ready' ? 'fxm-ico--g' : 'fxm-ico--o'}`}><Icon /></span>
        {typeof t.count === 'number' && t.count > 0 && <span className="fxm-qa-count" aria-label={`${t.count} en attente`}>{t.count}</span>}
        <span><b>{t.title}</b><small>{t.sub}</small></span>
      </Link>; })}
    </nav>

    <div className="fxm-dash-row fxm-top">
      <section className="fxm-card fxm-up fxm-panel" style={{ '--d': '.4s', flex: '1 1 340px' } as any} aria-labelledby="todo-title">
        <div className="fxm-panel-head"><h2 id="todo-title">À faire maintenant</h2>{todo.length > 0 && <span className="fxm-badge-hot">{todo.length}</span>}</div>
        {todo.length ? todo.map((t, i) => { const Icon = t.icon; return <Link key={i} href={t.href} className="fxm-todo fxm-in" style={{ '--d': `${0.5 + i * 0.08}s` } as any}>
          <span className={`fxm-ico fxm-ico--s fxm-ico--${tone[t.tone] || 'o'}`}><Icon /></span>
          <span className="fxm-grow"><b>{t.count != null && <>{t.count} </>}{t.title}</b><small>{t.sub}</small></span><ChevronRight size={18} />
        </Link>; })
          : <div className="fxm-todo"><span className="fxm-ico fxm-ico--s fxm-ico--g"><CheckCircle2 /></span><span className="fxm-grow"><b>Rien d’urgent</b><small>Tout est à jour dans l’atelier.</small></span></div>}
      </section>
      <section className="fxm-card fxm-up fxm-panel" style={{ '--d': '.46s', flex: '2 1 420px' } as any} aria-labelledby="recent-title">
        <div className="fxm-panel-head"><h2 id="recent-title">Derniers appareils</h2><Link href="/app/repairs" className="fxm-link">Tout voir</Link></div>
        {(data.recent || []).slice(0, 6).map((r: any, i: number) => <Link key={r.id} href={`/app/repairs/${r.code}`} className="fxm-todo fxm-in" style={{ '--d': `${0.55 + i * 0.06}s` } as any}>
          <span className="fxm-av" aria-hidden="true"><span>{initialsOf(r.client?.fullName)}</span></span>
          <span className="fxm-grow"><b>{[r.brand, r.model].filter(Boolean).join(' ') || r.code}</b><small>{r.client?.fullName} · {dateTime(r.updatedAt)}</small></span><StatusBadge status={r.status} />
        </Link>)}
        {!data.recent?.length && <div className="fxm-todo"><span className="fxm-ico fxm-ico--s fxm-ico--b"><Smartphone /></span><span className="fxm-grow"><b>Aucun appareil pour l’instant</b><small>Commencez par « Nouvelle réparation ».</small></span></div>}
      </section>
    </div>

    {(data.pickups || []).length > 0 && <section className="fxm-card fxm-panel fxm-up fx-pickups" style={{ '--d': '.5s' } as any} aria-labelledby="pickup-title">
      <div className="fxm-panel-head"><h2 id="pickup-title"><BellRing size={18} /> Appareils prêts à relancer</h2>{data.autoPickup && <span className="fxm-chip">Relance WhatsApp automatique</span>}</div>
      <p className="fxm-small" style={{ margin: '0 0 8px' }}>Prêts depuis 3 jours ou plus. 1re relance à 3 jours, 2e à 7 jours.</p>
      {data.pickups.map((x: any) => <div key={x.code} className="fxm-todo">
        <span className={`fxm-ico fxm-ico--s ${x.days >= 7 ? 'fxm-ico--p' : 'fxm-ico--y'}`}><PackageCheck /></span>
        <Link href={`/app/repairs/${x.code}`} className="fxm-grow"><b>{x.client} · {x.device}</b><small>Prêt depuis {x.days} j · {x.sent ? `${x.sent} relance(s) faite(s)` : 'jamais relancé'}{x.balance > 0 ? ` · reste ${money(x.balance)}` : ''}</small></Link>
        {x.stage > 0 ? <a className="btn btn-success btn-sm" href={waLink(x.phone, x.message)} target="_blank" rel="noreferrer" onClick={() => { api(`/api/repairs/${encodeURIComponent(x.code)}/pickup-reminder`, { method: 'POST' }).then(() => reload()).catch(() => {}); }}><MessageCircle size={16} /> Relancer</a>
          : <span className="fxm-chip fxm-chip--ok"><CheckCircle2 size={14} /> Relancé</span>}
      </div>)}
    </section>}

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

function initialsOf(name?: string) {
  return String(name || '?').split(' ').filter(Boolean).map(x => x[0]).slice(0, 2).join('').toUpperCase() || '?';
}
