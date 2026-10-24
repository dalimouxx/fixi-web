import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {invoke} from '@tauri-apps/api/core';
import './style.css';
import {WindowsLabelStudio} from './labels';

type Product={id:string;name:string;sku:string;barcode?:string|null;category:string|null;price:number;stock?:number};
type Customer={id:string;name:string};
type Bootstrap={companyName:string;role:string;products:Product[];customers:Customer[];pinConfigured?:boolean};
type ReturnsData={sales:{id:string;reference:string;createdAt:string;total:number;items:{id:string;name:string;sku:string|null;quantity:number;remaining?:number;unitPrice:number}[]}[];returns:{id:string;reference:string;sourceRef:string|null;createdAt:string;total:number;refund:number;status:string;note:string|null}[]};
type PendingReturn={reference:string;sourceSaleId:string;items:{saleItemId:string;quantity:number;restock:boolean;condition:string;reason:string}[];refund:number;refundMethod:'CASH';note:string};
type PendingDebt={reference:string;saleId:string;amount:number;method:'CASH'|'CARD'|'TRANSFER'};
type OperationStatus={exists:boolean;kind:string;reference:string;record?:{id:string;remaining?:number}|null};
type Debts={debts:{id:string;reference:string;createdAt:string;customer:string;total:number;paid:number;due:number;status:string}[]};
type OnlineOrders={orders:{id:string;status:string;createdAt:string;customer:string;items:{name:string;sku:string;quantity:number}[]}[]};
type History={sales:{id:string;reference:string;createdAt:string;status:string;total:number;paid:number;customerId:string|null}[];sessions:{id:string;status:string;openedAt:string;closedAt:string|null}[]};
const sample:Product[]=[
{id:'p1',name:'Écran iPhone 11',sku:'IP11-ECR',category:'Écrans',price:85},
{id:'p2',name:'Batterie Samsung A52',sku:'SA52-BAT',category:'Batteries',price:39},
{id:'p3',name:'Câble USB-C 1m',sku:'CAB-C-1M',category:'Accessoires',price:12.5},
{id:'p4',name:'Vitre iPhone 13',sku:'IP13-VIT',category:'Écrans',price:27},
{id:'p5',name:'Chargeur rapide 25W',sku:'CHA-25W',category:'Accessoires',price:32},
{id:'p6',name:'Coque Samsung S24',sku:'S24-COQ',category:'Coques',price:20}
];
const draftKey=(server:string,login:string)=>'fixi:windows-pos:draft:v1:'+encodeURIComponent(server.trim().toLowerCase())+':'+encodeURIComponent(login.trim().toLowerCase());
const dt=(v:number)=>new Intl.NumberFormat('fr-TN',{minimumFractionDigits:3,maximumFractionDigits:3}).format(v)+' DT';
function App(){
 const scanRef=useRef<HTMLInputElement>(null);
 const [deviceProfile,setDeviceProfile]=useState<{configured:boolean;server?:string;login?:string}|null>(null);
 const [showPasswordLogin,setShowPasswordLogin]=useState(false),[quickPin,setQuickPin]=useState('');
 const [pinConfigured,setPinConfigured]=useState(false),[pinLocked,setPinLocked]=useState(false),[pinValue,setPinValue]=useState(''),[pinError,setPinError]=useState('');
 const lastSavedRef=useRef('');
 const [draftScope,setDraftScope]=useState('');
 const [data,setData]=useState<Bootstrap|null>(null),[server,setServer]=useState(''),[login,setLogin]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[customerId,setCustomerId]=useState('');
 const [labelsOpen,setLabelsOpen]=useState(false),[ticket,setTicket]=useState<{reference:string;items:{name:string;quantity:number;price:number}[];total:number;paid:number;date:string;company:string}|null>(null);
 const [payMethod,setPayMethod]=useState<'CASH'|'CARD'|'TRANSFER'>('CASH'),[amount,setAmount]=useState(''),[saleKey,setSaleKey]=useState(''),[saleMessage,setSaleMessage]=useState('');
 const [cashAmount,setCashAmount]=useState(''),[cashNote,setCashNote]=useState(''),[cashError,setCashError]=useState(''),[cashBusy,setCashBusy]=useState(false);
 const [orderBusy,setOrderBusy]=useState('');
 const [pendingDebt,setPendingDebt]=useState<PendingDebt|null>(null);
 const [debtSelected,setDebtSelected]=useState(''),[debtAmount,setDebtAmount]=useState(''),[debtMethod,setDebtMethod]=useState<'CASH'|'CARD'|'TRANSFER'>('CASH'),[debtPaymentKey,setDebtPaymentKey]=useState(''),[debtBusy,setDebtBusy]=useState(false),[debtMessage,setDebtMessage]=useState('');
 const [pendingReturn,setPendingReturn]=useState<PendingReturn|null>(null);
 const [returnReference,setReturnReference]=useState(''),[returnUncertain,setReturnUncertain]=useState(false);
 const [returnSaleId,setReturnSaleId]=useState(''),[returnQty,setReturnQty]=useState<Record<string,number>>({}),[returnDamaged,setReturnDamaged]=useState(false),[returnRefund,setReturnRefund]=useState('0'),[returnReason,setReturnReason]=useState('Retour client'),[returnBusy,setReturnBusy]=useState(false),[returnMessage,setReturnMessage]=useState('');
 const [returnsData,setReturnsData]=useState<ReturnsData|null>(null),[returnsError,setReturnsError]=useState('');
 const [debts,setDebts]=useState<Debts|null>(null),[debtsError,setDebtsError]=useState('');
 const [onlineOrders,setOnlineOrders]=useState<OnlineOrders|null>(null),[ordersError,setOrdersError]=useState('');
 const [history,setHistory]=useState<History|null>(null),[historyError,setHistoryError]=useState('');
 const [screen,setScreen]=useState<'caisse'|'produits'|'stock'|'clients'|'historique'|'session'|'commandes'|'dettes'|'retours'>('caisse'),[scanCode,setScanCode]=useState(''),[discount,setDiscount]=useState('0');
 const [uncertainSale,setUncertainSale]=useState(false);
 const [q,setQ]=useState(''),[category,setCategory]=useState('Tous'),[cart,setCart]=useState<Record<string,number>>({});
 useEffect(()=>{void invoke<{configured:boolean;server?:string;login?:string}>('supplier_saved_profile').then(profile=>{
    setDeviceProfile(profile);
    if(profile.configured){setServer(profile.server||'');setLogin(profile.login||'');}
   }).catch(()=>setDeviceProfile({configured:false}))},[]);
 const catalog=data?.products||sample;
 const categories=['Tous',...new Set(catalog.map(p=>p.category||'Autres'))];
 const products=catalog.filter(p=>(category==='Tous'||(p.category||'Autres')===category)&&(!q||[p.name,p.sku,p.barcode||''].join(' ').toLowerCase().includes(q.toLowerCase())));
 const entries=Object.entries(cart).filter(([id,n])=>n>0&&catalog.some(p=>p.id===id)).map(([id,n])=>({product:catalog.find(p=>p.id===id)!,quantity:n}));
 const subtotal=useMemo(()=>entries.reduce((v,x)=>v+x.quantity*x.product.price,0),[entries]);
 const total=subtotal; // Discounts require server-side amount/tax support; leave disabled for safe V3.
 // Only unsent sales are kept locally, scoped to the server and supplier login.
 // Never persist credentials or a paid receipt in the draft.
 useEffect(()=>{if(!draftScope||!data)return;
  try{const draft={cart,customerId,amount,payMethod,saleKey,updatedAt:new Date().toISOString()};const encoded=JSON.stringify(draft);if(encoded!==lastSavedRef.current){localStorage.setItem(draftScope,encoded);lastSavedRef.current=encoded}}catch{setError('Impossible de sauvegarder le panier localement : vérifiez l’espace disque.')}
 },[cart,customerId,amount,payMethod,saleKey,draftScope,data]);
 useEffect(()=>{if(!draftScope)return;try{const saved=localStorage.getItem(draftScope+':debt');
   if(saved){const op=JSON.parse(saved) as PendingDebt;if(/^WINPAY-[a-f0-9-]{36}$/i.test(op.reference)&&Number.isFinite(op.amount))setPendingDebt(op)}
   else setPendingDebt(null)
  }catch{setDebtsError('Une opération locale ne peut pas être lue : contrôlez le journal FIXI avant un nouvel encaissement.')}
 },[draftScope]);
 useEffect(()=>{if(!draftScope)return;try{const saved=localStorage.getItem(draftScope+':return');
   if(saved){const op=JSON.parse(saved) as PendingReturn;if(/^WINRET-[a-f0-9-]{36}$/i.test(op.reference)){setPendingReturn(op);setReturnUncertain(true);setReturnReference(op.reference)}}
   else setPendingReturn(null)
  }catch{setReturnsError('Retour en attente illisible. Vérifiez les avoirs avant toute nouvelle validation.')}
 },[draftScope]);
 const focusScanner=()=>{if(screen==='caisse'&&!labelsOpen&&data&&!busy)scanRef.current?.focus()};
 useEffect(()=>{if(screen==='caisse'&&data&&!labelsOpen)scanRef.current?.focus()},[screen,data,labelsOpen]);
 useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if(event.key==='F2'){event.preventDefault();setScreen('caisse');scanRef.current?.focus()}};
  const onPointer=(event:PointerEvent)=>{const target=event.target as HTMLElement|null;
   if(!target||!target.closest('.app')||target.closest('input,select,textarea,[contenteditable="true"]'))return;
   // Return scanner focus after choosing a product or pressing a cashier action.
   if(screen==='caisse'&&!labelsOpen)queueMicrotask(()=>scanRef.current?.focus());
  };
  window.addEventListener('keydown',onKey);window.addEventListener('pointerup',onPointer);
  return()=>{window.removeEventListener('keydown',onKey);window.removeEventListener('pointerup',onPointer)}
 },[screen,labelsOpen]);
 function scan(){const key=scanCode.trim().toLowerCase();if(!key)return;const found=catalog.find(p=>[p.sku,p.barcode].some(v=>v?.trim().toLowerCase()===key));if(!found){setError('Code introuvable : '+scanCode)}else{change(found.id,1);setError('');setQ('');setScreen('caisse')}setScanCode('');scanRef.current?.focus()}
 const change=(id:string,d:number)=>{if(uncertainSale){setError('Vente à vérifier : consultez l’historique avant toute modification du panier.');return}setSaleKey('');setCart(old=>({...old,[id]:Math.max(0,Math.min(catalog.find(p=>p.id===id)?.stock??999999,(old[id]||0)+d))}));};
 async function checkout(){
  if(!data||data.role==='DEMO'||busy||entries.length===0||uncertainSale)return;
  const paid=amount.trim()===''?total:Number(amount);
  if(!Number.isFinite(paid)||paid<0||paid>total){setError('Montant payé invalide');return}
  if(paid<total&&!customerId){setError('Sélectionnez un client pour laisser une dette');return}
  const reference=saleKey||('WIN-'+crypto.randomUUID());setSaleKey(reference);
  // Synchronously store the reference before sending money-affecting requests.
  if(draftScope){try{localStorage.setItem(draftScope,JSON.stringify({cart,customerId,amount,payMethod,saleKey:reference,updatedAt:new Date().toISOString()}))}catch{setError('Sauvegarde locale impossible : vente annulée avant envoi');return}}
  setBusy(true);setError('');setSaleMessage('');
  try{
   const receipt={reference,items:entries.map(e=>({name:e.product.name,quantity:e.quantity,price:e.product.price})),total,paid,date:new Date().toLocaleString('fr-TN'),company:data.companyName};
   const sale=await invoke<{reference?:string}>('supplier_checkout',{sale:{reference,items:entries.map(e=>({productId:e.product.id,quantity:e.quantity})),customerId:customerId||null,method:payMethod,paid}});
   if(draftScope){try{localStorage.removeItem(draftScope);lastSavedRef.current=''}catch{}}
   setUncertainSale(false);setTicket({...receipt,reference:sale.reference||reference});setSaleMessage('Vente enregistrée : '+(sale.reference||reference));setCart({});setAmount('');setSaleKey('');setCustomerId('');
   const fresh=await invoke<Bootstrap>('supplier_refresh');setData(fresh);focusScanner();
  }catch(e){const message=String(e);setError(message);
    const definitiveRefusal=/HTTP 40[134]|non activée|désactivées|accès refusé|API Windows ventes absente|Vente refusée/i.test(message);
    if(definitiveRefusal){setSaleKey('');setUncertainSale(false);}
    else {setUncertainSale(true);setError(message+' — Opération à vérifier avant toute nouvelle tentative. Référence : '+reference)}
   }finally{setBusy(false)}
 }
 async function setupPin(){setPinError('');try{await invoke('pin_setup',{pin:pinValue});setPinConfigured(true);setDeviceProfile({configured:true,server,login});setPinValue('')}catch(e){setPinError(String(e))}}
 async function lockPin(){setPinError('');try{await invoke('pin_lock');setPinLocked(true);setPinValue('')}catch(e){setPinError(String(e))}}
 async function unlockPin(e:React.FormEvent){e.preventDefault();setPinError('');try{await invoke('pin_unlock',{pin:pinValue});setPinLocked(false);setPinValue('');scanRef.current?.focus()}catch(e){setPinError(String(e));setPinValue('')}}
 function acceptLogin(next:Bootstrap,origin:string,username:string){
  const key=draftKey(origin,username);let restored:Record<string,number>={};let savedCustomer='';let savedAmount='';let savedMethod:'CASH'|'CARD'|'TRANSFER'='CASH';let restoredSaleKey='';
  try{const raw=localStorage.getItem(key);if(raw){const draft=JSON.parse(raw);if(draft&&typeof draft.cart==='object'&&!Array.isArray(draft.cart)){for(const [id,qty] of Object.entries(draft.cart)){const product=next.products.find(p=>p.id===id);if(product&&Number.isInteger(qty)&&Number(qty)>0)restored[id]=Math.min(Number(qty),product.stock??999999)}}if(typeof draft.customerId==='string'&&next.customers.some(c=>c.id===draft.customerId))savedCustomer=draft.customerId;if(typeof draft.amount==='string')savedAmount=draft.amount;if(['CASH','CARD','TRANSFER'].includes(draft.payMethod))savedMethod=draft.payMethod;if(typeof draft.saleKey==='string'&&/^WIN-[a-f0-9-]{36}$/i.test(draft.saleKey))restoredSaleKey=draft.saleKey}}catch{setError('Ancien panier local illisible : une nouvelle session est ouverte.')}
  lastSavedRef.current='';setUncertainSale(Boolean(restoredSaleKey));setSaleKey(restoredSaleKey);setPinConfigured(Boolean(next.pinConfigured));setPinLocked(false);setData(next);setDraftScope(key);setCart(restored);setCustomerId(savedCustomer);setAmount(savedAmount);setPayMethod(savedMethod);setCategory('Tous');setPassword('');setScreen('caisse')
 }
 async function connect(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');
  try{const next=await invoke<Bootstrap>('supplier_login',{server,login,password});acceptLogin(next,server,login);
   setDeviceProfile(next.pinConfigured?{configured:true,server,login}:{configured:false});setShowPasswordLogin(false)}
  catch(e){setError(String(e))}finally{setBusy(false)}
 }
 async function connectPin(e:React.FormEvent){e.preventDefault();if(!deviceProfile?.configured)return;
  setBusy(true);setError('');
  try{const next=await invoke<Bootstrap>('supplier_pin_login',{pin:quickPin});
   acceptLogin({...next,pinConfigured:true},deviceProfile.server||'',deviceProfile.login||'');setQuickPin('');setPinConfigured(true)}
  catch(e){setError(String(e));setQuickPin('')}finally{setBusy(false)}
 }
 async function refresh(){setBusy(true);setError('');try{const next=await invoke<Bootstrap>('supplier_refresh');setData(next)}catch(e){setError(String(e))}finally{setBusy(false)}}
 async function cashAction(action:'CASH_OPEN'|'CASH_CLOSE'){if(!data||data.role==='DEMO')return;const n=Number(cashAmount);if(cashAmount.trim()===''||!Number.isFinite(n)||n<0){setCashError('Saisissez un montant valide');return}if(action==='CASH_CLOSE'&&!cashNote.trim()){setCashError('Indiquez une observation pour la clôture');return}setCashBusy(true);setCashError('');try{await invoke('supplier_cash_action',{operation:{action,[action==='CASH_OPEN'?'openingAmount':'closingAmount']:n,note:cashNote}});setCashAmount('');setCashNote('');await loadHistory()}catch(e){setCashError(String(e))}finally{setCashBusy(false)}}
 async function transitionOrder(id:string,status:'CONFIRMED'|'PREPARING'|'READY_FOR_DELIVERY'){
  if(!window.confirm('Confirmer le passage de la commande au statut '+status+' ?'))return;
  setOrderBusy(id);setOrdersError('');
  try{await invoke('supplier_order_transition',{orderId:id,status});await loadOrders()}
  catch(e){setOrdersError(String(e))}finally{setOrderBusy('')}
 }
 async function submitDebt(operation:PendingDebt){
  if(debtBusy)return;
  setDebtBusy(true);setDebtsError('');setDebtMessage('');
  try{
   const response=await invoke<{remaining:number}>('supplier_debt_payment',{payment:operation});
   if(draftScope)localStorage.removeItem(draftScope+':debt');
   setPendingDebt(null);setDebtMessage('Règlement enregistré : '+operation.reference+' · reste '+dt(response.remaining));
   setDebtPaymentKey('');setDebtAmount('');await loadDebts()
  }catch(e){
   const message=String(e);
   if(/HTTP 40[134]|désactivés|accès refusé|absente du serveur/i.test(message)){
    if(draftScope)localStorage.removeItem(draftScope+':debt');
    setPendingDebt(null);setDebtPaymentKey('');setDebtsError(message)
   }else setDebtsError(message+' — paiement à vérifier, référence conservée : '+operation.reference)
  }finally{setDebtBusy(false)}
 }
 async function collectDebt(){
  if(pendingDebt){setDebtsError('Résolvez d’abord le paiement en attente '+pendingDebt.reference);return}
  const sale=debts?.debts.find(x=>x.id===debtSelected);const n=Number(debtAmount);
  if(!sale||!Number.isFinite(n)||n<=0||n>sale.due){setDebtsError('Sélectionnez une facture et un montant inférieur au solde dû.');return}
  if(!window.confirm('Enregistrer un versement de '+dt(n)+' pour '+sale.customer+' / '+sale.reference+' ?'))return;
  const operation:PendingDebt={reference:'WINPAY-'+crypto.randomUUID(),saleId:sale.id,amount:n,method:debtMethod};
  try{if(!draftScope)throw Error('Session fournisseur non disponible');localStorage.setItem(draftScope+':debt',JSON.stringify(operation))}
  catch{setDebtsError('Sauvegarde locale du règlement impossible. Aucun paiement envoyé.');return}
  setPendingDebt(operation);setDebtPaymentKey(operation.reference);
  await submitDebt(operation)
 }
 async function verifyDebt(){
  if(!pendingDebt)return;
  setDebtBusy(true);setDebtsError('');
  try{const result=await invoke<OperationStatus>('supplier_operation_status',{kind:'debt',reference:pendingDebt.reference});
   if(result.exists){
    if(draftScope)localStorage.removeItem(draftScope+':debt');
    setDebtMessage('Paiement retrouvé sur FIXI Cloud : '+pendingDebt.reference);setPendingDebt(null);setDebtPaymentKey('');await loadDebts();
   }else setDebtsError('Aucun encaissement trouvé à cette référence. Vous pouvez renvoyer la même opération sans changer sa référence.')
  }catch(e){setDebtsError(String(e)+' — ne créez pas un autre paiement.')}
  finally{setDebtBusy(false)}
 }
 async function submitReturn(operation:PendingReturn){
  if(returnBusy)return;
  setReturnBusy(true);setReturnsError('');setReturnMessage('');
  try{
   await invoke('supplier_return_create',{request:operation});
   if(draftScope)localStorage.removeItem(draftScope+':return');
   setPendingReturn(null);setReturnUncertain(false);setReturnMessage('Avoir enregistré : '+operation.reference);
   setReturnReference('');setReturnSaleId('');setReturnQty({});setReturnRefund('0');await loadReturns()
  }catch(e){
   const message=String(e);
   if(/HTTP 40[134]|désactivés|accès refusé|absente du serveur/i.test(message)){
    if(draftScope)localStorage.removeItem(draftScope+':return');
    setPendingReturn(null);setReturnUncertain(false);setReturnReference('');setReturnsError(message)
   }else{setReturnUncertain(true);setReturnsError(message+' — retour à vérifier : '+operation.reference)}
  }finally{setReturnBusy(false)}
 }
 async function createReturn(){
  if(pendingReturn||returnUncertain){setReturnsError('Résolvez d’abord le retour en attente.');return}
  const sale=returnsData?.sales.find(x=>x.id===returnSaleId);
  if(!sale){setReturnsError('Sélectionnez une vente source.');return}
  const lines=sale.items.filter(x=>(returnQty[x.id]||0)>0).map(x=>({
    saleItemId:x.id,quantity:returnQty[x.id],restock:!returnDamaged,condition:returnDamaged?'DAMAGED':'BON',reason:returnReason
  }));
  if(!lines.length){setReturnsError('Sélectionnez au moins un article.');return}
  if(lines.some(x=>{const item=sale.items.find(i=>i.id===x.saleItemId);return !item||x.quantity>(item.remaining??item.quantity)})){setReturnsError('Quantité supérieure à la quantité retournable.');return}
  const refund=Number(returnRefund);
  if(!Number.isFinite(refund)||refund<0){setReturnsError('Remboursement invalide.');return}
  if(!window.confirm('Confirmer ce retour et son éventuel remboursement ?'))return;
  const operation:PendingReturn={reference:'WINRET-'+crypto.randomUUID(),sourceSaleId:sale.id,items:lines,refund,refundMethod:'CASH',note:returnReason};
  try{if(!draftScope)throw Error('Session absente');localStorage.setItem(draftScope+':return',JSON.stringify(operation))}
  catch{setReturnsError('Sauvegarde locale impossible : retour non envoyé.');return}
  setPendingReturn(operation);setReturnReference(operation.reference);await submitReturn(operation)
 }
 async function verifyReturn(){
  if(!pendingReturn)return;
  setReturnBusy(true);setReturnsError('');
  try{
   const result=await invoke<OperationStatus>('supplier_operation_status',{kind:'return',reference:pendingReturn.reference});
   if(result.exists){
    if(draftScope)localStorage.removeItem(draftScope+':return');
    setPendingReturn(null);setReturnUncertain(false);setReturnReference('');setReturnMessage('Avoir retrouvé dans FIXI Cloud : '+result.reference);await loadReturns()
   }else setReturnsError('Aucun avoir trouvé pour cette référence. Vous pouvez renvoyer exactement la même opération.')
  }catch(e){setReturnsError(String(e)+' — conserve la référence pour éviter les doublons.')}
  finally{setReturnBusy(false)}
 }
 async function loadReturns(){if(!data||data.role==='DEMO')return;setReturnsError('');try{setReturnsData(await invoke<ReturnsData>('supplier_returns'))}catch(e){setReturnsError(String(e))}}
 async function loadDebts(){if(!data||data.role==='DEMO')return;setDebtsError('');try{setDebts(await invoke<Debts>('supplier_debts'))}catch(e){setDebtsError(String(e))}}
 async function loadOrders(){if(!data||data.role==='DEMO')return;setOrdersError('');try{setOnlineOrders(await invoke<OnlineOrders>('supplier_orders'))}catch(e){setOrdersError(String(e))}}
 async function loadHistory(){if(!data||data.role==='DEMO')return;setHistoryError('');try{setHistory(await invoke<History>('supplier_history'))}catch(e){setHistoryError(String(e))}}
 function navigate(next:typeof screen){setScreen(next);if(next==='historique'||next==='session')void loadHistory();if(next==='commandes')void loadOrders();if(next==='dettes')void loadDebts();if(next==='retours')void loadReturns()}
 function printTicket(){if(!ticket)return;document.body.dataset.printMode='ticket';const reset=()=>{delete document.body.dataset.printMode};window.addEventListener('afterprint',reset,{once:true});requestAnimationFrame(()=>window.print())}
 async function logout(){setDeviceProfile(null);setShowPasswordLogin(false);setPinConfigured(false);setPinLocked(false);setDraftScope('');setUncertainSale(false);await invoke('supplier_logout');setData(null);setCart({});setSaleKey('');setCustomerId('')}
 
 return <>{!data&&<div className="connection">
 {deviceProfile?.configured&&!showPasswordLogin?
  <form onSubmit={connectPin} className="quick-login">
   <h2>FIXI · Connexion rapide</h2>
   <p>Fournisseur : <strong>{deviceProfile.login}</strong></p>
   <p className="login-server">{deviceProfile.server}</p>
   <label>Code PIN à 4 chiffres<input autoFocus inputMode="numeric" autoComplete="off" type="password" maxLength={4} placeholder="••••" value={quickPin} onChange={e=>setQuickPin(e.target.value.replace(/\D/g,'').slice(0,4))}/></label>
   {error&&<p role="alert" className="connect-error">{error}</p>}
   <button type="submit" disabled={busy||quickPin.length!==4}>{busy?'Connexion…':'Ouvrir la caisse'}</button>
   <small>Ce profil est protégé dans le gestionnaire d’identifiants Windows. Après cinq codes erronés, l’accès est temporairement bloqué.</small>
  </form>
 :
  <form onSubmit={connect}><h2>Connexion FIXI Supplier</h2><p>Connectez-vous une fois avec vos identifiants, puis activez un PIN sécurisé sur ce PC.</p><label>Serveur HTTPS<input type="url" required placeholder="https://fixi-web.onrender.com" value={server} onChange={e=>setServer(e.target.value)}/></label><label>Identifiant fournisseur<input required value={login} onChange={e=>setLogin(e.target.value)}/></label><label>Mot de passe<input required type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p role="alert" className="connect-error">{error}</p>}<button type="submit" disabled={busy}>{busy?'Connexion…':'Se connecter à FIXI Cloud'}</button><small>Les identifiants ne sont enregistrés dans Windows que si vous activez volontairement le PIN.</small></form>}
 {deviceProfile?.configured&&<button type="button" onClick={()=>{setShowPasswordLogin(x=>!x);setError('')}}>{showPasswordLogin?'Utiliser mon PIN':'Utiliser mon mot de passe fournisseur'}</button>}
 <button type="button" onClick={()=>{setData({companyName:'Démonstration',role:'DEMO',products:sample,customers:[]});setShowPasswordLogin(false)}}>Continuer en mode démonstration</button>
 </div>}<div className={screen==='caisse'?'app':'app app-detail'}><aside className="nav"><div className="logo">FIXI <small>CAISSE PRO</small></div>{([['caisse','▦','Caisse'],['produits','◫','Produits'],['stock','▤','Stock'],['clients','♙','Clients'],['historique','▧','Historiques'],['session','◉','Ouverture / clôture'],['commandes','▣','Commandes en ligne'],['dettes','◈','Dettes / règlements'],['retours','↶','Retours / avoirs']] as const).map(([id,icon,label])=><button key={id} className={'nav-item '+(screen===id?'active':'')} onClick={()=>navigate(id)}>{icon} &nbsp; {label}</button>)}<div className="bottom">{data?.companyName||'Démonstration'}</div></aside><main><header><div><h1>Point de vente</h1><p>{data?.role==='DEMO'?'Données de démonstration':data?.companyName||'Données fournisseur FIXI'}</p></div><span className="status">{data?.role==='DEMO'?'● MODE DÉMONSTRATION':'● CONNECTÉ · CAISSE V3'}</span></header><div style={{display:'flex',gap:8,marginTop:12}}><button onClick={refresh} disabled={busy||data?.role==='DEMO'}>Actualiser FIXI</button><button onClick={logout}>Déconnexion</button><button onClick={()=>setLabelsOpen(true)}>Étiquettes codes-barres</button>{pinConfigured?<button onClick={()=>void lockPin()}>🔒 Verrouiller (PIN)</button>:<label className="pin-create">Code PIN local <input inputMode="numeric" type="password" maxLength={4} placeholder="4 chiffres" value={pinValue} onChange={e=>setPinValue(e.target.value.replace(/\D/g,'').slice(0,4))}/><button onClick={()=>void setupPin()} disabled={pinValue.length!==4}>Activer le PIN</button></label>}{ticket&&<button onClick={printTicket}>Imprimer dernier ticket</button>}</div>{screen==='caisse'&&<div className="scan-strip"><input ref={scanRef} autoFocus aria-label="Scanner ou saisir un code-barres" placeholder="SCAN RAPIDE · F2 · Scanner un code-barres ou saisir une référence SKU…" value={scanCode} onChange={e=>setScanCode(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')scan()}}/><button onClick={scan}>Ajouter au panier</button></div>}{(screen==='caisse'||screen==='produits')&&<div className="search"><input aria-label="Rechercher un produit" value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher par nom, SKU ou code-barres"/></div>}{screen==='caisse'&&<><div className="tabs">{categories.map(c=><button key={c} className={category===c?'selected':''} onClick={()=>setCategory(c)}>{c}</button>)}</div><section className="products">{products.map(p=><button key={p.id} className="product" onClick={()=>change(p.id,1)}><span className="pictogram">▣</span><b>{p.name}</b><small>{p.sku}{data?.role!=='DEMO'?' · Stock : '+(p.stock??'—'):''}</small><strong>{dt(p.price)}</strong></button>)}</section></>}
{screen==='produits'&&<section className="data-table"><h2>Catalogue produits</h2><table><thead><tr><th>Produit</th><th>Référence</th><th>Catégorie</th><th>Prix</th></tr></thead><tbody>{catalog.filter(p=>!q||[p.name,p.sku].join(' ').toLowerCase().includes(q.toLowerCase())).map(p=><tr key={p.id}><td>{p.name}</td><td>{p.sku}</td><td>{p.category||'—'}</td><td>{dt(p.price)}</td></tr>)}</tbody></table></section>}
{screen==='stock'&&<section className="data-table"><h2>État du stock</h2><table><thead><tr><th>Produit</th><th>Référence</th><th>Disponible</th></tr></thead><tbody>{catalog.map(p=><tr key={p.id}><td>{p.name}</td><td>{p.sku}</td><td>{p.stock??'Non disponible'}</td></tr>)}</tbody></table></section>}
{screen==='clients'&&<section className="data-table"><h2>Clients fournisseur</h2><table><thead><tr><th>Client</th><th>Compte</th></tr></thead><tbody>{data?.customers.map(c=><tr key={c.id}><td>{c.name}</td><td>Actif</td></tr>)}</tbody></table></section>}
{screen==='session'&&<section className="data-table"><h2>Ouverture et clôture de caisse</h2><p>Gestion du fonds en espèces. Les opérations sont validées et enregistrées sur le serveur fournisseur.</p><button type="button" onClick={()=>void loadHistory()}>Actualiser les sessions</button><p>La clôture peut signaler un écart avec le montant attendu. Comptez physiquement les espèces avant confirmation.</p><label className="cash-field">Montant compté (DT)<input type="number" min="0" step="0.001" value={cashAmount} onChange={e=>setCashAmount(e.target.value)} placeholder="0.000"/></label><label className="cash-field">Observation<input value={cashNote} maxLength={500} onChange={e=>setCashNote(e.target.value)} placeholder="Fond initial, écart, justification…"/></label>{cashError&&<p role="alert" className="connect-error">{cashError}</p>}<div className="cash-actions"><button disabled={cashBusy||data?.role==='DEMO'} onClick={()=>void cashAction('CASH_OPEN')}>Ouvrir la caisse</button><button disabled={cashBusy||data?.role==='DEMO'} onClick={()=>void cashAction('CASH_CLOSE')}>Clôturer la caisse</button></div>{history?.sessions&&<table><thead><tr><th>Session</th><th>Ouverte</th><th>Clôturée</th><th>État</th></tr></thead><tbody>{history.sessions.map(x=><tr key={x.id}><td>{x.id.slice(-7)}</td><td>{new Date(x.openedAt).toLocaleString('fr-TN')}</td><td>{x.closedAt?new Date(x.closedAt).toLocaleString('fr-TN'):'—'}</td><td>{x.status}</td></tr>)}</tbody></table>}</section>}
{screen==='retours'&&<section className="data-table"><h2>Retours produits et avoirs</h2><p>Traçabilité des retours liés aux ventes. L’enregistrement d’un nouvel avoir nécessite le contrôle des quantités déjà retournées, de l’état du produit et du remboursement serveur.</p><button type="button" onClick={()=>void loadReturns()}>Actualiser les retours</button>{returnsError&&<p role="alert" className="connect-error">{returnsError}</p>}{returnsData?<><div className="return-editor"><h3>Nouveau retour</h3>{!['OWNER','ADMIN','MANAGER'].includes(data?.role||'')&&<p className="stock-warning">La validation d’un remboursement nécessite le rôle Responsable, Administrateur ou Propriétaire.</p>}{pendingReturn&&<div className="uncertain-sale" role="alert"><strong>Retour à vérifier</strong><p>Référence : {pendingReturn.reference}. Cette opération est sauvegardée sur le PC.</p><button type="button" disabled={returnBusy} onClick={()=>void verifyReturn()}>Vérifier l’avoir dans FIXI Cloud</button><button type="button" disabled={returnBusy} onClick={()=>void submitReturn(pendingReturn)}>Renvoyer exactement le même retour</button></div>}<p>Remplissez les quantités réellement rendues. Les remboursements espèces nécessitent une caisse ouverte.</p><label>Vente d’origine<select value={returnSaleId} onChange={e=>{setReturnSaleId(e.target.value);setReturnQty({})}}><option value="">Choisir une facture</option>{returnsData.sales.map(x=><option key={x.id} value={x.id}>{x.reference} · {dt(x.total)}</option>)}</select></label>{returnsData.sales.find(x=>x.id===returnSaleId)?.items.map(item=><label key={item.id}>{item.name} · retournable {item.remaining??item.quantity} / {item.quantity}<input type="number" min="0" max={item.remaining??item.quantity} step="1" value={returnQty[item.id]||0} onChange={e=>setReturnQty(v=>({...v,[item.id]:Math.max(0,Math.min(item.remaining??item.quantity,Math.trunc(Number(e.target.value)||0)))}))}/></label>)}<label><input type="checkbox" checked={returnDamaged} onChange={e=>setReturnDamaged(e.target.checked)}/> Produit endommagé : ne pas remettre en stock</label><label>Motif<input value={returnReason} maxLength={200} onChange={e=>setReturnReason(e.target.value)}/></label><label>Remboursement espèces (DT)<input type="number" min="0" step="0.001" value={returnRefund} onChange={e=>setReturnRefund(e.target.value)}/></label><button disabled={returnBusy||returnUncertain||Boolean(pendingReturn)||!returnSaleId||!['OWNER','ADMIN','MANAGER'].includes(data?.role||'')} onClick={()=>void createReturn()}>{returnBusy?'Validation…':'Créer l’avoir (autorisation serveur requise)'}</button>{returnMessage&&<p role="status">{returnMessage}</p>}</div><h3>Avoirs enregistrés</h3><table><thead><tr><th>Avoir</th><th>Vente source</th><th>Date</th><th>Montant</th><th>Remboursé</th><th>Statut</th></tr></thead><tbody>{returnsData.returns.map(x=><tr key={x.id}><td>{x.reference}</td><td>{x.sourceRef||'—'}</td><td>{new Date(x.createdAt).toLocaleDateString('fr-TN')}</td><td>{dt(x.total)}</td><td>{dt(x.refund)}</td><td>{x.status}</td></tr>)}</tbody></table><h3>Ventes sources récentes</h3><table><thead><tr><th>Facture</th><th>Date</th><th>Montant</th><th>Articles</th></tr></thead><tbody>{returnsData.sales.map(x=><tr key={x.id}><td>{x.reference}</td><td>{new Date(x.createdAt).toLocaleDateString('fr-TN')}</td><td>{dt(x.total)}</td><td>{x.items.map(i=><div key={i.id}>{i.name} · Qté vendue {i.quantity}</div>)}</td></tr>)}</tbody></table></>:<p>Chargez les avoirs depuis FIXI Cloud.</p>}</section>}
{screen==='dettes'&&<section className="data-table"><h2>Dettes clients et règlements</h2><p>Journal réel des sommes dues au fournisseur, avec référence de vente, montant déjà réglé et solde. Pour éviter tout double encaissement, les paiements Windows seront activés après validation de la transaction côté serveur.</p><button type="button" onClick={()=>void loadDebts()}>Actualiser les dettes</button>{debtsError&&<p role="alert" className="connect-error">{debtsError}</p>}{pendingDebt&&<div className="uncertain-sale" role="alert"><strong>Versement à vérifier</strong><p>Référence : {pendingDebt.reference} · montant : {dt(pendingDebt.amount)}. Cette référence est conservée même après fermeture.</p><button disabled={debtBusy} onClick={()=>void verifyDebt()}>Vérifier sur FIXI Cloud</button><button disabled={debtBusy} onClick={()=>void submitDebt(pendingDebt)}>Renvoyer exactement le même règlement</button></div>}<div className="debt-settlement"><label>Facture / client<select value={debtSelected} onChange={e=>{setDebtSelected(e.target.value);setDebtPaymentKey('')}}><option value="">Sélectionner une créance</option>{debts?.debts.map(x=><option key={x.id} value={x.id}>{x.customer} — {x.reference} — dû {dt(x.due)}</option>)}</select></label><label>Versement (DT)<input type="number" step="0.001" min="0.001" value={debtAmount} onChange={e=>{setDebtAmount(e.target.value);setDebtPaymentKey('')}}/></label><label>Moyen<select value={debtMethod} onChange={e=>{setDebtMethod(e.target.value as 'CASH'|'CARD'|'TRANSFER');setDebtPaymentKey('')}}><option value="CASH">Espèces</option><option value="CARD">Carte</option><option value="TRANSFER">Virement</option></select></label><button disabled={debtBusy||Boolean(pendingDebt)||!debtSelected||data?.role==='DEMO'} onClick={()=>void collectDebt()}>{debtBusy?'Traitement…':'Encaisser le versement (contrôle serveur)'}</button></div>{debtMessage&&<p role="status" className="sale-success">{debtMessage}</p>}{debts?<><h3>{debts.debts.length} vente(s) avec reste à payer · Total : {dt(debts.debts.reduce((n,x)=>n+x.due,0))}</h3><table><thead><tr><th>Client</th><th>Facture / vente</th><th>Date</th><th>Total</th><th>Déjà payé</th><th>Reste dû</th></tr></thead><tbody>{debts.debts.map(x=><tr key={x.id}><td>{x.customer}</td><td>{x.reference}</td><td>{new Date(x.createdAt).toLocaleDateString('fr-TN')}</td><td>{dt(x.total)}</td><td>{dt(x.paid)}</td><td><strong>{dt(x.due)}</strong></td></tr>)}</tbody></table></>:<p>Chargement des créances…</p>}</section>}
{screen==='commandes'&&<section className="data-table"><h2>Commandes en ligne à préparer</h2><p>Ces commandes sont réelles et synchronisées avec FIXI Cloud. La confirmation et la remise au livreur restent protégées par le workflow serveur existant.</p><button type="button" onClick={()=>void loadOrders()}>Actualiser les commandes</button>{ordersError&&<p role="alert" className="connect-error">{ordersError}</p>}{onlineOrders?<table><thead><tr><th>Atelier</th><th>Date</th><th>Statut</th><th>Produits</th><th>Action</th></tr></thead><tbody>{onlineOrders.orders.map(o=><tr key={o.id}><td>{o.customer}</td><td>{new Date(o.createdAt).toLocaleString('fr-TN')}</td><td>{o.status}</td><td>{o.items.map((x,i)=><div key={i}>{x.name} · {x.sku} · Qté {x.quantity}</div>)}</td><td><button disabled={orderBusy===o.id||data?.role==='DEMO'} onClick={()=>void transitionOrder(o.id,o.status==='PENDING'?'CONFIRMED':o.status==='CONFIRMED'?'PREPARING':'READY_FOR_DELIVERY')}>{o.status==='PENDING'?'Confirmer':o.status==='CONFIRMED'?'Préparer':o.status==='PREPARING'?'Prête pour livraison':'En attente du livreur'}</button></td></tr>)}</tbody></table>:<p>Chargement des commandes…</p>}</section>}
{screen==='stock'&&catalog.some(p=>p.stock!==undefined&&p.stock<=5)&&<div className="stock-warning" role="status">⚠ {catalog.filter(p=>p.stock!==undefined&&p.stock<=5).length} produit(s) en stock bas ou épuisé. Consultez la page Stock pour réapprovisionner.</div>}
{screen==='historique'&&<section className="data-table"><h2>Historique des ventes</h2><button type="button" onClick={()=>void loadHistory()}>Actualiser l'historique</button>{historyError&&<p role="alert" className="connect-error">{historyError}</p>}{history?<><h3>Ventes récentes</h3><table><thead><tr><th>Référence</th><th>Date</th><th>État</th><th>Total</th><th>Payé</th><th>Reste</th></tr></thead><tbody>{history.sales.map(x=><tr key={x.id}><td>{x.reference}</td><td>{new Date(x.createdAt).toLocaleString('fr-TN')}</td><td>{x.status}</td><td>{dt(x.total)}</td><td>{dt(x.paid)}</td><td>{dt(Math.max(0,x.total-x.paid))}</td></tr>)}</tbody></table><h3>Sessions de caisse</h3><table><thead><tr><th>Ouverture</th><th>Clôture</th><th>État</th></tr></thead><tbody>{history.sessions.map(x=><tr key={x.id}><td>{new Date(x.openedAt).toLocaleString('fr-TN')}</td><td>{x.closedAt?new Date(x.closedAt).toLocaleString('fr-TN'):'—'}</td><td>{x.status}</td></tr>)}</tbody></table></>:<p>Chargez l'historique depuis FIXI Cloud.</p>}</section>}
<div className="notice">Catalogue synchronisé. Ventes Windows soumises à l'activation et aux contrôles du serveur.</div></main>{screen==='caisse'&&<aside className="checkout"><h2>Panier <small>{entries.reduce((n,e)=>n+e.quantity,0)} article(s)</small></h2><div className="customer">♙ &nbsp; <select value={customerId} onChange={e=>setCustomerId(e.target.value)}><option value="">Client comptoir</option>{data?.customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div className="lines">{entries.length?entries.map(({product,quantity})=><div className="line" key={product.id}><b>{product.name}</b><small>{dt(product.price)} / unité</small><div className="controls"><button onClick={()=>change(product.id,-1)}>−</button><span>{quantity}</span><button onClick={()=>change(product.id,1)}>+</button><strong>{dt(product.price*quantity)}</strong></div></div>):<div className="empty">Scannez ou sélectionnez un produit</div>}</div><div className="totals"><div><span>Sous-total</span><b>{dt(total)}</b></div><div className="grand"><span>Total</span><strong>{dt(total)}</strong></div></div><section className="checkout-form"><h3>Règlement</h3><label>Mode de paiement<select value={payMethod} onChange={e=>{setPayMethod(e.target.value as 'CASH'|'CARD'|'TRANSFER');setSaleKey('')}}><option value="CASH">Espèces</option><option value="CARD">Carte</option><option value="TRANSFER">Virement</option></select></label><label>Montant reçu (DT)<input type="number" min="0" max={total} step="0.001" placeholder={total.toFixed(3)} value={amount} onChange={e=>{setAmount(e.target.value);setSaleKey('')}}/></label><div className="due">Reste à payer : {dt(Math.max(0,total-(amount.trim()===''?total:Number(amount)||0)))}</div>{amount.trim()!==''&&Number(amount)<total&&<small>Pour une vente à crédit, sélectionnez un client.</small>}{error&&<p role="alert" className="connect-error">{error}</p>}{saleMessage&&<p className="sale-success" role="status">{saleMessage}</p>}{uncertainSale&&<div className="uncertain-sale"><strong>Vente à vérifier avant de continuer.</strong><p>Référence : {saleKey}. Consultez l’historique FIXI. Si la vente existe, supprimez le panier en attente ; sinon vous pourrez reprendre la saisie.</p><button type="button" onClick={()=>{setScreen('historique');void loadHistory()}}>Ouvrir l’historique</button><button type="button" onClick={()=>{setUncertainSale(false);setSaleKey('')}}>J’ai vérifié : vente non enregistrée</button><button type="button" onClick={()=>{setUncertainSale(false);setSaleKey('');setCart({});setAmount('');setCustomerId('')}}>J’ai vérifié : vente déjà enregistrée</button></div>}</section><button className="disabledpay" disabled={busy||uncertainSale||data?.role==='DEMO'||entries.length===0} onClick={checkout}>{busy?'Validation en cours…':'Valider la vente (contrôle serveur)'}</button><button className="reset" onClick={()=>{setCart({});setSaleKey('');setAmount('')}}>Vider le panier</button></aside>}</div>{pinError&&!pinLocked&&<div className="pin-error" role="alert">{pinError}</div>}{pinLocked&&<div className="pin-lock"><form onSubmit={unlockPin}><h2>FIXI CAISSE VERROUILLÉE</h2><p>Saisissez votre code à 4 chiffres pour reprendre le travail.</p><input aria-label="Code PIN" autoFocus inputMode="numeric" type="password" maxLength={4} value={pinValue} onChange={e=>setPinValue(e.target.value.replace(/\D/g,'').slice(0,4))}/>{pinError&&<p role="alert">{pinError}</p>}<button disabled={pinValue.length!==4}>Déverrouiller</button><small>Le PIN peut également ouvrir la caisse après redémarrage lorsque le profil Windows a été enregistré.</small></form></div>}{labelsOpen&&!pinLocked&&<WindowsLabelStudio products={catalog} companyName={data?.companyName||'FIXI'} onClose={()=>setLabelsOpen(false)}/>}<div className="receipt-print-area">{ticket&&<article className="receipt-ticket"><h2>{ticket.company}</h2><p>Ticket FIXI Caisse Windows</p><p>{ticket.reference}</p><p>{ticket.date}</p><hr/>{ticket.items.map((x,i)=><div key={i}>{x.name} · {x.quantity} × {dt(x.price)}<b>{dt(x.quantity*x.price)}</b></div>)}<hr/><p>Total : <b>{dt(ticket.total)}</b></p><p>Reçu : {dt(ticket.paid)}</p><p>Reste : {dt(ticket.total-ticket.paid)}</p><small>Émis depuis FIXI Caisse Windows</small></article>}</div></>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
