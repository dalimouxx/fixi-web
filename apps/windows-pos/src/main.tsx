import React,{useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {invoke} from '@tauri-apps/api/core';
import './style.css';

type Product={id:string;name:string;sku:string;barcode?:string|null;category:string|null;price:number;stock?:number};
type Customer={id:string;name:string};
type Bootstrap={companyName:string;role:string;products:Product[];customers:Customer[]};
const sample:Product[]=[
{id:'p1',name:'Écran iPhone 11',sku:'IP11-ECR',category:'Écrans',price:85},
{id:'p2',name:'Batterie Samsung A52',sku:'SA52-BAT',category:'Batteries',price:39},
{id:'p3',name:'Câble USB-C 1m',sku:'CAB-C-1M',category:'Accessoires',price:12.5},
{id:'p4',name:'Vitre iPhone 13',sku:'IP13-VIT',category:'Écrans',price:27},
{id:'p5',name:'Chargeur rapide 25W',sku:'CHA-25W',category:'Accessoires',price:32},
{id:'p6',name:'Coque Samsung S24',sku:'S24-COQ',category:'Coques',price:20}
];
const dt=(v:number)=>new Intl.NumberFormat('fr-TN',{minimumFractionDigits:3,maximumFractionDigits:3}).format(v)+' DT';
function App(){
 const [data,setData]=useState<Bootstrap|null>(null),[server,setServer]=useState(''),[login,setLogin]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[customerId,setCustomerId]=useState('');
 const [q,setQ]=useState(''),[category,setCategory]=useState('Tous'),[cart,setCart]=useState<Record<string,number>>({});
 const catalog=data?.products||sample;
 const categories=['Tous',...new Set(catalog.map(p=>p.category||'Autres'))];
 const products=catalog.filter(p=>(category==='Tous'||(p.category||'Autres')===category)&&(!q||[p.name,p.sku,p.barcode||''].join(' ').toLowerCase().includes(q.toLowerCase())));
 const entries=Object.entries(cart).filter(([,n])=>n>0).map(([id,n])=>({product:catalog.find(p=>p.id===id)!,quantity:n}));
 const total=useMemo(()=>entries.reduce((v,x)=>v+x.quantity*x.product.price,0),[entries]);
 const change=(id:string,d:number)=>setCart(old=>({...old,[id]:Math.max(0,Math.min(catalog.find(p=>p.id===id)?.stock??999999,(old[id]||0)+d))}));
 async function connect(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{const next=await invoke<Bootstrap>('supplier_login',{server,login,password});setData(next);setCart({});setCategory('Tous');setPassword('')}catch(e){setError(String(e))}finally{setBusy(false)}}
 async function refresh(){setBusy(true);setError('');try{const next=await invoke<Bootstrap>('supplier_refresh');setData(next);setCart({})}catch(e){setError(String(e))}finally{setBusy(false)}}
 async function logout(){await invoke('supplier_logout');setData(null);setCart({});setCustomerId('')}
 
 return <>{!data&&<div className="connection"><form onSubmit={connect}><h2>Connexion FIXI Supplier</h2><p>Connectez la caisse à votre compte fournisseur. Lecture seule pour cette version.</p><label>Serveur HTTPS<input type="url" required placeholder="https://votre-serveur-fixi.tld" value={server} onChange={e=>setServer(e.target.value)}/></label><label>Identifiant fournisseur<input required value={login} onChange={e=>setLogin(e.target.value)}/></label><label>Mot de passe<input required type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p role="alert" className="connect-error">{error}</p>}<button type="submit" disabled={busy}>{busy?'Connexion…':'Se connecter à FIXI Cloud'}</button><small>Session conservée uniquement pendant l’ouverture de l’application. Aucun mot de passe enregistré.</small></form><button onClick={()=>setData({companyName:'Démonstration',role:'DEMO',products:sample,customers:[]})}>Continuer en mode démonstration</button></div>}<div className="app"><aside className="nav"><div className="logo">FIXI <small>CAISSE PRO</small></div><div className="nav-item active">▦ &nbsp; Caisse</div><div className="nav-item">◫ &nbsp; Produits</div><div className="nav-item">▤ &nbsp; Stock</div><div className="nav-item">♙ &nbsp; Clients</div><div className="nav-item">▣ &nbsp; Fournisseurs</div><div className="nav-item">▧ &nbsp; Historiques</div><div className="bottom">{data?.companyName||'Démonstration'}</div></aside><main><header><div><h1>Point de vente</h1><p>{data?.role==='DEMO'?'Données de démonstration':data?.companyName||'Données fournisseur FIXI'}</p></div><span className="status">{data?.role==='DEMO'?'● MODE DÉMONSTRATION':'● CONNECTÉ · LECTURE SEULE'}</span></header><div style={{display:'flex',gap:8,marginTop:12}}><button onClick={refresh} disabled={busy||data?.role==='DEMO'}>Actualiser FIXI</button><button onClick={logout}>Déconnexion</button></div><div className="search"><input aria-label="Rechercher un produit" value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher par nom, SKU ou code-barres"/></div><div className="tabs">{categories.map(c=><button key={c} className={category===c?'selected':''} onClick={()=>setCategory(c)}>{c}</button>)}</div><section className="products">{products.map(p=><button key={p.id} className="product" onClick={()=>change(p.id,1)}><span className="pictogram">▣</span><b>{p.name}</b><small>{p.sku}{data?.role!=='DEMO'?' · Stock : '+(p.stock??'—'):''}</small><strong>{dt(p.price)}</strong></button>)}</section><div className="notice">Catalogue synchronisé en lecture seule. Aucun encaissement, vente ou stock n'est modifié.</div></main><aside className="checkout"><h2>Panier <small>{entries.reduce((n,e)=>n+e.quantity,0)} article(s)</small></h2><div className="customer">♙ &nbsp; <select value={customerId} onChange={e=>setCustomerId(e.target.value)}><option value="">Client comptoir</option>{data?.customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div className="lines">{entries.length?entries.map(({product,quantity})=><div className="line" key={product.id}><b>{product.name}</b><small>{dt(product.price)} / unité</small><div className="controls"><button onClick={()=>change(product.id,-1)}>−</button><span>{quantity}</span><button onClick={()=>change(product.id,1)}>+</button><strong>{dt(product.price*quantity)}</strong></div></div>):<div className="empty">Scannez ou sélectionnez un produit</div>}</div><div className="totals"><div><span>Sous-total</span><b>{dt(total)}</b></div><div className="grand"><span>Total</span><strong>{dt(total)}</strong></div></div><button className="disabledpay" disabled>Encaissement indisponible en démonstration</button><button className="reset" onClick={()=>setCart({})}>Vider le panier démo</button></aside></div></>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
