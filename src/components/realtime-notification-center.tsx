'use client';

import Link from 'next/link';
import {Bell,BellRing,CheckCheck,Volume2,VolumeX,MonitorUp,Smartphone,Activity,X,Truck,PackageCheck,ShoppingBag,MapPinned,CheckCircle2,Info} from 'lucide-react';
import {useEffect,useRef,useState} from 'react';
import {dateTime} from '@/lib/format';
import {playFixiNotificationSound,primeNotificationAudio,notificationAudioStatus} from '@/lib/notification-audio';
import {PushToggle} from '@/components/push-toggle';
import {getNotificationExperience} from '@/lib/notification-experience';

type Props={
  apiUrl:string;
  eventsUrl:string;
  storageKey:string;
  allHref?:string;
  compact?:boolean;
  onNavigate?:(href:string)=>void;
  onEvent?:(notification:any)=>void;
};
type Incoming={
 id:string;title:string;message:string;href?:string|null;
 experienceKey?:string;soundKey?:string;priority?:string;kind?:string;type?:string;
 readAt?:string|null;createdAt?:string;[key:string]:any;
};

const labelFor=(key:string)=>key.startsWith('SUPPLIER_')?'FIXI SUPPLIER':
  key.startsWith('SHOP_')?'FIXI BOUTIQUE':key.startsWith('DRIVER_')?'FIXI DELIVERY':'FIXI';
function ExperienceIcon({keyName}:{keyName:string}){
 if(keyName==='SUPPLIER_NEW_ORDER')return <ShoppingBag/>;
 if(keyName.startsWith('SUPPLIER_'))return <PackageCheck/>;
 if(keyName==='DRIVER_NEW_MISSION')return <Truck/>;
 if(keyName==='DRIVER_ARRIVED')return <MapPinned/>;
 if(keyName==='DRIVER_DELIVERED'||keyName==='SHOP_ORDER_DELIVERED')return <CheckCircle2/>;
 if(keyName.startsWith('SHOP_'))return <PackageCheck/>;
 return <Info/>;
}
const channelFor=(key:string)=>getNotificationExperience(key).channel;

export function RealtimeNotificationCenter({apiUrl,eventsUrl,storageKey,allHref,compact=true,onNavigate,onEvent}:Props){
  const[rows,setRows]=useState<Incoming[]>([]);
  const[unread,setUnread]=useState(0);
  const[open,setOpen]=useState(false);
  const[filter,setFilter]=useState<'ALL'|'UNREAD'>('ALL');
  const[sound,setSound]=useState(true);
  const[desktop,setDesktop]=useState(false);
  const[audioReady,setAudioReady]=useState(false);
  const[volume,setVolume]=useState(.8);
  const[diagnosticsOpen,setDiagnosticsOpen]=useState(false);
  const[pushDiagnostic,setPushDiagnostic]=useState<'UNSUPPORTED'|'BLOCKED'|'SUBSCRIBED'|'NOT_SUBSCRIBED'|'CHECKING'>('CHECKING');
  const[workerDiagnostic,setWorkerDiagnostic]=useState(false);
  const[pushTestStatus,setPushTestStatus]=useState('');
  const[pushTesting,setPushTesting]=useState(false);
  const[toast,setToast]=useState<Incoming|null>(null);
  const lastId=useRef('');
  const initial=useRef(true);
  const soundRef=useRef(true);
  const volumeRef=useRef(.8);
  const announced=useRef(new Set<string>());
  const dismissTimer=useRef<ReturnType<typeof setTimeout>|null>(null);

  function announce(n:Incoming){
    if(!n.id||announced.current.has(n.id))return;
    announced.current.add(n.id);
    if(announced.current.size>120){
      const values=[...announced.current];announced.current=new Set(values.slice(-75));
    }
    setToast(n);
    if(dismissTimer.current)clearTimeout(dismissTimer.current);
    const ex=getNotificationExperience(n.experienceKey);
    dismissTimer.current=setTimeout(()=>setToast(null),ex.duration);
    if(soundRef.current){
      const audible=playFixiNotificationSound(n.soundKey||ex.sound,volumeRef.current);
      if(!audible)setAudioReady(false);
    }
    // Avoid duplicate system + Push notifications for the same event.
    if(typeof Notification!=='undefined'&&Notification.permission==='granted'&&document.hidden){
      const fallback=()=>{try{new Notification(n.title,{body:n.message,tag:n.id})}catch{}};
      if('serviceWorker'in navigator && 'PushManager'in window){
        navigator.serviceWorker.ready.then(r=>r.pushManager.getSubscription())
          .then(sub=>{if(!sub)fallback()}).catch(fallback);
      }else fallback();
    }
  }

  async function load(fromRealtime=false){
    try{
      const r=await fetch(apiUrl,{cache:'no-store'});if(!r.ok)return;
      const j=await r.json(),next:Incoming[]=Array.isArray(j.rows)?j.rows:[];
      const newest=next[0];
      if(!initial.current&&fromRealtime&&newest&&newest.id!==lastId.current)announce(newest);
      setRows(next);setUnread(Number(j.unread||0));
      if(newest)lastId.current=newest.id;
      initial.current=false;
    }catch{/* Network reconnect/poll will retry. */}
  }

  useEffect(()=>{
    const stored=localStorage.getItem(storageKey+':sound');
    const enabled=stored!=='0';setSound(enabled);soundRef.current=enabled;
    const storedVolume=Number(localStorage.getItem(storageKey+':volume')??'.8');
    const initialVolume=Number.isFinite(storedVolume)?Math.max(0,Math.min(1,storedVolume)):.8;
    setVolume(initialVolume);volumeRef.current=initialVolume;setAudioReady(notificationAudioStatus()==='READY');
    setDesktop(typeof Notification!=='undefined'&&Notification.permission==='granted');
    const prime=()=>{void primeNotificationAudio().then(setAudioReady)};
    window.addEventListener('pointerdown',prime,{once:true});
    window.addEventListener('keydown',prime,{once:true});
    void load();
    const es=new EventSource(eventsUrl);
    es.onmessage=(ev)=>{
      try{
        const e=JSON.parse(ev.data);
        if(e.type==='notification.created'){
          const n=e.payload;
          if(n?.id&&n?.message){announce(n);void load(false);}
          else void load(true);
          onEvent?.(n);
        }
      }catch{void load(true);}
    };
    // SSE is instantaneous; polling is a safety net for sleeping phones or reconnects.
    const t=setInterval(()=>{if(document.visibilityState==='visible')void load(true);},25000);
    const focus=()=>void load(true);
    document.addEventListener('visibilitychange',focus);
    return()=>{
      window.removeEventListener('pointerdown',prime);
      window.removeEventListener('keydown',prime);
      document.removeEventListener('visibilitychange',focus);
      es.close();clearInterval(t);
      if(dismissTimer.current)clearTimeout(dismissTimer.current);
    };
  },[]);

  function toggleSound(){
    const next=!sound;setSound(next);soundRef.current=next;
    localStorage.setItem(storageKey+':sound',next?'1':'0');
    if(next)void testSound();
  }
  function changeVolume(next:number){
    const clamped=Math.max(0,Math.min(1,next));
    setVolume(clamped);volumeRef.current=clamped;
    localStorage.setItem(storageKey+':volume',String(clamped));
  }
  async function testSound(){
    const available=await primeNotificationAudio();
    setAudioReady(available);
    if(!available)return;
    const tone=apiUrl.includes('/delivery/')?'DRIVER_MISSION':
      apiUrl.includes('/supplier/')?'SUPPLIER_ORDER':'SHOP_PROGRESS';
    playFixiNotificationSound(tone,volumeRef.current);
  }
  async function checkPush(){
    if(typeof Notification==='undefined'||!('serviceWorker'in navigator)||!('PushManager'in window)){
      setPushDiagnostic('UNSUPPORTED');setWorkerDiagnostic(false);return;
    }
    if(Notification.permission==='denied'){setPushDiagnostic('BLOCKED');return}
    setPushDiagnostic('CHECKING');
    try{
      const reg=await navigator.serviceWorker.getRegistration();
      setWorkerDiagnostic(!!reg?.active);
      if(!reg){setPushDiagnostic('NOT_SUBSCRIBED');return}
      const subscription=await reg.pushManager.getSubscription();
      setPushDiagnostic(subscription?'SUBSCRIBED':'NOT_SUBSCRIBED');
    }catch{setPushDiagnostic('NOT_SUBSCRIBED')}
  }
  function openDiagnostics(){
    setDiagnosticsOpen(value=>!value);
    void checkPush();
    setAudioReady(notificationAudioStatus()==='READY');
  }
  async function sendTestPush(){
    if(pushTesting)return;
    setPushTesting(true);setPushTestStatus('');
    const path=apiUrl.includes('/supplier/')?'/api/supplier/push/test':
      apiUrl.includes('/delivery/')?'/api/delivery/push/test':'/api/push/test';
    try{
      const response=await fetch(path,{method:'POST',credentials:'same-origin'});
      const result=await response.json().catch(()=>({}));
      if(!response.ok){setPushTestStatus(String(result.error||'Test refusé')+' (HTTP '+response.status+')');return}
      setPushTestStatus('Test enregistré. Vérifiez la notification système de votre téléphone ; le son dépend des réglages Android/iOS.');
    }catch{setPushTestStatus('Connexion au serveur impossible. Réessayez avec Internet actif.')}
    finally{setPushTesting(false)}
  }
  async function enableDesktop(){
    if(typeof Notification==='undefined')return;
    const p=await Notification.requestPermission();setDesktop(p==='granted');
  }
  async function mark(id:string){
    try{
      const r=await fetch(apiUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'READ',id})});
      if(!r.ok)return;
      setRows(x=>x.map(n=>n.id===id?{...n,readAt:new Date().toISOString()}:n));
      setUnread(x=>Math.max(0,x-1));
    }catch{/* Retry from the list after next sync. */}
  }
  async function markAll(){
    try{
      const r=await fetch(apiUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'READ_ALL'})});
      if(!r.ok)return;
      setRows(x=>x.map(n=>({...n,readAt:n.readAt||new Date().toISOString()})));
      setUnread(0);
    }catch{/* Retain unread count on failure. */}
  }
  function go(n:Incoming){
    if(!n.readAt)void mark(n.id);
    setOpen(false);
    if(n.href){
      if(onNavigate)onNavigate(n.href);
      else window.location.assign(n.href);
    }
  }
  function dismiss(){setToast(null);if(dismissTimer.current)clearTimeout(dismissTimer.current);}

  return <div className={'rt-notifications '+(compact?'compact':'')}>
    <button type="button" className={'rt-bell '+(unread?'active':'')} onClick={()=>setOpen(v=>!v)} aria-expanded={open}
      aria-label={'Notifications'+(unread?' — '+unread+' non lues':'')} title="Notifications temps réel">
      {unread?<BellRing/>:<Bell/>}{unread>0&&<span>{unread>99?'99+':unread}</span>}
    </button>
    {open&&<div className="rt-panel">
      <div className="rt-head"><div><b>Centre de notifications</b><span>{unread?unread+' non lue(s)':'Tout est lu'}</span></div><button onClick={()=>setOpen(false)} aria-label="Fermer"><X/></button></div>
      <div className="rt-controls">
        <button className={sound?'on':''} onClick={toggleSound}>{sound?<Volume2/>:<VolumeX/>}{sound?'Son activé':'Son coupé'}</button>
<button className={desktop?'on':''} onClick={enableDesktop}><MonitorUp/>{desktop?'Système autorisé':'Autoriser le système'}</button>
        <button type="button" onClick={openDiagnostics} aria-expanded={diagnosticsOpen}>
          <Activity/>Diagnostic
        </button>
        {unread>0&&<button onClick={()=>void markAll()}><CheckCheck/>Tout lire</button>}
      </div>
      {diagnosticsOpen&&<div className="rt-diagnostics">
        <div className="rt-diag-heading"><Smartphone size={20}/><strong>Notifications FIXI — diagnostic</strong></div>
        <div className="rt-diag-row"><span>Son dans l'application</span><b>{audioReady?'Prêt':'À activer'}</b></div>
        {!audioReady&&<p>Pour entendre les alertes, appuyez sur « Tester le son ». Les navigateurs bloquent le son tant qu'aucune interaction n'a eu lieu.</p>}
        <div className="rt-diag-volume">
          <label htmlFor={storageKey+'-volume'}>Volume FIXI : {Math.round(volume*100)} %</label>
          <input id={storageKey+'-volume'} type="range" min="0" max="100" step="10" value={Math.round(volume*100)}
            onChange={e=>changeVolume(Number(e.target.value)/100)}/>
          <button type="button" onClick={()=>void testSound()}><Volume2 size={17}/>Tester le son</button>
        </div>
        <div className="rt-diag-row"><span>Service worker</span><b>{workerDiagnostic?'Actif':'Non vérifié / inactif'}</b></div>
        <div className="rt-diag-row"><span>Notifications téléphone (Push)</span>
          <b>{pushDiagnostic==='SUBSCRIBED'?'Abonné':pushDiagnostic==='BLOCKED'?'Bloqué par l’appareil':
            pushDiagnostic==='UNSUPPORTED'?'Non compatible':pushDiagnostic==='CHECKING'?'Vérification…':'Non abonné'}</b></div>
        <div className="rt-diag-actions">
          <PushToggle subscribeUrl={apiUrl.includes('/supplier/')?'/api/supplier/push/subscribe':
            apiUrl.includes('/delivery/')?'/api/delivery/push/subscribe':'/api/push/subscribe'} label/>
          <button type="button" onClick={()=>void checkPush()}>Revérifier Push</button>
          <button type="button" disabled={pushTesting||pushDiagnostic==='UNSUPPORTED'||pushDiagnostic==='BLOCKED'}
            onClick={()=>void sendTestPush()}>{pushTesting?'Envoi…':'Envoyer un Push test'}</button>
        </div>
        {pushTestStatus&&<p role="status">{pushTestStatus}</p>}
        <small>Les sons personnalisés sont possibles quand l'application est ouverte. Téléphone verrouillé : le navigateur et les réglages Android/iOS décident du son et des vibrations.</small>
      </div>}
      <div className="rt-filter-tabs" role="group" aria-label="Afficher les notifications">
        <button type="button" className={filter==='ALL'?'active':''} aria-pressed={filter==='ALL'}
          onClick={()=>setFilter('ALL')}>Toutes <span>{rows.length}</span></button>
        <button type="button" className={filter==='UNREAD'?'active':''} aria-pressed={filter==='UNREAD'}
          onClick={()=>setFilter('UNREAD')}>Non lues <span>{unread}</span></button>
      </div>
      <div className="rt-list">
        {rows.filter(n=>filter==='ALL'||!n.readAt).slice(0,20).map(n=>n.href&&!onNavigate?
          <Link href={n.href} key={n.id} className={n.readAt?'':'unread'} onClick={()=>go(n)}><Notif n={n}/></Link>:
          <button key={n.id} className={n.readAt?'':'unread'} onClick={()=>go(n)}><Notif n={n}/></button>
        )}
        {!rows.filter(n=>filter==='ALL'||!n.readAt).length&&
          <div className="rt-empty"><Bell/>
            <b>{filter==='UNREAD'?'Tout est à jour':'Aucune notification'}</b>
            <span>{filter==='UNREAD'?'Toutes les notifications sont lues.':'Les événements importants apparaîtront ici.'}</span>
          </div>}
      </div>
      {allHref&&<Link className="rt-all" href={allHref} onClick={()=>setOpen(false)}>Voir toutes les notifications</Link>}
    </div>}
    {toast&&<div role={toast.priority==='HIGH'||toast.priority==='URGENT'?'alert':'status'}
      aria-live={toast.priority==='HIGH'||toast.priority==='URGENT'?'assertive':'polite'}
      className={'rt-toast rt-toast-premium rt-toast-'+channelFor(toast.experienceKey||'GENERAL')+' '+String(toast.kind||toast.type||'info').toLowerCase()}>
      <i className="rt-toast-identity"><ExperienceIcon keyName={toast.experienceKey||'GENERAL'}/></i>
      <div className="rt-toast-copy">
        <span className="rt-toast-eyebrow">{labelFor(toast.experienceKey||'GENERAL')}</span>
        <b>{toast.title}</b><span>{toast.message}</span>
        {toast.href&&<button type="button" className="rt-toast-action" onClick={()=>{go(toast);dismiss()}}>Voir les détails →</button>}
      </div>
      <button className="rt-toast-dismiss" aria-label="Masquer cette notification" onClick={dismiss}><X/></button>
    </div>}
  </div>;
}
function Notif({n}:{n:Incoming}){
  return <><i className={'rt-kind '+String(n.kind||n.type||'info').toLowerCase()+' rt-kind-'+channelFor(n.experienceKey||'GENERAL')}>
    <ExperienceIcon keyName={n.experienceKey||'GENERAL'}/></i>
    <span><b>{n.title}</b><small>{n.message}</small><time>{dateTime(n.createdAt||new Date().toISOString())}</time></span>{!n.readAt&&<em/>}</>;
}
