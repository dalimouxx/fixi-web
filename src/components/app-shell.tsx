'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Search, LogOut, HelpCircle, ChevronRight, WifiOff, PlusCircle, PackageOpen, Sparkles, MonitorPlay } from 'lucide-react';
import { NotificationBell } from './notification-bell';
import { PwaRegister } from './pwa-register';
import { BrandLogo } from './brand-logo';
import { OfflineSyncBadge } from './offline-sync-badge';
import { InstallAppButton } from './install-app-button';
import { ThemeToggle } from './theme-toggle';
import { TextSizeToggle } from './text-size-toggle';
import { FxSheet } from './fx-sheet';
import { HelpSheet } from './help-sheet';
import { UniversalSearch } from './universal-search';
import { isConnectAppPath } from '@/lib/freemium';
import { visibleNav, matchNav, itemLabel, type NavSection } from '@/lib/nav-atelier';
import { useUiMode } from '@/lib/ui-mode';

export function AppShell({ children, user }: { children?: React.ReactNode; user: any }) {
  const p = usePathname();
  const router = useRouter();
  const connect = user.accessTier === 'CONNECT';
  const { advanced, setMode, mode } = useUiMode('atelier');
  const [search, setSearch] = useState(false);
  const [help, setHelp] = useState(false);
  const [more, setMore] = useState(false);
  const [online, setOnline] = useState(true);
  const allow = connect ? isConnectAppPath : undefined;

  // Menu affiché (selon le mode) et ensemble complet (pour la recherche).
  const sections = useMemo(() => visibleNav(user.role, { includeAdvanced: advanced || connect, allow }), [user.role, advanced, connect]);
  const allSections = useMemo(() => visibleNav(user.role, { includeAdvanced: true, allow }), [user.role, connect]);
  const current = useMemo(() => matchNav(p, allSections), [p, allSections]);
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => { setExpanded(current?.section.id ?? null); }, [current?.section.id]);

  useEffect(() => { const sync = () => setOnline(navigator.onLine); sync(); addEventListener('online', sync); addEventListener('offline', sync); return () => { removeEventListener('online', sync); removeEventListener('offline', sync); }; }, []);
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (!connect) setSearch(v => !v); } };
    addEventListener('keydown', f); return () => removeEventListener('keydown', f);
  }, [connect]);
  useEffect(() => { const beat = () => fetch('/api/heartbeat', { method: 'POST' }).catch(() => {}); beat(); const t = setInterval(beat, 30000); const vis = () => document.visibilityState === 'visible' && beat(); document.addEventListener('visibilitychange', vis); return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); }; }, []);
  useEffect(() => { const es = new EventSource('/api/events'); es.onmessage = () => window.dispatchEvent(new CustomEvent('fixi:realtime')); const vis = () => { if (document.visibilityState === 'visible') window.dispatchEvent(new CustomEvent('fixi:realtime')); }; document.addEventListener('visibilitychange', vis); return () => { document.removeEventListener('visibilitychange', vis); es.close(); }; }, []);
  // Mesure d'usage : un événement par écran ouvert.
  useEffect(() => { fetch('/api/usage', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: p, mode }) }).catch(() => {}); }, [p]);
  useEffect(() => { setMore(false); setHelp(false); }, [p]);

  async function logout() { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/login'); router.refresh(); }
  const closeSearch = useCallback(() => setSearch(false), []);
  const closeHelp = useCallback(() => setHelp(false), []);
  const closeMore = useCallback(() => setMore(false), []);
  const initials = String(user.fullName || '').split(' ').map((x: string) => x[0]).slice(0, 2).join('').toUpperCase();
  const isActive = (href: string) => current?.item.href === href;
  const primary = connect
    ? { href: '/app/suppliers', label: 'Commander une pièce', icon: PackageOpen }
    : ['ADMIN', 'RECEPTION', 'CASHIER'].includes(user.role) ? { href: '/app/repairs/new', label: 'Nouvelle réparation', icon: PlusCircle } : null;

  // Barre d'onglets mobile : 4 sections + « Plus ».
  const tabs = useMemo(() => {
    const wanted = connect ? ['parts', 'more'] : ['home', 'repairs', 'cash', 'parts'];
    return sections.filter(s => wanted.includes(s.id)).slice(0, 4).map(s => ({ section: s, item: s.items[0] }));
  }, [sections, connect]);

  // Fonction de rendu (et non composant) : pas de remontage, le focus clavier est conservé.
  function renderSection(section: NavSection) {
    const Icon = section.icon;
    const isCurrent = current?.section.id === section.id;
    if (section.items.length === 1) {
      const item = section.items[0];
      return <Link key={section.id} href={item.href} className={`fx-nav-section ${isCurrent ? 'is-current' : ''}`} aria-current={isCurrent ? 'page' : undefined}><Icon />{itemLabel(item, user.role)}</Link>;
    }
    const open = expanded === section.id;
    return <div key={section.id}>
      <button type="button" className={`fx-nav-section ${isCurrent ? 'is-current' : ''}`} aria-expanded={open}
        onClick={() => { if (!isCurrent && !open) router.push(section.items[0].href); setExpanded(open ? null : section.id); }}>
        <Icon /><span>{section.label}</span><ChevronRight className="fx-nav-chevron" />
      </button>
      {open && <div className="fx-nav-items">
        {section.items.map(item => { const I = item.icon; return <Link key={item.href} href={item.href} className={`fx-nav-link ${isActive(item.href) ? 'active' : ''}`} aria-current={isActive(item.href) ? 'page' : undefined}>
          <I /><span>{itemLabel(item, user.role)}</span>{item.advanced && <em>Avancé</em>}
        </Link>; })}
      </div>}
    </div>;
  }

  const modeSwitch = !connect && <div className="fx-mode" role="group" aria-label="Affichage du menu">
    <button type="button" aria-pressed={!advanced} onClick={() => setMode('simple')}>Simple</button>
    <button type="button" aria-pressed={advanced} onClick={() => setMode('advanced')}>Avancé</button>
  </div>;

  return <div className="fx-shell">
    <PwaRegister />
    <aside className="fx-side" aria-label="Menu principal">
      <div className="fx-side-brand"><BrandLogo /></div>
      {primary && <Link href={primary.href} className="btn btn-primary fx-side-cta"><primary.icon size={19} />{primary.label}</Link>}
      <nav className="fx-side-nav">{sections.map(renderSection)}</nav>
      {connect && <Link href="/app/upgrade" className="btn btn-soft"><Sparkles size={16} /> Passer à Fixi Pro</Link>}
      <div className="fx-side-foot">
        <div className="fx-side-shop"><span className="fx-avatar" aria-hidden="true">{initials}</span><div style={{ minWidth: 0 }}><b>{user.shopName}</b><small>{user.fullName} · {user.roleLabel}</small></div></div>
        {modeSwitch}
        <div className="fx-side-tools">
          {!connect && <Link href={`/queue?shop=${encodeURIComponent(user.shopSlug)}`} target="_blank" className="fx-icon-btn" title="Écran d'attente clients" aria-label="Ouvrir l'écran d'attente clients"><MonitorPlay size={18} /></Link>}
          <TextSizeToggle />
          <ThemeToggle />
          <button type="button" className="btn btn-ghost btn-sm" onClick={logout}><LogOut size={16} /> Quitter</button>
        </div>
      </div>
    </aside>

    <div className="fx-main">
      <header className="fx-top">
        {connect
          ? <div className="fx-search" style={{ cursor: 'default' }}><PackageOpen size={18} /><span>Vos commandes, factures et livraisons</span></div>
          : <button type="button" className="fx-search" onClick={() => setSearch(true)}><Search size={18} /><span>Rechercher : téléphone, code, IMEI, client…</span><kbd>Ctrl K</kbd></button>}
        <div className="fx-top-actions">
          {!online && <span className="fx-offline"><WifiOff size={14} /> Hors ligne</span>}
          <OfflineSyncBadge />
          <button type="button" className="fx-icon-btn" onClick={() => setHelp(true)} aria-label="Aide pour cet écran" title="Aide"><HelpCircle size={20} /></button>
          <NotificationBell />
        </div>
      </header>
      <main className="fx-content">
        {connect && !isConnectAppPath(p) ? <div className="fx-page" style={{ maxWidth: 760 }}>
          <div className="card card-pad"><h1 className="page-title">Fonction réservée à Fixi Pro</h1>
            <p className="page-sub">Vos commandes, livraisons, factures et dettes restent gratuites et sans limite.</p>
            <div className="toolbar" style={{ marginTop: 14 }}><Link href="/app/suppliers" className="btn btn-ghost">Mes commandes</Link><Link href="/app/upgrade" className="btn btn-primary">Découvrir Fixi Pro</Link></div></div>
        </div> : children}
      </main>
    </div>

    <nav className="fx-tabbar" aria-label="Navigation rapide">
      {tabs.map(({ section, item }) => { const Icon = section.icon; const on = current?.section.id === section.id; return <Link key={section.id} href={item.href} className={on ? 'active' : ''} aria-current={on ? 'page' : undefined}><Icon /><span>{section.id === 'parts' && connect ? 'Commander' : section.label}</span></Link>; })}
      <button type="button" className={more ? 'active' : ''} onClick={() => setMore(true)} aria-haspopup="dialog"><MoreIcon /><span>Plus</span></button>
    </nav>

    <FxSheet open={more} onClose={closeMore} side="bottom" title="Menu" subtitle={`${user.shopName} · ${user.roleLabel}`} label="Menu complet">
      {primary && <Link href={primary.href} className="btn btn-primary btn-block" style={{ marginBottom: 16 }}><primary.icon size={19} />{primary.label}</Link>}
      {sections.map(s => <div className="fx-more-group" key={s.id}><h3><s.icon size={15} />{s.label}</h3>
        <div className="fx-more-grid">{s.items.map(item => { const I = item.icon; return <Link key={item.href} href={item.href} className={isActive(item.href) ? 'active' : ''}><I /><span>{itemLabel(item, user.role)}</span></Link>; })}</div>
      </div>)}
      {connect && <Link href="/app/upgrade" className="btn btn-soft btn-block" style={{ marginBottom: 12 }}><Sparkles size={16} /> Passer à Fixi Pro</Link>}
      {modeSwitch}
      <div className="fx-side-tools" style={{ marginTop: 12 }}>
        <InstallAppButton label="Installer l’application" /><TextSizeToggle /><ThemeToggle />
        <button type="button" className="btn btn-ghost btn-sm" onClick={logout}><LogOut size={16} /> Quitter</button>
      </div>
    </FxSheet>

    <HelpSheet open={help} onClose={closeHelp} pathname={p} advanced={advanced || connect} onAdvanced={connect ? undefined : () => setMode('advanced')} />
    {!connect && <UniversalSearch open={search} onClose={closeSearch} sections={allSections} role={user.role} />}
  </div>;
}

function MoreIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
}
