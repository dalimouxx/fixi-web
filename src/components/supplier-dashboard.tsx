'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {
  Boxes,ClipboardList,LogOut,PackagePlus,Truck,CheckCircle2,Plus,RefreshCw,LayoutDashboard,Users,
  ReceiptText,WalletCards,BadgeDollarSign,Warehouse,Search,ArrowDownToLine,AlertTriangle,TrendingUp,
  Banknote,MapPinned,ShoppingCart,FileText,History,X
} from 'lucide-react';
import {api} from './ui';
import {dateTime,money} from '@/lib/format';
import {SupplierPos} from './supplier-pos';
import {SupplierMasterData} from './supplier-master-data';
import {SupplierDeliveryCenter} from './supplier-delivery-center';
import {SupplierActionModal} from './supplier-action-modal';
import {SupplierTeam} from './supplier-team';
import {SupplierReports} from './supplier-reports';
import {SupplierInventory} from './supplier-inventory';
import {SupplierWarehouses} from './supplier-warehouses';
import {SupplierReturns} from './supplier-returns';
import {SupplierDues} from './supplier-dues';
import {SupplierCommercialDocuments} from './supplier-commercial-documents';
import {SupplierPurchases} from './supplier-purchases';
import {RealtimeNotificationCenter} from './realtime-notification-center';
import {PushToggle} from './push-toggle';
import {PwaRegister} from './pwa-register';
import {InstallAppButton} from './install-app-button';
import {FixiMark} from './fixi-mark';
import {FixiSmartWidgets} from './fixi-smart-widgets';

const nextStatus:Record<string,string|undefined>={PENDING:'CONFIRMED',CONFIRMED:'PREPARING',PREPARING:'READY_FOR_DELIVERY',READY_FOR_DELIVERY:undefined,OUT_FOR_DELIVERY:undefined};
const labels:Record<string,string>={PENDING:'Nouvelle',CONFIRMED:'Confirmée',PREPARING:'Préparation',READY_FOR_DELIVERY:'Disponible livreurs',OUT_FOR_DELIVERY:'En livraison',RETURNING:'Retour fournisseur',RETURNED:'Retour reçu à traiter',DELIVERED:'Livrée',CANCELLED:'Annulée'};
type Tab='dashboard'|'orders'|'products'|'masters'|'purchases'|'vendors'|'clients'|'invoices'|'returns'|'warehouses'|'inventory'|'pricing'|'dues'|'finance'|'reports'|'cashier'|'delivery'|'team';

export function SupplierDashboard({session}:{session:any}){
  const[tab,setTab]=useState<Tab>(session.role==='CASHIER'?'cashier':session.role==='STOCK'?'products':session.role==='DELIVERY_MANAGER'?'delivery':session.role==='ACCOUNTANT'?'finance':'dashboard');const[products,setProducts]=useState<any[]>([]);const[orders,setOrders]=useState<any[]>([]);const[drivers,setDrivers]=useState<any[]>([]);const[erp,setErp]=useState<any>({customers:[],sales:[],saleItems:[],payments:[],expenses:[],purchases:[],cashSessions:[],movements:[],metrics:{}});const[advanced,setAdvanced]=useState<any>({warehouses:[],warehouseStock:[],vendors:[],returns:[],returnItems:[],counts:[],countItems:[],tiers:[],events:[]});const[master,setMaster]=useState<any>({categories:[],brands:[],units:[],paymentMethods:[],company:null});
  const[refresh,setRefresh]=useState(0);const[orderView,setOrderView]=useState<'active'|'history'>('active');const[orderSearch,setOrderSearch]=useState('');const[q,setQ]=useState('');const[actionModal,setActionModal]=useState<any>(null);const[showDriverForm,setShowDriverForm]=useState(false);const[driverForm,setDriverForm]=useState({fullName:'',login:'',phone:'',password:''});const[driverError,setDriverError]=useState('');
  const emptyProduct={sku:'',barcode:'',name:'',imageUrl:'',brandId:'',categoryId:'',unitId:'',qualityGrade:'',purchasePrice:'',retailPrice:'',wholesalePrice:'',minimumPrice:'',taxRate:'0',stock:'0',minStock:'0',maxStock:'',minOrderQty:'1',warrantyDays:'0',location:'',serialTracked:false};
  const[form,setForm]=useState<any>(emptyProduct);
  async function load(){const[p,o,e,a,d,m]=await Promise.all([fetch('/api/supplier/products',{cache:'no-store'}).then(r=>r.json()),fetch('/api/supplier/orders',{cache:'no-store'}).then(r=>r.json()),fetch('/api/supplier/erp',{cache:'no-store'}).then(r=>r.json()).catch(()=>null),fetch('/api/supplier/advanced',{cache:'no-store'}).then(r=>r.json()).catch(()=>null),fetch('/api/supplier/drivers',{cache:'no-store'}).then(r=>r.json()).catch(()=>[]),fetch('/api/supplier/master-data',{cache:'no-store'}).then(r=>r.json()).catch(()=>null)]);setProducts(Array.isArray(p)?p:[]);setOrders(Array.isArray(o)?o:[]);setDrivers(Array.isArray(d)?d:[]);if(e&&typeof e==='object')setErp(e);if(a&&typeof a==='object')setAdvanced(a);if(m&&typeof m==='object')setMaster(m)}
  useEffect(()=>{load();const vis=()=>{if(document.visibilityState==='visible')load()};const focus=()=>load();document.addEventListener('visibilitychange',vis);window.addEventListener('focus',focus);const t=setInterval(()=>{if(document.visibilityState==='visible')load()},18000);return()=>{clearInterval(t);document.removeEventListener('visibilitychange',vis);window.removeEventListener('focus',focus)}},[refresh]);
  async function logout(){await fetch('/api/supplier/auth/logout',{method:'POST'});location.href='/supplier/login'}
  async function add(e:any){e.preventDefault();await api('/api/supplier/products',{method:'POST',body:JSON.stringify({...form,price:Number(form.retailPrice||0),purchasePrice:Number(form.purchasePrice||0),retailPrice:Number(form.retailPrice||0),wholesalePrice:form.wholesalePrice===''?null:Number(form.wholesalePrice),minimumPrice:form.minimumPrice===''?null:Number(form.minimumPrice),taxRate:Number(form.taxRate||0),stock:Number(form.stock||0),minStock:Number(form.minStock||0),maxStock:form.maxStock===''?null:Number(form.maxStock),minOrderQty:Number(form.minOrderQty||1),warrantyDays:Number(form.warrantyDays||0)})});setForm(emptyProduct);setRefresh(x=>x+1)}
  async function status(id:string,status:string){await api('/api/supplier/orders/'+id,{method:'PATCH',body:JSON.stringify({status})});setRefresh(x=>x+1)}
  async function erpAction(payload:any){await api('/api/supplier/erp',{method:'POST',body:JSON.stringify(payload)});setRefresh(x=>x+1)}
  async function advancedAction(payload:any){await api('/api/supplier/advanced',{method:'POST',body:JSON.stringify(payload)});setRefresh(x=>x+1)}
  async function newCustomer(){setActionModal({type:'CUSTOMER'})}
  async function newExpense(){setActionModal({type:'EXPENSE'})}
  async function purchase(p:any){setActionModal({type:'PURCHASE',product:p})}
  async function newVendor(){setActionModal({type:'VENDOR'})}
  async function newWarehouse(){setActionModal({type:'WAREHOUSE'})}
  async function startInventory(){await advancedAction({action:'STOCK_COUNT_START',reference:'INV-'+Date.now(),warehouseId:advanced.warehouses?.[0]?.id||null})}
  async function addTier(){setActionModal({type:'PRICE_TIER'})}
  async function createReturn(){setActionModal({type:'RETURN'})}
  async function newDriver(e?:any){if(e)e.preventDefault();setDriverError('');try{if(!driverForm.fullName.trim())throw new Error('Nom du livreur requis');if(!driverForm.login.trim())throw new Error('Identifiant requis');if(driverForm.password.length<4)throw new Error('Mot de passe minimum 4 caractères');await api('/api/supplier/drivers',{method:'POST',body:JSON.stringify({fullName:driverForm.fullName.trim(),login:driverForm.login.trim().toLowerCase(),password:driverForm.password,phone:driverForm.phone.trim()})});setDriverForm({fullName:'',login:'',phone:'',password:''});setShowDriverForm(false);setRefresh(x=>x+1)}catch(e:any){setDriverError(e.message||'Impossible de créer le livreur')}}
  const activeOrders=orders.filter(x=>!['DELIVERED','CANCELLED'].includes(x.status));
  const delivered=orders.filter(x=>x.status==='DELIVERED');const revenue=delivered.reduce((a,x)=>a+Number(x.total),0);
  const stockUnits=products.reduce((a,p)=>a+Number(p.stock||0),0);const stockValue=products.reduce((a,p)=>a+Number(p.stock||0)*Number(p.price||0),0);
  const lowStock=products.filter(p=>Number(p.stock||0)<=Math.max(2,Number(p.minOrderQty||1))).length;
  const clients=useMemo(()=>{const m=new Map<string,any>();for(const o of orders){const k=o.shop?.name||o.shopId;if(!m.has(k))m.set(k,{name:k,region:o.shop?.region,address:o.shop?.address,phone:o.shop?.phone,orders:0,total:0,last:o.createdAt});const x=m.get(k);x.orders++;x.total+=Number(o.total);if(new Date(o.createdAt)>new Date(x.last))x.last=o.createdAt}return [...m.values()].sort((a,b)=>b.total-a.total)},[orders]);
  const filteredProducts=products.filter(p=>[p.sku,p.name,p.brand,p.category].join(' ').toLowerCase().includes(q.toLowerCase()));
  const orderQuery=orderSearch.trim().toLocaleLowerCase('fr');
  const visibleOrders=orders.filter(o=>{
    const finished=['DELIVERED','CANCELLED','RETURNED'].includes(o.status);
    if(orderView==='active'&&finished||orderView==='history'&&!finished)return false;
    if(!orderQuery)return true;
    const values=[o.reference,o.shop?.name,o.shop?.phone,o.shop?.region,o.deliveryAddress,
      ...(o.items||[]).flatMap((item:any)=>[item.product?.name,item.product?.sku])];
    return values.some(x=>String(x||'').toLocaleLowerCase('fr').includes(orderQuery));
  });
  const dueForShop=(shopId:string)=>{const customer=(erp.customers||[]).find((x:any)=>x.shopId===shopId);if(!customer)return 0;return (erp.sales||[]).filter((x:any)=>x.customerId===customer.id&&x.status!=='CANCELLED').reduce((a:number,x:any)=>a+Math.max(0,Number(x.total||0)-Number(x.paid||0)),0)};
  const cashCollected=delivered.reduce((a,o)=>a+Number(o.total),0);
  const directSales=Number(erp.metrics?.salesTotal??(erp.sales||[]).reduce((a:any,x:any)=>a+Number(x.total||0),0));const directPaid=Number(erp.metrics?.collected??(erp.payments||[]).filter((x:any)=>x.kind==='IN').reduce((a:any,x:any)=>a+Number(x.amount||0),0));const expensesTotal=Number(erp.metrics?.expenses??(erp.expenses||[]).reduce((a:any,x:any)=>a+Number(x.amount||0),0));const purchaseTotal=Number(erp.metrics?.purchaseTotal??(erp.purchases||[]).reduce((a:any,x:any)=>a+Number(x.total||0),0));const dueSales=Number(erp.metrics?.receivables??(erp.sales||[]).reduce((a:any,x:any)=>a+Math.max(0,Number(x.total||0)-Number(x.paid||0)),0));const duePurchases=Number(erp.metrics?.payables??(erp.purchases||[]).reduce((a:any,x:any)=>a+Math.max(0,Number(x.total||0)-Number(x.paid||0)),0));const estimatedGross=revenue+Number(erp.metrics?.grossProfit||0)-expensesTotal;const cashOpen=(erp.cashSessions||[]).find((x:any)=>x.status==='OPEN'&&(!x.accountId||x.accountId===session.id));

  const role=String(session.role||'ADMIN');
  const access:Record<string,string[]>={
    OWNER:['dashboard','cashier','orders','products','masters','purchases','vendors','clients','invoices','returns','warehouses','inventory','pricing','dues','finance','reports','delivery','team'],
    ADMIN:['dashboard','cashier','orders','products','masters','purchases','vendors','clients','invoices','returns','warehouses','inventory','pricing','dues','finance','reports','delivery','team'],
    MANAGER:['dashboard','cashier','orders','products','masters','purchases','vendors','clients','invoices','returns','warehouses','inventory','pricing','dues','finance','reports','delivery','team'],
    STOCK:['dashboard','products','masters','purchases','vendors','returns','warehouses','inventory','pricing','reports'],
    SALES:['dashboard','cashier','orders','products','clients','invoices','pricing','dues','reports'],
    CASHIER:['dashboard','cashier','clients','invoices','delivery'],
    ACCOUNTANT:['dashboard','clients','invoices','dues','finance','reports','purchases','vendors'],
    DELIVERY_MANAGER:['dashboard','orders','delivery']
  };
  const navAll=[
    ['dashboard','Tableau de bord',LayoutDashboard],['cashier','POS / Caisse',WalletCards],['orders','Commandes',ClipboardList],['products','Produits & stock',Warehouse],['masters','Référentiels',Boxes],['purchases','Achats',ArrowDownToLine],['vendors','Fournisseurs',Users],
    ['clients','Clients',Users],['invoices','Facturation',ReceiptText],['returns','Retours',RefreshCw],['warehouses','Dépôts',Warehouse],['inventory','Inventaire',Boxes],['pricing','Prix grossistes',BadgeDollarSign],['dues','Créances & dettes',Banknote],
    ['finance','Finance & bénéfice',TrendingUp],['reports','Rapports',FileText],['delivery','Livraison',Truck],['team','Équipe & accès',Users]
  ] as const;
  const nav=navAll.filter(([key])=>(access[role]||access.ADMIN).includes(key));
  useEffect(()=>{
    const fromUrl=new URLSearchParams(window.location.search).get('tab');
    const match=nav.find(([key])=>key===fromUrl);
    if(match)setTab(match[0] as Tab);
  },[]);
  function navigateNotification(href:string){
    if(href.startsWith('/supplier?')){
      const target=new URL(href,window.location.origin).searchParams.get('tab');
      const allowed=nav.find(([key])=>key===target);
      if(allowed){setTab(allowed[0] as Tab);setMobileNavOpen(false);return;}
    }
    // The finance, delivery and other supplier pages are separate routes.
    if(href.startsWith('/supplier/')||href==='/supplier'){
      window.location.assign(href);return;
    }
    window.location.assign('/supplier');
  }

  const [mobileNavOpen,setMobileNavOpen]=useState(false);
  const mobilePrimary=nav.filter(([key])=>['dashboard','orders','products','delivery','cashier'].includes(key)).slice(0,4);

  return <div className="supplier-os supplier-erp"><PwaRegister/>
    {mobileNavOpen&&<button aria-label="Fermer le menu fournisseur" className="fixi-supplier-drawer-backdrop" onClick={()=>setMobileNavOpen(false)}/>}
    <aside className={mobileNavOpen?'fixi-supplier-drawer open':'fixi-supplier-drawer'} aria-label="Navigation Supplier">
      <button className="fixi-supplier-drawer-close" aria-label="Fermer le menu" onClick={()=>setMobileNavOpen(false)}><X size={20}/></button>
      <div className="supplier-os-brand"><FixiMark/><div><b>Fixi Supplier</b><span>{session.companyName}</span></div></div>
      <div className="fixi-supplier-menu-scroll" role="navigation" aria-label="Modules du fournisseur" tabIndex={0}>
        {nav.map(([key,label,Icon])=><div key={key} className="fixi-supplier-nav-item">
          {key==='dashboard'&&<div className="supplier-nav-label">VUE GÉNÉRALE</div>}
          {key==='products'&&<div className="supplier-nav-label">CATALOGUE & STOCK</div>}
          {key==='clients'&&<div className="supplier-nav-label">VENTES & FACTURATION</div>}
          {key==='warehouses'&&<div className="supplier-nav-label">GESTION DES DÉPÔTS</div>}
          {key==='dues'&&<div className="supplier-nav-label">COMPTES & LOGISTIQUE</div>}
          <button type="button" className={tab===key?'active':''} onClick={()=>{setTab(key as Tab);setMobileNavOpen(false)}} aria-current={tab===key?'page':undefined}>
            <Icon/><span>{label}</span>{key==='orders'&&activeOrders.length>0&&<em>{activeOrders.length}</em>}
          </button>
        </div>)}
        <div className="supplier-nav-label">ABONNEMENT & RÈGLEMENTS</div>
        <Link href="/supplier/settlements" onClick={()=>setMobileNavOpen(false)} className="supplier-delivery-link"><WalletCards/><span>Comptes & règlements</span></Link>
        <Link href="/supplier/subscription" onClick={()=>setMobileNavOpen(false)} className="supplier-delivery-link"><ReceiptText/><span>Mon abonnement Supplier</span></Link>
        <div className="supplier-nav-label">LIVRAISONS</div>
        <Link href="/delivery/login" target="_blank" className="supplier-delivery-link"><MapPinned/><span>App livreur</span></Link>
      </div>
      <div className="supplier-side-foot"><div><strong>{session.fullName}</strong><small>{session.role||'ADMIN'} · Compte fournisseur</small></div><button onClick={logout}><LogOut/></button></div>
    </aside>

    <main>
      <header><div className="fixi-supplier-header-title"><button type="button" className="fixi-supplier-menu-button" aria-label="Ouvrir les modules fournisseur" aria-expanded={mobileNavOpen} onClick={()=>setMobileNavOpen(true)}><span>☰</span></button><div><span>FIXI SUPPLIER ERP</span><h1>{nav.find(x=>x[0]===tab)?.[1]}</h1></div></div><div className="toolbar"><RealtimeNotificationCenter apiUrl="/api/supplier/notifications" eventsUrl="/api/supplier/events" storageKey="fixi-supplier-notifications" onEvent={()=>setRefresh(x=>x+1)} onNavigate={navigateNotification}/><PushToggle subscribeUrl="/api/supplier/push/subscribe"/><InstallAppButton label="Installer"/><button className="btn btn-ghost" onClick={()=>setRefresh(x=>x+1)}><RefreshCw/> Actualiser</button></div></header>
      <section className="supplier-mobile-install">
        <div className="supplier-mobile-install-copy"><i>F</i><span><b>Fixi Supplier sur votre téléphone</b><small>Installez l’ERP comme application et activez les notifications pour les commandes, paiements, retours et livraisons.</small></span></div>
        <div className="supplier-mobile-install-actions"><InstallAppButton label="Installer Fixi Supplier"/><PushToggle subscribeUrl="/api/supplier/push/subscribe" label/></div>
      </section>

      {tab==='dashboard'&&<>
        <section className="fixi-supplier-quick-workflow" aria-label="Actions rapides du fournisseur">
          <div className="fixi-workflow-heading"><div><span>FIXI CLEAR PRO</span><h2>Que souhaitez-vous faire ?</h2><p>Accédez directement à vos opérations les plus fréquentes.</p></div></div>
          <div className="fixi-workflow-actions">
            {nav.some(([key])=>key==='orders')&&<button type="button" onClick={()=>setTab('orders')}>
              <ClipboardList size={21}/><strong>Commandes</strong><small>{activeOrders.length} à suivre</small></button>}
            {nav.some(([key])=>key==='cashier')&&<button type="button" onClick={()=>setTab('cashier')}>
              <WalletCards size={21}/><strong>Nouvelle vente</strong><small>Ouvrir la caisse</small></button>}
            {nav.some(([key])=>key==='products')&&<button type="button" onClick={()=>setTab('products')}>
              <Warehouse size={21}/><strong>Stock</strong><small>{lowStock} alertes stock</small></button>}
            {nav.some(([key])=>key==='dues')&&<button type="button" onClick={()=>setTab('dues')}>
              <Banknote size={21}/><strong>Créances</strong><small>Soldes et règlements</small></button>}
          </div>
        </section>
        <FixiSmartWidgets area="supplier" onAction={target=>setTab(target as Tab)}
          subtitle="Commandes, ventes, stock et clients de votre société, actualisés automatiquement."
          widgets={[
            {id:'supplier-orders',label:'Commandes actives',value:activeOrders.length,
             description:'À préparer ou à livrer',icon:'orders',action:'orders',urgent:activeOrders.some(o=>o.status==='PENDING')},
            {id:'supplier-revenue',label:'CA livré',value:money(revenue),
             description:'Commandes livrées enregistrées',icon:'finance',accent:'success',action:'finance'},
            {id:'supplier-stock',label:'Unités en stock',value:stockUnits,
             description:'Stock disponible dans le catalogue',icon:'stock',action:'products'},
            {id:'supplier-value',label:'Valeur vente stock',value:money(stockValue),
             description:'Estimation aux prix de vente',icon:'finance',accent:'info',action:'inventory'},
            {id:'supplier-warning',label:'Stock faible',value:lowStock,
             description:'Produits à réapprovisionner',icon:'alert',accent:'warning',urgent:lowStock>0,action:'products'},
            {id:'supplier-clients',label:'Clients professionnels',value:clients.length+(erp.customers?.length||0),
             description:'Boutiques connectées et clients ERP',icon:'clients',action:'clients'},
          ]}/>
        <div className="supplier-dashboard-grid">
          <section className="supplier-panel"><div className="supplier-section-head"><div><b>À traiter maintenant</b><span>Actions prioritaires pour aujourd’hui</span></div></div>
            <div className="supplier-action-list">
              {activeOrders.filter(o=>o.status==='PENDING').length>0&&<button onClick={()=>setTab('orders')}><ClipboardList/><span><b>{activeOrders.filter(o=>o.status==='PENDING').length} nouvelles commandes</b><small>À confirmer</small></span></button>}
              {lowStock>0&&<button onClick={()=>setTab('products')}><AlertTriangle/><span><b>{lowStock} produits en stock faible</b><small>Réapprovisionnement conseillé</small></span></button>}
              {orders.filter(o=>o.status==='READY_FOR_DELIVERY').length>0&&<button onClick={()=>setTab('delivery')}><Truck/><span><b>{orders.filter(o=>o.status==='READY_FOR_DELIVERY').length} commandes prêtes</b><small>À affecter aux livreurs</small></span></button>}
              {!activeOrders.length&&!lowStock&&<div className="supplier-ok"><CheckCircle2/><span><b>Tout est sous contrôle</b><small>Aucune alerte prioritaire</small></span></div>}
            </div>
          </section>
          <section className="supplier-panel"><div className="supplier-section-head"><div><b>Performance</b><span>Résumé commercial</span></div></div>
            <div className="supplier-metrics"><div><span>Commandes livrées</span><b>{delivered.length}</b></div><div><span>Panier moyen</span><b>{money(delivered.length?revenue/delivered.length:0)}</b></div><div><span>Bénéfice estimatif*</span><b>{money(estimatedGross)}</b></div><div><span>Clients</span><b>{clients.length}</b></div></div>
            <small className="supplier-disclaimer">* Estimation temporaire jusqu’à activation du coût d’achat réel par produit.</small>
          </section>
        </div>
        <section className="supplier-panel" style={{marginTop:12}}><div className="supplier-section-head"><div><b>Dernières commandes</b><span>Flux boutiques Fixi</span></div><button className="btn btn-soft btn-sm" onClick={()=>setTab('orders')}>Tout voir</button></div><OrderTable orders={orders.slice(0,8)}/></section>
      </>}

      {tab==='orders'&&<section className="supplier-panel">
        <div className="fixi-orders-search-panel">
          <div><h2>Rechercher une commande</h2><p>Retrouvez une commande par numéro, atelier, téléphone, ville ou article.</p></div>
          <div className="fixi-orders-search-row">
            <label htmlFor="fixi-supplier-order-search" className="fixi-search-field"><Search size={19} aria-hidden="true"/>
              <input id="fixi-supplier-order-search" type="search" autoComplete="off"
                value={orderSearch} onChange={e=>setOrderSearch(e.target.value)}
                placeholder="Ex. CMD-204, Samsung, Atelier..."/>
            </label>
            {orderSearch&&<button type="button" className="btn btn-soft" onClick={()=>setOrderSearch('')}>Effacer</button>}
          </div>
          <small role="status" aria-live="polite">{visibleOrders.length} commande(s) affichée(s) · {orderView==='active'?'En cours':'Historique'}</small>
        </div>
        <div className="supplier-orders-tabs"><button className={orderView==='active'?'active':''} onClick={()=>setOrderView('active')}>À traiter <b>{orders.filter(o=>!['DELIVERED','CANCELLED','RETURNED'].includes(o.status)).length}</b></button><button className={orderView==='history'?'active':''} onClick={()=>setOrderView('history')}>Historique <b>{orders.filter(o=>['DELIVERED','CANCELLED','RETURNED'].includes(o.status)).length}</b></button></div><div className="supplier-order-grid">{visibleOrders.map(o=><article key={o.id}><div className="supplier-order-head"><div><code>{o.reference}</code><b>{o.shop.name}</b><span>{o.shop.region||'—'} · {dateTime(o.createdAt)}</span></div><span className={`status-pill ${o.status.toLowerCase()}`}>{labels[o.status]||o.status}</span></div><div className="supplier-order-customer"><div><span>Client</span><b>{o.shop.name}</b><small>{o.shop.phone||'Téléphone —'}</small><small>{o.deliveryAddress||o.shop.address||o.shop.region||'Adresse —'}</small></div><div><span>Dû client</span><b>{money(dueForShop(o.shopId))}</b><small>Code remise {o.deliveryCode||'—'}</small></div></div><div className="supplier-order-items">{o.items.map((i:any)=><div key={i.id}><span><b>{i.product.name}</b><small>{i.product.sku||''}</small> × {i.quantity}</span><b>{money(Number(i.unitPrice)*i.quantity)}</b></div>)}</div><div className="supplier-order-total"><span>Total commande</span><b>{money(o.total)}</b></div><div className="supplier-order-actions">{nextStatus[o.status]&&<button className="btn btn-primary btn-sm" onClick={()=>status(o.id,nextStatus[o.status]!)}>{labels[nextStatus[o.status]!]}</button>}{['READY_FOR_DELIVERY','OUT_FOR_DELIVERY','RETURNING','RETURNED','DELIVERED'].includes(o.status)&&<Link className="btn btn-soft btn-sm" href={'/supplier/orders/'+o.id+'/ticket'} target="_blank"><FileText/> Ticket livraison</Link>}{!['OUT_FOR_DELIVERY','RETURNING','RETURNED','DELIVERED','CANCELLED'].includes(o.status)&&<button className="btn btn-danger btn-sm" onClick={()=>status(o.id,'CANCELLED')}>Annuler</button>}</div>{o.delivery&&<div className="supplier-delivery"><Truck/><span>{labels[o.status]}{o.delivery.driverName?` · ${o.delivery.driverName}`:''}{o.delivery.driverPhone?` · ${o.delivery.driverPhone}`:''}{Number(o.delivery.cashCollected||0)>0?` · encaissé ${money(o.delivery.cashCollected)}`:''}</span></div>}</article>)}
        {visibleOrders.length===0&&<div className="fixi-orders-empty" role="status">
          <ClipboardList size={32} aria-hidden="true"/>
          <div><strong>{orderSearch?'Aucune commande pour cette recherche':'Aucune commande dans cette catégorie'}</strong>
          <p>{orderSearch?'Essayez un autre numéro, client, téléphone ou produit.':'Les nouvelles commandes apparaîtront ici après confirmation de leur réception.'}</p></div>
          {orderSearch&&<button type="button" className="btn btn-soft" onClick={()=>setOrderSearch('')}>Réinitialiser</button>}
        </div>}
        </div></section>}

      {tab==='products'&&<><div className="supplier-stock-toolbar"><div className="global-search"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="SKU, code-barres, produit, marque, catégorie…"/></div><div><b>{stockUnits}</b><span>unités physiques</span></div><div><b>{money(products.reduce((a,p)=>a+Number(p.stock||0)*Number(p.averageCost||p.purchasePrice||0),0))}</b><span>valorisation au coût</span></div><Link href="/supplier/import-products" className="btn btn-soft"><FileText/> Import CSV</Link></div><div className="supplier-catalog-layout"><section className="supplier-panel"><div className="supplier-product-grid">{filteredProducts.map(p=><article key={p.id}><div className="supplier-product-img">{p.imageUrl?<img src={p.imageUrl} alt=""/>:<Boxes/>}</div><code>{p.sku}{p.barcode?' · '+p.barcode:''}</code><b>{p.name}</b><span>{p.brand||'—'} · {p.category||'Sans catégorie'}{p.qualityGrade?' · '+p.qualityGrade:''}</span><div><strong>{money(p.retailPrice??p.price)}</strong><em className={(Number(p.stock)-Number(p.reservedStock||0))<=Number(p.minStock||0)?'low':''}>{Number(p.stock)-Number(p.reservedStock||0)} dispo.</em></div><small>Coût {money(p.averageCost||p.purchasePrice||0)} · Grossiste {p.wholesalePrice?money(p.wholesalePrice):'—'} · {p.warrantyDays||0} j garantie</small><button className="btn btn-soft btn-sm btn-block" onClick={()=>purchase(p)}>+ Réapprovisionner</button></article>)}</div></section><form className="supplier-panel supplier-add supplier-add-rich" onSubmit={add}><div className="smart-kicker"><PackagePlus size={13}/> FICHE PRODUIT</div><h2>Nouveau produit</h2><div className="supplier-product-form-grid"><div className="field"><label className="label">SKU *</label><input className="input" required value={form.sku} onChange={e=>setForm({...form,sku:e.target.value})}/></div><div className="field"><label className="label">Code-barres</label><input className="input" value={form.barcode} onChange={e=>setForm({...form,barcode:e.target.value})}/></div><div className="field wide"><label className="label">Nom *</label><input className="input" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div><label className="supplier-product-photo wide"><span className="label">Photo produit</span><div>{form.imageUrl?<img src={form.imageUrl} alt="Aperçu"/>:<Boxes/>}<span><b>{form.imageUrl?'Photo prête':'Ajouter une photo'}</b><small>JPG/PNG · compression automatique</small></span></div><input type="file" accept="image/*" onChange={async e=>{const file=e.target.files?.[0];if(file)setForm({...form,imageUrl:await compressProductImage(file)})}}/></label><div className="field"><label className="label">Catégorie *</label><select className="input" required value={form.categoryId} onChange={e=>setForm({...form,categoryId:e.target.value})}><option value="">Choisir…</option>{(master.categories||[]).filter((x:any)=>x.active).map((x:any)=><option key={x.id} value={x.id}>{x.parentId?'↳ ':''}{x.name}</option>)}</select></div><div className="field"><label className="label">Marque</label><select className="input" value={form.brandId} onChange={e=>setForm({...form,brandId:e.target.value})}><option value="">Sans marque</option>{(master.brands||[]).filter((x:any)=>x.active).map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div><div className="field"><label className="label">Unité</label><select className="input" value={form.unitId} onChange={e=>setForm({...form,unitId:e.target.value})}><option value="">Pièce</option>{(master.units||[]).filter((x:any)=>x.active).map((x:any)=><option key={x.id} value={x.id}>{x.name} ({x.symbol})</option>)}</select></div><div className="field"><label className="label">Qualité / grade</label><input className="input" placeholder="Original, OLED, Incell…" value={form.qualityGrade} onChange={e=>setForm({...form,qualityGrade:e.target.value})}/></div><div className="field"><label className="label">Coût achat</label><input className="input" type="number" min="0" step="0.001" value={form.purchasePrice} onChange={e=>setForm({...form,purchasePrice:e.target.value})}/></div><div className="field"><label className="label">Prix détail *</label><input className="input" required type="number" min="0" step="0.001" value={form.retailPrice} onChange={e=>setForm({...form,retailPrice:e.target.value})}/></div><div className="field"><label className="label">Prix grossiste</label><input className="input" type="number" min="0" step="0.001" value={form.wholesalePrice} onChange={e=>setForm({...form,wholesalePrice:e.target.value})}/></div><div className="field"><label className="label">Prix minimum</label><input className="input" type="number" min="0" step="0.001" value={form.minimumPrice} onChange={e=>setForm({...form,minimumPrice:e.target.value})}/></div><div className="field"><label className="label">TVA %</label><input className="input" type="number" min="0" step="0.01" value={form.taxRate} onChange={e=>setForm({...form,taxRate:e.target.value})}/></div><div className="field"><label className="label">Stock initial</label><input className="input" type="number" min="0" value={form.stock} onChange={e=>setForm({...form,stock:e.target.value})}/></div><div className="field"><label className="label">Stock minimum</label><input className="input" type="number" min="0" value={form.minStock} onChange={e=>setForm({...form,minStock:e.target.value})}/></div><div className="field"><label className="label">Stock maximum</label><input className="input" type="number" min="0" value={form.maxStock} onChange={e=>setForm({...form,maxStock:e.target.value})}/></div><div className="field"><label className="label">Emplacement</label><input className="input" placeholder="A-03-02" value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></div><div className="field"><label className="label">Garantie (jours)</label><input className="input" type="number" min="0" value={form.warrantyDays} onChange={e=>setForm({...form,warrantyDays:e.target.value})}/></div><label className="supplier-check wide"><input type="checkbox" checked={form.serialTracked} onChange={e=>setForm({...form,serialTracked:e.target.checked})}/><span>Suivi par numéro de série / IMEI</span></label></div><button className="btn btn-primary btn-block"><Plus/> Créer le produit</button><button type="button" className="btn btn-soft btn-block" onClick={()=>setTab('masters')}>Gérer catégories, marques et unités</button></form></div></>}

      {tab==='clients'&&<section className="supplier-panel"><div className="supplier-section-head"><div><b>Clients professionnels</b><span>Boutiques Fixi + clients directs du fournisseur</span></div><button className="btn btn-primary btn-sm" onClick={newCustomer}><Plus/> Nouveau client</button></div><div className="table-wrap"><table className="table"><thead><tr><th>Client</th><th>Région</th><th>Téléphone</th><th>Commandes</th><th>CA cumulé</th><th>Dernière activité</th></tr></thead><tbody>{clients.map((x:any)=><tr key={x.name}><td><b>{x.name}</b><div className="muted">{x.address||'—'}</div></td><td>{x.region||'—'}</td><td>{x.phone||'—'}</td><td>{x.orders}</td><td><b>{money(x.total)}</b></td><td>{dateTime(x.last)}</td></tr>)}{(erp.customers||[]).map((x:any)=><tr key={x.id}><td><b>{x.name}</b><div className="muted">{x.address||'Client direct'}</div></td><td>{x.region||'—'}</td><td>{x.phone||'—'}</td><td>Direct</td><td>—</td><td>{dateTime(x.updatedAt)}</td></tr>)}</tbody></table></div></section>}

      {tab==='invoices'&&<><section className="supplier-panel"><div className="supplier-section-head"><div><b>Factures de vente</b><span>Factures issues du POS et des commandes Fixi livrées, avec statut de règlement.</span></div></div><div className="supplier-invoice-list">{(erp.sales||[]).map((x:any)=>{const credits=(erp.returns||[]).filter((r:any)=>r.sourceSaleId===x.id&&r.status==='COMPLETED');const credit=credits.reduce((a:number,r:any)=>a+Number(r.total||0),0),refund=credits.reduce((a:number,r:any)=>a+Number(r.refund||0),0),netTotal=Math.max(0,Number(x.total)-credit),netPaid=Math.max(0,Number(x.paid)-refund),due=Math.max(0,netTotal-netPaid);return <article key={x.id}><div className="supplier-invoice-list-main"><i><ReceiptText/></i><span><code>{x.reference}</code><b>{x.sourceOrderId?'Commande Marketplace':'Vente directe / POS'}</b><small>{dateTime(x.createdAt)}{credit>0?' · avoir '+money(credit):''}</small></span></div><div className="supplier-invoice-list-money"><b>{money(netTotal)}</b><small className={due>0?'due':''}>{due>0?'Reste '+money(due):'Soldée'}</small></div><Link className="btn btn-soft btn-sm" href={'/supplier/documents/'+x.id} target="_blank"><FileText/> Facture</Link></article>})}{!(erp.sales||[]).length&&<div className="delivery-empty"><ReceiptText/><h3>Aucune facture</h3><p>Les ventes POS et commandes Marketplace livrées apparaîtront ici.</p></div>}</div></section><section className="supplier-panel" style={{marginTop:12}}><SupplierCommercialDocuments products={products} customers={erp.customers||[]} vendors={advanced.vendors||[]} warehouses={advanced.warehouses||[]} onChanged={()=>setRefresh(x=>x+1)}/></section></>}

      {tab==='finance'&&<><div className="supplier-kpis"><K icon={BadgeDollarSign} label="CA marketplace" value={money(revenue)}/><K icon={Banknote} label="Ventes directes" value={money(directSales)}/><K icon={AlertTriangle} label="Créances clients" value={money(dueSales)}/><K icon={Warehouse} label="Dettes achats" value={money(duePurchases)}/></div><section className="supplier-panel"><div className="supplier-section-head"><div><b>Finance fournisseur</b><span>Ventes, paiements, achats et dépenses enregistrés.</span></div><button className="btn btn-soft btn-sm" onClick={newExpense}><Plus/> Dépense</button></div><div className="supplier-metrics"><div><span>Encaissements directs</span><b>{money(directPaid)}</b></div><div><span>Dépenses</span><b>{money(expensesTotal)}</b></div><div><span>Achats</span><b>{money(purchaseTotal)}</b></div><div><span>Résultat de flux</span><b>{money(revenue+directPaid-expensesTotal-purchaseTotal)}</b></div></div></section></>}

      {tab==='cashier'&&<SupplierPos products={products} customers={erp.customers||[]} cashSessions={erp.cashSessions||[]} methods={master.paymentMethods||[]} warehouses={advanced.warehouses||[]} warehouseStock={advanced.warehouseStock||[]} session={session} onChanged={()=>setRefresh(x=>x+1)}/>} 
      {tab==='masters'&&<SupplierMasterData data={master} onChanged={()=>setRefresh(x=>x+1)}/>} 

      
      {tab==='purchases'&&<SupplierPurchases products={products} purchases={erp.purchases||[]} vendors={advanced.vendors||[]} warehouses={advanced.warehouses||[]} methods={master.paymentMethods||[]} onChanged={()=>setRefresh(x=>x+1)}/>} 

      {tab==='vendors'&&<section className="supplier-panel"><div className="supplier-section-head"><div><b>Fournisseurs amont</b><span>Grossistes/importateurs auprès desquels vous achetez.</span></div><button className="btn btn-primary btn-sm" onClick={newVendor}><Plus/> Ajouter</button></div><div className="supplier-card-grid">{(advanced.vendors||[]).map((v:any)=><article key={v.id}><Users/><div><b>{v.name}</b><span>{v.phone||'—'} · {v.address||'—'}</span></div><strong>{money(v.openingDue||0)}</strong></article>)}</div></section>}

      {tab==='returns'&&<SupplierReturns sales={erp.sales||[]} saleItems={erp.saleItems||[]} returns={advanced.returns||[]} returnItems={advanced.returnItems||[]} warehouses={advanced.warehouses||[]} methods={master.paymentMethods||[]} onChanged={()=>setRefresh(x=>x+1)}/>} 

      {tab==='warehouses'&&<SupplierWarehouses products={products} warehouses={advanced.warehouses||[]} warehouseStock={advanced.warehouseStock||[]} onNewWarehouse={newWarehouse} onChanged={()=>setRefresh(x=>x+1)}/>} 

      {tab==='inventory'&&<SupplierInventory products={products} warehouses={advanced.warehouses||[]} counts={advanced.counts||[]} countItems={advanced.countItems||[]} onChanged={()=>setRefresh(x=>x+1)}/>} 

      {tab==='pricing'&&<section className="supplier-panel"><div className="supplier-section-head"><div><b>Prix grossistes & paliers</b><span>Tarifs selon la quantité commandée.</span></div><button className="btn btn-primary btn-sm" onClick={addTier}><Plus/> Nouveau palier</button></div><div className="table-wrap"><table className="table"><thead><tr><th>Produit</th><th>Tarif</th><th>Qté min.</th><th>Prix</th></tr></thead><tbody>{(advanced.tiers||[]).map((x:any)=><tr key={x.id}><td>{products.find(p=>p.id===x.productId)?.name||x.productId}</td><td>{x.name}</td><td>{x.minQty}</td><td><b>{money(x.unitPrice)}</b></td></tr>)}</tbody></table></div></section>}

      {tab==='dues'&&<SupplierDues sales={erp.sales||[]} purchases={erp.purchases||[]} returns={erp.returns||advanced.returns||[]} customers={erp.customers||[]} methods={master.paymentMethods||[]} onChanged={()=>setRefresh(x=>x+1)}/>} 

      {tab==='reports'&&<SupplierReports/>}

{tab==='delivery'&&<SupplierDeliveryCenter orders={orders} drivers={drivers} onChanged={()=>setRefresh(x=>x+1)}/>}
      {tab==='team'&&<SupplierTeam session={session}/>} 
    </main>
    <nav className="fixi-supplier-bottom-nav" aria-label="Accès rapides Supplier">
      {mobilePrimary.map(([key,label,Icon])=><button type="button" key={key} className={tab===key?'active':''}
        aria-current={tab===key?'page':undefined} onClick={()=>{setTab(key as Tab);setMobileNavOpen(false)}}>
        <Icon size={20}/><span>{label==='Tableau de bord'?'Accueil':label==='Produits & stock'?'Stock':label==='POS / Caisse'?'Caisse':label}</span>
      </button>)}
      <button type="button" aria-label="Tous les modules" onClick={()=>setMobileNavOpen(true)}>
        <span style={{fontSize:23,lineHeight:1}}>≡</span><span>Plus</span>
      </button>
    </nav>
    <SupplierActionModal action={actionModal} products={products} vendors={advanced.vendors||[]} methods={master.paymentMethods||[]} warehouses={advanced.warehouses||[]} onClose={()=>setActionModal(null)} onDone={()=>setRefresh(x=>x+1)}/>
  </div>
}

function K({icon:Icon,label,value}:any){return <div><i><Icon/></i><span>{label}</span><b>{value}</b></div>}
function OrderTable({orders}:{orders:any[]}){return <div className="table-wrap"><table className="table"><thead><tr><th>Commande</th><th>Boutique</th><th>Statut</th><th>Total</th><th>Date</th></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td><code>{o.reference}</code></td><td>{o.shop.name}</td><td><span className={`status-pill ${o.status.toLowerCase()}`}>{labels[o.status]||o.status}</span></td><td><b>{money(o.total)}</b></td><td>{dateTime(o.createdAt)}</td></tr>)}</tbody></table></div>}

async function compressProductImage(file:File){return new Promise<string>((resolve,reject)=>{const img=new Image();const url=URL.createObjectURL(file);img.onload=()=>{const max=900,scale=Math.min(1,max/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);const ctx=canvas.getContext('2d');if(!ctx){URL.revokeObjectURL(url);return reject(new Error('Image non supportée'))}ctx.drawImage(img,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);resolve(canvas.toDataURL('image/jpeg',.75))};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Image illisible'))};img.src=url})}
