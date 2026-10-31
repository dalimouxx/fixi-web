'use client';
import {useEffect,useState} from 'react';
import {BellRing,BellOff} from 'lucide-react';

function b64ToUint8(value:string){
 const pad='='.repeat((4-value.length%4)%4),b=(value+pad).replace(/-/g,'+').replace(/_/g,'/');
 const raw=atob(b);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}

/** Works on the shop, supplier and delivery spaces; reports failures instead of
 * claiming Push is enabled when the server refused to save the subscription.
 */
export function PushToggle({subscribeUrl='/api/push/subscribe',label=false,onStateChange}:{subscribeUrl?:string;label?:boolean;onStateChange?:(active:boolean)=>void}){
 const[supported,setSupported]=useState(false);
 const[on,setOn]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  let live=true;
  const ok=typeof navigator!=='undefined'&&'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window;
  setSupported(ok);if(!ok)return;
  void navigator.serviceWorker.getRegistration().then(async reg=>{
   if(!live||!reg)return;
   const sub=await reg.pushManager.getSubscription();
   if(!live)return;
   if(!sub){setOn(false);onStateChange?.(false);return}
   // A browser subscription is not enough: it must belong to this FIXI account.
   const response=await fetch(subscribeUrl,{method:'POST',
    headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(sub)});
   if(!live)return;
   if(response.ok){setOn(true);onStateChange?.(true)}
   else{
    setOn(false);onStateChange?.(false);
    setError('Le téléphone a un abonnement navigateur, mais FIXI Cloud refuse de le rattacher à ce compte (HTTP '+response.status+').');
   }
  }).catch(()=>{if(live){setOn(false);onStateChange?.(false);setError('Impossible de vérifier l’abonnement Push du téléphone. Vérifiez Internet et la connexion FIXI.')}});
  return()=>{live=false};
 },[subscribeUrl]);

 async function toggle(){
  if(!supported||busy)return;
  setBusy(true);setError('');
  try{
   if(Notification.permission==='denied'){
    setError('Les notifications sont bloquées dans le navigateur ou le téléphone. Autorisez FIXI dans les réglages du site.');
    return;
   }
   let reg=await navigator.serviceWorker.getRegistration();
   if(!reg)reg=await navigator.serviceWorker.register('/sw.js');
   const current=await reg.pushManager.getSubscription();
   if(current&&on){
    const response=await fetch(subscribeUrl,{method:'DELETE',headers:{'Content-Type':'application/json'},
     credentials:'same-origin',body:JSON.stringify({endpoint:current.endpoint})});
    if(!response.ok)throw Error('Le serveur n’a pas confirmé la désactivation des notifications.');
    await current.unsubscribe();setOn(false);onStateChange?.(false);return;
   }
   // If the OS already has an endpoint but this FIXI account is not registered,
   // attach it instead of silently unsubscribing the device.
   if(current&&!on){
    const response=await fetch(subscribeUrl,{method:'POST',headers:{'Content-Type':'application/json'},
     credentials:'same-origin',body:JSON.stringify(current)});
    if(!response.ok)throw Error('FIXI Cloud refuse de rattacher cet abonnement (HTTP '+response.status+').');
    setOn(true);onStateChange?.(true);return;
   }
   const keyResponse=await fetch('/api/push/public-key',{cache:'no-store'});
   if(!keyResponse.ok)throw Error('Clé Push indisponible sur FIXI Cloud.');
   const key=await keyResponse.json();
   if(!key.publicKey)throw Error('Notifications Push non configurées sur le serveur.');
   const perm=await Notification.requestPermission();
   if(perm!=='granted'){setError('Autorisation de notifications non accordée.');return}
   const subscription=await reg.pushManager.subscribe({
    userVisibleOnly:true,applicationServerKey:b64ToUint8(key.publicKey)
   });
   const response=await fetch(subscribeUrl,{method:'POST',headers:{'Content-Type':'application/json'},
    credentials:'same-origin',body:JSON.stringify(subscription)});
   if(!response.ok){
    await subscription.unsubscribe().catch(()=>{});
    throw Error('FIXI Cloud a refusé d’enregistrer ce téléphone (HTTP '+response.status+').');
   }
   setOn(true);onStateChange?.(true);
  }catch(e){
   setError(e instanceof Error?e.message:'Activation des notifications impossible.');
  }finally{setBusy(false)}
 }
 if(!supported)return label?<small role="status">Push non disponible dans ce navigateur. Installez la PWA FIXI compatible ou utilisez Android/iOS pris en charge.</small>:null;
 return <>
  <button type="button" className={'push-toggle '+(on?'on':'')+(label?' labeled':'')}
   onClick={()=>void toggle()} disabled={busy}
   title={on?'Désactiver les notifications Push':'Activer les notifications Push'}
   aria-pressed={on}>
   {on?<BellRing size={17}/>:<BellOff size={17}/>}
   {label&&<span>{busy?'Vérification…':on?'Push activé':'Activer Push'}</span>}
  </button>
  {error&&<small role="alert" className="push-error">{error}</small>}
 </>;
}
