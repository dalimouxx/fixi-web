'use client';

import Link from 'next/link';
import {Bell,BellRing,CheckCheck,Volume2,VolumeX,MonitorUp,X} from 'lucide-react';
import {useEffect,useRef,useState} from 'react';
import {dateTime} from '@/lib/format';
import {playFixiNotificationSound,primeNotificationAudio} from '@/lib/notification-audio';

type Props={
  apiUrl:string;
  eventsUrl:string;
  storageKey:string;
  allHref?:string;
  compact?:boolean;
  onNavigate?:(href:string)=>void;
};

export function RealtimeNotificationCenter({apiUrl,eventsUrl,storageKey,allHref,compact=true,onNavigate}:Props){
  const[rows,setRows]=useState<any[]>([]);
  const[unread,setUnread]=useState(0);
  const[open,setOpen]=useState(false);
  const[sound,setSound]=useState(true);
  const[desktop,setDesktop]=useState(false);
  const[toast,setToast]=useState<any>(null);
  const lastId=useRef<string>('');
  const initial=useRef(true);
  const soundRef=useRef(true);

  async function load(fromRealtime=false){
    const r=await fetch(apiUrl,{cache:'no-store'});if(!r.ok)return;
    const j=await r.json();const next=Array.isArray(j.rows)?j.rows:[];
    const newest=next[0];
    if(!initial.current&&fromRealtime&&newest&&newest.id!==lastId.current){
      announce(newest);
    }
    setRows(next);setUnread(Number(j.unread||0));
    if(newest)lastId.current=newest.id;
    initial.current=false;
  }

  function announce(n:any){
    setToast(n);setTimeout(()=>setToast(null),5200);
    if(soundRef.current)playFixiNotificationSound(n.soundKey||soundFor(n.kind,n.priority));
    if(typeof Notification!=='undefined'&&Notification.permission==='granted'&&document.hidden){
      try{new Notification(n.title,{body:n.message,tag:n.id})}catch{}
    }
  }

  useEffect(()=>{
    const stored=localStorage.getItem(storageKey+':sound');const enabled=stored!=='0';setSound(enabled);soundRef.current=enabled;
    setDesktop(typeof Notification!=='undefined'&&Notification.permission==='granted');
    const prime=()=>primeNotificationAudio();
    window.addEventListener('pointerdown',prime,{once:true});
    load();
    const es=new EventSource(eventsUrl);
    es.onmessage=(ev)=>{try{const e=JSON.parse(ev.data);if(e.type==='notification.created'){const n=e.payload;if(n?.id&&n?.message){announce(n);load(false)}else load(true)}}catch{load(true)}};
    const t=setInterval(()=>load(true),20000);
    return()=>{window.removeEventListener('pointerdown',prime);es.close();clearInterval(t)};
  },[]);

  function toggleSound(){
    const next=!sound;setSound(next);soundRef.current=next;localStorage.setItem(storageKey+':sound',next?'1':'0');
    if(next){primeNotificationAudio();playFixiNotificationSound('CHIME')}
  }
  async function enableDesktop(){
    if(typeof Notification==='undefined')return;
    const p=await Notification.requestPermission();setDesktop(p==='granted');
  }
  async function mark(id:string){
    await fetch(apiUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'READ',id})}).catch(()=>{});
    setRows(x=>x.map(n=>n.id===id?{...n,readAt:new Date().toISOString()}:n));setUnread(x=>Math.max(0,x-1));
  }
  async function markAll(){
    await fetch(apiUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'READ_ALL'})}).catch(()=>{});
    setRows(x=>x.map(n=>({...n,readAt:n.readAt||new Date().toISOString()})));setUnread(0);
  }
  function go(n:any){if(!n.readAt)mark(n.id);setOpen(false);if(n.href){if(onNavigate)onNavigate(n.href);else window.location.href=n.href}}

  return <div className={'rt-notifications '+(compact?'compact':'')}>
    <button className={'rt-bell '+(unread?'active':'')} onClick={()=>setOpen(v=>!v)} title="Notifications temps réel">
      {unread?<BellRing/>:<Bell/>}{unread>0&&<span>{unread>99?'99+':unread}</span>}
    </button>
    {open&&<div className="rt-panel">
      <div className="rt-head"><div><b>Notifications</b><span>{unread?unread+' non lue(s)':'Tout est lu'}</span></div><button onClick={()=>setOpen(false)}><X/></button></div>
      <div className="rt-controls">
        <button className={sound?'on':''} onClick={toggleSound}>{sound?<Volume2/>:<VolumeX/>}{sound?'Son activé':'Son coupé'}</button>
        <button className={desktop?'on':''} onClick={enableDesktop}><MonitorUp/>{desktop?'Bureau activé':'Activer bureau'}</button>
        {unread>0&&<button onClick={markAll}><CheckCheck/>Tout lire</button>}
      </div>
      <div className="rt-list">
        {rows.slice(0,20).map(n=>n.href&&!onNavigate?
          <Link href={n.href} key={n.id} className={n.readAt?'':'unread'} onClick={()=>go(n)}><Notif n={n}/></Link>:
          <button key={n.id} className={n.readAt?'':'unread'} onClick={()=>go(n)}><Notif n={n}/></button>
        )}
        {!rows.length&&<div className="rt-empty"><Bell/><b>Aucune notification</b><span>Les événements importants apparaîtront ici.</span></div>}
      </div>
      {allHref&&<Link className="rt-all" href={allHref} onClick={()=>setOpen(false)}>Voir toutes les notifications</Link>}
    </div>}
    {toast&&<div className={'rt-toast '+String(toast.kind||'info').toLowerCase()} onClick={()=>{go(toast);setToast(null)}}>
      <i><BellRing/></i><div><b>{toast.title}</b><span>{toast.message}</span></div><button onClick={e=>{e.stopPropagation();setToast(null)}}><X/></button>
    </div>}
  </div>
}

function Notif({n}:{n:any}){return <><i className={'rt-kind '+String(n.kind||n.type||'info').toLowerCase()}><Bell/></i><span><b>{n.title}</b><small>{n.message}</small><time>{dateTime(n.createdAt)}</time></span>{!n.readAt&&<em/>}</>}
function soundFor(kind:string,priority:string){if(priority==='URGENT'||kind==='ERROR')return'URGENT';if(priority==='HIGH'||kind==='WARNING'||kind==='STOCK')return'WARNING';if(kind==='SUCCESS'||kind==='PAYMENT')return'SUCCESS';return'CHIME'}
