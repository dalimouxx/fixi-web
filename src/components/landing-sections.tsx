'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, Camera, Check, CheckCircle2, Clock3, CreditCard, FileSearch, LocateFixed, MapPin, MessageCircle, Navigation, Pause, Phone, Play, Search, ShieldCheck, Smartphone, Sparkles, Star, Store, Wrench, Zap } from 'lucide-react';

const dt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(n) + ' DT';

/* =============== 1. Démo : une réparation complète, qui se joue toute seule =============== */
const STEPS = [
  { t: 'Réception', icon: Smartphone, title: 'Le client dépose son téléphone', text: 'Numéro du client, modèle, panne et photo : la fiche est prête en 30 secondes.', data: [['Client', 'Mohamed · 21 555 497'], ['Appareil', 'iPhone 13'], ['Panne', 'Écran cassé']] },
  { t: 'Diagnostic', icon: FileSearch, title: 'Fixi aide à chiffrer', text: 'Les réparations similaires et le prix habituel du réseau s’affichent tout de suite.', data: [['Cas similaires', '18 réparations'], ['Durée moyenne', '52 min'], ['Prix conseillé', '210 DT']] },
  { t: 'Réparation', icon: Wrench, title: 'Le technicien répare', text: 'La pièce utilisée sort du stock automatiquement, l’historique se met à jour.', data: [['Technicien', 'Ahmed'], ['Pièce', 'Écran OLED × 1'], ['Stock', '8 → 7']] },
  { t: 'Prêt', icon: MessageCircle, title: 'Le client est prévenu', text: 'Contrôle qualité validé : un WhatsApp part avec le lien de suivi et le prix.', data: [['Contrôle', '8 / 8 points'], ['WhatsApp', 'Envoyé ✓'], ['Garantie', '90 jours']] },
  { t: 'Paiement', icon: CreditCard, title: 'Paiement et remise', text: 'Espèces, carte ou D17, ticket imprimé, garantie démarrée.', data: [['Espèces', '100 DT'], ['D17', '110 DT'], ['Reste', '0 DT']] },
];
const DURATION = 5200;

export function LandingFlowDemo() {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(false);
  const root = useRef<HTMLElement>(null);
  useEffect(() => { const el = root.current; if (!el) return; const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: .35 }); io.observe(el); return () => io.disconnect(); }, []);
  useEffect(() => { if (!playing || !visible) return; const t = setTimeout(() => setI(x => (x + 1) % STEPS.length), DURATION); return () => clearTimeout(t); }, [i, playing, visible]);
  const s = STEPS[i];
  return <section className="lps lps-demo" id="demo" ref={root}>
    <div className="lps-head"><span className="lps-eyebrow">DÉMO EN 5 ÉTAPES</span><h2>Une réparation complète,<br /><em>du dépôt au paiement.</em></h2><p>Regardez une réparation passer dans Fixi. Touchez une étape pour la revoir.</p></div>
    <div className="lps-demo-grid" style={{ '--dur': DURATION + 'ms' } as CSSProperties}>
      <ol className="lps-steps">{STEPS.map((x, k) => { const I = x.icon; return <li key={x.t}>
        <button type="button" className={k === i ? 'is-on' : k < i ? 'is-done' : ''} onClick={() => { setI(k); setPlaying(false); }} aria-current={k === i ? 'step' : undefined}>
          <i>{k < i ? <Check size={18} /> : <I size={18} />}</i>
          <span><b>{x.t}</b><small>{x.title}</small></span>
          {k === i && <em className={'lps-timer' + (playing && visible ? ' is-run' : '')} key={i + String(playing)} />}
        </button></li>; })}
        <li className="lps-play"><button type="button" onClick={() => setPlaying(p => !p)}>{playing ? <><Pause size={15} /> Pause</> : <><Play size={15} /> Lecture automatique</>}</button></li>
      </ol>
      <div className="lps-device">
        <div className="lps-phone"><div className="lps-phone-screen" key={i}>
          <header><span className="lps-chip"><i />{s.t}</span><small>Étape {i + 1} / {STEPS.length}</small></header>
          {i === 0 && <div className="lps-sc lps-sc-form"><label>Téléphone<b className="lps-type">21 555 497</b></label><label>Appareil<b className="lps-type d2">iPhone 13</b></label><label>Panne<b className="lps-type d3">Écran cassé</b></label><div className="lps-photo"><Camera size={18} /> Photo avant réparation <Check size={16} /></div></div>}
          {i === 1 && <div className="lps-sc"><div className="lps-price"><small>Prix conseillé</small><b>210 DT</b><span>fourchette 190 – 230 DT</span></div>{['iPhone 13 · écran · 205 DT', 'iPhone 13 · écran · 215 DT', 'iPhone 13 Pro · écran · 260 DT'].map((x, k) => <div className="lps-row" key={x} style={{ '--k': k } as CSSProperties}><Sparkles size={14} />{x}</div>)}</div>}
          {i === 2 && <div className="lps-sc"><div className="lps-stock"><span>Écran OLED iPhone 13</span><div><b className="lps-old">8</b><ArrowRight size={18} /><b className="lps-new">7</b></div><small>en stock</small></div><div className="lps-bar"><i /></div><div className="lps-row" style={{ '--k': 1 } as CSSProperties}><Wrench size={14} /> Ahmed · en réparation</div></div>}
          {i === 3 && <div className="lps-sc lps-sc-chat"><div className="lps-bubble">Bonjour Mohamed 👋 Votre <b>iPhone 13</b> est prêt. Montant : <b>210 DT</b>. Suivi : fixi.tn/t/F-2604</div><small className="lps-read">✓✓ Lu</small><div className="lps-checks">{['Écran', 'Tactile', 'Caméra', 'Charge'].map((x, k) => <span key={x} style={{ '--k': k } as CSSProperties}><CheckCircle2 size={14} />{x}</span>)}</div></div>}
          {i === 4 && <div className="lps-sc"><div className="lps-total"><small>Total</small><b>210 DT</b></div><div className="lps-split"><span style={{ flex: 100 }}>Espèces 100</span><span style={{ flex: 110 }}>D17 110</span></div><div className="lps-done"><CheckCircle2 size={22} /> Payé · ticket imprimé</div></div>}
        </div></div>
        <aside className="lps-data" key={'d' + i}><span><Zap size={14} /> MIS À JOUR AUTOMATIQUEMENT</span><h3>{s.title}</h3><p>{s.text}</p><dl>{s.data.map(([k, v], n) => <div key={k} style={{ '--k': n } as CSSProperties}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></aside>
      </div>
    </div>
  </section>;
}

/* =============== 2. Tarifs : clairs, avec l'équivalent par mois =============== */
const UNIT: Record<string, [string, number]> = { DAY: ['jour', 1 / 30], WEEK: ['semaine', 7 / 30], MONTH: ['mois', 1], YEAR: ['an', 12] };
function perMonth(p: any) { const [, m] = UNIT[p.durationUnit] || ['mois', 1]; const months = Math.max(1 / 30, Number(p.durationValue || 1) * m); return Number(p.price || 0) / months; }
function useCountUp(to: number, run: boolean) { const [v, setV] = useState(0); useEffect(() => { if (!run) return; if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(to); return; } const t0 = performance.now(); let raf = 0; const f = (t: number) => { const p = Math.min(1, (t - t0) / 900); setV(to * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(f); }; raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf); }, [to, run]); return v; }
function Price({ value, run }: { value: number; run: boolean }) { const v = useCountUp(value, run); return <>{new Intl.NumberFormat('fr-FR', { maximumFractionDigits: value % 1 ? 3 : 0 }).format(Math.round(v * 1000) / 1000)}</>; }

export function LandingPricing() {
  const [plans, setPlans] = useState<any[] | null>(null);
  const [seen, setSeen] = useState(false);
  const root = useRef<HTMLElement>(null);
  useEffect(() => { fetch('/api/public/plans').then(r => r.json()).then(j => setPlans(Array.isArray(j) ? j : [])).catch(() => setPlans([])); }, []);
  useEffect(() => { const el = root.current; if (!el) return; const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: .25 }); io.observe(el); return () => io.disconnect(); }, []);
  const list = plans || [];
  // Économie calculée par rapport à l'offre la plus courte (en général le mois).
  const months=(p:any)=>Number(p.durationValue||1)*((UNIT[p.durationUnit]||['',1])[1] as number);
  const shortest=[...list].sort((a,b)=>months(a)-months(b))[0];
  const baseMonthly = shortest?perMonth(shortest):0;
  const featured = list.length >= 3 ? 1 : list.length - 1;
  return <section className="lps lps-pricing" id="tarifs" ref={root}>
    <div className="lps-head center"><span className="lps-eyebrow">TARIFS SIMPLES</span><h2>Un prix clair.<br /><em>Sans surprise.</em></h2><p>Toutes les fonctions sont incluses dans chaque offre. Plus la durée est longue, moins le mois coûte cher.</p></div>
    {plans === null ? <div className="lps-plans">{[0, 1, 2].map(k => <div key={k} className="lps-plan is-skeleton" />)}</div> :
      list.length === 0 ? <div className="lps-plan lps-plan--solo"><Sparkles size={28} /><h3>30 jours pour essayer</h3><p>Créez votre atelier, testez tout, et choisissez votre formule ensuite.</p><Link className="lps-cta" href="/onboarding">Commencer gratuitement <ArrowRight size={18} /></Link></div> :
        <div className={'lps-plans' + (seen ? ' is-in' : '')}>{list.map((p, k) => {
          const pm = perMonth(p), save = baseMonthly > 0 && p!==shortest ? Math.round((1 - pm / baseMonthly) * 100) : 0;
          const [unit] = UNIT[p.durationUnit] || ['mois'];
          const feats: string[] = Array.isArray(p.features) ? p.features.filter((x: any) => typeof x === 'string') : [];
          return <article key={p.id} className={'lps-plan' + (k === featured ? ' is-featured' : '')} style={{ '--k': k } as CSSProperties}>
            {k === featured && <span className="lps-badge"><Star size={13} /> Le plus choisi</span>}
            <h3>{p.name}</h3><p>{p.description || 'Toutes les fonctions Fixi.'}</p>
            <div className="lps-amount"><b><Price value={Number(p.price || 0)} run={seen} /></b><span>DT<small>/ {Number(p.durationValue) > 1 ? p.durationValue + ' ' : ''}{unit}{Number(p.durationValue) > 1 && unit !== 'mois' ? 's' : ''}</small></span></div>
            <div className="lps-month">{p.durationUnit !== 'MONTH' || Number(p.durationValue) !== 1 ? <>soit <b>{dt(Math.round(pm * 1000) / 1000)}</b> par mois</> : <>payé chaque mois</>}{save >= 5 && <em>−{save} %</em>}</div>
            <ul>
              <li><Check size={16} /> {p.maxShops > 1 ? p.maxShops + ' boutiques' : '1 boutique'}</li>
              <li><Check size={16} /> {p.maxUsersPerShop} utilisateurs par boutique</li>
              {p.trialDays > 0 && <li><Check size={16} /> {p.trialDays} jours d’essai gratuit</li>}
              {feats.slice(0, 4).map(f => <li key={f}><Check size={16} /> {f}</li>)}
              <li><Check size={16} /> Application Android et suivi client</li>
            </ul>
            <Link className={'lps-cta' + (k === featured ? '' : ' is-ghost')} href="/onboarding">Choisir {p.name} <ArrowRight size={18} /></Link>
          </article>;
        })}</div>}
    <div className="lps-custom"><ShieldCheck size={20} /><span><b>Besoin d’une durée ou d’un prix différent ?</b> Plusieurs boutiques, 45 jours, 3 mois… Fixi crée une offre sur mesure pour votre atelier.</span><a href="#faq">En savoir plus</a></div>
  </section>;
}

/* =============== 3. Annuaire : trouver un atelier près de soi =============== */
type Shop = { id: string; name: string; slug: string; region: string; city?: string | null; address?: string | null; phone?: string | null; whatsappPhone?: string | null; latitude?: number | null; longitude?: number | null; logoDataUrl?: string | null; publicDescription?: string | null; publicServices: string[]; openingHours?: any; publicFeatured: boolean; rating?: number | null; reviewCount: number; distance?: number };
const rad = (v: number) => v * Math.PI / 180;
const km = (a: number, b: number, c: number, d: number) => { const h = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
const wa = (v?: string | null) => { let n = String(v || '').replace(/\D/g, ''); if (n.startsWith('00')) n = n.slice(2); if (n.length === 8) n = '216' + n; return n ? 'https://wa.me/' + n : ''; };
function todayHours(h: any) { if (!h) return ''; const d = new Date().getDay(); return d === 0 ? h.sunday : d === 6 ? h.saturday : h.weekdays; }
function isOpen(h: any) { const x = todayHours(h); if (!x) return null; if (/ferm/i.test(x)) return false; const m = String(x).match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/); if (!m) return null; const n = new Date(), t = n.getHours() * 60 + n.getMinutes(); return t >= +m[1] * 60 + +m[2] && t <= +m[3] * 60 + +m[4]; }
// Emprise de la Tunisie pour placer les points sur la carte stylisée.
const BOX = { latMin: 30.2, latMax: 37.6, lngMin: 7.5, lngMax: 11.7 };
const pos = (s: Shop) => s.latitude == null || s.longitude == null ? null : { x: (Number(s.longitude) - BOX.lngMin) / (BOX.lngMax - BOX.lngMin) * 100, y: (BOX.latMax - Number(s.latitude)) / (BOX.latMax - BOX.latMin) * 100 };

export function LandingStores() {
  const [data, setData] = useState<{ stores: Shop[]; filters: any } | null>(null);
  const [q, setQ] = useState(''), [region, setRegion] = useState(''), [sel, setSel] = useState<string>(''), [locating, setLocating] = useState(false), [me, setMe] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => { fetch('/api/public/stores', { cache: 'no-store' }).then(r => r.json()).then(j => setData({ stores: Array.isArray(j?.stores) ? j.stores : [], filters: j?.filters || {} })).catch(() => setData({ stores: [], filters: {} })); }, []);
  const stores = useMemo(() => (data?.stores || []).filter(s => (!region || s.region === region) && (!q || [s.name, s.city, s.region, s.address, ...(s.publicServices || [])].some(x => String(x || '').toLowerCase().includes(q.toLowerCase())))), [data, q, region]);
  const shown = stores.slice(0, 6);
  const current = stores.find(s => s.id === sel) || shown[0];
  const regions: string[] = (data?.filters?.regions || []).slice(0, 8);
  function nearest() {
    if (!navigator.geolocation || !data) return; setLocating(true);
    navigator.geolocation.getCurrentPosition(p => {
      const list = data.stores.map(s => s.latitude != null && s.longitude != null ? { ...s, distance: km(p.coords.latitude, p.coords.longitude, Number(s.latitude), Number(s.longitude)) } : s).sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9));
      setData({ ...data, stores: list }); setRegion(''); setQ(''); setSel(list[0]?.id || ''); setLocating(false);
      setMe({ x: (p.coords.longitude - BOX.lngMin) / (BOX.lngMax - BOX.lngMin) * 100, y: (BOX.latMax - p.coords.latitude) / (BOX.latMax - BOX.latMin) * 100 });
    }, () => setLocating(false), { timeout: 8000 });
  }
  return <section className="lps lps-stores">
    <div className="lps-stores-grid">
      <div className="lps-stores-left">
        <div className="lps-head"><span className="lps-eyebrow">ANNUAIRE DES ATELIERS</span><h2>Trouvez un atelier Fixi<br /><em>près de chez vous.</em></h2><p>Appelez, écrivez sur WhatsApp ou lancez l’itinéraire en un toucher.</p></div>
        <div className="lps-search"><Search size={19} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Ville, quartier ou service (écran, batterie…)" /><button type="button" onClick={nearest} disabled={locating}><LocateFixed size={17} /> {locating ? 'Recherche…' : 'Le plus proche'}</button></div>
        {regions.length > 0 && <div className="lps-regions"><button type="button" aria-pressed={!region} onClick={() => setRegion('')}>Toutes</button>{regions.map(r => <button type="button" key={r} aria-pressed={region === r} onClick={() => setRegion(region === r ? '' : r)}>{r}</button>)}</div>}
        {!data ? <div className="lps-shops">{[0, 1, 2].map(k => <div key={k} className="lps-shop is-skeleton" />)}</div> :
          shown.length === 0 ? <div className="lps-empty"><Store size={30} /><b>Aucun atelier trouvé</b><span>Essayez une autre ville ou région.</span></div> :
            <div className="lps-shops">{shown.map((s, k) => { const open = isOpen(s.openingHours); const w = wa(s.whatsappPhone || s.phone); return <article key={s.id} className={'lps-shop' + (current?.id === s.id ? ' is-on' : '')} style={{ '--k': k } as CSSProperties} onMouseEnter={() => setSel(s.id)} onClick={() => setSel(s.id)}>
              <div className="lps-shop-logo">{s.logoDataUrl ? <img src={s.logoDataUrl} alt="" /> : <Store size={20} />}</div>
              <div className="lps-shop-main"><b>{s.name}</b><small><MapPin size={13} /> {[s.city, s.region].filter(Boolean).join(' · ')}{s.distance != null ? ` · ${s.distance.toFixed(1)} km` : ''}</small>
                <div className="lps-shop-tags">{open !== null && <span className={open ? 'is-open' : 'is-closed'}><Clock3 size={12} /> {open ? 'Ouvert' : 'Fermé'}</span>}{s.rating ? <span><Star size={12} /> {s.rating}</span> : null}{(s.publicServices || []).slice(0, 2).map(x => <span key={x}>{x}</span>)}</div></div>
              <div className="lps-shop-actions">{s.phone && <a href={'tel:' + s.phone.replace(/[^+\d]/g, '')} aria-label={'Appeler ' + s.name} onClick={e => e.stopPropagation()}><Phone size={17} /></a>}{w && <a href={w} target="_blank" rel="noreferrer" aria-label={'WhatsApp ' + s.name} onClick={e => e.stopPropagation()} className="is-wa"><MessageCircle size={17} /></a>}<Link href={'/stores/' + s.slug} aria-label={'Voir ' + s.name} onClick={e => e.stopPropagation()}><ArrowRight size={17} /></Link></div>
            </article>; })}</div>}
        <Link href="/stores" className="lps-all">Voir tous les ateliers ({data?.stores.length || 0}) <ArrowRight size={17} /></Link>
      </div>
      <div className="lps-map" aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="lps-tn"><path d="M44 2 L60 3 L66 9 L63 15 L70 18 L68 26 L74 30 L72 37 L80 41 L86 47 L78 53 L72 58 L76 64 L70 70 L62 74 L58 84 L54 98 L46 96 L44 84 L36 76 L30 66 L26 56 L30 46 L26 36 L30 26 L34 16 L38 8 Z" /></svg>
        {(data?.stores || []).map((s, k) => { const p = pos(s); if (!p) return null; return <span key={s.id} className={'lps-pin' + (current?.id === s.id ? ' is-on' : '')} style={{ left: p.x + '%', top: p.y + '%', '--k': k } as CSSProperties}><i /></span>; })}
        {me && <span className="lps-me" style={{ left: me.x + '%', top: me.y + '%' }}><i /></span>}
        {current && <div className="lps-map-card" key={current.id}><b>{current.name}</b><small>{current.address || [current.city, current.region].filter(Boolean).join(', ')}</small>
          <a href={current.latitude != null ? `https://www.google.com/maps/dir/?api=1&destination=${current.latitude},${current.longitude}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([current.name, current.city, current.region].filter(Boolean).join(', '))}`} target="_blank" rel="noreferrer"><Navigation size={15} /> Itinéraire</a></div>}
        <div className="lps-map-count"><b>{data?.stores.length || 0}</b><span>ateliers sur le réseau</span></div>
      </div>
    </div>
  </section>;
}
