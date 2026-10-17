'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {
  LayoutDashboard,Wrench,PlusCircle,Users,CreditCard,Boxes,ReceiptText,UserCog,BarChart3,Settings,Search,LogOut,
  MonitorPlay,ShieldCheck,HeartHandshake,FileText,History,X,Headphones,PackageOpen,Link2,Sparkles,Gift,BrainCircuit,
  Workflow,Activity,CalendarDays,Megaphone,Eye,Building2,Smartphone,MessageCircle,ShoppingBag,PhoneCall,GraduationCap,
  HeartHandshake as CareIcon,CloudOff,PanelLeftClose,PanelLeftOpen,Zap,Command,ChevronRight,Wifi,WifiOff,ChevronDown
} from 'lucide-react';
import {NotificationBell} from './notification-bell';
import {PwaRegister} from './pwa-register';
import {BrandLogo} from './brand-logo';
import {PushToggle} from './push-toggle';
import {OfflineSyncBadge} from './offline-sync-badge';
import {InstallAppButton} from './install-app-button';

const links=[
['Dashboard','/app/dashboard',LayoutDashboard,['ADMIN','RECEPTION','TECHNICIAN','CASHIER'],'PRINCIPAL'],
['Réception Express','/app/repairs/new',PlusCircle,['ADMIN','RECEPTION','CASHIER'],'PRINCIPAL'],
['Réparations','/app/repairs',Wrench,['ADMIN','RECEPTION','TECHNICIAN','CASHIER'],'PRINCIPAL'],
['Clients','/app/clients',Users,['ADMIN','RECEPTION','CASHIER'],'PRINCIPAL'],
['Caisse','/app/cashier',CreditCard,['ADMIN','CASHIER'],'PRINCIPAL'],
['Stock','/app/stock',Boxes,['ADMIN','TECHNICIAN'],'PRINCIPAL'],

['Compatibilité pièces','/app/compatibility',Link2,['ADMIN','RECEPTION','TECHNICIAN'],'ATELIER'],
['Catalogue appareils','/app/device-catalog',Smartphone,['ADMIN','RECEPTION'],'ATELIER'],
['Fixi Supplier','/app/suppliers',PackageOpen,['ADMIN','RECEPTION'],'ATELIER'],
['Achats atelier','/app/purchases',ShoppingBag,['ADMIN','RECEPTION'],'ATELIER'],
['Marché pièces','/app/parts-market',ShoppingBag,['ADMIN','RECEPTION','TECHNICIAN','CASHIER'],'ATELIER'],
['Rendez-vous','/app/appointments',CalendarDays,['ADMIN','RECEPTION'],'ATELIER'],
['Garanties / SAV','/app/warranties',HeartHandshake,['ADMIN','RECEPTION','TECHNICIAN'],'ATELIER'],
['Devis & factures','/app/documents',FileText,['ADMIN','RECEPTION','CASHIER'],'ATELIER'],
['Paiements','/app/payments',CreditCard,['ADMIN','CASHIER'],'ATELIER'],
['Sessions caisse','/app/cash-sessions',History,['ADMIN','CASHIER'],'ATELIER'],
['Mouvements stock','/app/stock-movements',History,['ADMIN','TECHNICIAN'],'ATELIER'],
['Dépenses','/app/expenses',ReceiptText,['ADMIN'],'ATELIER'],

['Fixi Brain','/app/brain',BrainCircuit,['ADMIN'],'INTELLIGENCE'],
['Smart Insights','/app/insights',Activity,['ADMIN'],'INTELLIGENCE'],
['Automations','/app/automations',Workflow,['ADMIN'],'INTELLIGENCE'],
['Smart Marketing','/app/marketing',Megaphone,['ADMIN'],'INTELLIGENCE'],
['Mode propriétaire','/app/owner',Eye,['ADMIN'],'INTELLIGENCE'],
['Réseau / Franchise','/app/network',Building2,['ADMIN'],'INTELLIGENCE'],

['Communauté','/app/community',MessageCircle,['ADMIN','RECEPTION','TECHNICIAN','CASHIER'],'SERVICES'],
['Expert Call','/app/expert-call',PhoneCall,['ADMIN','RECEPTION','TECHNICIAN','CASHIER'],'SERVICES'],
['Academy','/app/academy',GraduationCap,['ADMIN','RECEPTION','TECHNICIAN','CASHIER'],'SERVICES'],
['Fixi Care','/app/care',CareIcon,['ADMIN','RECEPTION','CASHIER'],'SERVICES'],
['Offline Sync','/app/offline',CloudOff,['ADMIN','RECEPTION','CASHIER'],'SERVICES'],

['Équipe','/app/team',UserCog,['ADMIN'],'GESTION'],
['Rapports','/app/reports',BarChart3,['ADMIN'],'GESTION'],
['Support Fixi','/app/support',Headphones,['ADMIN','RECEPTION','TECHNICIAN','CASHIER'],'GESTION'],
['Nouveautés','/app/updates',Sparkles,['ADMIN','RECEPTION','TECHNICIAN','CASHIER'],'GESTION'],
['Parrainage','/app/referrals',Gift,['ADMIN'],'GESTION'],
['Abonnement Fixi','/app/subscription',ReceiptText,['ADMIN'],'GESTION'],
['Journal','/app/audit',ShieldCheck,['ADMIN'],'GESTION'],
['Paramètres','/app/settings',Settings,['ADMIN'],'GESTION']
] as const;

const groupLabels:any={PRINCIPAL:'Essentiel',ATELIER:'Atelier & ventes',INTELLIGENCE:'Pilotage intelligent',SERVICES:'Réseau Fixi',GESTION:'Administration'};

export function AppShell({children,user}:{children?:React.ReactNode;user:any}){
  const p=usePathname();const router=useRouter();
  const[cmd,setCmd]=useState(false);const[q,setQ]=useState('');const[collapsed,setCollapsed]=useState(false);const[online,setOnline]=useState(true);
  const visible=useMemo(()=>links.filter(x=>(x[3] as readonly string[]).includes(user.role)),[user.role]);
  const groups=useMemo(()=>['PRINCIPAL','ATELIER','INTELLIGENCE','SERVICES','GESTION'].map(g=>[g,visible.filter(x=>x[4]===g)] as const).filter(([,items])=>items.length),[visible]);
  const current=useMemo(()=>visible.filter(x=>p===x[1]||p.startsWith(x[1]+'/')).sort((a,b)=>b[1].length-a[1].length)[0],[visible,p]);
  const currentGroup=current?groupLabels[current[4]]:'Fixi';
  const mobileLinks=visible.filter(x=>['/app/dashboard','/app/repairs/new','/app/repairs','/app/cashier','/app/stock'].includes(x[1])).slice(0,5);
  useEffect(()=>{const saved=localStorage.getItem('fixi-sidebar-collapsed');setCollapsed(saved==='1')},[]);
  useEffect(()=>{const sync=()=>setOnline(navigator.onLine);sync();addEventListener('online',sync);addEventListener('offline',sync);return()=>{removeEventListener('online',sync);removeEventListener('offline',sync)}},[]);
  useEffect(()=>{localStorage.setItem('fixi-sidebar-collapsed',collapsed?'1':'0')},[collapsed]);
  useEffect(()=>{const f=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setCmd(v=>!v)}if(e.key==='Escape')setCmd(false)};addEventListener('keydown',f);return()=>removeEventListener('keydown',f)},[]);
  useEffect(()=>{const beat=()=>fetch('/api/heartbeat',{method:'POST'}).catch(()=>{});beat();const t=setInterval(beat,30000);const vis=()=>document.visibilityState==='visible'&&beat();document.addEventListener('visibilitychange',vis);return()=>{clearInterval(t);document.removeEventListener('visibilitychange',vis)}},[]);
  async function logout(){await fetch('/api/auth/logout',{method:'POST'});router.push('/login');router.refresh()}
  function search(v:string){const x=v.trim();if(!x)return;setCmd(false);router.push('/app/repairs?q='+encodeURIComponent(x))}
  return <div className={`app-shell ${collapsed?'sidebar-collapsed':''}`}>
    <PwaRegister/>
    <aside className="sidebar">
      <div className="brand">
        <BrandLogo/>
        <div className="brand-caption-wrap"><div className="brand-caption">SMART REPAIR OS · V10</div><span><Sparkles size={10}/> PREMIUM</span></div>
        <button className="sidebar-collapse" onClick={()=>setCollapsed(v=>!v)} title={collapsed?'Agrandir le menu':'Réduire le menu'}>{collapsed?<PanelLeftOpen size={17}/>:<PanelLeftClose size={17}/>}</button>
      </div>
      <Link href="/app/repairs/new" className="sidebar-primary-action"><PlusCircle size={17}/><span>Nouvelle réception</span></Link>
      <nav className="nav">
        {groups.map(([group,items])=><div className="nav-group" key={group}>
          <div className="nav-section">{groupLabels[group]}</div>
          {items.map(([label,href,Icon])=><Link key={href} href={href} title={label} className={`nav-link ${p===href||p.startsWith(href+'/')?'active':''}`}><Icon/><span>{label}</span>{label==='Fixi Supplier'&&<em>MARKET</em>}</Link>)}
        </div>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="shop-chip"><strong>{user.shopName}</strong><small>{user.roleLabel}</small><div className="shop-live"><i/> Connecté à Fixi</div><Link href={`/queue?shop=${encodeURIComponent(user.shopSlug)}`} target="_blank" className="nav-link queue-link"><MonitorPlay size={15}/><span>Écran file</span></Link></div>
      </div>
    </aside>
    <main className="app-main">
      <header className="topbar">
        <button className="global-search" onClick={()=>setCmd(true)}><Search size={17}/><span>Client, IMEI, réparation, pièce, facture…</span><kbd>Ctrl K</kbd></button>
        <div className="topbar-quick"><Link href="/app/repairs/new" className="topbar-new"><Zap size={15}/><span>Réception</span></Link></div>
        <div className="userbox"><OfflineSyncBadge/><NotificationBell/><PushToggle/><InstallAppButton label="Installer"/><div className="avatar">{user.fullName.split(' ').map((x:string)=>x[0]).slice(0,2).join('').toUpperCase()}</div><div className="user-meta"><strong>{user.fullName}</strong><span>{user.roleLabel}</span></div><button className="btn btn-ghost btn-sm" onClick={logout} title="Déconnexion"><LogOut size={16}/></button></div>
      </header>
      <div className="system-context-bar">
        <div className="system-context-path"><span>{currentGroup}</span><ChevronRight size={13}/><b>{current?.[0]||'Espace Fixi'}</b></div>
        <div className="system-context-meta"><span className={online?'system-online':'system-offline'}>{online?<Wifi size={13}/>:<WifiOff size={13}/>} {online?'Synchronisé':'Hors ligne'}</span><span>{user.shopName}</span><span>{user.roleLabel}</span></div>
      </div>
      {children}
    </main>
    <nav className="mobile-ops-nav">{mobileLinks.map(([label,href,Icon])=><Link key={href} href={href} className={p===href||p.startsWith(href+'/')?'active':''}><Icon/><span>{label.replace('Réception Express','Réception')}</span></Link>)}</nav>
    {cmd&&<div className="command-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setCmd(false)}>
      <div className="command command-v2">
        <div className="command-input"><Search/><input autoFocus value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search(q)} placeholder="Rechercher dans Fixi…"/><button onClick={()=>setCmd(false)}><X size={16}/></button></div>
        {q?<button className="command-global-result" onClick={()=>search(q)}><div><Search size={17}/><span><b>Rechercher “{q}”</b><small>Réparations, client, téléphone, code ou appareil</small></span></div><ChevronRight size={17}/></button>:<div className="command-hint"><Command size={13}/> Tapez un terme ou choisissez une action rapide</div>}
        <div className="command-shortcuts">
          <Link href="/app/repairs/new" onClick={()=>setCmd(false)}><PlusCircle/><span><b>Nouvelle réception</b><small>Créer un dossier réparation</small></span></Link>
          <Link href="/app/cashier" onClick={()=>setCmd(false)}><CreditCard/><span><b>Nouvelle vente</b><small>Ouvrir la caisse</small></span></Link>
          <Link href="/app/compatibility" onClick={()=>setCmd(false)}><Link2/><span><b>Tester une pièce</b><small>Compatibility Hub</small></span></Link>
          <Link href="/app/stock" onClick={()=>setCmd(false)}><Boxes/><span><b>Stock</b><small>Voir les pièces disponibles</small></span></Link>
        </div>
        <div className="command-grid">{visible.filter(x=>x[0].toLowerCase().includes(q.toLowerCase())||!q).slice(0,14).map(([label,href,Icon])=><Link href={href} key={href} onClick={()=>setCmd(false)}><Icon size={16}/><span>{label}</span></Link>)}</div>
      </div>
    </div>}
  </div>
}
