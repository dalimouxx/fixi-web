import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {invoke} from '@tauri-apps/api/core';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {WindowsLabelStudio} from './labels';
import {TicketPrint,type ReceiptData} from './TicketV4';
import {TicketSearchV4} from './TicketSearchV4';
import {Banknote,BookOpen,Boxes,Check,ChevronRight,CircleAlert,CircleCheck,CreditCard,Delete,HandCoins,Inbox,KeyRound,Landmark,Lock,LockOpen,LogIn,Minus,PackageOpen,PackageSearch,PanelLeftClose,PanelLeftOpen,Plus,Power,Printer,ReceiptText,RefreshCw,ScanBarcode,Search,ShieldCheck,ShoppingCart,Tags,Trash2,TriangleAlert,Truck,Undo2,UserPlus,UserRound,UserRoundCog,Users,Wallet,X,type LucideIcon} from 'lucide-react';
import './style.css';
import './v4.css';
import './v5.css';

type Product={id:string;name:string;sku:string;barcode?:string|null;category:string|null;price:number;wholesalePrice?:number|null;minStock?:number;stock:number};
type Customer={id:string;name:string};
type Boot={companyName:string;role:string;products:Product[];customers:Customer[];pinConfigured?:boolean;receiptProfile?:import('./TicketV4').ReceiptBusinessProfile|null};
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
type NavItem={id:Page;icon:LucideIcon;label:string;hint?:string};
const nav:NavItem[]=[
 {id:'caisse',icon:ShoppingCart,label:'Caisse'},
 {id:'historique',icon:ReceiptText,label:'Tickets & ventes',hint:'Retrouver une vente et réimprimer son ticket.'},
 {id:'retours',icon:Undo2,label:'Retours & avoirs',hint:'Scannez le ticket du client, puis choisissez les articles rendus.'},
 {id:'session',icon:Wallet,label:'Session de caisse',hint:'Ouvrez la caisse le matin, clôturez-la le soir.'},
 {id:'clients',icon:Users,label:'Clients',hint:'Créez un client et vendez-lui directement.'},
 {id:'dettes',icon:HandCoins,label:'Dettes clients',hint:'Ce que chaque client doit encore, et ses versements.'},
 {id:'commandes',icon:Inbox,label:'Commandes en ligne',hint:'Confirmez, préparez, puis passez au livreur.'},
 {id:'livreurs',icon:Truck,label:'Recettes livreurs',hint:'Comptez l’argent rapporté par chaque livreur.'},
 {id:'produits',icon:BookOpen,label:'Catalogue',hint:'Prix détail et gros de chaque article.'},
 {id:'stock',icon:Boxes,label:'Stock',hint:'Les ruptures d’abord.'},
];
const navGroups:{label:string;items:Page[]}[]=[
 {label:'Vente',items:['caisse','historique','retours','session']},
 {label:'Clients',items:['clients','dettes']},
 {label:'Livraison',items:['commandes','livreurs']},
 {label:'Articles',items:['produits','stock']},
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
 const [receiptWarning,setReceiptWarning]=useState(''),[printRequest,setPrintRequest]=useState(0);
 const [customerDebts,setCustomerDebts]=useState<CustomerDebt[]>([]),[clientDebtId,setClientDebtId]=useState('');
 const [newClientName,setNewClientName]=useState(''),[newClientPhone,setNewClientPhone]=useState(''),[newClientAddress,setNewClientAddress]=useState('');
 const [ticketQuery,setTicketQuery]=useState(''),[ticketFrom,setTicketFrom]=useState(''),[ticketTo,setTicketTo]=useState('');
 const [ticketMatches,setTicketMatches]=useState<TicketSearch[]>([]);
 const [courierShifts,setCourierShifts]=useState<CourierShift[]>([]),[selectedShift,setSelectedShift]=useState(''),[courierAmount,setCourierAmount]=useState(''),[courierNote,setCourierNote]=useState('');
 const [givenCash,setGivenCash]=useState('');
 const [compact,setCompact]=useState(()=>{try{return localStorage.getItem('fixi:v5:compact')==='1'}catch{return false}});
 const scanRef=useRef<HTMLInputElement>(null);
 const saleRefFn=useRef<()=>void>(()=>{});
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
 useEffect(()=>{const handler=(e:KeyboardEvent)=>{if(e.key==='F2'&&boot&&!locked){e.preventDefault();setPage('caisse');requestAnimationFrame(()=>scanRef.current?.focus())}
   if(e.key==='F9'&&boot&&!locked){e.preventDefault();saleRefFn.current()}};
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
 function localClearSale(){setGivenCash('');setCart({});setCustomerId('');setPaid('');setSaleRef('');setSearch('')}
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
   setTicket({reference:result.reference||reference,lines:entries.map(x=>({name:x.product.name,quantity:x.quantity,price:priceFor(x.product)})),paid:amount,total,company:boot.companyName,profile:boot.receiptProfile,date:new Date().toLocaleString('fr-TN'),customer:boot.customers.find(x=>x.id===customerId)?.name});setPrintRequest(n=>n+1);
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
  setTicket({reference:x.reference,company:boot.companyName,profile:boot.receiptProfile,date:new Date(x.createdAt).toLocaleString('fr-TN'),
   customer:x.customer,lines:x.items,total:x.total,paid:x.paid});setPrintRequest(n=>n+1);
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
 useEffect(()=>{
  if(!ticket||printRequest===0)return;
  document.body.dataset.printMode='ticket';
  const clean=()=>{delete document.body.dataset.printMode;setReceiptWarning('Ticket imprimé ou dialogue fermé : vérifiez la sortie papier, réimprimez si nécessaire.')};
  window.addEventListener('afterprint',clean,{once:true});
  requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()))
 },[ticket?.reference,printRequest]);
 saleRefFn.current=()=>{if(page==='caisse')void sale()};
 useEffect(()=>{try{localStorage.setItem('fixi:v5:compact',compact?'1':'0')}catch{}},[compact]);
 useEffect(()=>{if(!message)return;const t=window.setTimeout(()=>setMessage(''),5000);return()=>window.clearTimeout(t)},[message]);
 const pendingOrders=orders.filter(o=>o.status==='PENDING').length;
 const cartCount=entries.reduce((n,e)=>n+e.quantity,0);
 const given=Number(givenCash.replace(',','.'));
 const change=method==='CASH'&&givenCash.trim()!==''&&Number.isFinite(given)?given-(Number.isFinite(amount)?amount:0):null;
 const quickCash=[...new Set([Math.ceil(total),Math.ceil(total/5)*5,Math.ceil(total/10)*10,Math.ceil(total/50)*50].filter(v=>v>0))].slice(0,4);
 const current=nav.find(n=>n.id===page);
 if(!boot)return <div className="v5-login">
  <div className="v5-login-identity"><div className="v5-mark v5-mark--xl">F</div><h1>FIXI Caisse</h1><p>Le point de vente Windows de FIXI Supplier.</p>
   <ul><li><ScanBarcode size={18}/> Scanner rapide, panier gardé même après coupure</li><li><Wallet size={18}/> Ventes, dettes clients et retours au même endroit</li><li><Printer size={18}/> Tickets et étiquettes code-barres</li></ul></div>
  <div className="v5-login-panel">{profile?.configured&&!passwordMode?
   <form onSubmit={quickLogin} className="v5-card v5-login-form"><h2>Bonjour 👋</h2><p>Ouvrir la caisse de <strong>{profile.login}</strong></p>
    <PinPad value={pin} onChange={setPin} autoFocus/>
    <button disabled={busy||pin.length!==4} className="v5-btn v5-btn--primary v5-btn--lg">{busy?'Ouverture…':'Ouvrir la caisse'}</button>
    <button type="button" className="v5-link" onClick={()=>setPasswordMode(true)}>Se connecter avec le mot de passe</button></form>:
   <form onSubmit={connect} className="v5-card v5-login-form"><h2>Connexion</h2><p>Avec votre compte FIXI Supplier.</p>
    <label className="v5-field"><span>Identifiant</span><input autoFocus required value={login} onChange={e=>setLogin(e.target.value)} autoComplete="username"/></label>
    <label className="v5-field"><span>Mot de passe</span><input required type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label>
    <details className="v5-advanced"><summary>Serveur</summary><label className="v5-field"><span>Adresse du serveur FIXI</span><input type="url" required value={server} onChange={e=>setServer(e.target.value)}/></label></details>
    <button disabled={busy} className="v5-btn v5-btn--primary v5-btn--lg"><LogIn size={18}/> {busy?'Connexion…':'Se connecter'}</button>
    {profile?.configured&&<button type="button" className="v5-link" onClick={()=>setPasswordMode(false)}>Revenir au code PIN</button>}</form>}
   {error&&<p role="alert" className="v5-alert v5-alert--danger">{error}</p>}
   <button className="v5-link v5-link--muted" onClick={()=>{setBoot(demo);setPage('caisse')}}>Essayer sans connexion (démonstration)</button></div></div>;
 return <div className={'v4-app v5-app'+(page==='caisse'?' is-checkout':'')+(compact?' is-compact':'')}>
  <aside className="v5-side">
   <div className="v5-brand"><div className="v5-mark">F</div><div className="v5-brand-text"><strong>FIXI</strong><small>Caisse</small></div>
    <button className="v5-icon-btn v5-side-toggle" title={compact?'Agrandir le menu':'Réduire le menu'} aria-label={compact?'Agrandir le menu':'Réduire le menu'} onClick={()=>setCompact(v=>!v)}>{compact?<PanelLeftOpen size={18}/>:<PanelLeftClose size={18}/>}</button></div>
   <nav className="v5-nav" aria-label="Menu">{navGroups.map(g=><div key={g.label} className="v5-nav-group"><span className="v5-nav-heading">{g.label}</span>
    {g.items.map(id=>{const item=nav.find(n=>n.id===id)!;const I=item.icon;return <button key={id} title={item.label} aria-current={page===id?'page':undefined} className="v5-nav-item" onClick={()=>navigate(id)}><I size={19}/><span>{item.label}</span>{id==='commandes'&&pendingOrders>0&&<b>{pendingOrders}</b>}</button>})}</div>)}</nav>
   <div className="v5-account"><span className="v5-led" aria-hidden/><div><strong>{boot.companyName}</strong><small>{boot.role==='DEMO'?'Démonstration':(roleLabel[boot.role]||boot.role)+' · connecté'}</small></div>
    <div className="v5-account-actions"><button className="v5-icon-btn" title="Changer de compte" aria-label="Changer de compte" onClick={()=>void logout()}><UserRoundCog size={17}/></button><button className="v5-icon-btn" title="Fermer FIXI Caisse" aria-label="Fermer FIXI Caisse" onClick={()=>void getCurrentWindow().close()}><Power size={17}/></button></div></div>
  </aside>
  <main className="v5-main">
   <header className="v5-header"><div><h1>{page==='caisse'?'Caisse':current?.label}</h1>{current?.hint&&<p>{current.hint}</p>}</div><div className="v5-toolbar">
    <button className="v5-btn v5-btn--ghost" onClick={()=>void refresh()} disabled={busy||boot.role==='DEMO'} title="Recharger produits, prix et stock"><RefreshCw size={16} className={busy?'v5-spin':''}/> Synchroniser</button>
    <button className="v5-btn v5-btn--ghost" onClick={()=>setLabels(true)}><Tags size={16}/> Étiquettes</button>
    {pinConfigured?<button className="v5-btn v5-btn--ghost" onClick={()=>void lock()} title="Verrouiller la caisse (code PIN)"><Lock size={16}/> Verrouiller</button>:boot.role!=='DEMO'?<div className="v5-pin-setup"><input type="password" inputMode="numeric" maxLength={4} value={setupPin} onChange={e=>setSetupPin(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="PIN 4 chiffres" aria-label="Nouveau code PIN"/><button className="v5-btn v5-btn--ghost" disabled={busy||setupPin.length!==4} onClick={()=>void changePin()}><KeyRound size={16}/> Activer</button></div>:null}
   </div></header>
   {error&&<div role="alert" className="v5-alert v5-alert--danger"><CircleAlert size={18}/><span>{error}</span><button aria-label="Fermer" onClick={()=>setError('')}><X size={16}/></button></div>}
   {page==='caisse'&&<>
    <div className="v5-scan"><ScanBarcode size={22}/><input ref={scanRef} autoFocus placeholder="Scannez ou tapez une référence (F2)" value={scan} onChange={e=>setScan(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')barcode();if(e.key==='Escape')setScan('')}}/><button className="v5-btn v5-btn--primary" onClick={barcode}><Plus size={18}/> Ajouter</button></div>
    {low.length>0&&boot.role!=='DEMO'&&<button className="v5-low" onClick={()=>navigate('stock')}><TriangleAlert size={17}/><span><b>{low.filter(p=>p.stock===0).length} en rupture</b> · {low.length} stock(s) faible(s)</span><ChevronRight size={16}/></button>}
    <div className="v5-filters"><label className="v5-search"><Search size={17}/><input placeholder="Chercher un produit…" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button aria-label="Effacer" onClick={()=>setSearch('')}><X size={15}/></button>}</label>
     <div className="v5-seg" role="group" aria-label="Tarif" title={entries.length>0?'Videz le panier pour changer de tarif':'Tarif appliqué au panier'}>
      <button aria-pressed={priceMode==='RETAIL'} disabled={busy||!!saleRef||entries.length>0} onClick={()=>setPriceMode('RETAIL')}>Détail</button>
      <button aria-pressed={priceMode==='WHOLESALE'} disabled={busy||!!saleRef||entries.length>0} onClick={()=>setPriceMode('WHOLESALE')}>Gros</button></div></div>
    <div className="v5-chips">{categories.map(x=><button key={x} aria-pressed={x===category} onClick={()=>setCategory(x)}>{x}<small>{x==='Tous'?products.length:products.filter(p=>(p.category||'Autres')===x).length}</small></button>)}</div>
    {visible.length===0?<div className="v5-empty"><PackageSearch size={40}/><h3>Aucun produit</h3><p>Essayez un autre mot ou une autre catégorie.</p></div>:
    <section className="v5-products">{visible.map(p=>{const inCart=cart[p.id]||0;return <button key={p.id} disabled={p.stock<=0||busy||!!saleRef} className={'v5-product'+(inCart?' is-in-cart':'')} onClick={()=>add(p.id,1)}>
     {inCart>0&&<span className="v5-product-qty">{inCart}</span>}
     <span className="v5-product-cat">{p.category||'Autres'}</span><strong>{p.name}</strong><small className="v5-mono">{p.sku}</small>
     <span className="v5-product-foot"><b>{money(priceFor(p))}</b><span className={'v5-stock '+(p.stock===0?'is-out':p.stock<=(p.minStock??5)?'is-low':'')}>{p.stock===0?'Rupture':p.stock}</span></span>
     {priceMode==='RETAIL'&&p.wholesalePrice!=null&&<small className="v5-product-alt">Gros {money(p.wholesalePrice)}</small>}{priceMode==='WHOLESALE'&&<small className="v5-product-alt">Détail {money(p.price)}</small>}
    </button>})}</section>}
   </>}
   {page==='produits'&&<section className="v5-card"><label className="v5-search v5-search--panel"><Search size={17}/><input placeholder="Chercher par nom ou référence" value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="v5-table-wrap"><table className="v5-table"><thead><tr><th>Produit</th><th>Référence</th><th>Catégorie</th><th className="num">Prix détail</th><th className="num">Prix gros</th><th className="num">Disponible</th></tr></thead><tbody>{products.filter(p=>(p.name+' '+p.sku).toLowerCase().includes(search.toLowerCase())).map(p=><tr key={p.id}><td><b>{p.name}</b></td><td className="v5-mono">{p.sku}</td><td>{p.category||'—'}</td><td className="num">{money(p.price)}</td><td className="num">{p.wholesalePrice===undefined||p.wholesalePrice===null?'—':money(p.wholesalePrice)}</td><td className="num"><span className={'v5-stock '+(p.stock===0?'is-out':p.stock<=(p.minStock??5)?'is-low':'')}>{p.stock}</span></td></tr>)}</tbody></table></div></section>}
   {page==='stock'&&<section className="v5-card"><div className="v5-kpis"><div className="v5-kpi is-danger"><span>En rupture</span><b>{products.filter(p=>p.stock===0).length}</b></div><div className="v5-kpi is-warning"><span>Stock faible</span><b>{products.filter(p=>p.stock>0&&p.stock<=(p.minStock??5)).length}</b></div><div className="v5-kpi"><span>Articles</span><b>{products.length}</b></div></div>
    <div className="v5-table-wrap"><table className="v5-table"><thead><tr><th>Produit</th><th>Référence</th><th className="num">Disponible</th><th>État</th></tr></thead><tbody>{[...products].sort((a,b)=>a.stock-b.stock).map(p=><tr key={p.id}><td><b>{p.name}</b></td><td className="v5-mono">{p.sku}</td><td className="num"><b>{p.stock}</b></td><td>{p.stock===0?<Chip tone="danger">Rupture</Chip>:p.stock<=(p.minStock??5)?<Chip tone="warning">Stock faible</Chip>:<Chip tone="ok">Disponible</Chip>}</td></tr>)}</tbody></table></div></section>}
   {page==='clients'&&<section className="v5-card">
    <h2 className="v5-card-title"><UserPlus size={19}/> Nouveau client</h2>
    <div className="v5-form-row">
     <label className="v5-field"><span>Nom ou société *</span><input placeholder="Nom du client" value={newClientName} onChange={e=>setNewClientName(e.target.value)} maxLength={120}/></label>
     <label className="v5-field"><span>Téléphone</span><input placeholder="+216 …" value={newClientPhone} onChange={e=>setNewClientPhone(e.target.value)} maxLength={30}/></label>
     <label className="v5-field"><span>Adresse</span><input placeholder="Facultatif" value={newClientAddress} onChange={e=>setNewClientAddress(e.target.value)} maxLength={220}/></label>
     <button className="v5-btn v5-btn--primary" disabled={busy||boot.role==='DEMO'||newClientName.trim().length<2} onClick={()=>void createClient()}><Plus size={17}/> Ajouter</button>
    </div>
    <h2 className="v5-card-title">Clients <small>{boot.customers.length}</small></h2>
    {boot.customers.length===0?<Empty icon={Users} title="Aucun client" text="Ajoutez votre premier client ci-dessus."/>:
    <div className="v5-table-wrap"><table className="v5-table"><thead><tr><th>Client</th><th className="act"></th></tr></thead><tbody>
    {boot.customers.map(c=><tr key={c.id}><td><b>{c.name}</b></td><td className="act"><button className="v5-btn v5-btn--soft v5-btn--sm" onClick={()=>{setCustomerId(c.id);setPage('caisse')}}><ShoppingCart size={15}/> Vendre</button></td></tr>)}
    </tbody></table></div>}</section>}
   {page==='commandes'&&<section><div className="v5-section-head"><p>Mise à jour automatique toutes les 20 secondes.</p><button className="v5-btn v5-btn--ghost v5-btn--sm" onClick={()=>void load('commandes')}><RefreshCw size={15}/> Actualiser</button></div>
    {orders.length===0?<div className="v5-card"><Empty icon={Inbox} title="Aucune commande en attente" text="Les commandes des ateliers arrivent ici."/></div>:
    <div className="v5-orders">{orders.map(o=><article className="v5-card v5-order" key={o.id} data-status={o.status}><header><div><strong>{o.customer}</strong><small>{new Date(o.createdAt).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})}</small></div><StatusChip status={o.status}/></header>
     <ul>{o.items.map((i,n)=><li key={n}><span>{i.name}<small className="v5-mono">{i.sku}</small></span><b>× {i.quantity}</b></li>)}</ul>
     {['PENDING','CONFIRMED','PREPARING'].includes(o.status)?<button className="v5-btn v5-btn--primary" disabled={busy} onClick={()=>void orderTransition(o)}>{o.status==='PENDING'?<><Check size={17}/> Confirmer</>:o.status==='CONFIRMED'?<><PackageOpen size={17}/> Commencer la préparation</>:<><Truck size={17}/> Prête pour le livreur</>}</button>:<p className="v5-order-wait"><Truck size={16}/> En attente du livreur</p>}</article>)}</div>}</section>}
   {page==='dettes'&&<section className="v5-stack">
    {debtPending&&<Risk title="Versement à vérifier" text={debtPending.reference+' · '+money(debtPending.amount)}><button className="v5-btn v5-btn--soft v5-btn--sm" disabled={busy} onClick={()=>void verify('debt',debtPending.reference)}>Vérifier</button><button className="v5-btn v5-btn--ghost v5-btn--sm" disabled={busy||!debtPending.customerId} onClick={()=>void debtPay(debtPending)}>Renvoyer le même paiement</button></Risk>}
    <div className="v5-kpis"><div className="v5-kpi is-warning"><span>Total dû par les clients</span><b>{money(customerDebts.reduce((t,c)=>t+c.due,0))}</b></div><div className="v5-kpi"><span>Clients avec dette</span><b>{customerDebts.length}</b></div></div>
    <div className="v5-card"><h2 className="v5-card-title"><HandCoins size={19}/> Encaisser un versement</h2><p className="v5-hint">La somme règle d’abord les factures les plus anciennes.</p>
     <div className="v5-form-row">
      <label className="v5-field v5-field--wide"><span>Client</span><select disabled={busy||!!debtPending} value={clientDebtId} onChange={e=>setClientDebtId(e.target.value)}>
       <option value="">Choisir le client</option>{customerDebts.map(c=><option key={c.customerId} value={c.customerId}>{c.customer} · {money(c.due)} ({c.invoices} facture{c.invoices>1?'s':''})</option>)}
      </select></label>
      <label className="v5-field"><span>Montant (DT)</span><input disabled={busy||!!debtPending} type="number" min=".001" step=".001" value={debtAmount} onChange={e=>setDebtAmount(e.target.value)} placeholder="0,000"/></label>
      <MethodSeg value={debtMethod} onChange={setDebtMethod} disabled={busy||!!debtPending}/>
      <button className="v5-btn v5-btn--primary" disabled={busy||!!debtPending||!clientDebtId||boot.role==='DEMO'} onClick={()=>void debtPay()}><Check size={17}/> Encaisser</button>
     </div></div>
    <div className="v5-card">{customerDebts.length===0?<Empty icon={HandCoins} title="Aucune dette" text="Tous les clients sont à jour."/>:<div className="v5-table-wrap"><table className="v5-table"><thead><tr><th>Client</th><th>Téléphone</th><th className="num">Factures</th><th className="num">Dette</th><th className="act"></th></tr></thead><tbody>
    {customerDebts.map(c=><tr key={c.customerId} className={clientDebtId===c.customerId?'is-selected':''}><td><b>{c.customer}</b></td><td>{c.phone||'—'}</td><td className="num">{c.invoices}</td><td className="num"><b className="v5-due-amount">{money(c.due)}</b></td>
     <td className="act"><button className="v5-btn v5-btn--soft v5-btn--sm" disabled={busy||!!debtPending} onClick={()=>{setClientDebtId(c.customerId);setDebtAmount(String(c.due))}}>Recevoir</button></td></tr>)}
    </tbody></table></div>}</div></section>}
   {page==='retours'&&<section className="v5-stack">
    <div className="v5-card"><h2 className="v5-card-title"><Search size={19}/> Retrouver la vente</h2>
    <TicketSearchV4 query={ticketQuery} from={ticketFrom} to={ticketTo} busy={busy} results={ticketMatches}
     onQuery={setTicketQuery} onFrom={setTicketFrom} onTo={setTicketTo} onSearch={()=>void searchTickets()}
     onPrint={showTicket} onReturn={x=>void selectReturnFromTicket(x)}/></div>
    {returnPending&&<Risk title="Avoir à vérifier" text={returnPending.reference}><button className="v5-btn v5-btn--soft v5-btn--sm" onClick={()=>void verify('return',returnPending.reference)}>Vérifier dans FIXI</button><button className="v5-btn v5-btn--ghost v5-btn--sm" onClick={()=>void returnPay(returnPending)}>Renvoyer le même retour</button></Risk>}
    {canRefund?<div className="v5-card"><h2 className="v5-card-title"><Undo2 size={19}/> Retour et avoir</h2>
     <div className="v5-form-row"><label className="v5-field v5-field--wide"><span>Vente d’origine</span><select disabled={!!returnPending} value={returnSale} onChange={e=>{setReturnSale(e.target.value);setReturnQty({})}}><option value="">Choisir la vente</option>{sources.map(s=><option key={s.id} value={s.id}>{s.reference} · {money(s.total)}</option>)}</select></label></div>
     {returnSale&&<div className="v5-return-lines">{sources.find(s=>s.id===returnSale)?.items.map(i=><div key={i.id} className={'v5-return-line'+((returnQty[i.id]||0)>0?' is-on':'')}><span><b>{i.name}</b><small>{i.remaining} retournable(s) · {money(i.unitPrice)}</small></span>
      <Stepper value={returnQty[i.id]||0} max={i.remaining} onChange={v=>setReturnQty(q=>({...q,[i.id]:v}))}/></div>)}</div>}
     <div className="v5-form-row">
      <div className="v5-field v5-field--wide"><span>État du produit</span><div className="v5-seg v5-seg--block" role="group"><button aria-pressed={!returnDamage} title="Remis en stock" onClick={()=>setReturnDamage(false)}>Bon état</button><button aria-pressed={returnDamage} title="Mis de côté, hors stock" onClick={()=>setReturnDamage(true)}>Endommagé</button></div></div>
      <label className="v5-field"><span>Motif</span><input value={returnNote} onChange={e=>setReturnNote(e.target.value)}/></label>
      <label className="v5-field"><span>Remboursement (DT)</span><input type="number" min="0" step=".001" value={refund} onChange={e=>setRefund(e.target.value)}/></label>
      <MethodSeg value={refundMethod} onChange={setRefundMethod}/>
      <button disabled={busy||!returnSale||!!returnPending} className="v5-btn v5-btn--primary" onClick={()=>void returnPay()}><Check size={17}/> Confirmer le retour</button></div></div>:
     <div className="v5-alert v5-alert--info"><ShieldCheck size={18}/><span>Seuls le propriétaire, l’administrateur ou le responsable peuvent enregistrer un retour.</span></div>}
    <div className="v5-card"><h2 className="v5-card-title">Avoirs précédents</h2>{credits.length===0?<Empty icon={Undo2} title="Aucun avoir" text="Les retours enregistrés apparaîtront ici."/>:<div className="v5-table-wrap"><table className="v5-table"><thead><tr><th>Avoir</th><th>Vente</th><th className="num">Montant</th><th className="num">Remboursé</th><th>État</th></tr></thead><tbody>{credits.map(x=><tr key={x.id}><td className="v5-mono"><b>{x.reference}</b></td><td className="v5-mono">{x.sourceRef}</td><td className="num">{money(x.total)}</td><td className="num">{money(x.refund)}</td><td><StatusChip status={x.status}/></td></tr>)}</tbody></table></div>}</div></section>}
   {page==='historique'&&<section className="v5-stack">
    <div className="v5-card"><h2 className="v5-card-title"><Search size={19}/> Rechercher un ticket</h2>
    <TicketSearchV4 query={ticketQuery} from={ticketFrom} to={ticketTo} busy={busy} results={ticketMatches}
     onQuery={setTicketQuery} onFrom={setTicketFrom} onTo={setTicketTo} onSearch={()=>void searchTickets()}
     onPrint={showTicket} onReturn={x=>{setPage('retours');void selectReturnFromTicket(x)}}/></div>
    <div className="v5-card"><div className="v5-card-head"><h2 className="v5-card-title">Dernières ventes</h2>{ticket&&<button className="v5-btn v5-btn--soft v5-btn--sm" disabled={busy} onClick={printTicket}><Printer size={15}/> Réimprimer {ticket.reference}</button>}</div>
    {!history?.sales.length?<Empty icon={ReceiptText} title="Aucune vente" text="Les ventes de la caisse apparaîtront ici."/>:<div className="v5-table-wrap"><table className="v5-table"><thead><tr><th>Référence</th><th>Date</th><th className="num">Total</th><th className="num">Payé</th><th>État</th></tr></thead><tbody>
    {history.sales.map(x=><tr key={x.id}><td className="v5-mono"><b>{x.reference}</b></td><td>{new Date(x.createdAt).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})}</td><td className="num">{money(x.total)}</td><td className="num">{money(x.paid)}</td><td><StatusChip status={x.status}/></td></tr>)}
    </tbody></table></div>}</div></section>}
   {page==='session'&&<section className="v5-stack">{(()=>{const open=history?.sessions.find(s=>s.status==='OPEN');return <div className={'v5-session '+(open?'is-open':'is-closed')}><span className="v5-session-icon">{open?<LockOpen size={24}/>:<Lock size={24}/>}</span><div><b>{open?'Caisse ouverte':'Caisse fermée'}</b><small>{open?'Depuis le '+new Date(open.openedAt).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'}):'Ouvrez la caisse avant d’encaisser des espèces.'}</small></div></div>})()}
    <div className="v5-card"><h2 className="v5-card-title"><Wallet size={19}/> Ouvrir ou clôturer</h2><div className="v5-form-row"><label className="v5-field"><span>Montant compté (DT)</span><input type="number" min="0" step=".001" value={cashAmount} onChange={e=>setCashAmount(e.target.value)} placeholder="0,000"/></label><label className="v5-field v5-field--wide"><span>Observation</span><input value={cashNote} onChange={e=>setCashNote(e.target.value)} placeholder="Facultatif"/></label>
     <button className="v5-btn v5-btn--primary" disabled={busy} onClick={()=>void cash('CASH_OPEN')}><LockOpen size={17}/> Ouvrir</button><button className="v5-btn v5-btn--ghost" disabled={busy} onClick={()=>void cash('CASH_CLOSE')}><Lock size={17}/> Clôturer</button></div></div>
    <div className="v5-card"><h2 className="v5-card-title">Dernières sessions</h2>{!history?.sessions.length?<Empty icon={Wallet} title="Aucune session" text="Les ouvertures et clôtures apparaîtront ici."/>:<div className="v5-table-wrap"><table className="v5-table"><thead><tr><th>Ouverture</th><th>Clôture</th><th>État</th></tr></thead><tbody>{history.sessions.map(x=><tr key={x.id}><td>{new Date(x.openedAt).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})}</td><td>{x.closedAt?new Date(x.closedAt).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'}):'—'}</td><td><StatusChip status={x.status}/></td></tr>)}</tbody></table></div>}</div></section>}
   {page==='livreurs'&&<section className="v5-stack">
    {courierShifts.filter(s=>s.status==='PENDING_CASHIER').length===0?<div className="v5-card"><Empty icon={Truck} title="Aucune recette en attente" text="Quand un livreur termine sa tournée, sa remise apparaît ici."/></div>:
    <div className="v5-shifts">{courierShifts.filter(s=>s.status==='PENDING_CASHIER').map(x=><button key={x.id} className={'v5-card v5-shift'+(selectedShift===x.id?' is-selected':'')} disabled={busy} onClick={()=>{setSelectedShift(x.id);setCourierAmount(String(x.expectedCod??''))}}><Truck size={20}/><span><b>{x.driver?.fullName||'Livreur'}</b><small>Déclaré {money(Number(x.declaredRemit||0))}</small></span><span className="v5-shift-amount"><small>Attendu</small><b>{money(Number(x.expectedCod||0))}</b></span></button>)}</div>}
    {selectedShift&&(()=>{const sh=courierShifts.find(x=>x.id===selectedShift);const diff=Number(courierAmount)-Number(sh?.expectedCod||0);return <div className="v5-card"><h2 className="v5-card-title"><HandCoins size={19}/> Recette de {sh?.driver?.fullName||'livreur'}</h2><div className="v5-form-row">
     <label className="v5-field"><span>Montant reçu (DT)</span><input min="0" step=".001" type="number" disabled={busy} value={courierAmount} onChange={e=>setCourierAmount(e.target.value)}/></label>
     <label className="v5-field v5-field--wide"><span>Raison de l’écart{Number.isFinite(diff)&&Math.abs(diff)>=.001?' *':''}</span><input value={courierNote} disabled={busy} onChange={e=>setCourierNote(e.target.value)} placeholder="Obligatoire si le montant est différent"/></label>
     <button className="v5-btn v5-btn--primary" disabled={busy||boot.role==='DEMO'} onClick={()=>void closeCourierShift()}><Check size={17}/> Clôturer la recette</button></div>
     {Number.isFinite(diff)&&Math.abs(diff)>=.001&&<p className={'v5-diff '+(diff<0?'is-neg':'is-pos')}>Écart : {diff>0?'+':''}{money(diff)}</p>}</div>})()}
    <div className="v5-card"><h2 className="v5-card-title">Remises livreurs</h2>{courierShifts.length===0?<Empty icon={Truck} title="Aucune remise" text="L’historique des remises apparaîtra ici."/>:<div className="v5-table-wrap"><table className="v5-table"><thead><tr><th>Livreur</th><th className="num">Déclaré</th><th className="num">Attendu</th><th>État</th></tr></thead><tbody>{courierShifts.map(x=><tr key={x.id}><td><b>{x.driver?.fullName||'Livreur'}</b></td>
    <td className="num">{money(Number(x.declaredRemit||0))}</td><td className="num">{money(Number(x.expectedCod||0))}</td><td><StatusChip status={x.status}/></td></tr>)}</tbody></table></div>}</div>
   </section>}
  </main>
  {page==='caisse'&&<aside className="v5-basket" aria-label="Panier">
   <div className="v5-basket-head"><h2><ShoppingCart size={20}/> Panier</h2><span className="v5-count">{cartCount} article{cartCount>1?'s':''}</span>{entries.length>0&&!saleRef&&<button className="v5-icon-btn" title="Vider le panier" aria-label="Vider le panier" disabled={busy} onClick={()=>{if(window.confirm('Supprimer ce panier non payé ?')){localClearSale();setGivenCash('');setMessage('Panier vidé.')}}}><Trash2 size={17}/></button>}</div>
   {saleRef&&<Risk title="Vente à vérifier" text={saleRef}><button className="v5-btn v5-btn--soft v5-btn--sm" disabled={busy} onClick={()=>void verify('sale',saleRef)}>Vérifier la vente</button><button className="v5-btn v5-btn--ghost v5-btn--sm" disabled={busy} onClick={()=>void sale(true)}>Renvoyer</button></Risk>}
   <div className="v5-basket-items">{entries.length?entries.map(e=><div className="v5-line" key={e.product.id}><div className="v5-line-info"><strong>{e.product.name}</strong><small>{money(priceFor(e.product))} l’unité</small></div>
    <Stepper value={e.quantity} max={e.product.stock} disabled={busy||!!saleRef} onChange={v=>add(e.product.id,v-e.quantity)}/>
    <b className="v5-line-total">{money(e.quantity*priceFor(e.product))}</b></div>):<div className="v5-empty v5-empty--basket"><ScanBarcode size={40}/><h3>Panier vide</h3><p>Scannez un article ou touchez un produit.</p></div>}</div>
   <div className="v5-basket-foot">
    <div className="v5-client-row"><label className="v5-field v5-field--inline"><span><UserRound size={15}/> Client</span><select disabled={busy||!!saleRef} value={customerId} onChange={e=>setCustomerId(e.target.value)}><option value="">Vente comptoir</option>{boot.customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button className="v5-icon-btn" title="Nouveau client" aria-label="Nouveau client" disabled={busy||!!saleRef} onClick={()=>setPage('clients')}><UserPlus size={17}/></button></div>
    <MethodSeg value={method} onChange={v=>{setMethod(v);if(v!=='CASH')setGivenCash('')}} disabled={busy||!!saleRef}/>
    <div className="v5-total"><span>Total <small>{priceMode==='WHOLESALE'?'tarif gros':'tarif détail'}</small></span><strong>{money(total)}</strong></div>
    <div className="v5-pay-grid"><label className="v5-field"><span>Payé maintenant</span><input disabled={busy||!!saleRef||!entries.length} min="0" max={total} step=".001" type="number" placeholder={total.toFixed(3)} value={paid} onChange={e=>setPaid(e.target.value)}/></label>
     {method==='CASH'&&<label className="v5-field"><span>Le client donne</span><input disabled={busy||!!saleRef||!entries.length} min="0" step=".5" type="number" placeholder="Espèces reçues" value={givenCash} onChange={e=>setGivenCash(e.target.value)}/></label>}</div>
    {method==='CASH'&&entries.length>0&&!saleRef&&<div className="v5-quick">{quickCash.map(v=><button key={v} onClick={()=>setGivenCash(String(v))}>{v} DT</button>)}</div>}
    {change!==null&&<div className={'v5-change '+(change<0?'is-neg':'')}><span>{change<0?'Il manque':'Monnaie à rendre'}</span><strong>{money(Math.abs(change))}</strong></div>}
    {due>0&&<div className="v5-due"><span>Reste dû {customerId?'(crédit client)':'— choisissez un client'}</span><strong>{money(due)}</strong></div>}
    <button disabled={busy||!!saleRef||!entries.length||boot.role==='DEMO'} className="v5-btn v5-btn--primary v5-pay" onClick={()=>void sale()}>{busy?'Enregistrement…':<><Check size={20}/> Encaisser {entries.length?money(total):''}<kbd>F9</kbd></>}</button>
    {ticket&&<button className="v5-btn v5-btn--ghost v5-btn--sm" onClick={printTicket}><Printer size={15}/> Réimprimer le dernier ticket</button>}{receiptWarning&&<p className="v5-hint">{receiptWarning}</p>}
   </div>
  </aside>}
  {message&&<div role="status" className="v5-toast"><CircleCheck size={18}/><span>{message}</span><button aria-label="Fermer" onClick={()=>setMessage('')}><X size={15}/></button></div>}
  {labels&&<WindowsLabelStudio products={products} companyName={boot.companyName} onClose={()=>setLabels(false)}/>}
  {locked&&<div className="v5-lock"><form onSubmit={unlock} className="v5-card v5-lock-card"><div className="v5-mark v5-mark--xl">F</div><h2>Caisse verrouillée</h2><p>{boot.companyName} · code PIN</p><PinPad value={lockPin} onChange={setLockPin} autoFocus/><button className="v5-btn v5-btn--primary v5-btn--lg" disabled={lockPin.length!==4}><LockOpen size={18}/> Déverrouiller</button>{error&&<p className="v5-alert v5-alert--danger">{error}</p>}</form></div>}
  <TicketPrint ticket={ticket}/>
 </div>;
}
const statusMap:Record<string,[string,'ok'|'warning'|'danger'|'info'|'muted'|'brand']>={
 PENDING:['Nouvelle','brand'],CONFIRMED:['Confirmée','info'],PREPARING:['En préparation','warning'],READY_FOR_DELIVERY:['Prête','ok'],OUT_FOR_DELIVERY:['En livraison','info'],DELIVERED:['Livrée','ok'],CANCELLED:['Annulée','muted'],RETURNED:['Retournée','muted'],
 PAID:['Payée','ok'],PARTIAL:['Partielle','warning'],UNPAID:['Non payée','danger'],COMPLETED:['Terminée','ok'],REFUNDED:['Remboursé','ok'],ISSUED:['Émis','info'],
 OPEN:['Ouverte','ok'],CLOSED:['Clôturée','muted'],PENDING_CASHIER:['À clôturer','brand'],SUBMITTED:['Déclarée','info']};
const roleLabel:Record<string,string>={OWNER:'Propriétaire',ADMIN:'Administrateur',MANAGER:'Responsable',SALES:'Vendeur',CASHIER:'Caissier'};
function Chip({tone,children}:{tone:string;children:React.ReactNode}){return <span className={'v5-chip is-'+tone}>{children}</span>}
function StatusChip({status}:{status:string}){const [l,t]=statusMap[status]||[status.replace(/_/g,' ').toLowerCase(),'muted'];return <Chip tone={t}>{l}</Chip>}
function Empty({icon:I,title,text}:{icon:React.ComponentType<{size?:number}>;title:string;text:string}){return <div className="v5-empty"><I size={36}/><h3>{title}</h3><p>{text}</p></div>}
function Risk({title,text,children}:{title:string;text:string;children:React.ReactNode}){return <div className="v5-risk"><TriangleAlert size={19}/><div><strong>{title}</strong><p className="v5-mono">{text}</p><div className="v5-risk-actions">{children}</div></div></div>}
function Stepper({value,max,onChange,disabled}:{value:number;max:number;onChange:(v:number)=>void;disabled?:boolean}){return <div className="v5-stepper"><button type="button" aria-label="Moins" disabled={disabled||value<=0} onClick={()=>onChange(Math.max(0,value-1))}><Minus size={15}/></button><span>{value}</span><button type="button" aria-label="Plus" disabled={disabled||value>=max} onClick={()=>onChange(Math.min(max,value+1))}><Plus size={15}/></button></div>}
function MethodSeg({value,onChange,disabled}:{value:string;onChange:(v:string)=>void;disabled?:boolean}){return <div className="v5-seg v5-seg--method" role="group" aria-label="Moyen de paiement">{([['CASH','Espèces',Banknote],['CARD','Carte',CreditCard],['TRANSFER','Virement',Landmark]] as const).map(([v,l,I])=><button type="button" key={v} aria-pressed={value===v} disabled={disabled} onClick={()=>onChange(v)}><I size={16}/> {l}</button>)}</div>}
function PinPad({value,onChange,autoFocus}:{value:string;onChange:(v:string)=>void;autoFocus?:boolean}){
 const press=(d:string)=>onChange((value+d).slice(0,4));
 return <div className="v5-pinpad"><input className="v5-pin-input" autoFocus={autoFocus} type="password" inputMode="numeric" maxLength={4} value={value} onChange={e=>onChange(e.target.value.replace(/\D/g,'').slice(0,4))} aria-label="Code PIN"/>
  <div className="v5-pin-dots" aria-hidden>{[0,1,2,3].map(i=><i key={i} className={i<value.length?'is-on':''}/>)}</div>
  <div className="v5-keys">{['1','2','3','4','5','6','7','8','9'].map(d=><button type="button" key={d} onClick={()=>press(d)}>{d}</button>)}<button type="button" aria-label="Effacer" onClick={()=>onChange(value.slice(0,-1))}><Delete size={20}/></button><button type="button" onClick={()=>press('0')}>0</button><button type="button" aria-label="Tout effacer" onClick={()=>onChange('')}><X size={20}/></button></div></div>}
createRoot(document.getElementById('root')!).render(<App/>);
