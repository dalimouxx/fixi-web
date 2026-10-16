'use client';
import {useEffect,useState} from 'react';
import {BellRing,BellOff} from 'lucide-react';

function b64ToUint8(v:string){const pad='='.repeat((4-v.length%4)%4),b=(v+pad).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(b);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}

export function PushToggle({subscribeUrl='/api/push/subscribe'}:{subscribeUrl?:string}){
 const[supported,setSupported]=useState(false);const[on,setOn]=useState(false);const[busy,setBusy]=useState(false);
 useEffect(()=>{
  const ok='serviceWorker'in navigator&&'PushManager'in window;setSupported(ok);if(!ok)return;
  navigator.serviceWorker.ready.then(async reg=>{const sub=await reg.pushManager.getSubscription();setOn(!!sub);if(sub)await fetch(subscribeUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sub)}).catch(()=>{})}).catch(()=>{});
 },[subscribeUrl]);
 async function toggle(){
  if(!supported||busy)return;setBusy(true);
  try{
   if(Notification.permission==='denied'){alert('Notifications bloquées dans le navigateur. Autorisez-les dans les paramètres du site.');return}
   const reg=await navigator.serviceWorker.ready;const current=await reg.pushManager.getSubscription();
   if(current){await fetch(subscribeUrl,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:current.endpoint})});await current.unsubscribe();setOn(false);return}
   const key=await fetch('/api/push/public-key').then(r=>r.json());if(!key.publicKey){alert('Push non configuré sur le serveur.');return}
   const perm=await Notification.requestPermission();if(perm!=='granted')return;
   const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToUint8(key.publicKey)});
   await fetch(subscribeUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sub)});setOn(true);
  }finally{setBusy(false)}
 }
 return supported?<button className={'push-toggle '+(on?'on':'')} onClick={toggle} disabled={busy} title={on?'Notifications Push activées':'Activer les notifications Push'}>{on?<BellRing size={17}/>:<BellOff size={17}/>}</button>:null;
}
