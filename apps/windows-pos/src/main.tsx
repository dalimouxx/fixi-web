import React,{useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';

type Product={id:string;name:string;sku:string;category:string;price:number};
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
 const [q,setQ]=useState(''),[category,setCategory]=useState('Tous'),[cart,setCart]=useState<Record<string,number>>({});
 const categories=['Tous',...new Set(sample.map(p=>p.category))];
 const products=sample.filter(p=>(category==='Tous'||p.category===category)&&(!q||[p.name,p.sku].join(' ').toLowerCase().includes(q.toLowerCase())));
 const entries=Object.entries(cart).filter(([,n])=>n>0).map(([id,n])=>({product:sample.find(p=>p.id===id)!,quantity:n}));
 const total=useMemo(()=>entries.reduce((v,x)=>v+x.quantity*x.product.price,0),[entries]);
 const change=(id:string,d:number)=>setCart(old=>({...old,[id]:Math.max(0,(old[id]||0)+d)}));
 return <div className="app"><aside className="nav"><div className="logo">FIXI <small>CAISSE PRO</small></div><div className="nav-item active">▦ &nbsp; Caisse</div><div className="nav-item">◫ &nbsp; Produits</div><div className="nav-item">▤ &nbsp; Stock</div><div className="nav-item">♙ &nbsp; Clients</div><div className="nav-item">▣ &nbsp; Fournisseurs</div><div className="nav-item">▧ &nbsp; Historiques</div><div className="bottom">Windows · Prototype local</div></aside><main><header><div><h1>Point de vente</h1><p>Référence visuelle FIXI fournisseur — données de démonstration</p></div><span className="status">● MODE DÉMONSTRATION</span></header><div className="search"><input aria-label="Rechercher un produit" value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher ou saisir un code-barres (démonstration)"/></div><div className="tabs">{categories.map(c=><button key={c} className={category===c?'selected':''} onClick={()=>setCategory(c)}>{c}</button>)}</div><section className="products">{products.map(p=><button key={p.id} className="product" onClick={()=>change(p.id,1)}><span className="pictogram">▣</span><b>{p.name}</b><small>{p.sku}</small><strong>{dt(p.price)}</strong></button>)}</section><div className="notice">Prototype visuel non connecté. Aucun encaissement, vente ou stock réel n'est enregistré.</div></main><aside className="checkout"><h2>Panier <small>{entries.reduce((n,e)=>n+e.quantity,0)} article(s)</small></h2><div className="customer">♙ &nbsp; Client comptoir</div><div className="lines">{entries.length?entries.map(({product,quantity})=><div className="line" key={product.id}><b>{product.name}</b><small>{dt(product.price)} / unité</small><div className="controls"><button onClick={()=>change(product.id,-1)}>−</button><span>{quantity}</span><button onClick={()=>change(product.id,1)}>+</button><strong>{dt(product.price*quantity)}</strong></div></div>):<div className="empty">Scannez ou sélectionnez un produit</div>}</div><div className="totals"><div><span>Sous-total</span><b>{dt(total)}</b></div><div className="grand"><span>Total</span><strong>{dt(total)}</strong></div></div><button className="disabledpay" disabled>Encaissement indisponible en démonstration</button><button className="reset" onClick={()=>setCart({})}>Vider le panier démo</button></aside></div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
