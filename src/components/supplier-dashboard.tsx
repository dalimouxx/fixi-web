'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {
  Boxes,ClipboardList,LogOut,PackagePlus,Truck,CheckCircle2,Plus,RefreshCw,LayoutDashboard,Users,
  ReceiptText,WalletCards,BadgeDollarSign,Warehouse,Search,ArrowDownToLine,AlertTriangle,TrendingUp,
  Banknote,MapPinned,ShoppingCart,FileText,History
} from 'lucide-react';
import {api} from './ui';
import {dateTime,money} from '@/lib/format';

const nextStatus:Record<string,string|undefined>={PENDING:'CONFIRMED',CONFIRMED:'PREPARING',PREPARING:'READY_FOR_DELIVERY',READY_FOR_DELIVERY:'OUT_FOR_DELIVERY',OUT_FOR_DELIVERY:'DELIVERED'};
const labels:Record<string,string>={PENDING:'Nouvelle',CONFIRMED:'Confirmée',PREPARING:'Préparation',READY_FOR_DELIVERY:'Prête',OUT_FOR_DELIVERY:'En livraison',DELIVERED:'Livrée',CANCELLED:'Annulée'};
type Tab='dashboard'|'orders'|'products'|'clients'|'invoices'|'finance'|'cashier'|'delivery';

export function SupplierDashboard({session}:{session:any}){
  const[tab,setTab]=useState<Tab>('dashboard');const[products,setProducts]=useState<any[]>([]);const[orders,setOrders]=useState<any[]>([]);
  const[refresh,setRefresh]=useState(0);const[q,setQ]=useState('');
  const[form,setForm]=useState<any>({sku:'',name:'',brand:'',category:'',price:'',stock:'',minOrderQty:1});
  async function load(){const[p,o]=await Promise.all([fetch('/api/supplier/products',{cache:'no-store'}).then(r=>r.json()),fetch('/api/supplier/orders',{cache:'no-store'}).then(r=>r.json())]);setProducts(Array.isArray(p)?p:[]);setOrders(Array.isArray(o)?o:[])}
  useEffect(()=>{load()},[refresh]);
  async function logout(){await fetch('/api/supplier/auth/logout',{method:'POST'});location.href='/supplier/login'}
  async function add(e:any){e.preventDefault();await api('/api/supplier/products',{method:'POST',body:JSON.stringify({...form,price:Number(form.price),stock:Number(form.stock)})});setForm({sku:'',name:'',brand:'',category:'',price:'',stock:'',minOrderQty:1});setRefresh(x=>x+1)}
  async function status(id:string,status:string){const extra=status==='OUT_FOR_DELIVERY'?{driverName:prompt('Nom livreur')||'',driverPhone:prompt('Téléphone livreur')||''}:{};await api('/api/supplier/orders/'+id,{method:'PATCH',body:JSON.stringify({status,...extra})});setRefresh(x=>x+1)}
  const activeOrders=orders.filter(x=>!['DELIVERED','CANCELLED'].includes(x.status));
  const delivered=orders.filter(x=>x.status==='DELIVERED');const revenue=delivered.reduce((a,x)=>a+Number(x.total),0);
  const stockUnits=products.reduce((a,p)=>a+Number(p.stock||0),0);const stockValue=products.reduce((a,p)=>a+Number(p.stock||0)*Number(p.price||0),0);
  const lowStock=products.filter(p=>Number(p.stock||0)<=Math.max(2,Number(p.minOrderQty||1))).length;
  const clients=useMemo(()=>{const m=new Map<string,any>();for(const o of orders){const k=o.shop?.name||o.shopId;if(!m.has(k))m.set(k,{name:k,region:o.shop?.region,address:o.shop?.address,phone:o.shop?.phone,orders:0,total:0,last:o.createdAt});const x=m.get(k);x.orders++;x.total+=Number(o.total);if(new Date(o.createdAt)>new Date(x.last))x.last=o.createdAt}return [...m.values()].sort((a,b)=>b.total-a.total)},[orders]);
  const filteredProducts=products.filter(p=>[p.sku,p.name,p.brand,p.category].join(' ').toLowerCase().includes(q.toLowerCase()));
  const cashCollected=delivered.reduce((a,o)=>a+Number(o.total),0);
  const estimatedGross=revenue*0.22;

  const nav=[
    ['dashboard','Tableau de bord',LayoutDashboard],['orders','Commandes',ClipboardList],['products','Stock & catalogue',Warehouse],
    ['clients','Clients',Users],['invoices','Facturation',ReceiptText],['finance','Finance & bénéfice',TrendingUp],
    ['cashier','Caisse',WalletCards],['delivery','Livraison',Truck]
  ] as const;

  return <div className="supplier-os supplier-erp">
    <aside>
      <div className="supplier-os-brand"><i>F</i><div><b>Fixi Supplier</b><span>{session.companyName}</span></div></div>
      <div className="supplier-nav-label">GESTION</div>
      {nav.map(([key,label,Icon])=><button key={key} className={tab===key?'active':''} onClick={()=>setTab(key as Tab)}><Icon/><span>{label}</span>{key==='orders'&&activeOrders.length>0&&<em>{activeOrders.length}</em>}</button>)}
      <div className="supplier-nav-label">MOBILE</div>
      <Link href="/supplier/delivery" className="supplier-delivery-link"><MapPinned/><span>App livreur</span></Link>
      <div className="supplier-side-foot"><div><strong>{session.fullName}</strong><small>Compte fournisseur</small></div><button onClick={logout}><LogOut/></button></div>
    </aside>

    <main>
      <header><div><span>FIXI SUPPLIER ERP</span><h1>{nav.find(x=>x[0]===tab)?.[1]}</h1></div><div className="toolbar"><button className="btn btn-ghost" onClick={()=>setRefresh(x=>x+1)}><RefreshCw/> Actualiser</button></div></header>

      {tab==='dashboard'&&<>
        <div className="supplier-kpis supplier-kpis-6">
          <K icon={ClipboardList} label="Commandes actives" value={activeOrders.length}/><K icon={BadgeDollarSign} label="CA livré" value={money(revenue)}/>
          <K icon={Boxes} label="Unités en stock" value={stockUnits}/><K icon={Warehouse} label="Valeur vente stock" value={money(stockValue)}/>
          <K icon={AlertTriangle} label="Stock faible" value={lowStock}/><K icon={Users} label="Clients actifs" value={clients.length}/>
        </div>
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

      {tab==='orders'&&<section className="supplier-panel"><div className="supplier-order-grid">{orders.map(o=><article key={o.id}><div className="supplier-order-head"><div><code>{o.reference}</code><b>{o.shop.name}</b><span>{o.shop.region} · {dateTime(o.createdAt)}</span></div><span className={`status-pill ${o.status.toLowerCase()}`}>{labels[o.status]||o.status}</span></div><div className="supplier-order-items">{o.items.map((i:any)=><div key={i.id}><span>{i.product.name} × {i.quantity}</span><b>{money(Number(i.unitPrice)*i.quantity)}</b></div>)}</div><div className="supplier-order-total"><span>Total</span><b>{money(o.total)}</b></div><div className="supplier-order-actions">{nextStatus[o.status]&&<button className="btn btn-primary btn-sm" onClick={()=>status(o.id,nextStatus[o.status]!)}>{labels[nextStatus[o.status]!]}</button>}{!['OUT_FOR_DELIVERY','DELIVERED','CANCELLED'].includes(o.status)&&<button className="btn btn-danger btn-sm" onClick={()=>status(o.id,'CANCELLED')}>Annuler</button>}</div>{o.delivery&&<div className="supplier-delivery"><Truck/><span>{labels[o.status]}{o.delivery.driverName?` · ${o.delivery.driverName}`:''}{o.delivery.driverPhone?` · ${o.delivery.driverPhone}`:''}</span></div>}</article>)}</div></section>}

      {tab==='products'&&<><div className="supplier-stock-toolbar"><div className="global-search"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="SKU, produit, marque, catégorie…"/></div><div><b>{stockUnits}</b><span>unités physiques</span></div><div><b>{money(stockValue)}</b><span>valeur de vente</span></div></div><div className="supplier-catalog-layout"><section className="supplier-panel"><div className="supplier-product-grid">{filteredProducts.map(p=><article key={p.id}><div className="supplier-product-img">{p.imageUrl?<img src={p.imageUrl} alt=""/>:<Boxes/>}</div><code>{p.sku}</code><b>{p.name}</b><span>{p.brand||'—'} · {p.category||'Pièce'}</span><div><strong>{money(p.price)}</strong><em className={p.stock<=Math.max(2,p.minOrderQty)?'low':''}>Stock {p.stock}</em></div></article>)}</div></section><form className="supplier-panel supplier-add" onSubmit={add}><div className="smart-kicker"><PackagePlus size={13}/> NOUVEAU PRODUIT</div><h2>Ajouter au stock</h2>{[['sku','SKU'],['name','Nom'],['brand','Marque'],['category','Catégorie'],['price','Prix de vente'],['stock','Stock initial']].map(([k,l])=><div className="field" key={k}><label className="label">{l}</label><input className="input" type={['price','stock'].includes(k)?'number':'text'} required={['sku','name','price','stock'].includes(k)} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/></div>)}<button className="btn btn-primary btn-block"><Plus/> Ajouter</button></form></div></>}

      {tab==='clients'&&<section className="supplier-panel"><div className="supplier-section-head"><div><b>Clients professionnels</b><span>Historique automatiquement construit depuis les commandes</span></div></div><div className="table-wrap"><table className="table"><thead><tr><th>Client</th><th>Région</th><th>Téléphone</th><th>Commandes</th><th>CA cumulé</th><th>Dernière activité</th></tr></thead><tbody>{clients.map((x:any)=><tr key={x.name}><td><b>{x.name}</b><div className="muted">{x.address||'—'}</div></td><td>{x.region||'—'}</td><td>{x.phone||'—'}</td><td>{x.orders}</td><td><b>{money(x.total)}</b></td><td>{dateTime(x.last)}</td></tr>)}</tbody></table></div></section>}

      {tab==='invoices'&&<section className="supplier-panel"><div className="supplier-section-head"><div><b>Facturation & documents</b><span>Chaque commande peut servir de base à une facture ou un bon de livraison.</span></div></div><div className="supplier-doc-grid">{orders.filter(o=>o.status!=='CANCELLED').map(o=><article key={o.id}><FileText/><div><code>{o.reference}</code><b>{o.shop.name}</b><span>{dateTime(o.createdAt)}</span></div><strong>{money(o.total)}</strong><button className="btn btn-soft btn-sm" onClick={()=>window.print()}>Imprimer</button></article>)}</div></section>}

      {tab==='finance'&&<><div className="supplier-kpis"><K icon={BadgeDollarSign} label="CA livré" value={money(revenue)}/><K icon={Banknote} label="Encaissement calculé" value={money(cashCollected)}/><K icon={TrendingUp} label="Marge estimée" value={money(estimatedGross)}/><K icon={Warehouse} label="Valeur stock" value={money(stockValue)}/></div><section className="supplier-panel"><div className="supplier-section-head"><div><b>Finance fournisseur</b><span>Le moteur complet coût d’achat / dépenses / créances sera branché sur ces indicateurs.</span></div></div><div className="supplier-finance-note"><AlertTriangle/><p>Les données de coût d’achat, dettes fournisseurs, paiements partiels et dépenses ne sont pas encore présentes dans le schéma historique. L’interface est prête, mais Fixi n’invente pas de bénéfice comptable : seule la marge estimative est affichée tant que ces écritures ne sont pas saisies.</p></div></section></>}

      {tab==='cashier'&&<section className="supplier-panel supplier-cashier"><div className="supplier-section-head"><div><b>Espace caissier</b><span>Encaissement rapide des commandes livrées et ventes comptoir.</span></div></div><div className="supplier-cashier-grid"><div className="supplier-cash-big"><WalletCards/><span>Total livré enregistré</span><b>{money(cashCollected)}</b><small>{delivered.length} commandes livrées</small></div><div className="supplier-cash-actions"><button className="btn btn-primary"><ShoppingCart/> Nouvelle vente comptoir</button><button className="btn btn-soft"><Banknote/> Encaisser un client</button><button className="btn btn-soft"><History/> Historique caisse</button></div></div></section>}

      {tab==='delivery'&&<><section className="supplier-panel"><div className="supplier-section-head"><div><b>Centre de livraison</b><span>Préparation, affectation et suivi terrain.</span></div><Link href="/supplier/delivery" className="btn btn-primary"><MapPinned/> Ouvrir l’app livreur</Link></div><div className="supplier-delivery-board">{orders.filter(o=>['READY_FOR_DELIVERY','OUT_FOR_DELIVERY'].includes(o.status)).map(o=><article key={o.id}><div><code>{o.reference}</code><b>{o.shop.name}</b><span>{o.shop.address||o.shop.region}</span></div><span className={`status-pill ${o.status.toLowerCase()}`}>{labels[o.status]}</span><div><Truck/><b>{o.delivery?.driverName||'Non affecté'}</b><span>{o.delivery?.driverPhone||'—'}</span></div></article>)}</div></section></>}
    </main>
  </div>
}

function K({icon:Icon,label,value}:any){return <div><i><Icon/></i><span>{label}</span><b>{value}</b></div>}
function OrderTable({orders}:{orders:any[]}){return <div className="table-wrap"><table className="table"><thead><tr><th>Commande</th><th>Boutique</th><th>Statut</th><th>Total</th><th>Date</th></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td><code>{o.reference}</code></td><td>{o.shop.name}</td><td><span className={`status-pill ${o.status.toLowerCase()}`}>{labels[o.status]||o.status}</span></td><td><b>{money(o.total)}</b></td><td>{dateTime(o.createdAt)}</td></tr>)}</tbody></table></div>}
