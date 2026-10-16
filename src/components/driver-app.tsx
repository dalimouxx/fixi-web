'use client';
import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {MapPinned,Navigation,Phone,Truck,CheckCircle2,RefreshCw,Map,Clock3,Banknote,AlertTriangle,RotateCcw,CalendarClock,PackageCheck,LogOut,PlayCircle} from 'lucide-react';
import {api} from './ui';
import {dateTime,money} from '@/lib/format';

const labels:Record<string,string>={READY_FOR_DELIVERY:'À démarrer',OUT_FOR_DELIVERY:'En route',DELIVERED:'Livrée'};
export function DriverApp({session}:{session:any}){
 const router=useRouter();const[orders,setOrders]=useState<any[]>([]);const[events,setEvents]=useState<any[]>([]);const[busy,setBusy]=useState('');const[msg,setMsg]=useState('');
 async function load(){const [o,e]=await Promise.all([fetch('/api/delivery/orders',{cache:'no-store'}),fetch('/api/delivery/events',{cache:'no-store'})]);const oj=await o.json();const ej=await e.json();setOrders(Array.isArray(oj)?oj:[]);setEvents(Array.isArray(ej)?ej:[])}
 useEffect(()=>{load();const t=setInterval(load,20000);return()=>clearInterval(t)},[]);
 const active=useMemo(()=>orders.filter(o=>['READY_FOR_DELIVERY','OUT_FOR_DELIVERY'].includes(o.status)),[orders]);
 const done=useMemo(()=>orders.filter(o=>o.status==='DELIVERED').slice(0,20),[orders]);
 async function logout(){await fetch('/api/delivery/auth/logout',{method:'POST'});router.push('/delivery/login');router.refresh()}
 async function patch(o:any,payload:any){setBusy(o.id);setMsg('');try{await api('/api/delivery/orders/'+o.id,{method:'PATCH',body:JSON.stringify(payload)});await load()}catch(e:any){setMsg(e.message)}finally{setBusy('')}}
 async function addEvent(o:any,type:string,note?:string,amount?:number){try{await api('/api/delivery/events',{method:'POST',body:JSON.stringify({orderId:o.id,type,note:note||null,amount:Number.isFinite(Number(amount))?Number(amount):null})});setMsg('Événement enregistré');await load()}catch(e:any){setMsg(e.message)}}
 function sharePosition(o:any){if(!navigator.geolocation){setMsg('Géolocalisation non disponible');return}setBusy(o.id);navigator.geolocation.getCurrentPosition(async pos=>{try{await patch(o,{status:o.status,trackingNote:`GPS:${pos.coords.latitude},${pos.coords.longitude}|${new Date().toISOString()}`,latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy:pos.coords.accuracy})}catch{}finally{setBusy('')}},()=>{setBusy('');setMsg('Autorisez la localisation pour partager votre position.')},{enableHighAccuracy:true,timeout:10000,maximumAge:3000})}
 function maps(address:string){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(address)}
 return <div className="delivery-app driver-app">
  <header><div className="driver-header-brand"><Truck/><span><b>Fixi Delivery</b><small>{session.companyName}</small></span></div><div><b>{session.fullName}</b><span>Compte livreur</span></div><button onClick={logout} title="Déconnexion"><LogOut/></button></header>
  <main>
   <div className="delivery-hero"><div><span>MA TOURNÉE</span><h1>{active.length} livraison(s) active(s)</h1><p>Vous ne voyez ici que les commandes qui vous sont personnellement affectées.</p></div><button className="btn btn-soft" onClick={load}><RefreshCw/> Actualiser</button></div>
   {msg&&<div className="success" style={{marginBottom:12}}>{msg}</div>}
   <div className="delivery-list">
    {active.map(o=>{const address=o.shop?.address||o.shop?.region||'';return <article key={o.id}>
      <div className="delivery-card-top"><div><code>{o.reference}</code><h2>{o.shop?.name}</h2><span><Clock3/> {dateTime(o.createdAt)}</span></div><span className={'status-pill '+o.status.toLowerCase()}>{labels[o.status]||o.status}</span></div>
      <div className="delivery-destination"><MapPinned/><div><b>{address||'Adresse non renseignée'}</b><span>{o.shop?.phone||'Téléphone non renseigné'}</span></div></div>
      <div className="delivery-items">{o.items.map((i:any)=><div key={i.id}><span>{i.product.name} × {i.quantity}</span><b>{money(Number(i.unitPrice)*i.quantity)}</b></div>)}</div>
      <div className="delivery-total"><span>Montant commande</span><b>{money(o.total)}</b></div>
      <div className="delivery-actions">
       {address&&<a className="btn btn-soft" target="_blank" href={maps(address)}><Navigation/> Navigation</a>}
       {o.shop?.phone&&<a className="btn btn-soft" href={'tel:'+o.shop.phone}><Phone/> Appeler</a>}
       {o.status==='READY_FOR_DELIVERY'&&<button disabled={busy===o.id} className="btn btn-primary" onClick={()=>patch(o,{status:'OUT_FOR_DELIVERY'})}><PlayCircle/> Démarrer</button>}
       {o.status==='OUT_FOR_DELIVERY'&&<button disabled={busy===o.id} className="btn btn-soft" onClick={()=>sharePosition(o)}><Map/> Position</button>}
       {o.status==='OUT_FOR_DELIVERY'&&<button className="btn btn-soft" onClick={()=>{const a=Number(prompt('Montant COD encaissé (DT)',String(Number(o.total)))||0);if(a>=0)addEvent(o,'COD_COLLECTED','Encaissement COD',a)}}><Banknote/> COD</button>}
       {o.status==='OUT_FOR_DELIVERY'&&<button className="btn btn-soft" onClick={()=>addEvent(o,'CUSTOMER_ABSENT',prompt('Note absence')||'Client absent')}><AlertTriangle/> Absent</button>}
       {o.status==='OUT_FOR_DELIVERY'&&<button className="btn btn-soft" onClick={()=>addEvent(o,'DELIVERY_REFUSED',prompt('Motif du refus')||'Refus client')}><RotateCcw/> Refus</button>}
       {o.status==='OUT_FOR_DELIVERY'&&<button className="btn btn-soft" onClick={()=>addEvent(o,'RESCHEDULED',prompt('Nouvelle date / note')||'Reprogrammée')}><CalendarClock/> Reprogrammer</button>}
       {o.status==='OUT_FOR_DELIVERY'&&<button className="btn btn-soft" onClick={()=>addEvent(o,'RETURN_TO_DEPOT','Retour dépôt')}><PackageCheck/> Retour dépôt</button>}
       {o.status==='OUT_FOR_DELIVERY'&&<button disabled={busy===o.id} className="btn btn-primary" onClick={()=>patch(o,{status:'DELIVERED'})}><CheckCircle2/> Confirmer livraison</button>}
      </div>
      <div className="delivery-event-log">{events.filter((e:any)=>e.orderId===o.id).slice(0,8).map((e:any)=><div key={e.id}><i/><span><b>{e.type.replaceAll('_',' ')}</b><small>{e.note||''}{e.amount!==null&&e.amount!==undefined?` · ${money(e.amount)}`:''}</small></span><time>{dateTime(e.createdAt)}</time></div>)}</div>
    </article>})}
    {!active.length&&<div className="delivery-empty"><CheckCircle2/><h2>Aucune livraison active</h2><p>Le fournisseur doit vous affecter une commande depuis Fixi Supplier.</p></div>}
   </div>
   {done.length>0&&<section className="driver-history"><h2>Livraisons terminées</h2>{done.map(o=><div key={o.id}><span><b>{o.reference}</b><small>{o.shop?.name}</small></span><strong>{money(o.total)}</strong><CheckCircle2/></div>)}</section>}
  </main>
 </div>
}
