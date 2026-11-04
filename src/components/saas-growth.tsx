'use client';
import { useEffect, useState } from 'react';
import { Activity, CalendarClock, MessageCircle, RefreshCw, Rocket, TrendingDown, TrendingUp, UserPlus, Wallet } from 'lucide-react';
import { money } from '@/lib/format';
import { ErrorState, Skeleton } from './ui-states';
import { pitch } from '@/lib/help-center';

const ago = (d?: string | null) => { if (!d) return 'jamais'; const h = (Date.now() - new Date(d).getTime()) / 36e5; return h < 24 ? `il y a ${Math.max(1, Math.round(h))} h` : `il y a ${Math.round(h / 24)} j`; };
const tierLabel: Record<string, string> = { CONNECT: 'Gratuit', TRIAL: 'Essai', PRO: 'Pro' };

export function SaasGrowth() {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState(''); const [n, setN] = useState(0);
  useEffect(() => { setErr(''); fetch('/api/platform/growth', { cache: 'no-store' }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Chargement impossible'); setD(j); }).catch(e => setErr(e.message)); }, [n]);
  if (err) return <section className="control-content"><ErrorState message={err} onRetry={() => setN(x => x + 1)} /></section>;
  if (!d) return <section className="control-content"><Skeleton card lines={6} /></section>;
  const k = d.kpis, max = Math.max(1, ...d.series.map((x: any) => x.count)), maxR = Math.max(1, ...d.regions.map((x: any) => x.count));
  const Row = ({ r, extra }: { r: any; extra: string }) => <li><div><b>{r.name}</b><small>{r.region} · {extra}</small></div><span className={'gr-tier gr-tier--' + r.tier}>{tierLabel[r.tier]}</span>{r.wa ? <a className="btn btn-soft btn-sm" href={r.wa} target="_blank" rel="noreferrer"><MessageCircle size={14} /> WhatsApp</a> : <span className="gr-nophone">pas de téléphone</span>}</li>;
  return <section className="control-content gr">
    <div className="section-toolbar"><div><h2>Croissance</h2><p>Inscriptions, activation et revenus · 30 derniers jours</p></div><button className="btn btn-soft btn-sm" onClick={() => setN(x => x + 1)}><RefreshCw size={14} /> Actualiser</button></div>
    <div className="gr-kpis">
      <article><UserPlus size={18} /><span>Nouveaux ateliers</span><b>{k.signups30}</b><small>{k.signups7} cette semaine · {k.suppliers30} fournisseur(s)</small></article>
      <article><Rocket size={18} /><span>Activation</span><b>{k.activationPct} %</b><small>{k.activated} ont commandé dans les 7 jours</small></article>
      <article><Wallet size={18} /><span>Revenu mensuel</span><b>{money(k.mrr)}</b><small>{k.paying} abonné(s) payant(s) · {k.conversionPct} % du réseau</small></article>
      <article><TrendingUp size={18} /><span>Essais en cours</span><b>{k.trials}</b><small>{d.trialsEnding.length} se terminent sous 3 jours</small></article>
      <article className={k.lost30 ? 'is-bad' : ''}><TrendingDown size={18} /><span>Abonnements perdus</span><b>{k.lost30}</b><small>expirés ou annulés sur 30 jours</small></article>
    </div>
    <div className="gr-two">
      <div className="control-panel gr-chart"><h3><Activity size={16} /> Inscriptions par jour</h3>
        <div className="gr-bars" role="img" aria-label={`${k.signups30} inscriptions sur 30 jours`}>{d.series.map((x: any) => <i key={x.day} style={{ height: `${Math.max(3, x.count / max * 100)}%` }} className={x.count ? '' : 'z'} title={`${x.day} : ${x.count}`} />)}</div>
        <div className="gr-axis"><span>{d.series[0]?.day.slice(5)}</span><span>aujourd’hui</span></div></div>
      <div className="control-panel"><h3>Par gouvernorat</h3>{d.regions.length ? <ul className="gr-regions">{d.regions.slice(0, 10).map((r: any) => <li key={r.region}><span>{r.region}</span><i><b style={{ width: r.count / maxR * 100 + '%' }} /></i><em>{r.count}</em></li>)}</ul> : <p className="gr-empty">Aucune inscription sur la période.</p>}</div>
    </div>
    <div className="gr-three">
      <div className="control-panel"><h3><UserPlus size={16} /> Nouveaux inscrits <small>message de bienvenue</small></h3>{d.newcomers.length ? <ul className="gr-list">{d.newcomers.map((r: any) => <Row key={r.tenantId} r={r} extra={`${ago(r.createdAt)} · ${r.orders} commande(s)`} />)}</ul> : <p className="gr-empty">Personne pour l’instant.</p>}</div>
      <div className="control-panel"><h3><CalendarClock size={16} /> Essais qui se terminent</h3>{d.trialsEnding.length ? <ul className="gr-list">{d.trialsEnding.map((r: any) => <Row key={r.tenantId} r={r} extra={`fin ${new Date(r.trialEndsAt).toLocaleDateString('fr-TN')}`} />)}</ul> : <p className="gr-empty">Aucun essai ne se termine sous 3 jours.</p>}</div>
      <div className="control-panel"><h3><TrendingDown size={16} /> Inactifs depuis 7 jours</h3>{d.inactive.length ? <ul className="gr-list">{d.inactive.map((r: any) => <Row key={r.tenantId} r={r} extra={`vu ${ago(r.lastSeenAt)}`} />)}</ul> : <p className="gr-empty">Tous les ateliers sont actifs.</p>}</div>
    </div>
    <div className="control-panel gr-pitch"><h3><MessageCircle size={16} /> Message de présentation <small>à envoyer aux ateliers que vous démarchez</small></h3>
      {(['fr', 'ar'] as const).map(l => { const t = pitch('Fixi', (typeof window !== 'undefined' ? window.location.origin : '') + '/inscription')[l]; return <div key={l} className="gr-pitch-row" dir={l === 'ar' ? 'rtl' : 'ltr'}><p data-no-i18n>{t}</p><div><button className="btn btn-soft btn-sm" onClick={() => navigator.clipboard?.writeText(t)}>Copier</button><a className="btn btn-soft btn-sm" href={'https://wa.me/?text=' + encodeURIComponent(t)} target="_blank" rel="noreferrer">WhatsApp</a></div></div>; })}
      <p className="gr-note">Guide en ligne à partager : <a href="/aide" target="_blank">/aide</a> (atelier, fournisseur, livreur, en français et en arabe).</p></div>
    <p className="gr-note">Les boutons WhatsApp ouvrent un message prêt à envoyer depuis votre téléphone : rien n’est envoyé automatiquement.</p>
  </section>;
}
