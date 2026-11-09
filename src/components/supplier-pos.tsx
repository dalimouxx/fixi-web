'use client';
import { payLabel } from '@/lib/labels';
import {useEffect,useMemo,useState} from 'react';
import {Search,ShoppingCart,Plus,Minus,Trash2,Banknote,WalletCards,UserRound,ReceiptText,LockKeyhole,UnlockKeyhole,ScanLine,Percent,CheckCircle2,X,Printer,Camera,RefreshCw,History,ClipboardCheck,Calculator,AlertTriangle} from 'lucide-react';
import {api} from './ui';
import {money} from '@/lib/format';
import {BarcodeCamera} from './barcode-camera';
import {PauseCircle,PlayCircle,PencilLine,FileText} from 'lucide-react';

const NOTES=[50,20,10,5],COINS=[5,2,1,0.5,0.2,0.1,0.05,0.02,0.01];
type Parked={id:string;at:string;label:string;cart:CartLine[];customerId:string;discount:number;pricing:'retail'|'wholesale'};

type Props={products:any[];customers:any[];cashSessions:any[];methods:any[];warehouses:any[];warehouseStock:any[];session:any;onChanged:()=>void};
type CartLine={product:any;quantity:number;unitPrice:number};
type PaymentLine={method:string;amount:number};

export function SupplierPos({products,customers,cashSessions,methods,warehouses,warehouseStock,session,onChanged}:Props){
 const[q,setQ]=useState('');const[category,setCategory]=useState('ALL');const[pricing,setPricing]=useState<'retail'|'wholesale'>('retail');const[warehouseId,setWarehouseId]=useState('');
 const[cart,setCart]=useState<CartLine[]>([]);
 const[customerId,setCustomerId]=useState('');
 const[discount,setDiscount]=useState(0),[saleNote,setSaleNote]=useState('');const[payments,setPayments]=useState<PaymentLine[]>([{method:'CASH',amount:0}]);
 const[draftReady,setDraftReady]=useState(false);const[busy,setBusy]=useState(false);const[msg,setMsg]=useState('');const[err,setErr]=useState('');const[scanner,setScanner]=useState(false);const[cashModal,setCashModal]=useState<'open'|'close'|null>(null);
 const[cashAmount,setCashAmount]=useState('0'),[cashNote,setCashNote]=useState('');
 const[cashOverview,setCashOverview]=useState<any>(null),[cashBusy,setCashBusy]=useState(false);
 const[showCashDetails,setShowCashDetails]=useState(false);const[lastSale,setLastSale]=useState<any>(null);
 const[parked,setParked]=useState<Parked[]>([]),[freeOpen,setFreeOpen]=useState(false),[freeName,setFreeName]=useState(''),[freePrice,setFreePrice]=useState(''),[counting,setCounting]=useState(false),[denoms,setDenoms]=useState<Record<string,string>>({});
 useEffect(()=>{try{setParked(JSON.parse(localStorage.getItem('fixi-supplier-pos-parked')||'[]'))}catch{}},[]);
 const saveParked=(l:Parked[])=>{setParked(l);try{localStorage.setItem('fixi-supplier-pos-parked',JSON.stringify(l))}catch{}};
 const counted=Math.round([...NOTES,...COINS].reduce((a,v)=>a+v*Math.max(0,Math.trunc(Number(denoms[v])||0)),0)*1000)/1000;
 useEffect(()=>{if(counting)setCashAmount(String(counted))},[counted,counting]);
 const customer=customers.find(c=>c.id===customerId);
 const customerDue=customer?Math.max(0,Number(customer.due??0)):0;
 const openSession=cashSessions.find(x=>x.status==='OPEN'&&(!x.accountId||x.accountId===session.id));const effectiveWarehouseId=openSession?.warehouseId??warehouseId;
 async function refreshCash(){
   setCashBusy(true);
   try{const response=await fetch('/api/supplier/cash-overview',{cache:'no-store'});
     if(response.ok)setCashOverview(await response.json());
   }catch{/* Existing session and ledger remain visible on transient disconnect. */}
   finally{setCashBusy(false)}
 }
 useEffect(()=>{void refreshCash()},[cashSessions,session.id]);

 useEffect(()=>{try{const raw=localStorage.getItem('fixi-supplier-pos-draft');if(raw){const d=JSON.parse(raw);if(Array.isArray(d.cart))setCart(d.cart);if(d.customerId)setCustomerId(d.customerId);if(Number.isFinite(Number(d.discount)))setDiscount(Number(d.discount));
  if(d.saleNote)setSaleNote(String(d.saleNote).slice(0,500));if(Array.isArray(d.payments)&&d.payments.length)setPayments(d.payments);if(d.pricing)setPricing(d.pricing);if(d.warehouseId)setWarehouseId(d.warehouseId)}}catch{}finally{setDraftReady(true)}},[]);
 useEffect(()=>{if(!draftReady)return;try{localStorage.setItem('fixi-supplier-pos-draft',JSON.stringify({cart,customerId,discount,saleNote,payments,pricing,warehouseId,updatedAt:new Date().toISOString()}))}catch{}},[draftReady,cart,customerId,discount,saleNote,payments,pricing,warehouseId]);
  const categories=useMemo(()=>['ALL',...Array.from(new Set(products.filter(p=>p.active!==false).map(p=>p.category||'Sans catégorie'))).sort()],[products]);
 const filtered=useMemo(()=>products.filter(p=>p.active!==false&&(!q||[p.sku,p.barcode,p.name,p.brand,p.category].join(' ').toLowerCase().includes(q.toLowerCase()))&&(category==='ALL'||(p.category||'Sans catégorie')===category)),[products,q,category]);
 // Supplément « passager » : ajouté au prix atelier, tracé au serveur, jamais visible sur le ticket.
 const[walkIn,setWalkIn]=useState(false),[extra,setExtra]=useState<Record<string,number>>({}),[sugg,setSugg]=useState<{byProduct:Record<string,number>;byCategory:Record<string,number>}>({byProduct:{},byCategory:{}});
 useEffect(()=>{if(!walkIn)return;fetch('/api/supplier/walk-in-suggestions').then(r=>r.ok?r.json():null).then(j=>j&&setSugg({byProduct:j.byProduct||{},byCategory:j.byCategory||{}})).catch(()=>{})},[walkIn]);
 useEffect(()=>{if(!cart.length){setExtra({});setWalkIn(false)}},[cart.length]);
 const suggestOf=(p:any)=>sugg.byProduct[p.id]??(p.category?sugg.byCategory[p.category]:undefined)??0;
 const extraOf=(l:CartLine)=>walkIn&&!l.product.custom?Math.max(0,extra[l.product.id]??suggestOf(l.product)):0;
 const walkInTotal=cart.reduce((a,l)=>a+extraOf(l)*l.quantity,0);
 const subtotal=cart.reduce((a,l)=>a+(l.unitPrice+extraOf(l))*l.quantity,0);
 const tax=cart.reduce((a,l)=>{
  const base=l.unitPrice*l.quantity;
  const ratio=subtotal>0?Math.max(0,1-Math.max(0,discount)/subtotal):1;
  return a+base*ratio*Math.max(0,Number(l.product.taxRate||0))/100;
 },0);
 const total=Math.max(0,Math.round((subtotal-Math.max(0,discount)+tax)*1000)/1000);const paid=payments.reduce((a,p)=>a+Math.max(0,Number(p.amount||0)),0);const due=Math.max(0,total-paid);
 function productPrice(p:any){return pricing==='wholesale'?Number(p.wholesalePrice??p.price):Number(p.retailPrice??p.price)}
 function detect(code:string){const key=code.trim().toLowerCase();const p=products.find(x=>String(x.barcode||'').trim().toLowerCase()===key||String(x.sku||'').trim().toLowerCase()===key);setScanner(false);if(!p){setQ(code);setErr('Aucun produit trouvé pour le code '+code);return}setQ('');add(p)}
 function available(p:any){if(p.custom)return 1000;if(effectiveWarehouseId){const r=warehouseStock.find(x=>x.warehouseId===effectiveWarehouseId&&x.productId===p.id);return Math.max(0,Number(r?.quantity||0)-Number(r?.reserved||0))}return Math.max(0,Number(p.stock||0)-Number(p.reservedStock||0))}
 function add(p:any){const av=available(p);if(av<=0){setErr('Stock indisponible pour '+p.name+(effectiveWarehouseId?' dans ce dépôt':''));return}setErr('');setCart(cur=>{const x=cur.find(l=>l.product.id===p.id);if(x){if(x.quantity>=av)return cur;return cur.map(l=>l.product.id===p.id?{...l,quantity:l.quantity+1}:l)}return [...cur,{product:p,quantity:1,unitPrice:productPrice(p)}]})}
 function qty(id:string,delta:number){setCart(cur=>cur.map(l=>l.product.id===id?{...l,quantity:Math.max(1,Math.min(available(l.product),l.quantity+delta))}:l))}
 function setPrice(id:string,v:number){setCart(cur=>cur.map(l=>l.product.id===id?{...l,unitPrice:Math.max(0,v)}:l))}
 function remove(id:string){setCart(cur=>cur.filter(l=>l.product.id!==id))}
 function basePrice(p:any,v:'retail'|'wholesale'){return v==='wholesale'?Number(p.wholesalePrice??p.price):Number(p.retailPrice??p.price)}
 function updatePricing(v:'retail'|'wholesale',pct=Number(customer?.discountPct||0)){setPricing(v);setCart(cur=>cur.map(l=>l.product.custom?l:({...l,unitPrice:Math.round(basePrice(l.product,v)*(1-pct/100)*1000)/1000})))}
 // Le client choisi impose son tarif (détail/gros) et sa remise négociée.
 function chooseCustomer(id:string){setCustomerId(id);const c=customers.find(x=>x.id===id);updatePricing(c?.priceMode==='WHOLESALE'?'wholesale':'retail',Number(c?.discountPct||0))}
 function addFree(e:React.FormEvent){e.preventDefault();const price=Math.round(Number(freePrice.replace(',','.'))*1000)/1000;if(freeName.trim().length<2||!(price>0))return setErr('Nom et prix de l’article libre requis.');
  setCart(cur=>[...cur,{product:{id:'custom-'+crypto.randomUUID(),name:freeName.trim(),sku:'Article libre',custom:true,taxRate:0},quantity:1,unitPrice:price}]);setFreeName('');setFreePrice('');setFreeOpen(false);setErr('')}
 function park(){if(!cart.length)return;saveParked([{id:crypto.randomUUID(),at:new Date().toISOString(),label:customer?.name||('Client '+(parked.length+1)),cart,customerId,discount,pricing},...parked].slice(0,12));setCart([]);setCustomerId('');setDiscount(0);setMsg('Panier mis en attente.')}
 function resume(id:string){const x=parked.find(p=>p.id===id);if(!x)return;const rest=parked.filter(p=>p.id!==id);if(cart.length)rest.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),label:customer?.name||('Client '+(parked.length+1)),cart,customerId,discount,pricing});
  setCart(x.cart);setCustomerId(x.customerId);setDiscount(x.discount);setPricing(x.pricing);saveParked(rest)}
 async function invoice(){if(!lastSale)return;setBusy(true);setErr('');try{const r=await api('/api/supplier/documents/from-sale',{method:'POST',body:JSON.stringify({saleId:lastSale.id})});window.open('/supplier/commercial-documents/'+r.document.id,'_blank')}catch(e:any){setErr(e.message)}finally{setBusy(false)}}
 function payment(i:number,key:keyof PaymentLine,value:any){setPayments(cur=>cur.map((p,n)=>n===i?{...p,[key]:key==='amount'?Number(value):value}:p))}
 function addPayment(){setPayments(cur=>[...cur,{method:methods.find(m=>m.active&&m.code!=='CREDIT'&&!cur.some(x=>x.method===m.code))?.code||'CARD',amount:0}])}
 async function checkout(){
  if(!cart.length)return setErr('Ajoutez au moins un article.');
  if(due>0.001&&!customerId)return setErr('Sélectionnez un client pour laisser un reste à payer.');
  if(paid>total+0.001)return setErr('Le total des paiements dépasse le total de la vente.');
  setBusy(true);setErr('');setMsg('');
  try{
   const sale=await api('/api/supplier/erp',{method:'POST',body:JSON.stringify({action:'SALE',warehouseId:effectiveWarehouseId||null,customerId:customerId||null,items:cart.map(l=>l.product.custom?{custom:true,name:l.product.name,quantity:l.quantity,unitPrice:l.unitPrice}:{productId:l.product.id,quantity:l.quantity,unitPrice:l.unitPrice,...(extraOf(l)>0?{extra:extraOf(l)}:{})}),discount,tax,note:saleNote.trim()||null,payments:payments.filter(p=>p.amount>0),dueAt:due>0?new Date(Date.now()+7*86400000).toISOString():null})});
   setLastSale(sale);setMsg('Vente '+sale.reference+' enregistrée avec succès.');try{localStorage.removeItem('fixi-supplier-pos-draft')}catch{}setCart([]);setDiscount(0);setSaleNote('');setPayments([{method:'CASH',amount:0}]);setCustomerId('');onChanged();void refreshCash();
  }catch(e:any){setErr(e.message||'Vente impossible')}finally{setBusy(false)}
 }
 async function cashAction(){
  const v=Number(cashAmount||0);
  if(!Number.isFinite(v)||v<0){setErr('Montant espèces invalide.');return;}
  const expected=Number(cashOverview?.summary?.expected??0);
  const difference=Math.round((v-expected)*1000)/1000;
  if(cashModal==='close'&&Math.abs(difference)>=0.001&&!cashNote.trim()){
    setErr('Un motif est obligatoire lorsqu’il existe un écart de caisse.');return;
  }
  setBusy(true);setErr('');
  try{await api('/api/supplier/erp',{method:'POST',body:JSON.stringify({action:cashModal==='open'?'CASH_OPEN':'CASH_CLOSE',warehouseId:cashModal==='open'?(warehouseId||null):undefined,[cashModal==='open'?'openingAmount':'closingAmount']:v,note:cashNote.trim()||null})});setCashModal(null);setCashAmount('0');setCashNote('');setMsg(cashModal==='open'?'Caisse ouverte.':'Caisse clôturée.');onChanged();void refreshCash()}catch(e:any){setErr(e.message)}finally{setBusy(false)}
 }
 return <div className="supplier-pos">
  <div className="supplier-pos-top">
   <div><span className="smart-kicker"><WalletCards size={13}/> FIXI POS</span><h2>Point de vente</h2><p>Vente comptoir rapide, prix détail/grossiste et règlement multiple.</p></div>
   <div className={'supplier-register '+(openSession?'open':'closed')}><i/><span><b>{openSession?'Caisse ouverte':'Caisse fermée'}</b><small>{openSession?'Depuis '+new Date(openSession.openedAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'Ouvrez une session avant les espèces'}</small></span><button className="btn btn-soft btn-sm" onClick={()=>{setCashNote('');setCashAmount(openSession?'': '0');void refreshCash();setCashModal(openSession?'close':'open')}}>{openSession?<LockKeyhole/>:<UnlockKeyhole/>}{openSession?'Clôturer':'Ouvrir'}</button></div>
  </div>
  {err&&<div className="supplier-pos-alert error"><X/>{err}</div>}{msg&&<div className="supplier-pos-alert success"><CheckCircle2/>{msg}{lastSale&&<><button type="button" onClick={()=>window.open('/supplier/documents/'+lastSale.id,'_blank')}>
     <Printer/> Facture A4</button>
     <button type="button" onClick={()=>window.open('/supplier/documents/'+lastSale.id+'?format=ticket','_blank')}>
       <ReceiptText/> Ticket 80 mm</button>
     <button type="button" disabled={busy} onClick={()=>void invoice()}><FileText/> Facture numérotée</button></>}</div>}
  <section className="fixi-pos-cash-dashboard" aria-label="Suivi de caisse du fournisseur">
    <div className="fixi-pos-cash-heading">
      <div><span className="smart-kicker"><ClipboardCheck size={15}/> CONTRÔLE DE CAISSE</span>
        <h3>Journal et fonds de caisse</h3><p>Espèces du tiroir, séparées des cartes et des virements. Chaque mouvement est horodaté.</p></div>
      <div className="toolbar"><button type="button" className="btn btn-soft btn-sm" disabled={cashBusy}
        onClick={()=>void refreshCash()}><RefreshCw size={16}/> {cashBusy?'Actualisation…':'Actualiser'}</button>
        <button type="button" className="btn btn-soft btn-sm"
          onClick={()=>setShowCashDetails(v=>!v)} aria-expanded={showCashDetails}>
          <History size={16}/> {showCashDetails?'Masquer le journal':'Journal & clôtures'}</button></div>
    </div>
    {cashOverview?.current?
      <div className="fixi-pos-cash-stats">
        <div><span>Fond initial</span><b>{money(cashOverview.summary?.opening||0)}</b></div>
        <div><span>Entrées espèces</span><b>{money(cashOverview.summary?.incoming||0)}</b></div>
        <div><span>Sorties & dépenses</span><b>{money(Number(cashOverview.summary?.outgoing||0)+Number(cashOverview.summary?.expenses||0))}</b></div>
        <div className="important"><span>{cashOverview.current.status==='OPEN'?'Espèces théoriques':'Espèces attendues'}</span>
          <b>{money(cashOverview.summary?.expected||0)}</b></div>
      </div>:
      <p className="fixi-pos-cash-empty">Aucune session de caisse enregistrée pour cet utilisateur.</p>}
    {showCashDetails&&<div className="fixi-pos-cash-details">
      <h4>Mouvements de la session {cashOverview?.current?.status==='OPEN'?'en cours':'la plus récente'}</h4>
      <div className="fixi-pos-cash-movements">
        {(cashOverview?.movements||[]).map((m:any)=><div key={m.id}>
          <span><strong>{m.label}</strong><small>{new Date(m.at).toLocaleString('fr-FR')} · {payLabel(m.method)} {m.reference?'· '+m.reference:''}</small></span>
          <b className={m.type==='ENCASHMENT'?'plus':'minus'}>{m.type==='ENCASHMENT'?'+':'−'}{money(m.amount)}</b>
        </div>)}
        {!cashOverview?.movements?.length&&<p>Aucun mouvement enregistré sur cette session.</p>}
      </div>
      <h4>Dernières ouvertures et clôtures</h4>
      <div className="fixi-pos-cash-history">
        {(cashOverview?.recent||[]).map((x:any)=><div key={x.id}>
          <span>{new Date(x.openedAt).toLocaleString('fr-FR')}</span>
          <b>{x.status==='OPEN'?'Ouverte':'Clôturée'}</b>
          <span>Fond {money(x.openingAmount)} · Compte {x.closingAmount==null?'—':money(x.closingAmount)}</span>
          <strong className={Number(x.difference||0)===0?'plus':'minus'}>{x.difference==null?'—':'Écart '+money(x.difference)}</strong>
        </div>)}
      </div>
    </div>}
  </section>
  <div className="supplier-pos-layout">
   <section className="supplier-pos-products">
    <div className="supplier-pos-search"><ScanLine/><input autoFocus value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();const key=q.trim().toLowerCase();const exact=products.find(p=>String(p.barcode||'').trim().toLowerCase()===key||String(p.sku||'').trim().toLowerCase()===key);if(exact){add(exact);setQ('')}}}} placeholder="Scanner ou rechercher SKU, code-barres, produit…"/><button type="button" className="supplier-camera-btn" onClick={()=>setScanner(true)} title="Scanner avec la caméra"><Camera/></button><Search/></div>
    <div className="supplier-pos-mode-row"><div className="supplier-pos-pricing"><button className={pricing==='retail'?'active':''} onClick={()=>updatePricing('retail')}>Détail</button><button className={pricing==='wholesale'?'active':''} onClick={()=>updatePricing('wholesale')}>Grossiste</button></div><label className="supplier-pos-warehouse"><span>Dépôt</span><select value={effectiveWarehouseId||''} disabled={!!openSession} onChange={e=>{setWarehouseId(e.target.value);setCart([]);setErr('')}}><option value="">Stock global</option>{warehouses.filter(w=>w.active).map(w=><option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></label></div>
    <div className="supplier-pos-categories">{categories.map(c=><button key={c} className={category===c?'active':''} onClick={()=>setCategory(c)}>{c==='ALL'?'Tous':c}</button>)}</div>
    <div className="supplier-pos-grid">{filtered.map(p=>{const av=available(p);return <button key={p.id} disabled={av<=0} onClick={()=>add(p)} className="supplier-pos-product"><div><b>{p.name}</b><span>{p.brand||'—'} · {p.sku}</span></div><strong>{money(productPrice(p))}</strong><small className={av<=Number(p.minStock||0)?'low':''}>{av} dispo.</small></button>})}{!filtered.length&&<div className="supplier-pos-empty">Aucun produit correspondant.</div>}</div>
   </section>
   {cart.length>0&&<a href="#fx-pos-cart" className="fx-pos-cartbar"><span><b>{cart.reduce((a,l)=>a+l.quantity,0)} article(s)</b><small>Voir le panier et encaisser</small></span><strong>{total.toFixed(3)}</strong></a>}
   <aside className="supplier-pos-cart" id="fx-pos-cart">
    <div className="supplier-pos-cart-title"><div><ShoppingCart/><span><b>Panier</b><small>{cart.reduce((a,l)=>a+l.quantity,0)} article(s)</small></span></div><button onClick={()=>setCart([])} disabled={!cart.length}>Vider</button></div>
    <div className="fx-pos-tools"><button type="button" aria-pressed={walkIn} className={walkIn?'is-on':''} disabled={!cart.length} onClick={()=>setWalkIn(v=>!v)} title="Client de passage : supplément au prix atelier, non visible sur le ticket"><UserRound size={15}/> Passager{walkIn&&walkInTotal>0?' +'+money(walkInTotal):''}</button><button type="button" onClick={()=>setFreeOpen(v=>!v)}><PencilLine size={15}/> Article libre</button><button type="button" disabled={!cart.length} onClick={park}><PauseCircle size={15}/> En attente</button></div>
    {freeOpen&&<form className="fx-pos-free" onSubmit={addFree}><input className="input" autoFocus placeholder="Main-d’œuvre, accessoire…" value={freeName} maxLength={120} onChange={e=>setFreeName(e.target.value)}/><input className="input" type="number" min={0.001} step="0.001" placeholder="Prix DT" value={freePrice} onChange={e=>setFreePrice(e.target.value)}/><button className="btn btn-primary btn-sm">Ajouter</button></form>}
    {parked.length>0&&<div className="fx-pos-parked">{parked.map(x=><button type="button" key={x.id} onClick={()=>resume(x.id)}><PlayCircle size={14}/> {x.label}<small>{x.cart.reduce((a,l)=>a+l.quantity,0)}</small></button>)}</div>}
    <label className="supplier-pos-customer"><UserRound/><select value={customerId} onChange={e=>chooseCustomer(e.target.value)}><option value="">Client comptoir</option>{customers.filter(c=>c.active!==false).map(c=><option key={c.id} value={c.id}>{c.name}{Number(c.creditLimit)>0?' · crédit '+money(c.creditLimit):''}</option>)}</select></label>
    {customer&&(Number(customer.creditLimit)>0||customerDue>0||customer.priceMode==='WHOLESALE'||Number(customer.discountPct)>0)&&<p className={'fx-pos-credit'+(Number(customer.creditLimit)>0&&customerDue+due>Number(customer.creditLimit)?' is-over':'')}>
     {customer.priceMode==='WHOLESALE'?'Tarif gros':'Tarif détail'}{Number(customer.discountPct)>0?' · remise '+Number(customer.discountPct)+' %':''}{customerDue>0?' · doit déjà '+money(customerDue):''}{Number(customer.creditLimit)>0?' · plafond '+money(customer.creditLimit):''}
     {Number(customer.creditLimit)>0&&customerDue+due>Number(customer.creditLimit)&&<b> — plafond dépassé avec cette vente</b>}</p>}
    <div className="supplier-pos-lines">{cart.map(l=><div className="supplier-pos-line" key={l.product.id}><div className="supplier-pos-line-main"><div><b>{l.product.name}</b><span>{l.product.sku}</span></div><button onClick={()=>remove(l.product.id)}><Trash2/></button></div><div className="supplier-pos-line-controls"><div><button onClick={()=>qty(l.product.id,-1)}><Minus/></button><b>{l.quantity}</b><button onClick={()=>qty(l.product.id,1)}><Plus/></button></div><label><input type="number" min={0} step="0.001" value={l.unitPrice} onChange={e=>setPrice(l.product.id,Number(e.target.value))}/><span>DT</span></label>{walkIn&&!l.product.custom&&<label className="fx-pos-extra" title="Supplément passager (non visible sur le ticket)"><span>+</span><input inputMode="decimal" aria-label={'Supplément passager pour '+l.product.name} value={extra[l.product.id]??(suggestOf(l.product)||'')} placeholder="0" onChange={e=>{const v=e.target.value.replace(',','.');setExtra(x=>({...x,[l.product.id]:v===''?0:Math.max(0,Number(v)||0)}))}}/><span>DT</span></label>}<strong>{money((l.unitPrice+extraOf(l))*l.quantity)}</strong></div></div>)}{!cart.length&&<div className="supplier-pos-cart-empty"><ShoppingCart/><b>Panier vide</b><span>Scannez ou choisissez un produit.</span></div>}</div>
    <div className="supplier-pos-totals"><div><span>Sous-total</span><b>{money(subtotal)}</b></div><label><span><Percent/> Remise</span><input type="number" min={0} max={subtotal} step="0.001" value={discount} onChange={e=>setDiscount(Number(e.target.value))}/></label><div><span>Taxes</span><b>{money(tax)}</b></div><div className="grand"><span>Total</span><b>{money(total)}</b></div></div>
    <div className="supplier-pos-payments"><div className="supplier-pos-pay-head"><b>Règlements</b><button onClick={addPayment}><Plus/> Ajouter</button></div>{payments.map((p,i)=><div key={i} className="supplier-payment-line"><select value={p.method} onChange={e=>payment(i,'method',e.target.value)}>{methods.filter(m=>m.active&&m.code!=='CREDIT').map(m=><option key={m.id||m.code} value={m.code}>{m.name}</option>)}</select><input type="number" min={0} step="0.001" value={p.amount||''} placeholder="0.000" onChange={e=>payment(i,'amount',e.target.value)}/>{payments.length>1&&<button onClick={()=>setPayments(cur=>cur.filter((_,n)=>n!==i))}><X/></button>}</div>)}<button className="supplier-pay-balance" onClick={()=>setPayments(cur=>{
    const others=cur.slice(1).reduce((sum,p)=>sum+Math.max(0,Number(p.amount||0)),0);
    return cur.map((p,i)=>i===0?{...p,amount:Math.max(0,Math.round((total-others)*1000)/1000)}:p);
  })}><Banknote/> Régler la totalité</button></div>
    <label className="fixi-pos-sale-note"><span>Observation sur la facture (facultative)</span>
       <textarea value={saleNote} maxLength={500} rows={2}
         onChange={e=>setSaleNote(e.target.value)}
         placeholder="Ex. garantie 3 mois, livraison prévue, référence client…"/>
    </label>
    <div className="supplier-pos-balance"><span>Payé <b>{money(paid)}</b></span><span className={due>0?'due':''}>Reste <b>{money(due)}</b></span></div>
    <button disabled={busy||!cart.length} onClick={checkout} className="btn btn-primary btn-block supplier-pos-checkout"><ReceiptText/>{busy?'Validation…':'Valider la vente'} <b>{money(total)}</b></button>
   </aside>
  </div>
  {scanner&&<BarcodeCamera onDetected={detect} onClose={()=>setScanner(false)}/>}
  {cashModal&&<div className="supplier-modal-backdrop" role="presentation">
    <div className="supplier-modal fixi-pos-cash-modal" role="dialog" aria-modal="true"
      aria-labelledby="fixi-cash-title">
      <button type="button" className="supplier-modal-x" aria-label="Fermer" onClick={()=>setCashModal(null)}><X/></button>
      <span className="smart-kicker"><WalletCards size={13}/> SESSION DE CAISSE</span>
      <h2 id="fixi-cash-title">{cashModal==='open'?'Ouverture de caisse':'Clôture professionnelle'}</h2>
      <p>{cashModal==='open'?'Comptez les espèces du tiroir avant la première vente.':
        'Comptez réellement les espèces présentes dans le tiroir. Les paiements par carte et virement sont exclus.'}</p>
      {cashModal==='close'&&<div className="fixi-pos-cash-review">
        <div><span>Fond de départ</span><b>{money(cashOverview?.summary?.opening||0)}</b></div>
        <div><span>Encaissements espèces</span><b>{money(cashOverview?.summary?.incoming||0)}</b></div>
        <div><span>Sorties & dépenses</span><b>{money(Number(cashOverview?.summary?.outgoing||0)+Number(cashOverview?.summary?.expenses||0))}</b></div>
        <div className="total"><span>Théorique attendu</span><b>{money(cashOverview?.summary?.expected||0)}</b></div>
      </div>}
      <button type="button" className="btn btn-soft btn-sm fx-count-toggle" onClick={()=>setCounting(v=>!v)}><Calculator size={15}/> {counting?'Saisir le total directement':'Compter billets et pièces'}</button>
      {counting&&<div className="fx-denoms">{[...NOTES,...COINS].map(v=><label key={v}><span>{v>=1?v+' DT':Math.round(v*1000)+' mil.'}</span><input type="number" min={0} step={1} inputMode="numeric" value={denoms[v]||''} placeholder="0" onChange={e=>setDenoms(d=>({...d,[v]:e.target.value.replace(/\D/g,'')}))}/><b>{money(v*(Number(denoms[v])||0))}</b></label>)}</div>}
      <label className="label">{cashModal==='open'?'Fond initial compté (DT)':'Espèces réellement comptées (DT)'}</label>
      <div className="supplier-money-input"><input autoFocus inputMode="decimal" type="number" min={0} step="0.001"
        value={cashAmount} placeholder="0.000" onChange={e=>setCashAmount(e.target.value)}/><b>DT</b></div>
      {cashModal==='close'&&cashAmount!==''&&<p className={'fixi-pos-cash-difference '+(Math.abs(Number(cashAmount)-Number(cashOverview?.summary?.expected||0))<0.001?'balanced':'mismatch')}>
        <Calculator size={16}/> Écart de caisse : <strong>{money(Math.round((Number(cashAmount)-Number(cashOverview?.summary?.expected||0))*1000)/1000)}</strong>
      </p>}
      <label className="label">Observation {cashModal==='close'&&cashAmount!==''&&Math.abs(Number(cashAmount)-Number(cashOverview?.summary?.expected||0))>=0.001?'(obligatoire si écart)':'(facultatif)'}</label>
      <textarea className="input fixi-pos-cash-note" value={cashNote} maxLength={500}
        placeholder="Motif, dépôt au coffre, différence de comptage, etc."
        onChange={e=>setCashNote(e.target.value)}/>
      {err&&<p role="alert" className="fixi-pos-cash-error"><AlertTriangle size={16}/>{err}</p>}
      <button type="button" disabled={busy||cashAmount===''} className="btn btn-primary btn-block"
        onClick={()=>void cashAction()}>{busy?'Enregistrement…':cashModal==='open'?'Confirmer l’ouverture':'Clôturer et enregistrer l’écart'}</button>
    </div>
  </div>}
 </div>
}
