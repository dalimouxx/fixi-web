'use client';

import {useMemo,useState} from 'react';
import {
  Activity,AlertCircle,ArrowLeft,ArrowRight,Bell,Check,CheckCircle2,
  ChevronDown,ChevronRight,ClipboardList,Clock3,CreditCard,FileText,
  Filter,History,House,LayoutDashboard,MapPin,Menu,Minus,Package,
  PackageCheck,Plus,ScanBarcode,Search,Settings2,ShoppingBag,
  ShoppingCart,Smartphone,Store,Truck,Users,WalletCards,Wrench,X,
  type LucideIcon,
} from 'lucide-react';
import css from './preview.module.css';

type Role='supplier'|'atelier'|'delivery';
type SupplierSection='home'|'sales'|'orders'|'stock'|'clients'|'dues'|'couriers'|'reports';
type OrderState='À confirmer'|'En préparation'|'Prête'|'Livrée';
type Order={id:string;client:string;city:string;products:string;total:number;state:OrderState;time:string};
type Product={sku:string;name:string;available:number;price:number;wholesale:number};

const orders:Order[]=[
  {id:'CMD-1042',client:'Atelier Horizon',city:'Gabès',products:'Écran A12 · Batterie iPhone 11',total:245,state:'À confirmer',time:'10:42'},
  {id:'CMD-1041',client:'Mobile Service',city:'Médenine',products:'Écran Redmi Note 12',total:180,state:'En préparation',time:'09:18'},
  {id:'CMD-1040',client:'Tech Phone',city:'Mareth',products:'Connecteurs USB-C · Batterie A32',total:96,state:'Prête',time:'Hier'},
  {id:'CMD-1039',client:'Smart Atelier',city:'Gabès',products:'Batterie iPhone 12',total:65,state:'Livrée',time:'Hier'},
];
const products:Product[]=[
  {sku:'A12-LCD',name:'Écran Samsung A12',available:18,price:89,wholesale:79},
  {sku:'IP11-BAT',name:'Batterie iPhone 11',available:7,price:69,wholesale:58},
  {sku:'RN12-LCD',name:'Écran Redmi Note 12',available:3,price:180,wholesale:165},
  {sku:'USB-C-01',name:'Connecteur USB-C',available:52,price:12,wholesale:9},
];
const euros=(n:number)=>n.toLocaleString('fr-FR',{minimumFractionDigits:3,maximumFractionDigits:3})+' DT';

const navGroups:{title:string;items:{id:SupplierSection;label:string;icon:LucideIcon}[]}[]=[
  {title:'ESPACE DE TRAVAIL',items:[
    {id:'home',label:'Tableau de bord',icon:LayoutDashboard},
    {id:'sales',label:'Caisse & ventes',icon:ScanBarcode},
    {id:'orders',label:'Commandes',icon:ShoppingBag},
    {id:'stock',label:'Produits & stock',icon:Package},
  ]},
  {title:'GESTION',items:[
    {id:'clients',label:'Clients',icon:Users},
    {id:'dues',label:'Dettes & règlements',icon:WalletCards},
    {id:'couriers',label:'Livreurs',icon:Truck},
    {id:'reports',label:'Rapports',icon:FileText},
  ]},
];

function Mark({compact=false}:{compact?:boolean}){
  return <span className={css.mark} aria-label="FIXI">
    <span className={css.markGlyph}>F</span>{!compact&&<strong>fixi<span>.</span></strong>}
  </span>;
}
function Status({value}:{value:OrderState}){
  const cn=value==='À confirmer'?css.pending:value==='En préparation'?css.preparing:value==='Prête'?css.ready:css.delivered;
  return <span className={css.status+' '+cn}><span className={css.statusDot}/>{value}</span>;
}
function CardHeader({title,description,action}:{title:string;description?:string;action?:React.ReactNode}){
  return <div className={css.cardHeader}><div><h3>{title}</h3>{description&&<p>{description}</p>}</div>{action}</div>;
}

function SupplierDemo(){
  const[section,setSection]=useState<SupplierSection>('home');
  const[filter,setFilter]=useState<'À traiter'|'Toutes'>('À traiter');
  const[query,setQuery]=useState('');
  const[saleOpen,setSaleOpen]=useState(false);
  const[cart,setCart]=useState<Record<string,number>>({});
  const[message,setMessage]=useState('');
  const[menuOpen,setMenuOpen]=useState(false);
  const[bellOpen,setBellOpen]=useState(false);
  const[showWholesale,setShowWholesale]=useState(false);

  const filtered=useMemo(()=>orders.filter(o=>{
    const terms=[o.id,o.client,o.city,o.products].join(' ').toLowerCase();
    return (filter==='Toutes'||o.state!=='Livrée')&&terms.includes(query.toLowerCase());
  }),[filter,query]);
  const cartEntries=products.filter(p=>cart[p.sku]>0);
  const cartTotal=cartEntries.reduce((s,p)=>s+(showWholesale?p.wholesale:p.price)*cart[p.sku],0);
  const select=(value:SupplierSection)=>{setSection(value);setMenuOpen(false);setMessage('')};
  const add=(sku:string,delta:number)=>setCart(prev=>({...prev,[sku]:Math.max(0,(prev[sku]||0)+delta)}));
  const closeSale=()=>{setSaleOpen(false);setCart({});setMessage('Simulation terminée : aucune vente réelle enregistrée.')};

  return <div className={css.supplierApp}>
    {menuOpen&&<button type="button" className={css.mobileBackdrop} onClick={()=>setMenuOpen(false)} aria-label="Fermer la navigation"/>}
    <aside className={css.side+' '+(menuOpen?css.sideOpen:'')}>
      <div className={css.sideBrand}><Mark/><button className={css.closeMenu} onClick={()=>setMenuOpen(false)} aria-label="Fermer"><X size={19}/></button></div>
      <div className={css.sideWorkspace}><span className={css.workspaceIcon}><Store size={20}/></span><div><strong>Fournisseur démo</strong><small>Compte professionnel</small></div><ChevronDown size={16}/></div>
      <nav aria-label="Navigation fournisseur" className={css.sideNav}>
        {navGroups.map(g=><div key={g.title} className={css.navGroup}><div className={css.navLabel}>{g.title}</div>{g.items.map(item=>{
          const Icon=item.icon;
          return <button key={item.id} className={css.navItem+' '+(section===item.id?css.navActive:'')} onClick={()=>select(item.id)}>
            <Icon size={19}/><span>{item.label}</span>{item.id==='orders'&&<em>3</em>}
          </button>;
        })}</div>)}
      </nav>
      <div className={css.sideFoot}><span className={css.onlineDot}/> Espace de démonstration <span className={css.sideDemo}>SIMULATION</span></div>
    </aside>

    <div className={css.supplierWork}>
      <header className={css.supplierTop}>
        <div className={css.topIdentity}>
          <button type="button" className={css.hamburger} onClick={()=>setMenuOpen(true)} aria-label="Ouvrir le menu"><Menu size={21}/></button>
          <div><span className={css.breadcrumb}>Fournisseur / {navGroups.flatMap(g=>g.items).find(i=>i.id===section)?.label}</span><strong>Bonjour, bienvenue sur FIXI</strong></div>
        </div>
        <div className={css.topTools}>
          <span className={css.todayLabel}>Espace démo</span>
          <div className={css.topBellWrapper}><button className={css.iconButton} aria-label="Voir les notifications fictives" aria-expanded={bellOpen} onClick={()=>setBellOpen(v=>!v)}><Bell size={20}/><span className={css.alertDot}/></button>
            {bellOpen&&<div className={css.bellPopover}><strong>Notifications</strong><p>3 commandes attendent votre intervention.</p><button onClick={()=>{select('orders');setBellOpen(false)}}>Voir les commandes <ArrowRight size={15}/></button></div>}
          </div>
          <span className={css.avatar}>FD</span>
        </div>
      </header>

      <main className={css.supplierMain}>
        {message&&<div className={css.demoAlert} role="status"><CheckCircle2 size={18}/>{message}<button aria-label="Masquer" onClick={()=>setMessage('')}><X size={16}/></button></div>}
        {section==='home'&&<>
          <div className={css.pageHeading}><div><span className={css.eyebrow}>VOTRE ACTIVITÉ</span><h1>Vue d'ensemble</h1><p>Vos opérations essentielles, sans menus compliqués.</p></div><button className={css.primaryButton} onClick={()=>setSaleOpen(true)}><Plus size={18}/> Nouvelle vente</button></div>
          <div className={css.stats}>
            {[
              {icon:ShoppingBag,label:'Commandes à traiter',value:'03',hint:'1 nouvelle commande'},
              {icon:WalletCards,label:'Clients à encaisser',value:'04',hint:'Règlements en attente'},
              {icon:Package,label:'Produits en stock faible',value:'02',hint:'Vérifier les quantités'},
            ].map((stat,i)=>{const Icon=stat.icon;return <button key={stat.label} className={css.stat} onClick={()=>select(i===0?'orders':i===1?'dues':'stock')}><div className={css.statTop}><span className={css.statIcon}><Icon size={20}/></span><ArrowRight size={17}/></div><span>{stat.label}</span><strong>{stat.value}</strong><small>{stat.hint}</small></button>})}
          </div>
          <section className={css.supplierGrid}>
            <div className={css.panel}>
              <CardHeader title="À traiter maintenant" description="Les tâches les plus importantes de votre journée"/>
              <div className={css.taskList}>
                <button onClick={()=>select('orders')}><span className={css.taskIcon+' '+css.taskWarn}><ShoppingBag size={20}/></span><span><strong>Nouvelle commande à confirmer</strong><small>Atelier Horizon · 245,000 DT</small></span><ChevronRight size={20}/></button>
                <button onClick={()=>select('couriers')}><span className={css.taskIcon}><Truck size={20}/></span><span><strong>Colis prêt pour livraison</strong><small>Commande CMD-1040 · Tech Phone</small></span><ChevronRight size={20}/></button>
                <button onClick={()=>select('stock')}><span className={css.taskIcon}><AlertCircle size={20}/></span><span><strong>Stock à réapprovisionner</strong><small>Écran Redmi Note 12 · 3 unités</small></span><ChevronRight size={20}/></button>
              </div>
            </div>
            <div className={css.panel}>
              <CardHeader title="Actions rapides" description="Vos opérations fréquentes"/>
              <div className={css.quickGrid}>
                <button onClick={()=>setSaleOpen(true)}><ScanBarcode/><strong>Vendre</strong><span>Ouvrir la caisse</span></button>
                <button onClick={()=>select('orders')}><ClipboardList/><strong>Commandes</strong><span>Préparer</span></button>
                <button onClick={()=>select('stock')}><Package/><strong>Stock</strong><span>Consulter</span></button>
                <button onClick={()=>select('dues')}><CreditCard/><strong>Dettes</strong><span>Suivre</span></button>
              </div>
            </div>
          </section>
          <div className={css.panel}>
            <CardHeader title="Dernières commandes" description="Les dernières opérations enregistrées (exemples)" action={<button className={css.textButton} onClick={()=>select('orders')}>Tout afficher <ArrowRight size={16}/></button>}/>
            <div className={css.tableScroll}><table className={css.table}><thead><tr><th>Commande</th><th>Atelier</th><th>Montant</th><th>Statut</th><th></th></tr></thead><tbody>{orders.slice(0,3).map(o=><tr key={o.id}><td><strong>{o.id}</strong><small>{o.time}</small></td><td>{o.client}<small>{o.city}</small></td><td className={css.num}>{euros(o.total)}</td><td><Status value={o.state}/></td><td><button className={css.rowAction} aria-label={'Voir '+o.id} onClick={()=>select('orders')}><ChevronRight size={18}/></button></td></tr>)}</tbody></table></div>
          </div>
        </>}
        {section==='orders'&&<>
          <div className={css.pageHeading}><div><span className={css.eyebrow}>SUIVI DES COMMANDES</span><h1>Commandes</h1><p>Rechercher, confirmer et préparer les commandes de vos ateliers.</p></div></div>
          <div className={css.panel}>
            <div className={css.filterRow}><div className={css.searchBox}><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Commande, atelier, article, ville…" aria-label="Rechercher une commande"/></div><div className={css.filterTabs}><button className={filter==='À traiter'?css.filterActive:''} onClick={()=>setFilter('À traiter')}>À traiter</button><button className={filter==='Toutes'?css.filterActive:''} onClick={()=>setFilter('Toutes')}>Toutes</button></div></div>
            <div className={css.tableScroll}><table className={css.table}><thead><tr><th>Commande</th><th>Client</th><th>Articles</th><th>Total</th><th>Statut</th><th></th></tr></thead><tbody>
              {filtered.map(o=><tr key={o.id}><td><strong>{o.id}</strong><small>{o.time}</small></td><td>{o.client}<small>{o.city}</small></td><td>{o.products}</td><td className={css.num}>{euros(o.total)}</td><td><Status value={o.state}/></td><td><button className={css.rowAction} onClick={()=>setMessage('Aperçu '+o.id+' : '+o.products+' — '+euros(o.total))} aria-label={'Détails '+o.id}><ChevronRight size={18}/></button></td></tr>)}
              {!filtered.length&&<tr><td colSpan={6} className={css.emptyTable}>Aucune commande trouvée. Modifiez votre recherche.</td></tr>}
            </tbody></table></div><div className={css.tableFoot}>{filtered.length} commande(s) · Données fictives</div>
          </div>
        </>}
        {section==='sales'&&<>
          <div className={css.pageHeading}><div><span className={css.eyebrow}>VENDRE RAPIDEMENT</span><h1>Caisse & ventes</h1><p>Une interface concentrée sur les articles, le panier et le paiement.</p></div><button className={css.primaryButton} onClick={()=>setSaleOpen(true)}><Plus size={18}/> Ouvrir une vente</button></div>
          <div className={css.focusCard}><ScanBarcode size={31}/><div><h2>Prêt pour votre prochaine vente</h2><p>Recherchez un produit, modifiez la quantité et visualisez le ticket avant validation.</p><button className={css.primaryButton} onClick={()=>setSaleOpen(true)}>Tester la caisse <ArrowRight size={18}/></button></div></div>
        </>}
        {section==='stock'&&<>
          <div className={css.pageHeading}><div><span className={css.eyebrow}>CATALOGUE</span><h1>Produits & stock</h1><p>Quantités disponibles et prix affichés sans informations inutiles.</p></div></div>
          <div className={css.panel}><CardHeader title="Catalogue produits" description="Données fictives pour valider la lisibilité"/>
            <div className={css.tableScroll}><table className={css.table}><thead><tr><th>Référence</th><th>Produit</th><th>Disponibilité</th><th>Prix détail</th><th>Prix gros</th></tr></thead><tbody>{products.map(p=><tr key={p.sku}><td><strong>{p.sku}</strong></td><td>{p.name}</td><td><span className={p.available<=3?css.stockLow:css.stockOk}>{p.available} en stock</span></td><td className={css.num}>{euros(p.price)}</td><td className={css.num}>{euros(p.wholesale)}</td></tr>)}</tbody></table></div>
          </div>
        </>}
        {(['clients','dues','couriers','reports'] as SupplierSection[]).includes(section)&&<>
          <div className={css.pageHeading}><div><span className={css.eyebrow}>GESTION</span><h1>{navGroups.flatMap(g=>g.items).find(i=>i.id===section)?.label}</h1><p>Informations principales affichées en priorité, avec les détails accessibles à la demande.</p></div></div>
          {section==='clients'&&<div className={css.panel}><CardHeader title="Clients professionnels" description="Les comptes de vos ateliers"/><div className={css.taskList}>{['Atelier Horizon · Gabès','Mobile Service · Médenine','Tech Phone · Mareth'].map((x,i)=><button key={x} onClick={()=>setMessage('Aperçu du client '+x)}><span className={css.taskIcon}><Users size={19}/></span><span><strong>{x}</strong><small>{i+1} commande(s) dans cette simulation</small></span><ChevronRight size={20}/></button>)}</div></div>}
          {section==='dues'&&<div className={css.panel}><CardHeader title="Créances clients" description="Regrouper les montants dus par atelier"/><div className={css.taskList}>{[{n:'Atelier Horizon',amount:180},{n:'Mobile Service',amount:95}].map(x=><button key={x.n} onClick={()=>setMessage('Solde fictif '+x.n+' : '+euros(x.amount))}><span className={css.taskIcon}><WalletCards size={19}/></span><span><strong>{x.n}</strong><small>Historique et paiements partiels</small></span><b>{euros(x.amount)}</b></button>)}</div></div>}
          {section==='couriers'&&<div className={css.panel}><CardHeader title="Suivi des livraisons" description="Commandes et remises de recettes"/><div className={css.taskList}><button onClick={()=>setMessage('Aperçu de livraison : CMD-1040')}><span className={css.taskIcon}><Truck size={19}/></span><span><strong>CMD-1040 · Tech Phone</strong><small>Colis prêt pour l'enlèvement</small></span><ChevronRight size={20}/></button></div></div>}
          {section==='reports'&&<div className={css.panel}><CardHeader title="Rapports" description="Vue simplifiée des tendances"/><div className={css.reportRow}><div><span>Commandes de la journée</span><strong>03</strong></div><div><span>Montant des commandes démo</span><strong>{euros(orders.reduce((a,o)=>a+o.total,0))}</strong></div></div></div>}
        </>}
      </main>
    </div>
    {saleOpen&&<div className={css.modalBackdrop} role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setSaleOpen(false)}}>
      <div className={css.saleModal} role="dialog" aria-modal="true" aria-labelledby="fixi-preview-sale-title">
        <div className={css.modalHead}><div><span className={css.eyebrow}>SIMULATION SANS ENREGISTREMENT</span><h2 id="fixi-preview-sale-title">Nouvelle vente</h2></div><button className={css.iconButton} onClick={()=>setSaleOpen(false)} aria-label="Fermer"><X size={21}/></button></div>
        <div className={css.saleSubhead}>Choisissez un produit puis une quantité. Aucun stock réel ne sera modifié.</div>
        <label className={css.wholesaleToggle}><input type="checkbox" checked={showWholesale} onChange={e=>setShowWholesale(e.target.checked)}/> Mode prix grossiste</label>
        <div className={css.saleProducts}>{products.map(p=><div key={p.sku} className={css.saleProduct}><div><strong>{p.name}</strong><small>{p.sku} · {euros(showWholesale?p.wholesale:p.price)}</small></div><div className={css.qtyControls}><button onClick={()=>add(p.sku,-1)} disabled={!cart[p.sku]} aria-label={'Retirer '+p.name}><Minus size={16}/></button><b>{cart[p.sku]||0}</b><button onClick={()=>add(p.sku,1)} aria-label={'Ajouter '+p.name}><Plus size={16}/></button></div></div>)}</div>
        <div className={css.saleTotal}><span>{cartEntries.reduce((n,p)=>n+cart[p.sku],0)} article(s)</span><strong>{euros(cartTotal)}</strong></div>
        <div className={css.modalActions}><button className={css.secondaryButton} onClick={()=>setSaleOpen(false)}>Annuler</button><button className={css.primaryButton} disabled={!cartEntries.length} onClick={closeSale}>Terminer la simulation <Check size={17}/></button></div>
      </div>
    </div>}
  </div>;
}

type AtelierTab='home'|'repairs'|'orders'|'dues';
function AtelierDemo(){
 const[tab,setTab]=useState<AtelierTab>('home');
 const[reception,setReception]=useState(false);
 const[brand,setBrand]=useState('Samsung');
 const[model,setModel]=useState('Galaxy A12');
 const[problem,setProblem]=useState('Écran cassé');
 const[note,setNote]=useState('');
 const[alerts,setAlerts]=useState(false);
 const tabs:{id:AtelierTab;label:string;icon:LucideIcon}[]=[
  {id:'home',label:'Accueil',icon:House},
  {id:'repairs',label:'Réparations',icon:Wrench},
  {id:'orders',label:'Commandes',icon:ShoppingBag},
  {id:'dues',label:'Dettes',icon:WalletCards},
 ];
 return <div className={css.phone}>
   <div className={css.phoneNotch}/>
   <div className={css.phoneScreen}>
     <header className={css.phoneHeader}><div className={css.phoneBrand}><Mark compact/><div><b>FIXI Atelier</b><small>Atelier Exemple · Gabès</small></div></div><button className={css.phoneBell} aria-label="Voir les notifications de démonstration" onClick={()=>setAlerts(v=>!v)}><Bell size={21}/><i/></button></header>
     <div className={css.phoneScroll}>
       {alerts&&<div className={css.phoneAlert} role="status"><CheckCircle2 size={18}/> Votre commande CMD-1040 est prête pour livraison.<button onClick={()=>setAlerts(false)} aria-label="Masquer"><X size={15}/></button></div>}
       {note&&<div className={css.phoneAlert} role="status"><CheckCircle2 size={18}/>{note}<button onClick={()=>setNote('')} aria-label="Masquer"><X size={15}/></button></div>}
       {tab==='home'&&<>
         <span className={css.phoneEyebrow}>VOTRE ATELIER</span><h1 className={css.phoneTitle}>Bonjour 👋</h1><p className={css.phoneDesc}>Voici ce qui compte aujourd'hui.</p>
         <button className={css.phonePrimary} onClick={()=>setReception(true)}><Plus size={21}/> Nouvelle réception <ArrowRight size={18}/></button>
         <div className={css.phoneStats}><button onClick={()=>setTab('repairs')}><span><Wrench size={19}/></span><strong>08</strong><small>Réparations actives</small></button><button onClick={()=>setTab('orders')}><span><ShoppingBag size={19}/></span><strong>02</strong><small>Commandes en cours</small></button></div>
         <div className={css.phoneSectionTitle}><h2>À faire en priorité</h2><span>2 actions</span></div>
         <button className={css.phoneTask} onClick={()=>setTab('repairs')}><span className={css.phoneTaskIcon}><Clock3 size={20}/></span><span><strong>Réparation en attente</strong><small>iPhone 11 · Batterie à remplacer</small></span><ChevronRight size={18}/></button>
         <button className={css.phoneTask} onClick={()=>setTab('orders')}><span className={css.phoneTaskIcon}><PackageCheck size={20}/></span><span><strong>Commande prête</strong><small>CMD-1040 · Fournisseur exemple</small></span><ChevronRight size={18}/></button>
       </>}
       {tab==='repairs'&&<>
         <span className={css.phoneEyebrow}>SUIVI CLIENTS</span><h1 className={css.phoneTitle}>Réparations</h1><p className={css.phoneDesc}>Tous les appareils en un seul endroit.</p>
         <button className={css.phonePrimary} onClick={()=>setReception(true)}><Plus size={19}/> Nouvelle réception</button>
         {[
           {phone:'Samsung A12',owner:'Client 001',state:'Diagnostic',tone:'warm'},
           {phone:'iPhone 11',owner:'Client 002',state:'Attente pièce',tone:'warm'},
           {phone:'Redmi Note 12',owner:'Client 003',state:'Prêt à remettre',tone:'green'},
         ].map(x=><button key={x.phone} className={css.phoneListCard} onClick={()=>setNote('Fiche '+x.phone+' ouverte dans cette simulation.')}><span className={css.phoneListIcon}><Smartphone size={21}/></span><span><b>{x.phone}</b><small>{x.owner}</small><em className={x.tone==='green'?css.greenText:css.orangeText}>{x.state}</em></span><ChevronRight size={18}/></button>)}
       </>}
       {tab==='orders'&&<>
         <span className={css.phoneEyebrow}>APPROVISIONNEMENT</span><h1 className={css.phoneTitle}>Mes commandes</h1><p className={css.phoneDesc}>Les articles et les livraisons en cours.</p>
         <div className={css.phoneOrderCard}><span className={css.orderTag}>PRÊTE À LIVRER</span><h3>Commande CMD-1040</h3><p>Écran Samsung A12 · 1 pièce</p><strong>{euros(89)}</strong><button onClick={()=>setNote('Suivi de commande ouvert (simulation).')}>Voir le suivi <ArrowRight size={16}/></button></div>
         <div className={css.phoneOrderCard}><span className={css.orderTagSecondary}>EN PRÉPARATION</span><h3>Commande CMD-1041</h3><p>Connecteur USB-C · 3 pièces</p><strong>{euros(36)}</strong><button onClick={()=>setNote('Suivi de commande ouvert (simulation).')}>Voir le suivi <ArrowRight size={16}/></button></div>
       </>}
       {tab==='dues'&&<>
         <span className={css.phoneEyebrow}>MES COMPTES</span><h1 className={css.phoneTitle}>Mes dettes</h1><p className={css.phoneDesc}>Tous les règlements fournisseurs, au même endroit.</p>
         <div className={css.phoneDueCard}><small>Montant total restant</small><strong>{euros(275)}</strong><span>Données fictives, aucune écriture bancaire</span></div>
         <div className={css.phoneSectionTitle}><h2>Par fournisseur</h2></div>
         <button className={css.phoneTask} onClick={()=>setNote('Détail de compte fournisseur (simulation).')}><span className={css.phoneTaskIcon}><Store size={19}/></span><span><strong>Fournisseur Exemple A</strong><small>{euros(180)} à régler</small></span><ChevronRight size={18}/></button>
         <button className={css.phoneTask} onClick={()=>setNote('Détail de compte fournisseur (simulation).')}><span className={css.phoneTaskIcon}><Store size={19}/></span><span><strong>Fournisseur Exemple B</strong><small>{euros(95)} à régler</small></span><ChevronRight size={18}/></button>
       </>}
     </div>
     <nav className={css.bottomNav} aria-label="Navigation Atelier">{tabs.map(item=>{const Icon=item.icon;return <button key={item.id} className={tab===item.id?css.bottomActive:''} onClick={()=>setTab(item.id)}><Icon size={20}/><span>{item.label}</span></button>})}</nav>
     {reception&&<div className={css.phoneModalBackdrop}><div className={css.phoneSheet} role="dialog" aria-modal="true" aria-label="Nouvelle réception de démonstration"><div className={css.sheetHeader}><h2>Nouvelle réception</h2><button onClick={()=>setReception(false)} aria-label="Fermer"><X size={19}/></button></div><small>Une saisie simple, étape par étape.</small><label>Marque<select value={brand} onChange={e=>setBrand(e.target.value)}><option>Samsung</option><option>Apple</option><option>Xiaomi</option></select></label><label>Modèle<input value={model} onChange={e=>setModel(e.target.value)}/></label><label>Panne déclarée<select value={problem} onChange={e=>setProblem(e.target.value)}><option>Écran cassé</option><option>Batterie</option><option>Charge</option><option>Diagnostic</option></select></label><button className={css.phonePrimary} onClick={()=>{setNote('Réception '+brand+' '+model+' simulée. Aucun dossier réel créé.');setReception(false)}}><Check size={18}/> Simuler la réception</button></div></div>}
   </div>
 </div>;
}

type DeliveryTab='missions'|'history'|'cash';
function DeliveryDemo(){
 const[tab,setTab]=useState<DeliveryTab>('missions');
 const[step,setStep]=useState(0);
 const[notice,setNotice]=useState(false);
 const labels=['Mission disponible','Mission acceptée','En route','Sur place','Livraison effectuée'];
 const nextLabels=['Accepter la mission','Démarrer la livraison','Je suis arrivé','Confirmer la livraison','Nouvelle simulation'];
 return <div className={css.phone}>
   <div className={css.phoneNotch}/>
   <div className={css.phoneScreen}>
     <header className={css.phoneHeader}><div className={css.phoneBrand}><Mark compact/><div><b>FIXI Delivery</b><small>Livreur · Mode démonstration</small></div></div><button className={css.phoneBell} aria-label="Tester la notification" onClick={()=>setNotice(v=>!v)}><Bell size={21}/><i/></button></header>
     <div className={css.phoneScroll}>
       {notice&&<div className={css.phoneAlert}><Bell size={18}/> Nouvelle mission fictive disponible.<button onClick={()=>setNotice(false)} aria-label="Fermer"><X size={15}/></button></div>}
       {tab==='missions'&&<>
         <div className={css.deliveryGreeting}><span className={css.phoneEyebrow}>MA JOURNÉE</span><h1 className={css.phoneTitle}>Bonjour 👋</h1><p className={css.phoneDesc}>Une mission, une action à la fois.</p></div>
         <div className={css.driverAvailability}><span><span className={css.onlineDot}/> Disponible pour livraison</span><CheckCircle2 size={20}/></div>
         <div className={css.deliverySectionTitle}><h2>Votre prochaine mission</h2><span>1 mission</span></div>
         <div className={css.missionCard}>
           <div className={css.missionTop}><span className={css.missionBadge}>{labels[step]}</span><small>CMD-1042</small></div>
           <h3>Atelier Horizon</h3><p className={css.missionAddress}><MapPin size={18}/> Avenue de la République, Gabès</p>
           <div className={css.missionDivider}/>
           <div className={css.missionInfo}><span><Package size={19}/> 2 articles</span><span><WalletCards size={19}/> Paiement à la livraison</span></div>
           <div className={css.missionAmount}><span>Montant de la commande</span><strong>{euros(245)}</strong></div>
           <button className={css.phonePrimary} onClick={()=>setStep(x=>x===4?0:x+1)}>{step===4?<History size={20}/>:step===0?<Check size={20}/>:<ArrowRight size={20}/>} {nextLabels[step]}</button>
           <small className={css.simulationHint}>Simulation uniquement : aucune livraison ni recette réelle.</small>
         </div>
         <div className={css.deliveryHelp}><Activity size={18}/><span><strong>Informations claires</strong><small>Appuyez sur le bouton principal pour simuler chaque étape.</small></span></div>
       </>}
       {tab==='history'&&<>
         <span className={css.phoneEyebrow}>MES LIVRAISONS</span><h1 className={css.phoneTitle}>Historique</h1><p className={css.phoneDesc}>Retrouvez les missions terminées.</p>
         <div className={css.phoneOrderCard}><span className={css.orderTag}>LIVRÉE</span><h3>Commande CMD-1039</h3><p>Smart Atelier · Gabès</p><strong>{euros(65)}</strong></div>
         {step===4&&<div className={css.phoneOrderCard}><span className={css.orderTag}>LIVRÉE (SIMULÉE)</span><h3>Commande CMD-1042</h3><p>Atelier Horizon · Gabès</p><strong>{euros(245)}</strong></div>}
       </>}
       {tab==='cash'&&<>
         <span className={css.phoneEyebrow}>REMETTRE MES ENCAISSEMENTS</span><h1 className={css.phoneTitle}>Caisse livreur</h1><p className={css.phoneDesc}>Comprendre les montants et la recette à remettre.</p>
         <div className={css.phoneDueCard}><small>Montant à remettre (démo)</small><strong>{euros(step===4?245:0)}</strong><span>Les montants sont fictifs et ne créent aucune dette.</span></div>
         <button className={css.phoneTask} onClick={()=>setNotice(v=>!v)}><span className={css.phoneTaskIcon}><FileText size={20}/></span><span><strong>Voir les détails</strong><small>Livraisons et espèces collectées</small></span><ChevronRight size={18}/></button>
       </>}
     </div>
     <nav className={css.bottomNav} aria-label="Navigation Livreur">
       {[{id:'missions',icon:Truck,label:'Missions'},{id:'history',icon:History,label:'Historique'},{id:'cash',icon:WalletCards,label:'Caisse'}].map(x=>{const Icon=x.icon;return <button key={x.id} className={tab===x.id?css.bottomActive:''} onClick={()=>setTab(x.id as DeliveryTab)}><Icon size={20}/><span>{x.label}</span></button>})}
     </nav>
   </div>
 </div>;
}

export function FixiOnePreview(){
 const[role,setRole]=useState<Role>('supplier');
 const roles:{id:Role;title:string;subtitle:string;icon:LucideIcon}[]=[
  {id:'supplier',title:'Fournisseur',subtitle:'Ordinateur et caisse',icon:Store},
  {id:'atelier',title:'Réparateur',subtitle:'Application mobile',icon:Wrench},
  {id:'delivery',title:'Livreur',subtitle:'Application mobile',icon:Truck},
 ];
 return <div className={css.previewRoot}>
   <div className={css.previewTop}>
     <div className={css.previewBrand}><Mark/><span className={css.previewDivider}/><span>One · Design Lab</span></div>
     <span className={css.previewTag}>Prototype interactif · 100 % données fictives</span>
   </div>
   <div className={css.previewIntro}>
     <div><span className={css.eyebrow}>NOUVELLE EXPÉRIENCE FIXI</span><h1>Une interface plus simple.<br/><span>Un travail plus rapide.</span></h1><p>Un design sobre, des actions évidentes, et une expérience adaptée à chaque métier. Testez les écrans et les boutons : rien n'est connecté à vos données.</p></div>
     <div className={css.previewSideNote}><CheckCircle2 size={21}/><span>Démo isolée du logiciel actuel<br/><strong>Aucun changement en production</strong></span></div>
   </div>
   <div className={css.rolePicker} role="tablist" aria-label="Choisir une application">{roles.map(item=>{const Icon=item.icon;return <button key={item.id} role="tab" aria-selected={role===item.id} onClick={()=>setRole(item.id)} className={role===item.id?css.roleSelected:''}><Icon size={21}/><span><strong>{item.title}</strong><small>{item.subtitle}</small></span>{role===item.id&&<Check size={17}/>}</button>})}</div>
   <div className={css.screenWrap}>
     <div className={css.screenLabel}><div><strong>{role==='supplier'?'FIXI Supplier · Vue ordinateur':role==='atelier'?'FIXI Atelier · Vue téléphone':'FIXI Delivery · Vue téléphone'}</strong><span>Parcours et interactions simulés</span></div><span><span className={css.previewDot}/> Prototype V1</span></div>
     {role==='supplier'?<SupplierDemo/>:<div className={css.phoneStage}>{role==='atelier'?<AtelierDemo/>:<DeliveryDemo/>}</div>}
   </div>
   <div className={css.previewFoot}><span><CheckCircle2 size={17}/> Prototype indépendant du backend FIXI.</span><span>Lisibilité et parcours à valider avant toute intégration.</span></div>
 </div>;
}
