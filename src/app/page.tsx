'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { ArrowRight, BellRing, Boxes, Check, CheckCircle2, ChevronsRight, CreditCard, Download, MapPin, Menu, MessageCircle, Monitor, PackageCheck, Play, ScanLine, ShieldCheck, Smartphone, Sparkles, Star, Store, Truck, Users, Wrench, X, Zap, BarChart3, Mic, Wifi } from 'lucide-react';
import { AdSlot } from '@/components/ad-slot';
import { LandingFaq } from '@/components/landing-faq';
import { LandingFlowDemo, LandingPricing, LandingStores } from '@/components/landing-sections';
import './landing-v17.css';

const WINDOWS_URL = 'https://github.com/dalimouxx/fixi-web/releases/download/windows-latest/FIXI-Caisse-Setup.exe';

/** Fait apparaître un bloc quand il entre à l'écran (une seule fois). */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (!('IntersectionObserver' in window)) { el.classList.add('is-in'); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('is-in'); io.disconnect(); } }, { threshold: .18, rootMargin: '0px 0px -40px 0px' });
    io.observe(el); return () => io.disconnect();
  }, []);
  return ref;
}
function Reveal({ children, className = '', as: Tag = 'div', delay = 0, id }: { children: ReactNode; className?: string; as?: any; delay?: number; id?: string }) {
  const ref = useReveal<HTMLDivElement>();
  return <Tag ref={ref} id={id} className={'lp-reveal ' + className} style={{ '--d': delay + 'ms' } as CSSProperties}>{children}</Tag>;
}
/** Compteur qui monte jusqu'à sa valeur quand il devient visible. */
function Counter({ to, suffix = '', prefix = '' }: { to: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null); const [v, setV] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; io.disconnect();
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(to); return; }
      const t0 = performance.now(), dur = 1400;
      const tick = (t: number) => { const p = Math.min(1, (t - t0) / dur); setV(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }, { threshold: .5 });
    io.observe(el); return () => io.disconnect();
  }, [to]);
  return <span ref={ref}>{prefix}{v.toLocaleString('fr-FR')}{suffix}</span>;
}
/** Mot qui change dans le titre. */
function Rotator({ words }: { words: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI(x => (x + 1) % words.length), 2600); return () => clearInterval(t); }, [words.length]);
  return <span className="lp-rotator" aria-live="polite">{words.map((w, k) => <b key={w} className={k === i ? 'is-on' : ''} aria-hidden={k !== i}>{w}</b>)}</span>;
}
/** Carte qui s'incline légèrement sous la souris. */
function Tilt({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  function move(e: React.PointerEvent) { const el = ref.current; if (!el || e.pointerType !== 'mouse') return; const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; el.style.setProperty('--rx', (-y * 8).toFixed(2) + 'deg'); el.style.setProperty('--ry', (x * 10).toFixed(2) + 'deg'); el.style.setProperty('--mx', (x * 100 + 50) + '%'); el.style.setProperty('--my', (y * 100 + 50) + '%'); }
  function leave() { const el = ref.current; if (!el) return; el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); }
  return <div ref={ref} className={'lp-tilt ' + className} onPointerMove={move} onPointerLeave={leave}>{children}</div>;
}
function Logo({ size = 34 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" className="lp-logo-svg"><defs><linearGradient id="lpg" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#F0782B" /><stop offset="1" stopColor="#B9470A" /></linearGradient></defs><rect x="16" y="16" width="480" height="480" rx="112" fill="url(#lpg)" /><g transform="translate(256 256) scale(.86) translate(-262 -250)" fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round"><path d="M167 374V151a25 25 0 0 1 25-25h156" strokeWidth="65" /><path d="M167 244h140" strokeWidth="65" /><path d="m296 375 76-76m0 76-76-76" strokeWidth="43" /></g></svg>;
}

const apps = [
  { k: 'atelier', icon: '/icons/atelier.svg', title: 'Fixi Atelier', tag: 'Pour le réparateur', text: 'Réception en 4 étapes, photos, dictée vocale, suivi client par WhatsApp, caisse et rapport du mois.', points: ['Réception express', 'Suivi client en direct', 'Caisse et garanties'], href: '/login', cta: 'Ouvrir l’atelier', color: '#f0782b' },
  { k: 'supplier', icon: '/icons/supplier.svg', title: 'Fixi Fournisseur', tag: 'Pour le grossiste', text: 'Catalogue partagé, commandes des ateliers, préparation, factures, dettes clients et statistiques de marge.', points: ['Commandes en colonnes', 'Catalogue WhatsApp', 'Factures numérotées'], href: '/supplier/login', cta: 'Espace fournisseur', color: '#a8a29e' },
  { k: 'delivery', icon: '/icons/delivery.svg', title: 'Fixi Livreur', tag: 'Pour le livreur', text: 'Missions en temps réel, glisser pour accepter, tournée optimisée, preuve de remise et caisse du jour.', points: ['Alerte nouvelle mission', 'Itinéraire optimisé', 'Preuve de remise'], href: '/delivery/login', cta: 'Espace livreur', color: '#16a34a' },
  { k: 'windows', icon: '', title: 'FIXI Caisse Windows', tag: 'Pour le comptoir', text: 'Point de vente PC : scanner, tiroir-caisse, écran client, ventes même sans Internet et mise à jour automatique.', points: ['Ventes hors ligne', 'Plusieurs caissiers', 'Rapport Z'], href: WINDOWS_URL, cta: 'Télécharger pour Windows', color: '#2563eb' },
];
const steps = [
  { t: 'Reçu', d: 'Le client dépose son téléphone : photo, panne, prix en 30 secondes.', icon: Smartphone },
  { t: 'Diagnostic', d: 'Le technicien voit les cas similaires et le prix habituel du réseau.', icon: Wrench },
  { t: 'Pièce commandée', d: 'Un toucher envoie la commande au fournisseur, le livreur l’apporte.', icon: Truck },
  { t: 'Prêt', d: 'Le client reçoit un WhatsApp avec le lien de suivi et le prix.', icon: MessageCircle },
  { t: 'Rendu', d: 'Encaissement, garantie et avis client, tout est tracé.', icon: CheckCircle2 },
];
const brands = ['Samsung', 'Apple', 'Xiaomi', 'Oppo', 'Infinix', 'Tecno', 'Huawei', 'Realme', 'Itel', 'Honor', 'Nokia', 'Vivo'];

export default function Landing() {
  const [brand, setBrand] = useState<any>(null);
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const hero = useRef<HTMLElement>(null);
  useEffect(() => { fetch('/api/public/branding').then(r => r.json()).then(setBrand).catch(() => { }); }, []);
  useEffect(() => { const f = () => setScrolled(scrollY > 12); f(); addEventListener('scroll', f, { passive: true }); return () => removeEventListener('scroll', f); }, []);
  // Les téléphones du héros suivent doucement la souris.
  function parallax(e: React.PointerEvent) { const el = hero.current; if (!el || e.pointerType !== 'mouse') return; const r = el.getBoundingClientRect(); el.style.setProperty('--px', ((e.clientX - r.left) / r.width - .5).toFixed(3)); el.style.setProperty('--py', ((e.clientY - r.top) / r.height - .5).toFixed(3)); }
  const name = brand?.appName || 'Fixi';

  return <div className="lp">
    <nav className={'lp-nav' + (scrolled ? ' is-solid' : '')}>
      <a href="#top" className="lp-brand">{brand?.logoDataUrl ? <img src={brand.logoDataUrl} alt="" /> : <Logo />}<span>{name}</span></a>
      <div className={'lp-links' + (menu ? ' is-open' : '')} onClick={() => setMenu(false)}>
        <a href="#apps">Applications</a><a href="#comment">Comment ça marche</a><a href="#demo">Démo</a><a href="#tarifs">Tarifs</a><Link href="/stores">Boutiques</Link><a href="#faq">FAQ</a>
        <Link className="lp-btn lp-btn--ghost lp-only-mobile" href="/login">Connexion</Link>
      </div>
      <div className="lp-nav-cta"><Link className="lp-btn lp-btn--ghost lp-hide-mobile" href="/login">Connexion</Link><Link className="lp-btn lp-btn--primary" href="/inscription">Commencer <ArrowRight size={16} /></Link>
        <button className="lp-burger" aria-label={menu ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={menu} onClick={() => setMenu(v => !v)}>{menu ? <X size={22} /> : <Menu size={22} />}</button></div>
    </nav>

    {/* ---------- Héros ---------- */}
    <header className="lp-hero" id="top" ref={hero} onPointerMove={parallax}>
      <div className="lp-aurora"><i /><i /><i /></div><div className="lp-grid" />
      <div className="lp-hero-copy">
        <span className="lp-pill"><span className="lp-live" /> Nouveau · application livreur et caisse Windows</span>
        <h1>{brand?.landingHeadline || <>Le réseau qui fait tourner<br /><Rotator words={['les ateliers', 'les fournisseurs', 'les livreurs', 'le comptoir']} /></>}</h1>
        <p>{brand?.landingSubheadline || 'Réparations, pièces, livraisons et caisse : tout le monde de la réparation de téléphones connecté dans une seule application, en français et en arabe.'}</p>
        <div className="lp-hero-actions">
          <Link className="lp-btn lp-btn--primary lp-btn--lg lp-shine" href="/inscription">Essayer gratuitement <ArrowRight size={18} /></Link>
          <a className="lp-play" href="#demo"><i><Play size={18} /></i><span>Voir la démo<small>Une réparation en 60 secondes</small></span></a>
        </div>
        <ul className="lp-trust"><li><Check size={16} /> Compte gratuit</li><li><Check size={16} /> Sans installation</li><li><Check size={16} /> Android &amp; Windows</li></ul>
      </div>

      <div className="lp-stage" aria-hidden="true">
        <div className="lp-phone lp-phone--a">
          <div className="lp-screen lp-s-atelier">
            <div className="lp-s-hero"><small>Mercredi</small><b>Que voulez-vous faire ?</b><div className="lp-s-kpis"><span><b>485 DT</b>Caisse</span><span><b>6</b>En cours</span><span><b>3</b>À rendre</span></div></div>
            {[['Galaxy A54', 'Écran cassé', 'Prêt', 'ok'], ['iPhone 12', 'Batterie', 'Attente pièce', 'warn'], ['Redmi Note 12', 'Charge', 'En réparation', 'info']].map(([m, p, s, t], i) => <div className="lp-s-card" key={m} style={{ '--i': i } as CSSProperties}><div><b>{m}</b><small>{p}</small></div><em className={'t-' + t}>{s}</em></div>)}
          </div>
        </div>
        <div className="lp-phone lp-phone--b">
          <div className="lp-screen lp-s-driver">
            <div className="lp-s-dark"><small><i /> EN SERVICE</small><b>2 livraisons en cours</b></div>
            <div className="lp-s-offer"><span>CMD-1052</span><b>Atelier Smart Fix</b><small><MapPin size={11} /> Gabès</small><div className="lp-s-slide"><i><ChevronsRight size={14} /></i>Glisser pour accepter</div></div>
            <div className="lp-s-steps">{[0, 1, 2, 3].map(x => <i key={x} className={x < 2 ? 'done' : x === 2 ? 'now' : ''} />)}</div>
          </div>
        </div>
        <div className="lp-float lp-float--1"><BellRing size={16} /><span><b>Nouvelle mission</b><small>Atelier Smart Fix · 420 DT</small></span></div>
        <div className="lp-float lp-float--2"><MessageCircle size={16} /><span><b>WhatsApp envoyé</b><small>« Votre Galaxy A54 est prêt »</small></span></div>
        <div className="lp-float lp-float--3"><Zap size={16} /><span><b>+ 2 840 DT</b><small>aujourd’hui</small></span></div>
      </div>
      <a href="#apps" className="lp-scroll" aria-label="Défiler"><span /></a>
    </header>

    {/* ---------- Bande de marques ---------- */}
    <section className="lp-marquee" aria-label="Marques réparées"><div className="lp-marquee-track">{[...brands, ...brands].map((b, i) => <span key={i}>{b}</span>)}</div></section>

    {/* ---------- Chiffres ---------- */}
    <section className="lp-stats">
      {[[4, '', 'applications connectées'], [30, ' s', 'pour recevoir un appareil'], [2, '', 'langues : français et arabe'], [24, '/7', 'suivi client en ligne']].map(([n, s, l], i) => <Reveal key={String(l)} className="lp-stat" delay={i * 90}><b><Counter to={Number(n)} suffix={String(s)} /></b><span>{l}</span></Reveal>)}
    </section>

    {/* ---------- Les applications ---------- */}
    <section className="lp-section" id="apps">
      <Reveal className="lp-head"><span className="lp-eyebrow">UNE APPLICATION PAR MÉTIER</span><h2>Chacun son écran.<br /><em>Tout le monde connecté.</em></h2><p>L’atelier commande, le fournisseur prépare, le livreur livre, la caisse encaisse. Chaque geste met à jour les autres en temps réel.</p></Reveal>
      <div className="lp-apps">{apps.map((a, i) => <Reveal key={a.k} delay={i * 100}><Tilt className="lp-app">
        <div className="lp-app-glow" style={{ background: a.color }} />
        <div className="lp-app-top">{a.icon ? <img src={a.icon} alt="" width={56} height={56} /> : <span className="lp-app-win"><Monitor size={28} /></span>}<span className="lp-tag">{a.tag}</span></div>
        <h3>{a.title}</h3><p>{a.text}</p>
        <ul>{a.points.map(p => <li key={p}><CheckCircle2 size={16} /> {p}</li>)}</ul>
        {a.k === 'windows' ? <a className="lp-app-cta" href={a.href}><Download size={16} /> {a.cta}</a> : <Link className="lp-app-cta" href={a.href}>{a.cta} <ArrowRight size={16} /></Link>}
      </Tilt></Reveal>)}</div>
    </section>

    {/* ---------- Comment ça marche ---------- */}
    <section className="lp-section lp-dark" id="comment">
      <Reveal className="lp-head light"><span className="lp-eyebrow">COMMENT ÇA MARCHE</span><h2>Du dépôt au retrait,<br /><em>sans un papier.</em></h2></Reveal>
      <Reveal className="lp-flow">{steps.map((s, i) => { const I = s.icon; return <div className="lp-step" key={s.t} style={{ '--i': i } as CSSProperties}><i><I size={22} /></i><b>{s.t}</b><p>{s.d}</p></div>; })}<span className="lp-flow-line" /></Reveal>
    </section>

    {/* ---------- Grille de fonctions ---------- */}
    <section className="lp-section">
      <Reveal className="lp-head"><span className="lp-eyebrow">PENSÉ POUR LE TERRAIN</span><h2>Rapide au comptoir.<br /><em>Sérieux dans les chiffres.</em></h2></Reveal>
      <div className="lp-bento">
        <Reveal className="lp-b lp-b--wide" delay={0}><div className="lp-b-text"><span><BarChart3 size={18} /> Rapport du mois</span><h3>Vos chiffres, sans Excel.</h3><p>Encaissé, bénéfice, pannes fréquentes et performance de chaque technicien, en PDF et en fichier pour le comptable.</p></div>
          <svg className="lp-chart" viewBox="0 0 300 120" preserveAspectRatio="none"><defs><linearGradient id="lpc" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#f0782b" stopOpacity=".35" /><stop offset="1" stopColor="#f0782b" stopOpacity="0" /></linearGradient></defs><path className="lp-chart-area" d="M0 100 C40 95 50 70 90 76 S150 40 190 48 S250 18 300 22 L300 120 L0 120Z" fill="url(#lpc)" /><path className="lp-chart-line" d="M0 100 C40 95 50 70 90 76 S150 40 190 48 S250 18 300 22" fill="none" stroke="#f0782b" strokeWidth="4" strokeLinecap="round" /></svg></Reveal>
        <Reveal className="lp-b" delay={80}><span><Mic size={18} /> Dictée vocale</span><h3>Parlez, Fixi écrit.</h3><p>« Client Sami, Samsung A15, écran cassé » remplit la fiche.</p><div className="lp-wave">{Array.from({ length: 18 }).map((_, i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}</div></Reveal>
        <Reveal className="lp-b" delay={160}><span><ScanLine size={18} /> Scanner &amp; IMEI</span><h3>Un scan, c’est fait.</h3><p>Code-barres des pièces et IMEI vérifié contre les appareils signalés volés.</p><div className="lp-scanbox"><i /></div></Reveal>
        <Reveal className="lp-b" delay={0}><span><CreditCard size={18} /> Caisse</span><h3>Espèces, carte, D17.</h3><p>Paiement en plusieurs fois, monnaie à rendre et facture numérotée.</p><div className="lp-pay"><b>239,500 DT</b><small>Monnaie : 60,500 DT</small></div></Reveal>
        <Reveal className="lp-b" delay={80}><span><Wifi size={18} /> Hors ligne</span><h3>Internet coupe ? La vente continue.</h3><p>La caisse garde les ventes et les envoie au retour du réseau, sans doublon.</p></Reveal>
        <Reveal className="lp-b lp-b--accent" delay={160}><span><ShieldCheck size={18} /> Sécurité</span><h3>Simple devant, sérieux derrière.</h3><p>Codes PIN chiffrés, données isolées par boutique, journal de toutes les actions.</p></Reveal>
      </div>
    </section>

    <LandingFlowDemo />

    {/* ---------- Ce qui change ---------- */}
    <section className="lp-section lp-soft">
      <Reveal className="lp-head"><span className="lp-eyebrow">AU QUOTIDIEN</span><h2>Fait en Tunisie,<br /><em>pour les ateliers d’ici.</em></h2></Reveal>
      <div className="lp-quotes">{[[MessageCircle, 'Fini les appels « c’est prêt ? »', 'Le client reçoit son WhatsApp et suit sa réparation avec un lien, sans compte.'], [Truck, 'Les pièces arrivent plus vite', 'L’atelier commande en un toucher, le fournisseur prépare, le livreur est alerté.'], [Users, 'Chacun voit son travail', 'Gérant, réception, technicien, caissier, livreur : un écran adapté à chaque rôle.']].map(([I, t, d]: any, i) => <Reveal key={t} className="lp-quote" delay={i * 100}><i className="lp-quote-ico"><I size={22} /></i><h3>{t}</h3><p>{d}</p></Reveal>)}</div>
    </section>

    <section className="lp-sponsored"><AdSlot placement="LANDING" className="landing-ad-v4" /></section>
    <LandingPricing />

    <LandingStores />

    <div className="lp-faq" id="faq"><LandingFaq /></div>

    {/* ---------- Appel final ---------- */}
    <section className="lp-final">
      <Reveal className="lp-final-card"><div className="lp-aurora small"><i /><i /></div>
        <Logo size={64} />
        <h2>Prêt à passer à <em>{name}</em> ?</h2>
        <p>Créez votre atelier en 2 minutes. 30 jours pour essayer, sans engagement.</p>
        <div className="lp-hero-actions center"><Link className="lp-btn lp-btn--primary lp-btn--lg lp-shine" href="/inscription">Créer mon atelier <ArrowRight size={18} /></Link><Link className="lp-btn lp-btn--glass lp-btn--lg" href="/android"><Smartphone size={18} /> Application Android</Link><a className="lp-btn lp-btn--glass lp-btn--lg" href={WINDOWS_URL}><Monitor size={18} /> Caisse Windows</a></div>
      </Reveal>
    </section>

    <footer className="lp-footer">
      <div className="lp-brand"><Logo size={30} /><span>{name}</span></div>
      <nav><a href="#apps">Applications</a><Link href="/stores">Boutiques</Link><Link href="/login">Atelier</Link><Link href="/supplier/login">Fournisseur</Link><Link href="/delivery/login">Livreur</Link><Link href="/saas/login">Control</Link></nav>
      <div className="lp-legal"><Link href="/conditions">Conditions</Link><Link href="/confidentialite">Confidentialité</Link><Link href="/mentions-legales">Mentions légales</Link></div>
      <small>© {new Date().getFullYear()} {name} · Fait à Gabès, Tunisie</small>
    </footer>
  </div>;
}
