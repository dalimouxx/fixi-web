'use client';
import {useMemo,useState} from 'react';
import {Search,ShoppingCart,Plus,Minus,Trash2,Banknote,WalletCards,UserRound,ReceiptText,LockKeyhole,UnlockKeyhole,ScanLine,Percent,CheckCircle2,X,Printer} from 'lucide-react';
import {api} from './ui';
import {money} from '@/lib/format';

type Props={products:any[];customers:any[];cashSessions:any[];methods:any[];session:any;onChanged:()=>void};
type CartLine={product:any;quantity:number;unitPrice:number};
type PaymentLine={method:string;amount:number};

export function SupplierPos({products,customers,cashSessions,methods,session,onChanged}:Props){
 const[q,setQ]=useState('');const[category,setCategory]=useState('ALL');const[pricing,setPricing]=useState<'retail'|'wholesale'>('retail');
 const[cart,setCart]=useState<CartLine[]>([]);const[customerId,setCustomerId]=useState('');const[discount,setDiscount]=useState(0);const[payments,setPayments]=useState<PaymentLine[]>([{method:'CASH',amount:0}]);
 const[busy,setBusy]=useState(false);const[msg,setMsg]=useState('');const[err,setErr]=useState('');const[cashModal,setCashModal]=useState<'open'|'close'|null>(null);const[cashAmount,setCashAmount]=useState('0');const[lastSale,setLastSale]=useState<any>(null);
 const openSession=cashSessions.find(x=>x.status==='OPEN'&&(!x.accountId||x.accountId===session.id));
 const categories=useMemo(()=>['ALL',...Array.from(new Set(products.filter(p=>p.active!==false).map(p=>p.category||'Sans catégorie'))).sort()],[products]);
 const filtered=useMemo(()=>products.filter(p=>p.active!==false&&(!q||[p.sku,p.barcode,p.name,p.brand,p.category].join(' ').toLowerCase().includes(q.toLowerCase()))&&(category==='ALL'||(p.category||'Sans catégorie')===category)),[products,q,category]);
 const subtotal=cart.reduce((a,l)=>a+l.unitPrice*l.quantity,0);
 const tax=cart.reduce((a,l)=>a+(l.unitPrice*l.quantity*Math.max(0,Number(l.product.taxRate||0))/100),0);
 const total=Math.max(0,subtotal-Math.max(0,discount)+tax);const paid=payments.reduce((a,p)=>a+Math.max(0,Number(p.amount||0)),0);const due=Math.max(0,total-paid);
 function productPrice(p:any){return pricing==='wholesale'?Number(p.wholesalePrice??p.price):Number(p.retailPrice??p.price)}
 function add(p:any){const available=Number(p.stock||0)-Number(p.reservedStock||0);if(available<=0){setErr('Stock indisponible pour '+p.name);return}setErr('');setCart(cur=>{const x=cur.find(l=>l.product.id===p.id);if(x){if(x.quantity>=available)return cur;return cur.map(l=>l.product.id===p.id?{...l,quantity:l.quantity+1}:l)}return [...cur,{product:p,quantity:1,unitPrice:productPrice(p)}]})}
 function qty(id:string,delta:number){setCart(cur=>cur.map(l=>l.product.id===id?{...l,quantity:Math.max(1,Math.min(Number(l.product.stock||0)-Number(l.product.reservedStock||0),l.quantity+delta))}:l))}
 function setPrice(id:string,v:number){setCart(cur=>cur.map(l=>l.product.id===id?{...l,unitPrice:Math.max(0,v)}:l))}
 function remove(id:string){setCart(cur=>cur.filter(l=>l.product.id!==id))}
 function updatePricing(v:'retail'|'wholesale'){setPricing(v);setCart(cur=>cur.map(l=>({...l,unitPrice:v==='wholesale'?Number(l.product.wholesalePrice??l.product.price):Number(l.product.retailPrice??l.product.price)})))}
 function payment(i:number,key:keyof PaymentLine,value:any){setPayments(cur=>cur.map((p,n)=>n===i?{...p,[key]:key==='amount'?Number(value):value}:p))}
 function addPayment(){setPayments(cur=>[...cur,{method:methods.find(m=>m.active&&m.code!=='CREDIT'&&!cur.some(x=>x.method===m.code))?.code||'CARD',amount:0}])}
 async function checkout(){
  if(!cart.length)return setErr('Ajoutez au moins un article.');
  if(due>0.001&&!customerId)return setErr('Sélectionnez un client pour laisser un reste à payer.');
  if(paid>total+0.001)return setErr('Le total des paiements dépasse le total de la vente.');
  setBusy(true);setErr('');setMsg('');
  try{
   const sale=await api('/api/supplier/erp',{method:'POST',body:JSON.stringify({action:'SALE',customerId:customerId||null,items:cart.map(l=>({productId:l.product.id,quantity:l.quantity,unitPrice:l.unitPrice})),discount,tax,payments:payments.filter(p=>p.amount>0),dueAt:due>0?new Date(Date.now()+7*86400000).toISOString():null})});
   setLastSale(sale);setMsg('Vente '+sale.reference+' enregistrée avec succès.');setCart([]);setDiscount(0);setPayments([{method:'CASH',amount:0}]);setCustomerId('');onChanged();
  }catch(e:any){setErr(e.message||'Vente impossible')}finally{setBusy(false)}
 }
 async function cashAction(){
  const v=Math.max(0,Number(cashAmount||0));setBusy(true);setErr('');
  try{await api('/api/supplier/erp',{method:'POST',body:JSON.stringify({action:cashModal==='open'?'CASH_OPEN':'CASH_CLOSE',[cashModal==='open'?'openingAmount':'closingAmount']:v})});setCashModal(null);setCashAmount('0');setMsg(cashModal==='open'?'Caisse ouverte.':'Caisse clôturée.');onChanged()}catch(e:any){setErr(e.message)}finally{setBusy(false)}
 }
 return <div className="supplier-pos">
  <div className="supplier-pos-top">
   <div><span className="smart-kicker"><WalletCards size={13}/> FIXI POS</span><h2>Point de vente</h2><p>Vente comptoir rapide, prix détail/grossiste et règlement multiple.</p></div>
   <div className={'supplier-register '+(openSession?'open':'closed')}><i/ ><span><b>{openSession?'Caisse ouverte':'Caisse fermée'}</b><small>{openSession?'Depuis '+new Date(openSession.openedAt).toLocaleTimeString('fr-TN',{hour:'2-digit',minute:'2-digit'}):'Ouvrez une session avant les espèces'}</small></span><button className="btn btn-soft btn-sm" onClick={()=>{setCashAmount('0');setCashModal(openSession?'close':'open')}}>{openSession?<LockKeyhole/>:<UnlockKeyhole/>}{openSession?'Clôturer':'Ouvrir'}</button></div>
  </div>
  {err&&<div className="supplier-pos-alert error"><X/>{err}</div>}{msg&&<div className="supplier-pos-alert success"><CheckCircle2/>{msg}{lastSale&&<button onClick={()=>window.print()}><Printer/> Imprimer</button>}</div>}
  <div className="supplier-pos-layout">
   <section className="supplier-pos-products">
    <div className="supplier-pos-search"><ScanLine/><input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Scanner ou rechercher SKU, code-barres, produit…"/><Search/></div>
    <div className="supplier-pos-pricing"><button className={pricing==='retail'?'active':''} onClick={()=>updatePricing('retail')}>Détail</button><button className={pricing==='wholesale'?'active':''} onClick={()=>updatePricing('wholesale')}>Grossiste</button></div>
    <div className="supplier-pos-categories">{categories.map(c=><button key={c} className={category===c?'active':''} onClick={()=>setCategory(c)}>{c==='ALL'?'Tous':c}</button>)}</div>
    <div className="supplier-pos-grid">{filtered.map(p=>{const av=Number(p.stock||0)-Number(p.reservedStock||0);return <button key={p.id} disabled={av<=0} onClick={()=>add(p)} className="supplier-pos-product"><div><b>{p.name}</b><span>{p.brand||'—'} · {p.sku}</span></div><strong>{money(productPrice(p))}</strong><small className={av<=Number(p.minStock||0)?'low':''}>{av} dispo.</small></button>})}{!filtered.length&&<div className="supplier-pos-empty">Aucun produit correspondant.</div>}</div>
   </section>
   <aside className="supplier-pos-cart">
    <div className="supplier-pos-cart-title"><div><ShoppingCart/><span><b>Panier</b><small>{cart.reduce((a,l)=>a+l.quantity,0)} article(s)</small></span></div><button onClick={()=>setCart([])} disabled={!cart.length}>Vider</button></div>
    <label className="supplier-pos-customer"><UserRound/><select value={customerId} onChange={e=>setCustomerId(e.target.value)}><option value="">Client comptoir</option>{customers.filter(c=>c.active!==false).map(c=><option key={c.id} value={c.id}>{c.name}{Number(c.creditLimit)>0?' · crédit '+money(c.creditLimit):''}</option>)}</select></label>
    <div className="supplier-pos-lines">{cart.map(l=><div className="supplier-pos-line" key={l.product.id}><div className="supplier-pos-line-main"><div><b>{l.product.name}</b><span>{l.product.sku}</span></div><button onClick={()=>remove(l.product.id)}><Trash2/></button></div><div className="supplier-pos-line-controls"><div><button onClick={()=>qty(l.product.id,-1)}><Minus/></button><b>{l.quantity}</b><button onClick={()=>qty(l.product.id,1)}><Plus/></button></div><label><input type="number" min={0} step="0.001" value={l.unitPrice} onChange={e=>setPrice(l.product.id,Number(e.target.value))}/><span>DT</span></label><strong>{money(l.unitPrice*l.quantity)}</strong></div></div>)}{!cart.length&&<div className="supplier-pos-cart-empty"><ShoppingCart/><b>Panier vide</b><span>Scannez ou choisissez un produit.</span></div>}</div>
    <div className="supplier-pos-totals"><div><span>Sous-total</span><b>{money(subtotal)}</b></div><label><span><Percent/> Remise</span><input type="number" min={0} max={subtotal} step="0.001" value={discount} onChange={e=>setDiscount(Number(e.target.value))}/></label><div><span>Taxes</span><b>{money(tax)}</b></div><div className="grand"><span>Total</span><b>{money(total)}</b></div></div>
    <div className="supplier-pos-payments"><div className="supplier-pos-pay-head"><b>Règlements</b><button onClick={addPayment}><Plus/> Ajouter</button></div>{payments.map((p,i)=><div key={i} className="supplier-payment-line"><select value={p.method} onChange={e=>payment(i,'method',e.target.value)}>{methods.filter(m=>m.active&&m.code!=='CREDIT').map(m=><option key={m.id||m.code} value={m.code}>{m.name}</option>)}</select><input type="number" min={0} step="0.001" value={p.amount||''} placeholder="0.000" onChange={e=>payment(i,'amount',e.target.value)}/>{payments.length>1&&<button onClick={()=>setPayments(cur=>cur.filter((_,n)=>n!==i))}><X/></button>}</div>)}<button className="supplier-pay-balance" onClick={()=>setPayments(cur=>cur.map((p,i)=>i===0?{...p,amount:total}:p))}><Banknote/> Régler la totalité</button></div>
    <div className="supplier-pos-balance"><span>Payé <b>{money(paid)}</b></span><span className={due>0?'due':''}>Reste <b>{money(due)}</b></span></div>
    <button disabled={busy||!cart.length} onClick={checkout} className="btn btn-primary btn-block supplier-pos-checkout"><ReceiptText/>{busy?'Validation…':'Valider la vente'} <b>{money(total)}</b></button>
   </aside>
  </div>
  {cashModal&&<div className="supplier-modal-backdrop"><div className="supplier-modal"><button className="supplier-modal-x" onClick={()=>setCashModal(null)}><X/></button><span className="smart-kicker"><WalletCards size={13}/> SESSION CAISSE</span><h2>{cashModal==='open'?'Ouverture de caisse':'Clôture de caisse'}</h2><p>{cashModal==='open'?'Comptez le fond de caisse présent avant la première vente.':'Comptez uniquement les espèces réellement présentes dans le tiroir.'}</p><label className="label">{cashModal==='open'?'Fond initial':'Espèces comptées'}</label><div className="supplier-money-input"><input autoFocus type="number" min={0} step="0.001" value={cashAmount} onChange={e=>setCashAmount(e.target.value)}/><b>DT</b></div><button disabled={busy} className="btn btn-primary btn-block" onClick={cashAction}>{cashModal==='open'?'Ouvrir la caisse':'Clôturer et contrôler'}</button></div></div>}
 </div>
}
