import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {invoke} from '@tauri-apps/api/core';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {WindowsLabelStudio} from './labels';
import {TicketPrint,type ReceiptData} from './TicketV4';
import {TicketSearchV4} from './TicketSearchV4';
import './style.css';
import './v4.css';

type Product={id:string;name:string;sku:string;barcode?:string|null;category:string|null;price:number;wholesalePrice?:number|null;minStock?:number;stock:number};
type Customer={id:string;name:string};
type Boot={companyName:string;role:string;products:Product[];customers:Customer[];pinConfigured?:boolean};
type Order={id:string;customer:string;createdAt:string;status:string;items:{name:string;sku:string;quantity:number}[]};
type Debt={id:string;reference:string;customer:string;total:number;paid:number;due:number};
type CustomerDebt={customerId:string;customer:string;phone:string;due:number;invoices:number};
type TicketSearch={id:string;reference:string;createdAt:string;customer:string;phone:string;total:number;paid:number;status:string;items:{name:string;sku:string|null;quantity:number;price:number}[]};
type CourierShift={id:string;status:string;expectedCod:number;declaredRemit:number;openedAt:string;submittedAt?:string;driver?:{fullName:string;phone?:string}|null};
type ReturnLine={id:string;name:string;quantity:number;remaining:number;unitPrice:number};
type SaleSource={id:string;reference:string;total:number;items:ReturnLine[]};
type Credit={id:string;reference:string;sourceRef:string;total:number;refund:number;status:string;createdAt:string};
type Hist={sales:{id:string;reference:string;total:number;paid:number;status:string;createdAt:string}[];sessions:{id:string;status:string;openedAt:string;closedAt?:string}[]};
type Draft={cart:Record<string,number>;customerId:string;amount:string;method:string;reference:string;priceMode?:'RETAIL'|'WHOLESALE'};
type DebtRequest={saleId?:string;customerId?:string;amount:number;method:string;reference:string};
type ReturnRequest={sourceSaleId:string;items:{saleItemId:string;quantity:number;restock:boolean;condition:string;reason:string}[];refund:number;refundMethod:string;note:string;reference:string};
type Result={exists:boolean;reference:string;record?:{reference?:string;remaining?:number}|null};
type Page='caisse'|'produits'|'stock'|'clients'|'commandes'|'dettes'|'retours'|'historique'|'session'|'livreurs';
const money=(n:number)=>new Intl.NumberFormat('fr-TN',{minimumFractionDigits:3,maximumFractionDigits:3}).format(n)+' DT';
const initialServer='https://fixi-web.onrender.com';
const nav:{id:Page;icon:string;label:string}[]=[
 {id:'caisse',icon:'▦',label:'Caisse'}, {id:'produits',icon:'◫',label:'Catalogue'},
 {id:'stock',icon:'▤',label:'Stock'}, {id:'commandes',icon:'▧',label:'Commandes en ligne'},
 {id:'dettes',icon:'◈',label:'Dettes & règlements'},{id:'retours',icon:'↶',label:'Retours & avoirs'},
 {id:'clients',icon:'♙',label:'Clients'}, {id:'historique',icon:'▤',label:'Historique'},
 {id:'session',icon:'◉',label:'Session de caisse'},{id:'livreurs',icon:'♜',label:'Recettes livreurs'}
];
const demo:Boot={companyName:'Mode démonstration',role:'DEMO',products:[
 {id:'d1',name:'Écran Samsung A04',sku:'A04-LCD',price:89,stock:12,category:'Afficheurs'},
 {id:'d2',name:'Écran Samsung A06',sku:'A06-LCD',price:105,stock:4,category:'Afficheurs'},
 {id:'d3',name:'Batterie iPhone',sku:'IP-BAT',price:42,stock:0,category:'Batteries'}],customers:[]};
function App(){
 const [profile,setProfile]=useState<{configured:boolean;server?:string;login?:string}|null>(null);
 const [server,setServer]=useState(initialServer),[login,setLogin]=useState(''),[password,setPassword]=useState(''),[pin,setPin]=useState(''),[passwordMode,setPasswordMode]=useState(false);
 const [boot,setBoot]=useState<Boot|null>(null),[page,setPage]=useState<Page>('caisse'),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const [draftKey,setDraftKey]=useState(''),[cart,setCart]=useState<Record<string,number>>({}),[customerId,setCustomerId]=useState(''),[paid,setPaid]=useState(''),[method,setMethod]=useState('CASH'),[saleRef,setSaleRef]=useState('');
 const [scan,setScan]=useState(''),[search,setSearch]=useState(''),[category,setCategory]=useState('Tous'),[labels,setLabels]=useState(false);
 const [setupPin,setSetupPin]=useState(''),[lockPin,setLockPin]=useState(''),[locked,setLocked]=useState(false),[pinConfigured,setPinConfigured]=useState(false);
 const [orders,setOrders]=useState<Order[]>([]),[debts,setDebts]=useState<Debt[]>([]),[sources,setSources]=useState<SaleSource[]>([]),[credits,setCredits]=useState<Credit[]>([]),[history,setHistory]=useState<Hist|null>(null);
 const [debtSale,setDebtSale]=useState(''),[debtAmount,setDebtAmount]=useState(''),[debtMethod,setDebtMethod]=useState('CASH'),[debtPending,setDebtPending]=useState<DebtRequest|null>(null);
 const [returnSale,setReturnSale]=useState(''),[returnQty,setReturnQty]=useState<Record<string,number>>({}),[returnDamage,setReturnDamage]=useState(false),[refund,setRefund]=useState('0'),[refundMethod,setRefundMethod]=useState('CASH'),[returnNote,setReturnNote]=useState('Retour client'),[returnPending,setReturnPending]=useState<ReturnRequest|null>(null);
 const [cashAmount,setCashAmount]=useState(''),[cashNote,setCashNote]=useState('');
 const [ticket,setTicket]=useState<ReceiptData|null>(null),[priceMode,setPriceMode]=useState<'RETAIL'|'WHOLESALE'>('RETAIL');
 const [receiptWarning,setReceiptWarning]=useState('');
 const [customerDebts,setCustomerDebts]=useState<CustomerDebt[]>([]),[clientDebtId,setClientDebtId]=useState('');
 const [newClientName,setNewClientName]=useState(''),[newClientPhone,setNewClientPhone]=useState(''),[newClientAddress,setNewClientAddress]=useState('');
 const [ticketQuery,setTicketQuery]=useState(''),[ticketFrom,setTicketFrom]=useState(''),[ticketTo,setTicketTo]=useState('');
 const [ticketMatches,setTicketMatches]=useState<TicketSearch[]>([]);
 const [courierShifts,setCourierShifts]=useState<CourierShift[]>([]),[selectedShift,setSelectedShift]=useState(''),[courierAmount,setCourierAmount]=useState(''),[courierNote,setCourierNote]=useState('');
 const scanRef=useRef<HTMLInputElement>(null);
 const products=boot?.products||[];
 const entries=Object.entries(cart).filter(([id,q])=>q>0&&products.some(p=>p.id===id)).map(([id,quantity])=>({product:products.find(p=>p.id===id)!,quantity}));
 const priceFor=(p:Product)=>priceMode==='WHOLESALE'&&p.wholesalePrice!==null&&p.wholesalePrice!==undefined?p.wholesalePrice:p.price;
 const total=useMemo(()=>entries.reduce((v,x)=>v+x.quantity*priceFor(x.product),0),[entries,priceMode]);
 const amount=paid.trim()===''?total:Number(paid);
 const due=Math.max(0,total-(Number.isFinite(amount)?amount:0));
 const categories=['Tous',...new Set(products.map(p=>p.category||'Autres'))];
 const visible=products.filter(p=>(category==='Tous'||(p.category||'Autres')===category)&&(!search||[p.name,p.sku,p.barcode||''].join(' ').toLowerCase().includes(search.toLowerCase())));
 const low=products.filter(p=>p.stock<=(p.minStock??5));
 const focusScan=()=>{if(page==='caisse'&&!locked&&!labels)requestAnimationFrame(()=>scanRef.current?.focus())};
 useEffect(()=>{void invoke<{configured:boolean;server?:string;login?:string}>('supplier_saved_profile').then(p=>{setProfile(p);if(p.configured){setServer(p.server||initialServer);setLogin(p.login||'')}}).catch(()=>setProfile({configured:false}))},[]);
 useEffect(()=>{if(!draftKey||!boot||boot.role==='DEMO')return;
  try{const d:Draft={cart,customerId,amount:paid,method,reference:saleRef,priceMode};localStorage.setItem(draftKey,JSON.stringify(d))}
  catch{setError('Impossible de conserver le panier sur cet ordinateur.')}
 },[draftKey,boot,cart,customerId,paid,method,saleRef,priceMode]);
 useEffect(()=>{if(!draftKey)return;try{
   const debt=localStorage.getItem(draftKey+':debt');setDebtPending(debt?JSON.parse(debt):null);
   const ret=localStorage.getItem(draftKey+':return');setReturnPending(ret?JSON.parse(ret):null)
 }catch{setError('Une opération sauvegardée ne peut pas être lue. Vérifiez le journal fournisseur.')}},[draftKey]);
 useEffect(()=>{focusScan()},[page,locked,labels,boot]);
 useEffect(()=>{const handler=(e:KeyboardEvent)=>{if(e.key==='F2'&&boot&&!locked){e.preventDefault();setPage('caisse');requestAnimationFrame(()=>scanRef.current?.focus())}};
  window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)
 },[boot,locked]);
 function connectData(data:Boot,origin:string,user:string){
   const key='fixi:v4:draft:'+encodeURIComponent(origin.trim().toLowerCase())+':'+encodeURIComponent(user.trim().toLowerCase());
   let draft:Draft|null=null;
   try{
     const existing=localStorage.getItem(key);
     if(existing){draft=JSON.parse(existing)}
     else{
       // Import the previous FIXI V3 unpaid cart without deleting its backup.
       const oldKey='fixi:windows-pos:draft:v1:'+encodeURIComponent(origin.trim().toLowerCase())+':'+encodeURIComponent(user.trim().toLowerCase());
       const original=localStorage.getItem(oldKey);
       if(original){const old=JSON.parse(original);draft={cart:old.cart||{},customerId:old.customerId||'',amount:old.amount||'',method:old.payMethod||'CASH',reference:old.saleKey||'',priceMode:'RETAIL'}}
     }
   }catch{setError('Ancien panier illisible : ouvrez la V3 pour vérifier son contenu avant une vente.')}
   const saved:Record<string,number>={};
   if(draft?.cart)for(const [id,q] of Object.entries(draft.cart)){const prod=data.products.find(p=>p.id===id);if(prod&&Number.isInteger(q)&&q>0)saved[id]=Math.min(q,prod.stock)}
   setCart(saved);setCustomerId(data.customers.some(x=>x.id===draft?.customerId)?draft!.customerId:'');
   setPaid(draft?.amount||'');setPriceMode(draft?.priceMode==='WHOLESALE'?'WHOLESALE':'RETAIL');setMethod(['CASH','CARD','TRANSFER'].includes(draft?.method||'')?draft!.method:'CASH');
   setSaleRef(draft?.reference||'');setDraftKey(key);setBoot(data);setPage('caisse');setPinConfigured(Boolean(data.pinConfigured));setPassword('');setError('');setMessage(draft?.reference?'Vente interrompue à vérifier avant de continuer.':'');
 }
 async function connect(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');
  try{const data=await invoke<Boot>('supplier_login',{server,login,password});connectData(data,server,login);setProfile(data.pinConfigured?{configured:true,server,login}:{configured:false})}
  catch(e){setError(String(e))}finally{setBusy(false)}
 }
 async function quickLogin(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');
  try{const data=await invoke<Boot>('supplier_pin_login',{pin});connectData({...data,pinConfigured:true},profile?.server||server,profile?.login||login);setPin('')}
  catch(e){setError(String(e));setPin('')}finally{setBusy(false)}
 }
 async function refresh(){if(!boot||boot.role==='DEMO')return;setBusy(true);setError('');
  try{const data=await invoke<Boot>('supplier_refresh');setBoot({...data,pinConfigured});setMessage('Catalogue synchronisé. Panier conservé.')}
  catch(e){setError(String(e))}finally{setBusy(false)}
 }
 async function load(target:Page){if(!boot||boot.role==='DEMO')return;
  setError('');try{
   if(target==='commandes'){const data=await invoke<{orders:Order[]}>('supplier_orders');setOrders(data.orders)}
   if(target==='dettes'){
    const [old,grouped]=await Promise.all([
      invoke<{debts:Debt[]}>('supplier_debts'),
      invoke<{customers:CustomerDebt[]}>('supplier_customer_debts')
    ]);
    setDebts(old.debts);setCustomerDebts(grouped.customers)
   }
   if(target==='retours'){const data=await invoke<{sales:SaleSource[];returns:Credit[]}>('supplier_returns');setSources(data.sales);setCredits(data.returns)}
   if(target==='historique'||target==='session'){setHistory(await invoke<Hist>('supplier_history'))}
   if(target==='livreurs'){const shifts=await invoke<CourierShift[]>('supplier_delivery_shifts');setCourierShifts(shifts)}
  }catch(e){setError(String(e))}
 }
 useEffect(()=>{if(page!=='commandes'||!boot||boot.role==='DEMO')return;
  const interval=window.setInterval(()=>{void invoke<{orders:Order[]}>('supplier_orders').then(data=>setOrders(data.orders)).catch(()=>{})},20000);
  return()=>window.clearInterval(interval)
 },[page,boot?.role]);
 function navigate(target:Page){setPage(target);setSearch('');setMessage('');void load(target)}
 function add(id:string,delta:number){
   if(busy||saleRef){setError('Une vente est en cours ou à vérifier. Le panier est verrouillé.');return}
   const p=products.find(x=>x.id===id);if(!p)return;
   if(delta>0&&(cart[id]||0)>=p.stock){setError('Stock insuffisant pour '+p.name);return}
   setCart(c=>({...c,[id]:Math.max(0,(c[id]||0)+delta)}));setError('');focusScan()
 }
 function barcode(){const value=scan.trim().toLowerCase();if(!value)return;
  const p=products.find(x=>[x.barcode,x.sku].some(c=>c?.trim().toLowerCase()===value));
  if(p){add(p.id,1);setSearch('');setMessage(p.name+' ajouté au panier')}else setError('Code-barres introuvable : '+scan);
  setScan('');focusScan()
 }
 function localClearSale(){setCart({});setCustomerId('');setPaid('');setSaleRef('');setSearch('')}
 async function sale(replay=false){
  if(!boot||busy||boot.role==='DEMO'||!entries.length||(saleRef&&!replay))return;
  if(!Number.isFinite(amount)||amount<0||amount>total){setError('Montant payé incorrect.');return}
  if(amount<total&&!customerId){setError('Sélectionnez un client pour une vente à crédit.');return}
  const reference=saleRef||'WIN-'+crypto.randomUUID();
  if(!replay&&!window.confirm('Confirmer la vente de '+money(total)+' ?'))return;
  try{if(!draftKey)throw Error('Profil de caisse absent');localStorage.setItem(draftKey,JSON.stringify({cart,customerId,amount:paid,method,reference}))}
  catch{setError('Impossible de protéger le panier localement : vente non envoyée.');return}
  setSaleRef(reference);setBusy(true);setError('');setMessage('');
  try{const result=await invoke<{reference?:string}>('supplier_checkout',{sale:{reference,items:entries.map(e=>({productId:e.product.id,quantity:e.quantity,unitPrice:priceFor(e.product)})),customerId:customerId||null,paid:amount,method}});
   setTicket({reference:result.reference||reference,lines:entries.map(x=>({name:x.product.name,quantity:x.quantity,price:priceFor(x.product)})),paid:amount,total,company:boot.companyName,date:new Date().toLocaleString('fr-TN'),customer:boot.customers.find(x=>x.id===customerId)?.name});
   setMessage('Vente enregistrée : '+(result.reference||reference));localClearSale();await refresh();focusScan()
  }catch(e){const msg=String(e);setError(msg);if(/HTTP 40[1349]|Vente refusée|Stock insuffisant/i.test(msg)){setSaleRef('')}else setMessage('Vente à vérifier, référence conservée : '+reference)}
  finally{setBusy(false)}
 }
 async function verify(kind:'sale'|'debt'|'return',reference:string){
  if(!reference)return;setBusy(true);setError('');
  try{const r=await invoke<Result>('supplier_operation_status',{kind,reference});
   if(!r.exists){setMessage('Aucune opération trouvée pour '+reference+'. Vous pouvez renvoyer la même demande.');return}
   if(kind==='sale'){localClearSale();await refresh();setMessage('Vente retrouvée sur FIXI Cloud : '+reference)}
   if(kind==='debt'){localStorage.removeItem(draftKey+':debt');setDebtPending(null);void load('dettes');setMessage('Règlement retrouvé : '+reference)}
   if(kind==='return'){localStorage.removeItem(draftKey+':return');setReturnPending(null);void load('retours');setMessage('Avoir retrouvé : '+reference)}
  }catch(e){setError(String(e))}finally{setBusy(false)}
 }
 async function debtPay(op?:DebtRequest){
  if(busy||!boot)return;
  let request=op;
  if(!request){
   const c=customerDebts.find(x=>x.customerId===clientDebtId),v=Number(debtAmount);
   if(!c||!Number.isFinite(v)||v<=0||v>c.due){setError('Choisissez un client et un versement inférieur au solde total.');return}
   if(!window.confirm('Encaisser '+money(v)+' sur le compte '+c.customer+' (dette : '+money(c.due)+') ?'))return;
   request={customerId:c.customerId,amount:v,method:debtMethod,reference:'WINCUST-'+crypto.randomUUID()};
   try{localStorage.setItem(draftKey+':debt',JSON.stringify(request))}
   catch{setError('Sauvegarde locale impossible : aucun paiement envoyé');return}
   setDebtPending(request)
  }
  if(!request.customerId){setError('Ancien versement par facture en attente : vérifiez-le sur FIXI Supplier avant de commencer un règlement global.');return}
  setBusy(true);setError('');
  try{
   const r=await invoke<{remaining:number;allocated:number}>('supplier_customer_payment',{payment:request});
   localStorage.removeItem(draftKey+':debt');setDebtPending(null);setDebtAmount('');
   setMessage('Règlement global confirmé : '+money(request.amount)+' sur '+r.allocated+' facture(s). Solde : '+money(r.remaining));
   await load('dettes')
  }catch(e){const msg=String(e);setError(msg);
   if(/HTTP 40[1349]|versement refusé|Montant non valide/i.test(msg)){localStorage.removeItem(draftKey+':debt');setDebtPending(null)}
  }finally{setBusy(false)}
 }
 async function searchTickets(q=ticketQuery,from=ticketFrom,to=ticketTo){
  if(!boot||boot.role==='DEMO')return;
  setBusy(true);setError('');
  try{const data=await invoke<{sales:TicketSearch[]}>('supplier_find_tickets',{query:q,from,to});
   setTicketMatches(data.sales);
   if(data.sales.length===0)setMessage('Aucun ticket trouvé pour ces critères.')
  }catch(e){setError(String(e))}finally{setBusy(false)}
 }
 function showTicket(x:TicketSearch){
  if(!boot)return;
  setTicket({reference:x.reference,company:boot.companyName,date:new Date(x.createdAt).toLocaleString('fr-TN'),
   customer:x.customer,lines:x.items,total:x.total,paid:x.paid});
  setMessage('Ticket '+x.reference+' prêt à être réimprimé.')
 }
 async function selectReturnFromTicket(x:TicketSearch){
  setBusy(true);setError('');
  try{
   const result=await invoke<{sale:SaleSource}>('supplier_return_source',{reference:x.reference});
   setSources(rows=>[result.sale,...rows.filter(row=>row.id!==result.sale.id)]);
   setReturnSale(result.sale.id);setReturnQty({});
   setMessage('Vente '+x.reference+' chargée pour retour — vérifiez les articles et quantités.')
  }catch(e){setError(String(e))}finally{setBusy(false)}
 }
 async function createClient(){
  const name=newClientName.trim(),phone=newClientPhone.trim(),address=newClientAddress.trim();
  if(name.length<2){setError('Indiquez un nom de client valide.');return}
  if(!window.confirm('Créer le client '+name+' dans FIXI Supplier ?'))return;
  setBusy(true);setError('');
  try{
   const client=await invoke<Customer>('supplier_create_customer',{customer:{name,phone:phone||null,address:address||null}});
   const refreshed=await invoke<Boot>('supplier_refresh');
   setBoot({...refreshed,pinConfigured});setCustomerId(client.id);
   setNewClientName('');setNewClientPhone('');setNewClientAddress('');
   setMessage('Client '+name+' ajouté et sélectionné pour la caisse.');setPage('caisse')
  }catch(e){setError(String(e))}finally{setBusy(false)}
 }
 async function closeCourierShift(){
  if(!boot||busy)return;
  const shift=courierShifts.find(x=>x.id===selectedShift);
  const actual=Number(courierAmount);
  if(!shift||shift.status!=='PENDING_CASHIER'||!Number.isFinite(actual)||actual<0){setError('Sélectionnez une remise en attente et un montant reçu valide.');return}
  const expected=Number(shift.expectedCod||0);
  if(Math.abs(actual-expected)>=.001&&!courierNote.trim()){setError('Indiquez obligatoirement la raison de l’écart de caisse.');return}
  if(!window.confirm('Clôturer la recette livreur : attendu '+money(expected)+' / remis '+money(actual)+' ?'))return;
  setBusy(true);setError('');
  try{
   await invoke('supplier_delivery_close',{closure:{shiftId:shift.id,actualAmount:actual,note:courierNote.trim()}});
   setMessage('Remise livreur clôturée et rattachée à votre session de caisse.');
   setSelectedShift('');setCourierAmount('');setCourierNote('');await load('livreurs')
  }catch(e){setError(String(e))}finally{setBusy(false)}
 }
 async function returnPay(op?:ReturnRequest){
  if(busy||!boot)return;
  let request=op;
  if(!request){const sale=sources.find(x=>x.id===returnSale);
   if(!sale){setError('Sélectionnez la vente d’origine.');return}
   const lines=sale.items.filter(i=>(returnQty[i.id]||0)>0).map(i=>({saleItemId:i.id,quantity:returnQty[i.id],restock:!returnDamage,condition:returnDamage?'DAMAGED':'BON',reason:returnNote}));
   if(!lines.length||lines.some(i=>i.quantity>(sale.items.find(x=>x.id===i.saleItemId)?.remaining??0))){setError('Quantités retournables invalides.');return}
   const val=Number(refund);if(!Number.isFinite(val)||val<0){setError('Montant du remboursement incorrect.');return}
   if(!window.confirm('Créer l’avoir et enregistrer le remboursement '+money(val)+' ?'))return;
   request={reference:'WINRET-'+crypto.randomUUID(),sourceSaleId:sale.id,items:lines,refund:val,refundMethod,note:returnNote};
   try{localStorage.setItem(draftKey+':return',JSON.stringify(request))}catch{setError('Sauvegarde locale impossible. Retour non envoyé.');return}
   setReturnPending(request)
  }
  setBusy(true);setError('');
  try{await invoke('supplier_return_create',{request});localStorage.removeItem(draftKey+':return');setReturnPending(null);setReturnSale('');setReturnQty({});setMessage('Retour enregistré : '+request.reference);await load('retours')}
  catch(e){const msg=String(e);setError(msg);if(/HTTP 40[1349]|Retour refusé/i.test(msg)){localStorage.removeItem(draftKey+':return');setReturnPending(null)}}
  finally{setBusy(false)}
 }
 async function orderTransition(o:Order){const target:Record<string,string>={PENDING:'CONFIRMED',CONFIRMED:'PREPARING',PREPARING:'READY_FOR_DELIVERY'};
  if(!target[o.status]||busy)return;if(!window.confirm('Passer cette commande à '+target[o.status]+' ?'))return;
  setBusy(true);setError('');try{await invoke('supplier_order_transition',{orderId:o.id,status:target[o.status]});setMessage('Commande mise à jour');await load('commandes')}catch(e){setError(String(e))}finally{setBusy(false)}
 }
 async function cash(action:'CASH_OPEN'|'CASH_CLOSE'){const n=Number(cashAmount);if(cashAmount.trim()===''||!Number.isFinite(n)||n<0){setError('Saisissez un montant de caisse valide.');return}
  if(!window.confirm(action==='CASH_OPEN'?'Ouvrir la caisse ?':'Clôturer cette caisse ?'))return;
  setBusy(true);setError('');try{await invoke('supplier_cash_action',{operation:{action,[action==='CASH_OPEN'?'openingAmount':'closingAmount']:n,note:cashNote}});setMessage('Session de caisse mise à jour.');setCashAmount('');setCashNote('');await load('session')}
  catch(e){setError(String(e))}finally{setBusy(false)}
 }
 async function changePin(){if(setupPin.length!==4)return;setBusy(true);setError('');
  try{await invoke('pin_setup',{pin:setupPin});setPinConfigured(true);setProfile({configured:true,server,login});setSetupPin('');setMessage('Code PIN protégé dans Windows.')}
  catch(e){setError(String(e))}finally{setBusy(false)}
 }
 async function lock(){setError('');try{await invoke('pin_lock');setLocked(true);setLockPin('')}catch(e){setError(String(e))}}
 async function unlock(e:React.FormEvent){e.preventDefault();try{await invoke('pin_unlock',{pin:lockPin});setLocked(false);setLockPin('');focusScan()}catch(e){setError(String(e));setLockPin('')}}
 async function logout(){if(!window.confirm('Changer de compte supprimera le PIN enregistré sur ce PC. Continuer ?'))return;try{await invoke('supplier_logout')}catch(e){setError(String(e));return}
  setBoot(null);setProfile({configured:false});setDraftKey('');setPasswordMode(false);setLocked(false);setSaleRef('');setCart({})}
 function printTicket(){
  if(!ticket)return;
  document.body.dataset.printMode='ticket';
  window.addEventListener('afterprint',()=>{delete document.body.dataset.printMode;
    setReceiptWarning('Vérifiez que le ticket est bien sorti de l’imprimante. Sinon utilisez Réimprimer.');},{once:true});
  requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()))
 }
 const canRefund=['OWNER','ADMIN','MANAGER'].includes(boot?.role||'');
 const receiptAutoPrintRef=useRef('');
 useEffect(()=>{
  if(!ticket||receiptAutoPrintRef.current===ticket.reference)return;
  receiptAutoPrintRef.current=ticket.reference;
  document.body.dataset.printMode='ticket';
  const clean=()=>{delete document.body.dataset.printMode;setReceiptWarning('Ticket imprimé ou dialogue fermé : vérifiez la sortie papier, réimprimez si nécessaire.')};
  window.addEventListener('afterprint',clean,{once:true});
  requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()))
 },[ticket?.reference]);
 if(!boot)return <div className="v4-login">
  <div className="v4-login-identity"><div className="v4-mark">F</div><h1>FIXI Caisse</h1><p>Point de vente professionnel · Windows V4</p><ul><li>Scanner rapide et panier sauvegardé</li><li>Gestion intégrée FIXI Supplier</li><li>Comptabilité, commandes et retours</li></ul></div>
  <div className="v4-login-panel">{profile?.configured&&!passwordMode?
   <form onSubmit={quickLogin}><h2>Bienvenue</h2><p>Ouvrir la caisse de <strong>{profile.login}</strong></p><label>Code PIN<input autoFocus type="password" inputMode="numeric" maxLength={4} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="••••"/></label><button disabled={busy||pin.length!==4} className="v4-primary">Ouvrir la caisse</button><button type="button" className="v4-link" onClick={()=>setPasswordMode(true)}>Connexion avec mot de passe</button></form>:
   <form onSubmit={connect}><h2>Connexion fournisseur</h2><p>Utilise ton compte FIXI Supplier actuel.</p><label>Serveur FIXI<input type="url" required value={server} onChange={e=>setServer(e.target.value)}/></label><label>Identifiant<input required value={login} onChange={e=>setLogin(e.target.value)}/></label><label>Mot de passe<input required type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy} className="v4-primary">Connexion sécurisée</button>{profile?.configured&&<button type="button" className="v4-link" onClick={()=>setPasswordMode(false)}>Retour au PIN</button>}</form>}
  <button className="v4-demo" onClick={()=>{setBoot(demo);setPage('caisse')}}>Essayer sans connexion · Démonstration</button>
  {error&&<p role="alert" className="v4-error">{error}</p>}</div></div>;
 return <div className={'v4-app '+(page==='caisse'?'v4-checkout-layout':'v4-detail-layout')}>
  <aside className="v4-sidebar"><div className="v4-brand"><div className="v4-mark">F</div><div><strong>FIXI</strong><small>CAISSE PRO · V4</small></div></div>
   <span className="v4-side-heading">ESPACE DE TRAVAIL</span>
   {nav.map(item=><button key={item.id} className={'v4-nav '+(page===item.id?'current':'')} onClick={()=>navigate(item.id)}><span>{item.icon}</span>{item.label}{item.id==='commandes'&&orders.filter(o=>o.status==='PENDING').length>0&&<b>{orders.filter(o=>o.status==='PENDING').length}</b>}</button>)}
   <div className="v4-side-footer"><span className="v4-led"/> <strong>{boot.companyName}</strong><small>{boot.role==='DEMO'?'Démonstration':boot.role+' · Connecté'}</small></div>
  </aside>
  <main className="v4-main">
   <header className="v4-header"><div><small>FIXI SUPPLIER / {nav.find(n=>n.id===page)?.label}</small><h1>{page==='caisse'?'Caisse rapide':nav.find(n=>n.id===page)?.label}</h1></div><div className="v4-top-actions">
    <button onClick={()=>void refresh()} disabled={busy||boot.role==='DEMO'}>↻ Synchroniser</button>
    <button onClick={()=>setLabels(true)}>▦ Étiquettes</button>
    {pinConfigured?<button onClick={()=>void lock()}>▣ Verrouiller</button>:boot.role!=='DEMO'?<div className="v4-inline-pin"><input type="password" inputMode="numeric" maxLength={4} value={setupPin} onChange={e=>setSetupPin(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="PIN 4 chiffres"/><button disabled={busy||setupPin.length!==4} onClick={()=>void changePin()}>Activer PIN</button></div>:null}
    <button onClick={()=>void getCurrentWindow().close()}>Fermer</button><button onClick={()=>void logout()}>Changer de compte</button>
   </div></header>
   {error&&<div role="alert" className="v4-error">{error}<button onClick={()=>setError('')}>×</button></div>}
   {message&&<div role="status" className="v4-message">{message}<button onClick={()=>setMessage('')}>×</button></div>}
   {page==='caisse'&&<><div className="v4-scan"><span>▥</span><input ref={scanRef} autoFocus placeholder="Scanner code-barres ou saisir SKU · F2" value={scan} onChange={e=>setScan(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')barcode()}}/><button onClick={barcode}>Ajouter</button></div>
    {low.length>0&&boot.role!=='DEMO'&&<div className="v4-low"><strong>⚠ {low.filter(p=>p.stock===0).length} rupture(s) · {low.length} stock(s) faible(s)</strong><button onClick={()=>navigate('stock')}>Voir les stocks</button></div>}
    <div className="v4-search"><input placeholder="Rechercher un produit, une référence…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
    <div className="v4-price-switch"><strong>Tarif appliqué au panier :</strong>
  <button className={priceMode==='RETAIL'?'active':''} disabled={busy||!!saleRef||entries.length>0} onClick={()=>setPriceMode('RETAIL')}>Détail</button>
  <button className={priceMode==='WHOLESALE'?'active':''} disabled={busy||!!saleRef||entries.length>0} onClick={()=>setPriceMode('WHOLESALE')}>Gros</button>
  <small>Le tarif ne peut pas changer quand le panier contient des articles. Videz-le pour sélectionner un autre tarif.</small>
 </div><div className="v4-categories">{categories.map(x=><button key={x} className={x===category?'active':''} onClick={()=>setCategory(x)}>{x}</button>)}</div>
    <section className="v4-products">{visible.map(p=><button key={p.id} disabled={p.stock<=0||busy||!!saleRef} className="v4-product" onClick={()=>add(p.id,1)}><span className="v4-product-picture">▣</span><strong>{p.name}</strong><small>{p.sku}</small><span className={'v4-quantity '+(p.stock<=5?'alert':'')}>{p.stock===0?'RUPTURE':p.stock<=5?'Stock faible · '+p.stock:'En stock · '+p.stock}</span><span className="v4-price-pair"><small>Détail : {money(p.price)}</small><small>Gros : {p.wholesalePrice===null||p.wholesalePrice===undefined?'Non défini':money(p.wholesalePrice)}</small></span><b>{money(priceFor(p))}</b></button>)}</section>
   </>}
   {page==='produits'&&<section className="v4-panel"><h2>Catalogue fournisseur</h2><div className="v4-search"><input placeholder="Rechercher par nom ou SKU" value={search} onChange={e=>setSearch(e.target.value)}/></div><table><thead><tr><th>Produit</th><th>SKU</th><th>Catégorie</th><th>Prix détail</th><th>Prix gros</th><th>Disponible</th></tr></thead><tbody>{products.filter(p=>(p.name+' '+p.sku).toLowerCase().includes(search.toLowerCase())).map(p=><tr key={p.id}><td>{p.name}</td><td>{p.sku}</td><td>{p.category||'—'}</td><td>{money(p.price)}</td><td>{p.wholesalePrice===undefined||p.wholesalePrice===null?'—':money(p.wholesalePrice)}</td><td>{p.stock}</td></tr>)}</tbody></table></section>}
   {page==='stock'&&<section className="v4-panel"><h2>Disponibilité des articles</h2><p>Les ruptures apparaissent en premier.</p><table><thead><tr><th>Produit</th><th>Référence</th><th>Stock disponible</th><th>État</th></tr></thead><tbody>{[...products].sort((a,b)=>a.stock-b.stock).map(p=><tr key={p.id}><td>{p.name}</td><td>{p.sku}</td><td><b>{p.stock}</b></td><td><span className={p.stock<=5?'v4-danger':''}>{p.stock===0?'Rupture':p.stock<=5?'Stock faible':'Disponible'}</span></td></tr>)}</tbody></table></section>}
   {page==='clients'&&<section className="v4-panel">
 <div className="v4-panel-head"><div><h2>Clients fournisseur</h2><p>Créer un client puis l'utiliser immédiatement pour une vente ou un règlement.</p></div></div>
 <div className="v4-form-grid">
  <label>Nom et prénom / Société<input placeholder="Nom du client" value={newClientName} onChange={e=>setNewClientName(e.target.value)} maxLength={120}/></label>
  <label>Téléphone<input placeholder="+216 ..." value={newClientPhone} onChange={e=>setNewClientPhone(e.target.value)} maxLength={30}/></label>
  <label>Adresse<input placeholder="Adresse (facultatif)" value={newClientAddress} onChange={e=>setNewClientAddress(e.target.value)} maxLength={220}/></label>
  <button className="v4-primary" disabled={busy||boot.role==='DEMO'||newClientName.trim().length<2} onClick={()=>void createClient()}>+ Ajouter le client</button>
 </div>
 <table><thead><tr><th>Client</th><th>Statut</th><th>Action</th></tr></thead><tbody>
 {boot.customers.map(c=><tr key={c.id}><td>{c.name}</td><td>Actif</td><td><button onClick={()=>{setCustomerId(c.id);setPage('caisse')}}>Vendre à ce client</button></td></tr>)}
 </tbody></table></section>
   {page==='commandes'&&<section className="v4-panel"><div className="v4-panel-head"><div><h2>Commandes en ligne</h2><p>Confirmer, préparer et mettre à disposition du livreur.</p></div><button onClick={()=>void load('commandes')}>↻ Actualiser</button></div><div className="v4-order-grid">{orders.map(o=><div className="v4-order" key={o.id}><div><strong>{o.customer}</strong><span className="v4-status">{o.status}</span></div><small>{new Date(o.createdAt).toLocaleString('fr-TN')}</small><ul>{o.items.map((i,n)=><li key={n}>{i.name} · {i.sku} <b>× {i.quantity}</b></li>)}</ul><button disabled={busy||!['PENDING','CONFIRMED','PREPARING'].includes(o.status)} onClick={()=>void orderTransition(o)}>{o.status==='PENDING'?'Confirmer':o.status==='CONFIRMED'?'Commencer préparation':o.status==='PREPARING'?'Prête pour livreur':'En attente du livreur'}</button></div>)}</div>{orders.length===0&&<p>Aucune commande en attente.</p>}</section>}
   {page==='dettes'&&<section className="v4-panel">
 <div className="v4-panel-head"><div><h2>Dettes globales par client</h2><p>Un versement peut régler plusieurs anciennes factures : le serveur répartit automatiquement la somme, de la plus ancienne à la plus récente.</p></div><button onClick={()=>void load('dettes')}>↻ Actualiser</button></div>
 {debtPending&&<div className="v4-risk"><strong>Versement à vérifier</strong><p>{debtPending.reference} · {money(debtPending.amount)}</p>
  <button disabled={busy} onClick={()=>void verify('debt',debtPending.reference)}>Vérifier le règlement</button>
  <button disabled={busy||!debtPending.customerId} onClick={()=>void debtPay(debtPending)}>Renvoyer le même paiement</button></div>}
 <div className="v4-form-grid">
  <label>Client / dette totale<select disabled={busy||!!debtPending} value={clientDebtId} onChange={e=>setClientDebtId(e.target.value)}>
   <option value="">Sélectionner le client</option>{customerDebts.map(c=><option key={c.customerId} value={c.customerId}>{c.customer} · {money(c.due)} ({c.invoices} facture(s))</option>)}
  </select></label>
  <label>Montant du versement (DT)<input disabled={busy||!!debtPending} type="number" min=".001" step=".001" value={debtAmount} onChange={e=>setDebtAmount(e.target.value)}/></label>
  <label>Moyen de règlement<select disabled={busy||!!debtPending} value={debtMethod} onChange={e=>setDebtMethod(e.target.value)}>
   <option value="CASH">Espèces</option><option value="CARD">Carte</option><option value="TRANSFER">Virement</option>
  </select></label>
  <button className="v4-primary" disabled={busy||!!debtPending||!clientDebtId||boot.role==='DEMO'} onClick={()=>void debtPay()}>Encaisser le versement</button>
 </div>
 <h3>Solde des clients · {money(customerDebts.reduce((t,c)=>t+c.due,0))}</h3>
 <table><thead><tr><th>Nom du client</th><th>Téléphone</th><th>Factures dues</th><th>Dette totale</th><th>Action</th></tr></thead><tbody>
 {customerDebts.map(c=><tr key={c.customerId}><td><strong>{c.customer}</strong></td><td>{c.phone||'—'}</td><td>{c.invoices}</td><td><strong>{money(c.due)}</strong></td>
  <td><button disabled={busy||!!debtPending} onClick={()=>setClientDebtId(c.customerId)}>Recevoir un paiement</button></td></tr>)}
 </tbody></table></section>
   {page==='retours'&&<section className="v4-panel"><div className="v4-panel-head"><h2>Retours & avoirs</h2><button onClick={()=>void load('retours')}>↻ Actualiser</button></div><p>Scanner le ticket, ou rechercher la vente par date, client, téléphone ou référence.</p>
 <TicketSearchV4 query={ticketQuery} from={ticketFrom} to={ticketTo} busy={busy} results={ticketMatches}
 onQuery={setTicketQuery} onFrom={setTicketFrom} onTo={setTicketTo} onSearch={()=>void searchTickets()}
 onPrint={showTicket} onReturn={x=>void selectReturnFromTicket(x)}/>{returnPending&&<div className="v4-risk"><strong>Avoir à vérifier</strong><p>{returnPending.reference}</p><button onClick={()=>void verify('return',returnPending.reference)}>Vérifier dans FIXI</button><button onClick={()=>void returnPay(returnPending)}>Renvoyer le même retour</button></div>}{canRefund?<div className="v4-form-grid"><label>Vente d’origine<select disabled={!!returnPending} value={returnSale} onChange={e=>{setReturnSale(e.target.value);setReturnQty({})}}><option value="">Sélectionner une facture</option>{sources.map(s=><option key={s.id} value={s.id}>{s.reference} · {money(s.total)}</option>)}</select></label><div className="v4-return-lines">{sources.find(s=>s.id===returnSale)?.items.map(i=><label key={i.id}>{i.name} · {i.remaining} retournable(s)<input type="number" min="0" step="1" max={i.remaining} value={returnQty[i.id]||0} onChange={e=>setReturnQty(q=>({...q,[i.id]:Math.min(i.remaining,Math.max(0,Math.trunc(Number(e.target.value)||0)))}))}/></label>)}</div><label>État produit<select value={returnDamage?'DAMAGED':'BON'} onChange={e=>setReturnDamage(e.target.value==='DAMAGED')}><option value="BON">Bon état : remettre en stock</option><option value="DAMAGED">Endommagé : isoler du stock</option></select></label><label>Motif<input value={returnNote} onChange={e=>setReturnNote(e.target.value)}/></label><label>Remboursement (DT)<input type="number" min="0" step=".001" value={refund} onChange={e=>setRefund(e.target.value)}/></label><label>Moyen<select value={refundMethod} onChange={e=>setRefundMethod(e.target.value)}><option value="CASH">Espèces</option><option value="CARD">Carte</option><option value="TRANSFER">Virement</option></select></label><button disabled={busy||!returnSale||!!returnPending} className="v4-primary" onClick={()=>void returnPay()}>Confirmer le retour / avoir</button></div>:<p>Seuls les responsables, administrateurs ou propriétaires peuvent enregistrer un retour.</p>}<h3>Avoirs précédents</h3><table><thead><tr><th>Référence</th><th>Vente</th><th>Montant avoir</th><th>Remboursé</th><th>Statut</th></tr></thead><tbody>{credits.map(x=><tr key={x.id}><td>{x.reference}</td><td>{x.sourceRef}</td><td>{money(x.total)}</td><td>{money(x.refund)}</td><td>{x.status}</td></tr>)}</tbody></table></section>}
   {page==='historique'&&<section className="v4-panel">
 <div className="v4-panel-head"><div><h2>Rechercher et réimprimer un ticket</h2><p>Scannez le code imprimé ou recherchez par référence, client, téléphone et période.</p></div><button onClick={()=>void load('historique')}>↻ Actualiser</button></div>
 <TicketSearchV4 query={ticketQuery} from={ticketFrom} to={ticketTo} busy={busy} results={ticketMatches}
 onQuery={setTicketQuery} onFrom={setTicketFrom} onTo={setTicketTo} onSearch={()=>void searchTickets()}
 onPrint={showTicket} onReturn={x=>{setPage('retours');void selectReturnFromTicket(x)}}/>
 <h3>Dernières ventes</h3>
 <table><thead><tr><th>Référence</th><th>Date</th><th>Total</th><th>Payé</th><th>Statut</th></tr></thead><tbody>
 {history?.sales.map(x=><tr key={x.id}><td>{x.reference}</td><td>{new Date(x.createdAt).toLocaleString('fr-TN')}</td><td>{money(x.total)}</td><td>{money(x.paid)}</td><td>{x.status}</td></tr>)}
 </tbody></table>
 {ticket&&<button disabled={busy} onClick={printTicket}>Réimprimer le ticket : {ticket.reference}</button>}
 </section>
   {page==='session'&&<section className="v4-panel"><h2>Session de caisse</h2><p>Ouvrez la caisse avant les encaissements en espèces.</p><div className="v4-form-grid"><label>Montant (DT)<input type="number" min="0" step=".001" value={cashAmount} onChange={e=>setCashAmount(e.target.value)}/></label><label>Observation<input value={cashNote} onChange={e=>setCashNote(e.target.value)}/></label><button className="v4-primary" disabled={busy} onClick={()=>void cash('CASH_OPEN')}>Ouvrir la caisse</button><button disabled={busy} onClick={()=>void cash('CASH_CLOSE')}>Clôturer la caisse</button></div><h3>Dernières sessions</h3><table><thead><tr><th>Ouverture</th><th>Clôture</th><th>Statut</th></tr></thead><tbody>{history?.sessions.map(x=><tr key={x.id}><td>{new Date(x.openedAt).toLocaleString('fr-TN')}</td><td>{x.closedAt?new Date(x.closedAt).toLocaleString('fr-TN'):'—'}</td><td>{x.status}</td></tr>)}</tbody></table></section>}
   {page==='livreurs'&&<section className="v4-panel">
 <div className="v4-panel-head"><div><h2>Clôture des recettes livreurs</h2><p>Validez les remises COD des livreurs dans la session de caisse ouverte, avec preuve du montant et justification des écarts.</p></div><button onClick={()=>void load('livreurs')}>↻ Actualiser</button></div>
 <div className="v4-form-grid">
 <label>Livraison / remise en attente<select value={selectedShift} disabled={busy} onChange={e=>{setSelectedShift(e.target.value);const sh=courierShifts.find(x=>x.id===e.target.value);setCourierAmount(sh?String(sh.expectedCod??''):'')}}>
 <option value="">Sélectionner un livreur / service</option>{courierShifts.filter(s=>s.status==='PENDING_CASHIER').map(x=><option key={x.id} value={x.id}>{x.driver?.fullName||'Livreur'} · attendu {money(Number(x.expectedCod||0))}</option>)}
 </select></label>
 <label>Montant physiquement reçu (DT)<input min="0" step=".001" type="number" disabled={busy} value={courierAmount} onChange={e=>setCourierAmount(e.target.value)}/></label>
 <label>Observation / écart<input value={courierNote} disabled={busy} onChange={e=>setCourierNote(e.target.value)} placeholder="Justification si montant différent"/></label>
 <button className="v4-primary" disabled={busy||!selectedShift||boot.role==='DEMO'} onClick={()=>void closeCourierShift()}>Confirmer et clôturer la recette</button>
 </div>
 <h3>Remises livreurs</h3>
 <table><thead><tr><th>Livreur</th><th>Déclaration</th><th>Attendu</th><th>Statut</th></tr></thead><tbody>{courierShifts.map(x=><tr key={x.id}><td>{x.driver?.fullName||'Livreur'}</td>
 <td>{money(Number(x.declaredRemit||0))}</td><td>{money(Number(x.expectedCod||0))}</td><td>{x.status}</td></tr>)}</tbody></table>
 </section>}
  </main>
  {page==='caisse'&&<aside className="v4-basket"><div className="v4-basket-title"><h2>Panier</h2><span>{entries.reduce((n,e)=>n+e.quantity,0)} article(s)</span></div>
   {saleRef&&<div className="v4-risk"><strong>Vente à vérifier</strong><p>{saleRef}</p><button disabled={busy} onClick={()=>void verify('sale',saleRef)}>Vérifier la vente</button><button disabled={busy} onClick={()=>void sale(true)}>Renvoyer même référence</button></div>}
   <div className="v4-basket-items">{entries.length?entries.map(e=><div className="v4-cart-line" key={e.product.id}><div><strong>{e.product.name}</strong><small>{e.product.sku} · {money(priceFor(e.product))}</small></div><div className="v4-counter"><button disabled={busy||!!saleRef} onClick={()=>add(e.product.id,-1)}>−</button><span>{e.quantity}</span><button disabled={busy||!!saleRef} onClick={()=>add(e.product.id,1)}>+</button></div><b>{money(e.quantity*priceFor(e.product))}</b></div>):<div className="v4-empty"><span>▦</span><h3>Panier vide</h3><p>Scannez un produit ou choisissez-le dans le catalogue.</p></div>}</div>
   <div className="v4-basket-bottom"><div className="v4-basket-price"><span>Tarif : <strong>${priceMode==='WHOLESALE'?'Gros':'Détail'}</strong></span><button disabled={busy||!!saleRef} onClick={()=>setPage('clients')}>+ Nouveau client</button></div><label>Client<select disabled={busy||!!saleRef} value={customerId} onChange={e=>setCustomerId(e.target.value)}><option value="">Vente comptoir (sans client)</option>{boot.customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <div className="v4-total"><span>Total à payer</span><strong>{money(total)}</strong></div>
    <div className="v4-form-grid"><label>Mode<select disabled={busy||!!saleRef} value={method} onChange={e=>setMethod(e.target.value)}><option value="CASH">Espèces</option><option value="CARD">Carte</option><option value="TRANSFER">Virement</option></select></label><label>Reçu (DT)<input disabled={busy||!!saleRef} min="0" max={total} step=".001" type="number" placeholder={total.toFixed(3)} value={paid} onChange={e=>setPaid(e.target.value)}/></label></div>
    {due>0&&<div className="v4-due">Reste dû : <strong>{money(due)}</strong></div>}
    <button disabled={busy||!!saleRef||!entries.length||boot.role==='DEMO'} className="v4-pay" onClick={()=>void sale()}>{busy?'Enregistrement…':'PAYER / VALIDER LA VENTE'}</button>
    <button disabled={busy||!!saleRef||!entries.length} className="v4-clear" onClick={()=>{if(window.confirm('Supprimer ce panier non payé ?')){localClearSale();setMessage('Panier vidé.')}}}>Vider le panier</button>
    {ticket&&<button className="v4-print" onClick={printTicket}>Réimprimer ticket avec code-barres</button>}{receiptWarning&&<p className="v4-print-warning">{receiptWarning}</p>}
   </div>
  </aside>}
  {labels&&<WindowsLabelStudio products={products} companyName={boot.companyName} onClose={()=>setLabels(false)}/>}
  {locked&&<div className="v4-lock"><form onSubmit={unlock}><div className="v4-mark">F</div><h2>Caisse verrouillée</h2><p>Code PIN à 4 chiffres</p><input autoFocus type="password" inputMode="numeric" maxLength={4} value={lockPin} onChange={e=>setLockPin(e.target.value.replace(/\D/g,'').slice(0,4))}/><button className="v4-primary" disabled={lockPin.length!==4}>Déverrouiller</button>{error&&<p className="v4-error">{error}</p>}</form></div>}
  <TicketPrint ticket={ticket}/>
 </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
