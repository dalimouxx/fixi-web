'use client';
import {ReportProblemButton} from './report-problem';
import {TextSizeToggle} from './text-size-toggle';
import {LangToggle} from './lang-toggle';
import {orderStops,mapsRouteUrl} from '@/lib/route-order';
import {AndroidWidgetButton} from './android-widget-button';
import {SignaturePad} from './signature-pad';
import {DriverExtras} from './driver-extras';
import {useEffect,useMemo,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {MapPinned,Navigation,Phone,Truck,CheckCircle2,RefreshCw,Map,Clock3,Banknote,AlertTriangle,RotateCcw,CalendarClock,PackageCheck,LogOut,PlayCircle,PauseCircle,Route,WalletCards,Camera,ShieldCheck,X,UserRound,Gauge,Wifi,WifiOff,Radio,History,Store} from 'lucide-react';
import {api} from './ui';
import {FxSheet} from './fx-sheet';
import {SlideToConfirm} from './slide-to-confirm';
import {haptic} from '@/lib/haptics';
import {playFixiSound} from '@/lib/notification-audio';
import {RealtimeNotificationCenter} from './realtime-notification-center';
import {PwaRegister} from './pwa-register';
import {FixiSmartWidgets,type FixiWidgetData} from './fixi-smart-widgets';
import {BarcodeCamera} from './barcode-camera';
import {dateTime,money} from '@/lib/format';

const labels:Record<string,string>={READY_FOR_DELIVERY:'À accepter',OUT_FOR_DELIVERY:'En route',RETURNING:'Retour fournisseur',RETURNED:'Retour remis',DELIVERED:'Livrée'};
type DriverEventType='COD_COLLECTED'|'DUE_COLLECTED'|'CUSTOMER_ABSENT'|'SHOP_CLOSED'|'DELIVERY_REFUSED'|'RESCHEDULED'|'INCIDENT'|'RETURN_TO_DEPOT';
type EventModal={order:any;type:DriverEventType}|null;
type ProofModal={order:any}|null;

export function DriverApp({session}:{session:any}){
 const router=useRouter();const[orders,setOrders]=useState<any[]>([]);const[events,setEvents]=useState<any[]>([]);const[shift,setShift]=useState<any>({current:null,pendingCashier:null,recent:[]});const[busy,setBusy]=useState('');const[msg,setMsg]=useState('');const[err,setErr]=useState('');
 const[view,setView]=useState<'orders'|'dues'|'history'>('orders');const[eventModal,setEventModal]=useState<EventModal>(null);const[dueModal,setDueModal]=useState<any>(null);const[dueData,setDueData]=useState<any>(null);const[dueAmount,setDueAmount]=useState('');const[eventNote,setEventNote]=useState('');const[eventAmount,setEventAmount]=useState('');const[proofModal,setProofModal]=useState<ProofModal>(null);const[proofScanner,setProofScanner]=useState(false);const[proof,setProof]=useState({recipientName:'',recipientPhone:'',proofCode:'',proofUrl:''});
 const[shiftModal,setShiftModal]=useState<'open'|'close'|null>(null);const[eventPhoto,setEventPhoto]=useState('');const[signature,setSignature]=useState('');const lastPos=useRef<{lat:number;lng:number;acc:number;at:number}|null>(null);const[driverAvailable,setDriverAvailable]=useState(true);const[shiftForm,setShiftForm]=useState({startCash:'0',startMileage:'',endMileage:'',remittedCod:'0',note:''});const[tracking,setTracking]=useState(true);const[online,setOnline]=useState(true);const lastGps=useRef<Record<string,number>>({});
 async function load(){const rs=await Promise.all([fetch('/api/delivery/orders',{cache:'no-store'}),fetch('/api/delivery/events',{cache:'no-store'}),fetch('/api/delivery/shift',{cache:'no-store'}),fetch('/api/delivery/profile',{cache:'no-store'})]);if(rs.some(r=>r.status===401)){await fetch('/api/delivery/auth/logout',{method:'POST'}).catch(()=>{});router.replace('/delivery/login');router.refresh();return}const [o,e,s,p]=rs;const oj=await o.json(),ej=await e.json(),sj=await s.json(),pj=await p.json();setOrders(Array.isArray(oj)?oj:[]);loaded.current=true;setEvents(Array.isArray(ej)?ej:[]);setShift(sj&&typeof sj==='object'?sj:{current:null,pendingCashier:null,recent:[]});if(typeof pj?.driverAvailable==='boolean')setDriverAvailable(pj.driverAvailable)}
 useEffect(()=>{load();const vis=()=>{if(document.visibilityState==='visible')load()};const focus=()=>load();document.addEventListener('visibilitychange',vis);window.addEventListener('focus',focus);const t=setInterval(()=>{if(document.visibilityState==='visible')load()},15000);return()=>{clearInterval(t);document.removeEventListener('visibilitychange',vis);window.removeEventListener('focus',focus)}},[]);
 useEffect(()=>{const sync=()=>setOnline(navigator.onLine);sync();addEventListener('online',sync);addEventListener('offline',sync);return()=>{removeEventListener('online',sync);removeEventListener('offline',sync)}},[]);
 const available=useMemo(()=>orders.filter(o=>o.status==='READY_FOR_DELIVERY'&&!o.delivery?.driverAccountId),[orders]);
 const[route,setRoute]=useState<{ordered:any[];km:number;url:string}|null>(null);
 function optimizeRoute(){const run=(start:{lat:number;lng:number}|null)=>{const stops=active.map((o:any)=>({...o,lat:o.shop?.latitude!=null?Number(o.shop.latitude):null,lng:o.shop?.longitude!=null?Number(o.shop.longitude):null}));const r=orderStops(stops,start);if(!stops.some(x=>x.lat!=null)){setMsg('Les clients de cette tournée n’ont pas encore de position GPS : ordre inchangé.');return}setRoute({ordered:r.ordered,km:r.km,url:mapsRouteUrl(r.ordered,start)})};if(!navigator.geolocation)return run(null);navigator.geolocation.getCurrentPosition(p=>run({lat:p.coords.latitude,lng:p.coords.longitude}),()=>run(null),{enableHighAccuracy:true,timeout:8000,maximumAge:60000})}
 const active=useMemo(()=>orders.filter(o=>o.delivery?.driverAccountId===session.id&&['READY_FOR_DELIVERY','OUT_FOR_DELIVERY','RETURNING'].includes(o.status)).sort((a,b)=>a.status==='OUT_FOR_DELIVERY'?-1:b.status==='OUT_FOR_DELIVERY'?1:new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime()),[orders,session.id]);
 useEffect(()=>{setRoute(null)},[active.map((o:any)=>o.id+o.status).join(',')]);
 const done=useMemo(()=>orders.filter(o=>o.status==='DELIVERED').slice(0,30),[orders]);
 const deliveredToday=useMemo(()=>done.filter(o=>new Date(o.delivery?.deliveredAt||o.updatedAt).toDateString()===new Date().toDateString()),[done]);
 const deliveredValueToday=useMemo(()=>deliveredToday.reduce((a,o)=>a+Number(o.total||0),0),[deliveredToday]);
 const codToday=useMemo(()=>events.filter((e:any)=>['COD_COLLECTED','DUE_COLLECTED'].includes(e.type)&&new Date(e.createdAt).toDateString()===new Date().toDateString()).reduce((a:number,e:any)=>a+Number(e.amount||0),0),[events]);
 const dueCollectedToday=useMemo(()=>events.filter((e:any)=>e.type==='DUE_COLLECTED'&&new Date(e.createdAt).toDateString()===new Date().toDateString()).reduce((a:number,e:any)=>a+Number(e.amount||0),0),[events]);
 const exceptionsToday=useMemo(()=>events.filter((e:any)=>['CUSTOMER_ABSENT','SHOP_CLOSED','DELIVERY_REFUSED','INCIDENT','RETURN_TO_DEPOT'].includes(e.type)&&new Date(e.createdAt).toDateString()===new Date().toDateString()).length,[events]);
 async function toggleAvailable(){try{const next=!driverAvailable;await api('/api/delivery/profile',{method:'PATCH',body:JSON.stringify({driverAvailable:next})});setDriverAvailable(next);setMsg(next?'Vous êtes disponible pour recevoir de nouvelles courses.':'Vous ne recevrez plus de nouvelles courses automatiques.')}catch(e:any){setErr(e.message)}}
 async function logout(){await fetch('/api/delivery/auth/logout',{method:'POST'});router.push('/delivery/login');router.refresh()}
 async function accept(o:any){setBusy(o.id);setErr('');setMsg('');try{await api('/api/delivery/orders/'+o.id+'/accept',{method:'POST'});setMsg('Livraison acceptée. Elle est maintenant réservée pour vous.');await load()}catch(e:any){setErr(e.message)}finally{setBusy('')}}
 async function patch(o:any,payload:any,quiet=false){if(!quiet){setBusy(o.id);setErr('');setMsg('')}try{await api('/api/delivery/orders/'+o.id,{method:'PATCH',body:JSON.stringify(payload)});if(!quiet)await load()}catch(e:any){if(!quiet)setErr(e.message)}finally{if(!quiet)setBusy('')}}
 async function acceptOrder(o:any){setBusy(o.id);setErr('');try{await api('/api/delivery/orders/'+o.id,{method:'POST',body:'{}'});setMsg('Commande acceptée. Elle est maintenant réservée pour vous.');await load()}catch(e:any){setErr(e.message)}finally{setBusy('')}}
 async function openDue(o:any){setBusy(o.id);setErr('');try{const r=await fetch('/api/delivery/customers/'+o.shopId+'/due',{cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Impossible de charger le dû');setDueData(j);setDueAmount(j.due>0?Number(j.due).toFixed(3):'0');setDueModal(o)}catch(e:any){setErr(e.message)}finally{setBusy('')}}
 async function collectDue(){if(!dueModal)return;const amount=Number(dueAmount||0);if(!(amount>0))return;setBusy(dueModal.id);setErr('');try{const r=await api('/api/delivery/customers/'+dueModal.shopId+'/due',{method:'POST',body:JSON.stringify({amount,method:'CASH'})});setMsg('Dû encaissé · reste '+money(r.remaining));setDueModal(null);setDueData(null);await load()}catch(e:any){setErr(e.message)}finally{setBusy('')}}
 async function addEvent(){if(!eventModal)return;const o=eventModal.order,type=eventModal.type;setBusy(o.id);setErr('');try{const gps=lastPos.current&&Date.now()-lastPos.current.at<120000?lastPos.current:null;const r:any=await api('/api/delivery/events',{method:'POST',body:JSON.stringify({orderId:o.id,type,note:eventNote||null,amount:type==='COD_COLLECTED'?Number(eventAmount||0):null,proofUrl:eventPhoto||null,latitude:gps?.lat,longitude:gps?.lng,accuracy:gps?.acc})});setEventModal(null);setEventNote('');setEventAmount('');setEventPhoto('');setMsg(r?.rescheduled?`Passage ${r.attempts} enregistré : nouvelle tentative programmée, l’atelier est prévenu.`:r?.attempts?'3 passages sans livraison : le fournisseur est prévenu.':'Événement enregistré.');await load()}catch(e:any){setErr(e.message)}finally{setBusy('')}}
 async function confirmArrival(o:any){
  if(busy===o.id)return;
  setBusy(o.id);setErr('');setMsg('');
  try{
    const response=await api('/api/delivery/events',{method:'POST',
      body:JSON.stringify({orderId:o.id,type:'ARRIVED_AT_SHOP',...(lastPos.current&&Date.now()-lastPos.current.at<120000?{latitude:lastPos.current.lat,longitude:lastPos.current.lng,accuracy:lastPos.current.acc}:{})})});
    setMsg(response?.alreadyRecorded?'Arrivée déjà confirmée.':'📍 Arrivée confirmée. La boutique est informée.');
    await load();
  }catch(e:any){setErr(e.message||'Impossible de confirmer votre arrivée.')}
  finally{setBusy('');}
 }
 async function shiftAction(){
  if(!shiftModal||busy==='SHIFT')return;
  const action=shiftModal;
  const cash=Number(shiftForm.startCash||0);
  const remise=Number(shiftForm.remittedCod||0);
  const mileage=action==='open'?shiftForm.startMileage:shiftForm.endMileage;
  if((action==='open'&&(!Number.isFinite(cash)||cash<0))||
     (action==='close'&&(!Number.isFinite(remise)||remise<0))||
     (mileage!==''&&(!Number.isSafeInteger(Number(mileage))||Number(mileage)<0))){
    setErr('Vérifiez les montants et le kilométrage. Les valeurs négatives ne sont pas autorisées.');
    return;
  }
  setBusy('SHIFT');setErr('');setMsg('');
  try{
    const payload=action==='open'?
     {action:'OPEN',startCash:cash,startMileage:mileage===''?null:Number(mileage),note:shiftForm.note.trim()||null}:
     {action:'CLOSE',endMileage:mileage===''?null:Number(mileage),remittedCod:remise,note:shiftForm.note.trim()||null};
    await api('/api/delivery/shift',{method:'POST',body:JSON.stringify(payload)});
    setShiftModal(null);
    setMsg(action==='open'?'✅ Journée ouverte. Vous pouvez commencer votre tournée.':'✅ Remise caisse déclarée. Validation fournisseur en attente.');
    await load().catch(()=>setMsg('Journée enregistrée. Actualisez pour voir son état.'));
  }catch(e:any){
    setErr(e.message||'Impossible de démarrer la journée. Réessayez.');
    // The error is displayed inside the modal, so it cannot be hidden behind the backdrop.
  }finally{setBusy('')}
 }
 function openEvent(order:any,type:DriverEventType){setEventNote('');setEventAmount(type==='COD_COLLECTED'?String(Math.max(0,Number(order.total)-Number(order.delivery?.cashCollected||0))):type==='DUE_COLLECTED'?String(Number(order.customerDue||0)):'');setEventModal({order,type} as EventModal)}
 function maps(address:string){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(address)}
 async function photo(file?:File){if(!file)return;const data=await compressImage(file);setProof(p=>({...p,proofUrl:data}))}
 async function confirmDelivery(){if(!proofModal)return;const o=proofModal.order;if(!proof.recipientName.trim())return setErr('Nom du réceptionnaire requis.');setBusy(o.id);setErr('');setMsg('');try{
  // Do not use the quiet GPS helper: it hides errors and could display false success.
  await api('/api/delivery/orders/'+o.id,{method:'PATCH',body:JSON.stringify({status:'DELIVERED',...proof,signatureUrl:signature||undefined})});
  setProofModal(null);setProof({recipientName:'',recipientPhone:'',proofCode:'',proofUrl:''});setSignature('');
  setMsg('✅ Livraison confirmée avec preuve de remise. Mission terminée.');
  await load();
}catch(e:any){setErr(e.message||'Livraison non confirmée. Réessayez.')}finally{setBusy('')}}
 useEffect(()=>{
  const ongoing=active.filter(o=>o.status==='OUT_FOR_DELIVERY');
  if(!('serviceWorker'in navigator))return;
  navigator.serviceWorker.ready.then(reg=>{
    for(const o of ongoing)reg.active?.postMessage({type:'DELIVERY_ONGOING',orderId:o.id,title:'Livraison en cours · '+o.reference,body:(o.shop?.name||'Client')+' · '+money(o.total)});
  }).catch(()=>{});
  return()=>{navigator.serviceWorker.ready.then(reg=>{for(const o of ongoing)reg.active?.postMessage({type:'DELIVERY_ONGOING_CLEAR',orderId:o.id})}).catch(()=>{})}
 },[active.map(o=>o.id+o.status).join('|')]);
 useEffect(()=>{
  if(!tracking||!shift.current||!online)return;
  const current=active.filter(o=>o.status==='OUT_FOR_DELIVERY');if(!current.length||!navigator.geolocation)return;
  const id=navigator.geolocation.watchPosition(pos=>{lastPos.current={lat:pos.coords.latitude,lng:pos.coords.longitude,acc:pos.coords.accuracy,at:Date.now()};for(const o of current){const now=Date.now();if(now-(lastGps.current[o.id]||0)<15000)continue;lastGps.current[o.id]=now;patch(o,{status:o.status,trackingNote:`GPS:${pos.coords.latitude},${pos.coords.longitude}|${new Date().toISOString()}`,latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy:pos.coords.accuracy},true)}},()=>{}, {enableHighAccuracy:true,maximumAge:8000,timeout:12000});
  return()=>navigator.geolocation.clearWatch(id)
 },[tracking,shift.current?.id,online,active.map(o=>o.id+o.status).join('|')]);
 useEffect(()=>{const v=new URLSearchParams(location.search).get('v');if(v==='dues'||v==='history')setView(v)},[]);
 const [menu,setMenu]=useState(false),[moreFor,setMoreFor]=useState<any>(null),[toast,setToast]=useState('');
 const seen=useRef<Set<string>|null>(null);const loaded=useRef(false);
 // Nouvelle mission : vibration, son et bandeau, comme une vraie appli de livraison.
 useEffect(()=>{if(!loaded.current)return;const ids=new Set(available.map((o:any)=>o.id));
  if(seen.current){const fresh=[...ids].filter(id=>!seen.current!.has(id));if(fresh.length&&driverAvailable){haptic('warn');playFixiSound('livraison');const o=available.find((x:any)=>x.id===fresh[0]);setToast('Nouvelle mission · '+(o?.shop?.name||'')+' · '+money(o?.total||0))}}
  seen.current=ids},[available.map((o:any)=>o.id).join(',')]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),5000);return()=>clearTimeout(t)},[toast]);
 useEffect(()=>{if(!msg)return;const t=setTimeout(()=>setMsg(''),4500);return()=>clearTimeout(t)},[msg]);
 const stops=route?route.ordered:[...active].sort((a:any,b:any)=>(a.status==='OUT_FOR_DELIVERY'?0:1)-(b.status==='OUT_FOR_DELIVERY'?0:1));
 const current:any=stops[0];const others=stops.slice(1);
 const initials=String(session.fullName||'L').split(/\s+/).map((x:string)=>x[0]).slice(0,2).join('').toUpperCase();
 const stepOf=(o:any)=>o.status==='READY_FOR_DELIVERY'?1:o.status==='OUT_FOR_DELIVERY'&&!o.delivery?.arrivedAt?2:o.status==='OUT_FOR_DELIVERY'?3:o.status==='RETURNING'?3:1;
 const addr=(o:any)=>o.deliveryAddress||o.shop?.address||o.shop?.region||'';
 const onShift=!!shift.current;
 return <div className="delivery-app driver-app driver-v3"><PwaRegister/>
  <header className="dv-top">
   <button type="button" className="dv-avatar" onClick={()=>setMenu(true)} aria-label="Menu du livreur"><span>{initials}</span><i className={online?'on':'off'}/></button>
   <div className="dv-top-title"><b>{session.fullName}</b><small>{session.companyName}{!online&&' · hors ligne'}</small></div>
   <RealtimeNotificationCenter apiUrl="/api/delivery/notifications" eventsUrl="/api/delivery/events-stream" storageKey="fixi-delivery-notifications" onEvent={load}/>
  </header>
  <main className="dv-main">
   <section className={'dv-hero'+(onShift?' is-on':'')+(!online?' is-offline':'')}>
    <div className="dv-hero-row">
     <div><span className="dv-kicker">{!online?'Connexion perdue':shift.pendingCashier?'Recette en attente':onShift?'En service':'Hors service'}</span>
      <h1>{!online?'Vérifiez Internet':shift.pendingCashier?'Le caissier valide votre recette':onShift?(active.length?`${active.length} livraison${active.length>1?'s':''} en cours`:available.length?`${available.length} mission${available.length>1?'s':''} à prendre`:'En attente de missions'):'Démarrez votre journée'}</h1></div>
     {onShift&&<button type="button" className={'dv-switch'+(driverAvailable?' is-on':'')} onClick={toggleAvailable} aria-pressed={driverAvailable} aria-label="Disponible pour de nouvelles missions"><span/><b>{driverAvailable?'Disponible':'Pause'}</b></button>}
    </div>
    <div className="dv-stats">
     <div><b>{deliveredToday.length}</b><span>Livrées</span></div>
     <div><b>{money(codToday)}</b><span>Encaissé</span></div>
     <div><b>{exceptionsToday}</b><span>Incidents</span></div>
    </div>
    {!online?<button className="dv-hero-cta" onClick={load}><RefreshCw size={18}/> Réessayer</button>:
     shift.pendingCashier?<Link className="dv-hero-cta" href="/delivery/encaissements"><Banknote size={18}/> Voir ma recette · {money(shift.pendingCashier.declaredRemit||0)}</Link>:
     !onShift?<SlideToConfirm label="Glisser pour démarrer la journée" tone="dark" onConfirm={()=>setShiftModal('open')}/>:
     <div className="dv-hero-tools"><button type="button" className={'dv-chip'+(tracking?' is-on':'')} onClick={()=>setTracking(v=>!v)}><Map size={15}/> GPS {tracking?'actif':'en pause'}</button>
      <button type="button" className="dv-chip" onClick={load}><RefreshCw size={15}/> Actualiser</button>
      <button type="button" className="dv-chip dv-chip--end" onClick={()=>{setShiftForm(x=>({...x,remittedCod:String(codToday.toFixed?codToday.toFixed(3):codToday),endMileage:'',note:''}));setShiftModal('close')}}><PauseCircle size={15}/> Fin de journée</button></div>}
   </section>

   {err&&<div className="dv-alert is-error" role="alert"><AlertTriangle size={18}/><span>{err}</span><button onClick={()=>setErr('')} aria-label="Fermer"><X size={16}/></button></div>}

   {view==='orders'&&<><DriverExtras/>
    {available.length>0&&<section className="dv-section">
     <h2 className="dv-h2"><span className="dv-pulse"/> Nouvelles missions <em>{available.length}</em></h2>
     <div className="dv-offers">{available.map((o:any)=><article key={o.id} className="dv-offer">
      <header><span className="dv-ref">{o.reference}</span><strong>{money(o.total)}</strong></header>
      <h3>{o.shop?.name}</h3>
      <p><MapPinned size={15}/> {addr(o)||'Adresse non renseignée'}</p>
      <div className="dv-offer-meta"><span><PackageCheck size={14}/> {o.items?.length||0} article{(o.items?.length||0)>1?'s':''}</span>{Number(o.customerDue||0)>0&&<span><WalletCards size={14}/> Dû {money(o.customerDue)}</span>}<span><Clock3 size={14}/> {dateTime(o.createdAt)}</span></div>
      <SlideToConfirm label={onShift?'Glisser pour accepter':'Démarrez la journée d’abord'} disabled={busy===o.id||!onShift} onConfirm={()=>void accept(o)}/>
     </article>)}</div>
    </section>}

    {current?<section className="dv-section">
     <h2 className="dv-h2">Livraison en cours{route&&<small> · tournée optimisée ≈ {route.km} km</small>}</h2>
     {(()=>{const o=current,step=stepOf(o),collected=Number(o.delivery?.cashCollected||0),toCollect=Math.max(0,Number(o.total||0)-collected);return <article className="dv-current" key={o.id}>
      <ol className="dv-steps" aria-label="Étapes">{['Acceptée','En route','Arrivé','Remise'].map((l,i)=><li key={l} className={i<step?'done':i===step?'now':''}><i/><span>{l}</span></li>)}</ol>
      <div className="dv-current-head"><div><span className="dv-ref">{o.reference}</span><h3>{o.shop?.name}</h3><p><MapPinned size={15}/> {addr(o)||'Adresse non renseignée'}</p></div>
       <div className="dv-amount"><span>{toCollect>0?'À encaisser':'Payé'}</span><b>{money(toCollect>0?toCollect:o.total)}</b>{collected>0&&<small>déjà {money(collected)}</small>}</div></div>
      <div className="dv-quick">
       {addr(o)&&<a href={maps(addr(o))} target="_blank" rel="noreferrer"><Navigation size={20}/><span>Itinéraire</span></a>}
       {o.shop?.phone&&<a href={'tel:'+o.shop.phone}><Phone size={20}/><span>Appeler</span></a>}
       {o.status==='OUT_FOR_DELIVERY'&&<button type="button" onClick={()=>openEvent(o,'COD_COLLECTED')}><Banknote size={20}/><span>Encaisser</span></button>}
       {o.status==='OUT_FOR_DELIVERY'&&Number(o.customerDue||0)>0&&<button type="button" onClick={()=>openDue(o)}><WalletCards size={20}/><span>Dû client</span></button>}
       <Link href={'/delivery/orders/'+o.id+'/ticket'} target="_blank"><PackageCheck size={20}/><span>Bon</span></Link>
       {o.status==='OUT_FOR_DELIVERY'&&<button type="button" onClick={()=>setMoreFor(o)}><AlertTriangle size={20}/><span>Problème</span></button>}
      </div>
      <details className="dv-parcel"><summary>Colis : {o.items?.length||0} ligne{(o.items?.length||0)>1?'s':''}</summary>{(o.items||[]).map((i:any)=><div key={i.id}><span>{i.product?.name} × {i.quantity}</span><b>{money(Number(i.unitPrice)*i.quantity)}</b></div>)}</details>
      {o.status==='READY_FOR_DELIVERY'&&<SlideToConfirm label={onShift?'Glisser pour partir':'Démarrez la journée d’abord'} disabled={busy===o.id||!onShift} onConfirm={()=>void patch(o,{status:'OUT_FOR_DELIVERY'})}/>}
      {o.status==='OUT_FOR_DELIVERY'&&!o.delivery?.arrivedAt&&<SlideToConfirm label="Glisser : je suis arrivé" disabled={busy===o.id} onConfirm={()=>void confirmArrival(o)}/>}
      {o.status==='OUT_FOR_DELIVERY'&&o.delivery?.arrivedAt&&<SlideToConfirm label="Glisser pour confirmer la remise" tone="ok" disabled={busy===o.id} onConfirm={()=>{setProof({recipientName:'',recipientPhone:o.shop?.phone||'',proofCode:'',proofUrl:''});setProofModal({order:o})}}/>}
      {o.status==='RETURNING'&&<div className="dv-alert"><PackageCheck size={18}/><span><b>Retour à remettre au fournisseur.</b> Le stock est réintégré après contrôle.</span></div>}
      {events.filter((e:any)=>e.orderId===o.id).length>0&&<ul className="dv-log">{events.filter((e:any)=>e.orderId===o.id).slice(0,4).map((e:any)=><li key={e.id}><i/><span><b>{eventLabel(e.type)}</b>{e.amount!=null&&' · '+money(e.amount)}{e.note?' · '+e.note:''}</span><time>{new Date(e.createdAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</time></li>)}</ul>}
     </article>})()}
    </section>:available.length===0&&<section className="dv-empty"><div className="dv-empty-art"><Truck size={40}/></div><h2>{onShift?'Aucune mission pour le moment':'Prêt à rouler ?'}</h2><p>{onShift?'Restez disponible : une alerte sonne dès qu’une commande est prête.':'Démarrez votre journée pour recevoir les missions.'}</p></section>}

    {others.length>0&&<section className="dv-section">
     <div className="dv-h2-row"><h2 className="dv-h2">Prochains arrêts <em>{others.length}</em></h2>{active.length>1&&<button className="dv-chip" onClick={optimizeRoute}><Route size={15}/> {route?'Recalculer':'Optimiser'}</button>}{route?.url&&<a className="dv-chip" href={route.url} target="_blank" rel="noreferrer"><MapPinned size={15}/> Tout l’itinéraire</a>}</div>
     <ol className="dv-stops">{others.map((o:any,i:number)=><li key={o.id}><span className="dv-stop-n">{i+2}</span><div><b>{o.shop?.name}</b><small>{addr(o)||'Adresse non renseignée'}</small></div><strong>{money(o.total)}</strong>
      {o.status==='READY_FOR_DELIVERY'&&<button className="dv-chip" disabled={busy===o.id||!onShift} onClick={()=>void patch(o,{status:'OUT_FOR_DELIVERY'})}><PlayCircle size={15}/> Partir</button>}</li>)}</ol>
    </section>}
   </>}

   {view==='dues'&&<section className="dv-section"><h2 className="dv-h2">Dus clients</h2>
    {active.filter((o:any)=>Number(o.customerDue||0)>0).length===0?<div className="dv-empty small"><WalletCards size={30}/><p>Aucun dû à encaisser sur votre tournée.</p></div>:
    <div className="dv-list">{active.filter((o:any)=>Number(o.customerDue||0)>0).map((o:any)=><article key={'d'+o.id} className="dv-row"><div><b>{o.shop?.name}</b><small>{o.shop?.phone||'Sans téléphone'} · {(o.dueDetails||[]).length} facture(s)</small></div><strong>{money(o.customerDue)}</strong><button className="dv-chip" disabled={o.status!=='OUT_FOR_DELIVERY'} onClick={()=>openDue(o)}>Encaisser</button></article>)}</div>}
   </section>}

   {view==='history'&&<section className="dv-section"><h2 className="dv-h2">Historique <em>{done.length}</em></h2>
    {done.length===0?<div className="dv-empty small"><History size={30}/><p>Vos livraisons terminées apparaîtront ici.</p></div>:
    <div className="dv-list">{done.map((o:any)=><article key={o.id} className="dv-row"><CheckCircle2 size={20} className="dv-ok"/><div><b>{o.shop?.name}</b><small>{o.reference} · {o.delivery?.recipientName?'reçu par '+o.delivery.recipientName:'livrée'} · {dateTime(o.delivery?.deliveredAt||o.updatedAt)}</small></div><strong>{money(o.total)}</strong></article>)}</div>}
   </section>}
  </main>

  <nav className="dv-tabs" aria-label="Navigation livreur">
   <button className={view==='orders'?'active':''} onClick={()=>setView('orders')}><Truck size={22}/><span>Missions</span>{available.length+active.length>0&&<b>{available.length+active.length}</b>}</button>
   <button className={view==='dues'?'active':''} onClick={()=>setView('dues')}><WalletCards size={22}/><span>Dus</span>{active.filter((o:any)=>Number(o.customerDue||0)>0).length>0&&<b>{active.filter((o:any)=>Number(o.customerDue||0)>0).length}</b>}</button>
   <button className={view==='history'?'active':''} onClick={()=>setView('history')}><History size={22}/><span>Historique</span></button>
   <Link href="/delivery/encaissements"><Banknote size={22}/><span>Ma caisse</span></Link>
  </nav>

  {(toast||msg)&&<div className={'dv-toast'+(toast?' is-new':'')} role="status" onClick={()=>{setToast('');setMsg('');setView('orders')}}>{toast?<Truck size={18}/>:<CheckCircle2 size={18}/>}<span>{toast||msg}</span></div>}

  <FxSheet open={menu} onClose={()=>setMenu(false)} side="bottom" title={session.fullName} subtitle={session.companyName+' · Livreur'} label="Menu du livreur">
   <div className="dv-menu">
    <div className="dv-menu-row"><span>Langue</span><LangToggle/></div>
    <div className="dv-menu-row"><span>Taille du texte</span><TextSizeToggle/></div>
    <div className="dv-menu-row"><span>Widget Android</span><AndroidWidgetButton space="delivery"/></div>
    <div className="dv-menu-row"><span>Un souci ?</span><ReportProblemButton space="delivery" className="btn btn-soft btn-sm" label/></div>
    <Link className="btn btn-soft btn-block" href="/delivery/encaissements"><Banknote size={18}/> Ma caisse et mes remises</Link>
    <button className="btn btn-ghost btn-block dv-logout" onClick={logout}><LogOut size={18}/> Se déconnecter</button>
   </div>
  </FxSheet>
  <FxSheet open={!!moreFor} onClose={()=>setMoreFor(null)} side="bottom" title="Un problème ?" subtitle={moreFor?moreFor.reference+' · '+(moreFor.shop?.name||''):''} label="Problème de livraison">
   <div className="dv-more">{([['SHOP_CLOSED','Atelier fermé',Store],['CUSTOMER_ABSENT','Client absent',UserRound],['DELIVERY_REFUSED','Livraison refusée',RotateCcw],['RESCHEDULED','Reprogrammer',CalendarClock],['INCIDENT','Incident (accident, panne…)',AlertTriangle],['RETURN_TO_DEPOT','Retour au fournisseur',PackageCheck]] as const).map(([t,l,I])=><button key={t} type="button" onClick={()=>{const o=moreFor;setMoreFor(null);openEvent(o,t as DriverEventType)}}><I size={20}/><span>{l}</span></button>)}</div>
  </FxSheet>
  {dueModal&&<div className="supplier-modal-backdrop"><div className="supplier-modal delivery-modal"><button className="supplier-modal-x" onClick={()=>setDueModal(null)}><X/></button><span className="smart-kicker"><WalletCards size={13}/> CRÉANCE ATELIER</span><h2>{dueModal.shop?.name}</h2><p>Solde ouvert chez ce fournisseur : <b>{money(dueData?.due||0)}</b></p>{(dueData?.sales||[]).length>0&&<div className="driver-due-lines detailed">{dueData.sales.slice(0,8).map((s:any)=><details key={s.id}><summary><span><b>{s.reference}</b><small>{dateTime(s.createdAt)}</small></span><strong>{money(s.due??Math.max(0,Number(s.total)-Number(s.paid)))}</strong></summary><div className="driver-due-invoice-detail"><div><h4>Produits</h4>{(s.items||[]).map((i:any)=><p key={i.id}><span>{i.name} <small>{i.sku||''}</small></span><b>{i.quantity} × {money(i.unitPrice)}</b></p>)}</div><div><h4>Paiements</h4>{(s.payments||[]).map((p:any)=><p key={p.id}><span>{dateTime(p.createdAt)} · {p.method}</span><b>{money(p.amount)}</b></p>)}{!(s.payments||[]).length&&<small>Aucun paiement précédent</small>}</div>{s.delivery&&<div className="driver-due-proof"><ShieldCheck/><span><b>{s.delivery.driverName||'Livraison Fixi'}</b><small>{s.delivery.deliveredAt?'Livrée '+dateTime(s.delivery.deliveredAt):'Livraison enregistrée'}{s.delivery.recipientName?' · reçu par '+s.delivery.recipientName:''}</small></span></div>}</div></details>)}</div>}<label className="label">Montant encaissé</label><div className="supplier-money-input"><input type="number" min=".001" max={dueData?.due||0} step=".001" value={dueAmount} onChange={e=>setDueAmount(e.target.value)}/><b>DT</b></div><button disabled={busy===dueModal.id||!(Number(dueAmount)>0)||Number(dueAmount)>Number(dueData?.due||0)} className="btn btn-primary btn-block" onClick={collectDue}><Banknote/> Enregistrer l’encaissement</button></div></div>}
  {eventModal&&<div className="supplier-modal-backdrop"><div className="supplier-modal delivery-modal"><button className="supplier-modal-x" onClick={()=>setEventModal(null)}><X/></button><span className="smart-kicker"><AlertTriangle size={13}/> ÉVÉNEMENT TERRAIN</span><h2>{eventLabel(eventModal.type)}</h2><p>{eventModal.order.reference} · {eventModal.order.shop?.name}</p>{['COD_COLLECTED','DUE_COLLECTED'].includes(eventModal.type)&&<><label className="label">Montant encaissé</label><div className="supplier-money-input"><input autoFocus type="number" min="0" step="0.001" value={eventAmount} onChange={e=>setEventAmount(e.target.value)}/><b>DT</b></div></>}{['SHOP_CLOSED','CUSTOMER_ABSENT','DELIVERY_REFUSED','INCIDENT'].includes(eventModal.type)&&<><div className="dv-reasons">{(({SHOP_CLOSED:['Rideau baissé','Fermé pour la pause','Fermé toute la journée'],CUSTOMER_ABSENT:['Personne ne répond','Téléphone éteint','Gérant absent'],DELIVERY_REFUSED:['Mauvaise pièce','Commande annulée','Refuse de payer'],INCIDENT:['Panne','Accident','Colis abîmé']} as Record<string,string[]>)[eventModal.type]||[]).map(r=><button type="button" key={r} aria-pressed={eventNote===r} onClick={()=>setEventNote(r)}>{r}</button>)}</div>
<label className="dv-photo">{eventPhoto?<img src={eventPhoto} alt="Photo de preuve"/>:<Camera size={20}/>}<span><b>{eventPhoto?'Photo ajoutée':'Photo de preuve'}</b><small>Devanture, rideau, colis… avec l’heure et la position GPS</small></span><input type="file" accept="image/*" capture="environment" onChange={async e=>{const f=e.target.files?.[0];if(f)setEventPhoto(await compressImage(f))}}/></label></>}
<label className="label">Note / motif</label><textarea className="input" autoFocus={eventModal.type!=='COD_COLLECTED'} value={eventNote} onChange={e=>setEventNote(e.target.value)} placeholder="Ajoutez une information utile au responsable livraison…"/><button disabled={busy===eventModal.order.id} className="btn btn-primary btn-block" onClick={addEvent}>Enregistrer</button></div></div>}
  {proofModal&&<div className="supplier-modal-backdrop"><div className="supplier-modal delivery-modal proof-modal"><button className="supplier-modal-x" onClick={()=>setProofModal(null)}><X/></button><span className="smart-kicker"><ShieldCheck size={13}/> PREUVE DE LIVRAISON</span><h2>Confirmer la remise</h2><p>La confirmation est historisée et visible par le fournisseur.</p><label className="label">Nom du réceptionnaire *</label><div className="supplier-icon-input"><UserRound/><input className="input" autoFocus value={proof.recipientName} onChange={e=>setProof({...proof,recipientName:e.target.value})}/></div><label className="label">Téléphone</label><input className="input" value={proof.recipientPhone} onChange={e=>setProof({...proof,recipientPhone:e.target.value})}/><label className="label">Code unique affiché dans l’atelier *</label><div className="delivery-code-entry"><input className="input" inputMode="numeric" placeholder="6 chiffres" value={proof.proofCode} onChange={e=>setProof({...proof,proofCode:e.target.value.replace(/\D/g,'').slice(0,8)})}/><button type="button" className="btn btn-soft" onClick={()=>setProofScanner(true)}><Camera/> Scanner QR</button></div><SignaturePad onChange={setSignature}/><label className="driver-photo-upload"><Camera/><span><b>{proof.proofUrl?'Photo ajoutée':'Ajouter une photo de preuve'}</b><small>Optionnel · image compressée</small></span><input type="file" accept="image/*" capture="environment" onChange={e=>photo(e.target.files?.[0])}/></label><button disabled={busy===proofModal.order.id||!proof.recipientName.trim()||proof.proofCode.length!==6} className="btn btn-primary btn-block" onClick={confirmDelivery}><CheckCircle2/> Livraison remise</button></div></div>}
  {proofScanner&&<BarcodeCamera onClose={()=>setProofScanner(false)} onDetected={raw=>{const code=String(raw).replace(/^FIXI-DELIVERY:/,'').replace(/\D/g,'').slice(0,6);setProof(p=>({...p,proofCode:code}));setProofScanner(false)}}/>}
  {shiftModal&&<div className="supplier-modal-backdrop" role="presentation"><div className="supplier-modal delivery-modal" role="dialog" aria-modal="true" aria-labelledby="fixi-driver-shift-title"><button className="supplier-modal-x" onClick={()=>setShiftModal(null)}><X/></button><span className="smart-kicker"><Gauge size={13}/> JOURNÉE LIVREUR</span><h2 id="fixi-driver-shift-title">{shiftModal==='open'?'Démarrer la journée':'Clôturer la journée'}</h2>{shiftModal==='open'?<><label className="label">Espèces de départ</label><input className="input" type="number" min="0" step="0.001" value={shiftForm.startCash} onChange={e=>setShiftForm({...shiftForm,startCash:e.target.value})}/><label className="label">Kilométrage départ</label><input className="input" type="number" min="0" value={shiftForm.startMileage} onChange={e=>setShiftForm({...shiftForm,startMileage:e.target.value})}/></>:<><div className="driver-close-summary"><span>COD enregistré aujourd’hui</span><b>{money(codToday)}</b></div><label className="label">COD remis au responsable</label><input className="input" type="number" min="0" step="0.001" value={shiftForm.remittedCod} onChange={e=>setShiftForm({...shiftForm,remittedCod:e.target.value})}/><label className="label">Kilométrage fin</label><input className="input" type="number" min="0" value={shiftForm.endMileage} onChange={e=>setShiftForm({...shiftForm,endMileage:e.target.value})}/></>}<label className="label">Note</label><textarea className="input" value={shiftForm.note} onChange={e=>setShiftForm({...shiftForm,note:e.target.value})}/>{err&&<p role="alert" className="driver-shift-form-error"><AlertTriangle size={16}/>{err}</p>}
    <p className="driver-shift-form-help">{shiftModal==='open'?'Le fond de caisse est optionnel (0 DT par défaut). Une fois validée, la journée sera enregistrée dans l’historique.':'Après validation, le fournisseur devra confirmer votre remise de caisse.'}</p>
    <button type="button" disabled={busy==='SHIFT'} className="btn btn-primary btn-block" onClick={()=>void shiftAction()}>
      {busy==='SHIFT'?'Enregistrement…':shiftModal==='open'?'Confirmer le démarrage':'Déclarer la remise caisse'}
    </button></div></div>}
 </div>
}

function eventLabel(type:string){const x:Record<string,string>={COD_COLLECTED:'Encaissement COD',DUE_COLLECTED:'Ancien dû encaissé',CUSTOMER_ABSENT:'Client absent',SHOP_CLOSED:'Atelier fermé',ETA_SOON:'Arrivée annoncée',DELIVERY_REFUSED:'Livraison refusée',RESCHEDULED:'Livraison reprogrammée',INCIDENT:'Incident',RETURN_TO_DEPOT:'Retour vers fournisseur',DELIVERY_ACCEPTED:'Commande acceptée',DELIVERY_PROOF:'Preuve de livraison',ARRIVED_AT_SHOP:'Arrivée chez la boutique'};return x[type]||type.replaceAll('_',' ')}
async function compressImage(file:File){return new Promise<string>((resolve,reject)=>{const img=new Image();const url=URL.createObjectURL(file);img.onload=()=>{const max=960,scale=Math.min(1,max/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);const ctx=canvas.getContext('2d');if(!ctx){URL.revokeObjectURL(url);return reject(new Error('Image non supportée'))}ctx.drawImage(img,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);resolve(canvas.toDataURL('image/jpeg',.72))};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Image illisible'))};img.src=url})}
