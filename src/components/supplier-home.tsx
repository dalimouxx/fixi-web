'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import { AlertTriangle, Banknote, CheckCircle2, ChevronRight, ClipboardList, Moon, PackageCheck, Sparkles, Truck, WalletCards, Warehouse, Plus } from 'lucide-react';
import { money } from '@/lib/format';
import { CountUp, Ring, Sparkline } from './fixi-max-charts';

const STATUS: Record<string, [string, string]> = {
  PENDING: ['Nouvelle', 'hot'], CONFIRMED: ['Confirmée', 'info'], PREPARING: ['En préparation', 'warn'],
  READY_FOR_DELIVERY: ['Prête', 'ok'], OUT_FOR_DELIVERY: ['En livraison', 'vio'], RETURNING: ['Retour en cours', 'warn'],
  RETURNED: ['Retournée', 'mut'], DELIVERED: ['Livrée', 'ok'], CANCELLED: ['Annulée', 'mut'],
};
const dayKey = (d: string | Date) => new Date(d).toISOString().slice(0, 10);
const ini = (name?: string) => String(name || '?').split(' ').filter(Boolean).map(x => x[0]).slice(0, 2).join('').toUpperCase() || '?';
const ago = (d: string) => { const m = Math.round((Date.now() - new Date(d).getTime()) / 60000); return m < 1 ? 'à l’instant' : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`; };

/**
 * Accueil fournisseur Fixi Max : actions rapides, ventes du jour, recouvrement,
 * indicateurs, commandes en direct et produits stars. Données déjà chargées par le tableau de bord.
 */
export function SupplierHome({ session, orders, products, sales, canTab, onTab, lowStock }: {
  session: any; orders: any[]; products: any[]; sales: any[]; canTab: (t: string) => boolean; onTab: (t: string) => void; lowStock: number;
}) {
  const today = dayKey(new Date());
  const d = useMemo(() => {
    const live = orders.filter(o => o.status !== 'CANCELLED');
    const pos = (sales || []).filter((x: any) => x.status !== 'CANCELLED');
    const ordersToday = live.filter(o => dayKey(o.createdAt) === today);
    const posToday = pos.filter((x: any) => dayKey(x.createdAt) === today);
    const salesToday = ordersToday.reduce((a, o) => a + Number(o.total || 0), 0) + posToday.reduce((a: number, x: any) => a + Number(x.total || 0), 0);
    // 14 derniers jours : commandes + ventes comptoir.
    const days: string[] = []; for (let i = 13; i >= 0; i--) { const t = new Date(); t.setDate(t.getDate() - i); days.push(dayKey(t)); }
    const byDay = Object.fromEntries(days.map(k => [k, 0]));
    for (const o of live) { const k = dayKey(o.createdAt); if (k in byDay) byDay[k] += Number(o.total || 0); }
    for (const x of pos) { const k = dayKey(x.createdAt); if (k in byDay) byDay[k] += Number(x.total || 0); }
    const due = pos.reduce((a: number, x: any) => a + Math.max(0, Number(x.total || 0) - Number(x.paid || 0)), 0);
    const billed = pos.reduce((a: number, x: any) => a + Number(x.total || 0), 0);
    const debtors = new Set(pos.filter((x: any) => Number(x.total || 0) - Number(x.paid || 0) > 0.0005).map((x: any) => x.customerId)).size;
    const active = orders.filter(o => !['DELIVERED', 'CANCELLED', 'RETURNED'].includes(o.status));
    const pending = active.filter(o => o.status === 'PENDING').length;
    const ready = active.filter(o => o.status === 'READY_FOR_DELIVERY').length;
    const outFor = active.filter(o => o.status === 'OUT_FOR_DELIVERY').length;
    // Produits stars (30 jours) d'après les commandes des ateliers.
    const since = Date.now() - 30 * 86400000; const qty = new Map<string, { name: string; q: number }>();
    for (const o of live) if (new Date(o.createdAt).getTime() >= since) for (const it of o.items || []) { const n = it.product?.name || it.name; if (!n) continue; const cur = qty.get(n) || { name: n, q: 0 }; cur.q += Number(it.quantity || 0); qty.set(n, cur); }
    const stars = [...qty.values()].sort((a, b) => b.q - a.q).slice(0, 4);
    return { salesToday, ordersToday: ordersToday.length, posToday: posToday.length, series: days.map(k => byDay[k]), due, billed, debtors, active: active.length, pending, ready, outFor, stars };
  }, [orders, sales, today]);

  const recoveredPct = d.billed > 0 ? Math.max(0, Math.min(100, Math.round((d.billed - d.due) / d.billed * 100))) : null;
  const first = String(session?.fullName || '').split(' ')[0];
  const actions = [
    canTab('orders') && { tab: 'orders', icon: ClipboardList, title: 'Préparer les commandes', sub: `${d.active} à suivre`, count: d.pending, primary: true },
    canTab('cashier') && { tab: 'cashier', icon: WalletCards, title: 'Vendre au comptoir', sub: 'Caisse avec scan code-barres', ico: 'b' },
    canTab('products') && { tab: 'products', icon: Plus, title: 'Ajouter un produit', sub: 'Création guidée en 30 s', ico: 'v' },
    canTab('dues') && { tab: 'dues', icon: Banknote, title: 'Encaisser une dette', sub: d.due > 0 ? `${money(d.due)} à recouvrer` : 'Aucune dette', ico: 'g' },
  ].filter(Boolean) as any[];
  const todo = [
    d.pending > 0 && { tab: 'orders', icon: ClipboardList, ico: 'o', title: `${d.pending} nouvelle(s) commande(s)`, sub: 'À confirmer et préparer' },
    d.ready > 0 && { tab: 'delivery', icon: Truck, ico: 'v', title: `${d.ready} commande(s) prête(s)`, sub: 'À affecter à un livreur' },
    lowStock > 0 && { tab: 'products', icon: AlertTriangle, ico: 'y', title: `${lowStock} produit(s) en stock faible`, sub: 'Réapprovisionnement conseillé' },
    d.debtors > 0 && { tab: 'dues', icon: Banknote, ico: 'p', title: `${d.debtors} client(s) avec une dette`, sub: `${money(d.due)} au total` },
  ].filter(Boolean) as any[];

  return <div className="fxm-dash fxm-sh">
    <header className="fxm-dash-head fxm-up">
      <div>
        <span className="fxm-live-pill"><span className="fxm-live" aria-hidden="true" />{d.pending ? `${d.pending} nouvelle(s) commande(s)` : 'En direct'}</span>
        <h1 className="fxm-gt">{first ? `Bonjour ${first}, voici votre journée.` : 'Votre journée'}</h1>
        <p className="fxm-dash-sub">{d.ordersToday} commande(s) d’ateliers et {d.posToday} vente(s) au comptoir aujourd’hui.</p>
      </div>
      <Link href="/supplier/daily-report" className="btn fxm-btn-o"><Moon size={18} /> Fin de journée</Link>
    </header>

    <nav className="fxm-dash-row" aria-label="Actions rapides">
      {actions.map((a, i) => { const Icon = a.icon; return <button type="button" key={a.tab} onClick={() => onTab(a.tab)} className={`fxm-card fxm-hov fxm-qa fxm-up ${a.primary ? 'fxm-qa--primary' : ''}`} style={{ '--d': `${0.05 + i * 0.05}s` } as any}>
        <span className={`fxm-ico ${a.primary ? 'fxm-ico--w' : 'fxm-ico--' + a.ico}`}><Icon /></span>
        {a.count > 0 && <span className="fxm-qa-count" aria-label={`${a.count} nouvelles`}>{a.count}</span>}
        <span><b>{a.title}</b><small>{a.sub}</small></span>
      </button>; })}
    </nav>

    <div className="fxm-dash-row">
      <section className="fxm-ba fxm-up" style={{ '--d': '.25s', flex: '2 1 460px' } as any} aria-label="Ventes du jour">
        <div className="fxm-ba-in fxm-hero-cash">
          <div>
            <div className="fxm-kick">Ventes du jour</div>
            <div className="fxm-big"><CountUp value={d.salesToday} format={money} /></div>
            <div className="fxm-chips"><span className="fxm-chip">{d.ordersToday} commande(s)</span><span className="fxm-chip">{d.posToday} vente(s) comptoir</span></div>
          </div>
          <Sparkline points={d.series} />
        </div>
      </section>
      <section className="fxm-card fxm-hov fxm-up fxm-ring-card" style={{ '--d': '.3s' } as any} aria-label="Recouvrement">
        {recoveredPct !== null ? <Ring pct={recoveredPct} /> : <span className="fxm-ico fxm-ico--g" style={{ width: 72, height: 72, borderRadius: 24 }}><CheckCircle2 size={30} /></span>}
        <div><div className="fxm-kick fxm-kick--muted">À recouvrer</div><div className="fxm-mid"><CountUp value={d.due} format={money} /></div>
          <div className="fxm-small">{d.debtors ? `${d.debtors} client(s) concerné(s)` : 'Aucune dette en cours'}{recoveredPct !== null ? ` · ${recoveredPct} % déjà encaissé` : ''}</div></div>
      </section>
    </div>

    <section className="fxm-dash-row" aria-label="Indicateurs">
      {[
        { label: 'Commandes actives', value: d.active, sub: d.pending ? `${d.pending} nouvelle(s)` : 'Rien de nouveau', tone: d.pending ? 'warn' : 'muted', ico: 'o', icon: ClipboardList, tab: 'orders' },
        { label: 'Prêtes à livrer', value: d.ready, sub: d.outFor ? `${d.outFor} en livraison` : 'Aucune en route', tone: 'muted', ico: 'v', icon: PackageCheck, tab: 'delivery' },
        { label: 'Stock faible', value: lowStock, sub: lowStock ? 'À réapprovisionner' : 'Stock suffisant', tone: lowStock ? 'bad' : 'muted', ico: 'y', icon: Warehouse, tab: 'products' },
        { label: 'Produits actifs', value: products.filter(p => p.active !== false).length, sub: 'Visibles par les ateliers', tone: 'muted', ico: 'b', icon: Sparkles, tab: 'products' },
      ].filter(k => canTab(k.tab)).map((k, i) => { const Icon = k.icon; return <button type="button" key={k.label} onClick={() => onTab(k.tab)} className="fxm-card fxm-hov fxm-kpi fxm-up" style={{ '--d': `${0.35 + i * 0.05}s` } as any}>
        <span className={`fxm-ico fxm-ico--${k.ico}`} style={{ animationDelay: `${i * 0.5}s` }}><Icon /></span>
        <span><span className="fxm-kpi-l">{k.label}</span><span className="fxm-kpi-v"><CountUp value={k.value} /></span><span className={`fxm-kpi-d fxm-tone-${k.tone}`}>{k.sub}</span></span>
      </button>; })}
    </section>

    <div className="fxm-dash-row fxm-top">
      <section className="fxm-card fxm-up fxm-panel" style={{ '--d': '.45s', flex: '1 1 340px' } as any} aria-labelledby="sh-todo">
        <div className="fxm-panel-head"><h2 id="sh-todo">À traiter maintenant</h2>{todo.length > 0 && <span className="fxm-badge-hot">{todo.length}</span>}</div>
        {todo.length ? todo.map((t, i) => { const Icon = t.icon; return <button type="button" key={t.title} onClick={() => onTab(t.tab)} className="fxm-todo fxm-todo--btn fxm-in" style={{ '--d': `${0.5 + i * 0.07}s` } as any}>
          <span className={`fxm-ico fxm-ico--s fxm-ico--${t.ico}`}><Icon /></span><span className="fxm-grow"><b>{t.title}</b><small>{t.sub}</small></span><ChevronRight size={18} />
        </button>; })
          : <div className="fxm-todo"><span className="fxm-ico fxm-ico--s fxm-ico--g"><CheckCircle2 /></span><span className="fxm-grow"><b>Tout est sous contrôle</b><small>Aucune action prioritaire.</small></span></div>}
      </section>

      <section className="fxm-card fxm-up fxm-panel" style={{ '--d': '.5s', flex: '2 1 420px' } as any} aria-labelledby="sh-live">
        <div className="fxm-panel-head"><h2 id="sh-live">Commandes en direct <span className="fxm-live" aria-hidden="true" /></h2>{canTab('orders') && <button type="button" className="fxm-link fxm-linkbtn" onClick={() => onTab('orders')}>Tout voir</button>}</div>
        {orders.slice(0, 6).map((o, i) => { const st = STATUS[o.status] || [o.status, 'mut']; const items = (o.items || []).map((it: any) => `${it.quantity} × ${it.product?.name || it.name || 'article'}`).join(' · ');
          return <button type="button" key={o.id} onClick={() => onTab('orders')} className={'fxm-todo fxm-todo--btn fxm-in' + (o.status === 'PENDING' ? ' fxm-todo--new' : '')} style={{ '--d': `${0.55 + i * 0.06}s` } as any}>
            <span className="fxm-av" aria-hidden="true"><span>{ini(o.shop?.name)}</span></span>
            <span className="fxm-grow"><b>{o.shop?.name || 'Atelier'} <span className="fxm-mono">{o.reference}</span></b><small>{items || '—'} · {ago(o.createdAt)}</small></span>
            <span className="fxm-sh-end"><b className="fxm-num">{money(o.total)}</b><span className={`fxm-st fxm-st--${st[1]}`}>{st[0]}</span></span>
          </button>; })}
        {!orders.length && <div className="fxm-todo"><span className="fxm-ico fxm-ico--s fxm-ico--b"><ClipboardList /></span><span className="fxm-grow"><b>Aucune commande pour l’instant</b><small>Les commandes des ateliers Fixi apparaîtront ici en direct.</small></span></div>}
      </section>
    </div>

    {d.stars.length > 0 && <section className="fxm-card fxm-up fxm-panel" style={{ '--d': '.55s' } as any} aria-labelledby="sh-stars">
      <div className="fxm-panel-head"><h2 id="sh-stars">Produits stars · 30 jours</h2></div>
      <div className="fxm-sh-stars">{d.stars.map((s, i) => <div key={s.name} className="fxm-sh-star"><div><b>{s.name}</b><span className="fxm-num">{s.q} vendu(s)</span></div><div className="fxm-pg"><i style={{ width: `${Math.round(s.q / d.stars[0].q * 100)}%`, animationDelay: `${0.6 + i * 0.1}s` }} /></div></div>)}</div>
    </section>}
  </div>;
}
