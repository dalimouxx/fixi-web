'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,MapPinned,Navigation,Phone,Truck,CheckCircle2,RefreshCw,Map,Clock3} from 'lucide-react';
import {api} from './ui';
import {dateTime,money} from '@/lib/format';

const labels:Record<string,string>={READY_FOR_DELIVERY:'Prête',OUT_FOR_DELIVERY:'En route',DELIVERED:'Livrée',FAILED:'Échec'};
export function SupplierDeliveryApp({session}:{session:any}){
 const[orders,setOrders]=useState<any[]>([]);const[busy,setBusy]=useState<string>('');const[msg,setMsg]=useState('');
 async function load(){const r=await fetch('/api/supplier/orders',{cache:'no-store'});const j=await r.json();setOrders(Array.isArray(j)?j:[])}
 useEffect(()=>{load();const t=setInterval(load,20000);return()=>clearInterval(t)},[]);
 const active=useMemo(()=>orders.filter(o=>['READY_FOR_DELIVERY','OUT_FOR_DELIVERY'].includes(o.status)),[orders]);
 async function setStatus(o:any,status:string){setBusy(o.id);setMsg('');try{let extra:any={};if(status==='OUT_FOR_DELIVERY'){extra.driverName=o.delivery?.driverName||session.fullName;extra.driverPhone=o.delivery?.driverPhone||''}await api('/api/supplier/orders/'+o.id,{method:'PATCH',body:JSON.stringify({status,...extra})});await load()}catch(e:any){setMsg(e.message)}finally{setBusy('')}}
 function sharePosition(o:any){if(!navigator.geolocation){setMsg('Géolocalisation non disponible sur cet appareil.');return}setBusy(o.id);navigator.geolocation.getCurrentPosition(async pos=>{try{const trackingNote=`GPS:${pos.coords.latitude},${pos.coords.longitude}|${new Date().toISOString()}`;await api('/api/supplier/orders/'+o.id,{method:'PATCH',body:JSON.stringify({status:o.status,trackingNote,driverName:o.delivery?.driverName||session.fullName,driverPhone:o.delivery?.driverPhone||''})});setMsg('Position mise à jour.');await load()}catch(e:any){setMsg(e.message)}finally{setBusy('')}},()=>{setBusy('');setMsg('Autorisez la localisation pour partager votre position.')},{enableHighAccuracy:true,timeout:10000,maximumAge:5000})}
 function maps(address:string){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(address)}
 return <div className="delivery-app">
   <header><Link href="/supplier"><ArrowLeft/> Supplier</Link><div><b>Fixi Delivery</b><span>{session.companyName}</span></div><button onClick={load}><RefreshCw/></button></header>
   <main>
    <div className="delivery-hero"><div><span>TOURNÉE ACTIVE</span><h1>Livraisons du jour</h1><p>{active.length} livraison(s) à traiter. Partagez votre position uniquement pendant une course active.</p></div><div className="delivery-driver"><Truck/><b>{session.fullName}</b><span>Livreur connecté</span></div></div>
    {msg&&<div className="success" style={{marginBottom:12}}>{msg}</div>}
    <div className="delivery-list">
      {active.map(o=>{const address=o.shop?.address||o.shop?.region||'';return <article key={o.id}>
        <div className="delivery-card-top"><div><code>{o.reference}</code><h2>{o.shop?.name}</h2><span><Clock3/> {dateTime(o.createdAt)}</span></div><span className={'status-pill '+o.status.toLowerCase()}>{labels[o.status]||o.status}</span></div>
        <div className="delivery-destination"><MapPinned/><div><b>{address||'Adresse non renseignée'}</b><span>{o.shop?.phone||'Téléphone non renseigné'}</span></div></div>
        <div className="delivery-items">{o.items.map((i:any)=><div key={i.id}><span>{i.product.name} × {i.quantity}</span><b>{money(Number(i.unitPrice)*i.quantity)}</b></div>)}</div>
        <div className="delivery-total"><span>À livrer</span><b>{money(o.total)}</b></div>
        <div className="delivery-actions">
          {address&&<a className="btn btn-soft" target="_blank" href={maps(address)}><Navigation/> Navigation</a>}
          {o.shop?.phone&&<a className="btn btn-soft" href={'tel:'+o.shop.phone}><Phone/> Appeler</a>}
          {o.status==='READY_FOR_DELIVERY'&&<button disabled={busy===o.id} className="btn btn-primary" onClick={()=>setStatus(o,'OUT_FOR_DELIVERY')}><Truck/> Démarrer</button>}
          {o.status==='OUT_FOR_DELIVERY'&&<button disabled={busy===o.id} className="btn btn-soft" onClick={()=>sharePosition(o)}><Map/> Partager position</button>}
          {o.status==='OUT_FOR_DELIVERY'&&<button disabled={busy===o.id} className="btn btn-primary" onClick={()=>setStatus(o,'DELIVERED')}><CheckCircle2/> Livrée</button>}
        </div>
      </article>})}
      {!active.length&&<div className="delivery-empty"><CheckCircle2/><h2>Aucune livraison active</h2><p>Les nouvelles commandes prêtes apparaîtront automatiquement ici.</p></div>}
    </div>
   </main>
 </div>
}
