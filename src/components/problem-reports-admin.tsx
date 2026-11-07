'use client';
import {useEffect,useState} from 'react';
import {Check,Image as ImageIcon,RotateCcw,X} from 'lucide-react';
import {dateTime} from '@/lib/format';
import {SupportAccessButton} from './support-access';

const SRC:Record<string,string>={ATELIER:'Atelier',SUPPLIER:'Fournisseur',DRIVER:'Livreur',WINDOWS:'Caisse Windows'};

/** Admin Fixi : problèmes signalés depuis les applications. */
export function ProblemReportsAdmin(){
 const [status,setStatus]=useState<'OPEN'|'RESOLVED'>('OPEN'),[data,setData]=useState<any>(null),[shot,setShot]=useState(''),[refresh,setRefresh]=useState(0);
 useEffect(()=>{fetch('/api/platform/problem-reports?status='+status,{cache:'no-store'}).then(r=>r.json()).then(setData).catch(()=>setData({rows:[]}))},[status,refresh]);
 async function set(id:string,s:'OPEN'|'RESOLVED'){await fetch('/api/platform/problem-reports',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status:s})});setRefresh(x=>x+1)}
 async function view(id:string){const r=await fetch('/api/platform/problem-reports?id='+id).then(r=>r.json());setShot(r.screenshot||'')}
 return <section className="control-content fx-problems">
  <div className="section-toolbar"><div><h2>Problèmes signalés</h2><p>Envoyés avec le bouton « Signaler un problème » ({data?.open??0} à traiter).</p></div>
   <div className="fx-seg"><button aria-pressed={status==='OPEN'} onClick={()=>setStatus('OPEN')}>À traiter</button><button aria-pressed={status==='RESOLVED'} onClick={()=>setStatus('RESOLVED')}>Réglés</button></div></div>
  <div className="fx-list">{(data?.rows||[]).map((r:any)=><article key={r.id} className="fx-problem">
   <header><span className="fx-chip">{SRC[r.source]||r.source}</span><b>{r.reporter||'—'}</b><time>{dateTime(r.createdAt)}</time></header>
   <p>{r.message}</p>
   <small>{r.page||''}{r.appVersion?' · v'+r.appVersion:''}{r.contact?' · '+r.contact:''}</small>
   {r.lastError&&<pre>{r.lastError}</pre>}
   <div className="fx-problem-actions">{(r.shopId||r.companyId)&&<SupportAccessButton kind={r.shopId?'SHOP':'SUPPLIER'} id={r.shopId||r.companyId} name={r.targetName||r.reporter||'compte'} defaultReason={`Problème signalé : ${String(r.message||'').slice(0,80)}`} compact/>}{r.hasScreenshot&&<button className="btn btn-ghost btn-sm" onClick={()=>void view(r.id)}><ImageIcon size={15}/> Capture</button>}
    {r.status==='OPEN'?<button className="btn btn-soft btn-sm" onClick={()=>void set(r.id,'RESOLVED')}><Check size={15}/> Marquer réglé</button>:<button className="btn btn-ghost btn-sm" onClick={()=>void set(r.id,'OPEN')}><RotateCcw size={15}/> Rouvrir</button>}</div>
  </article>)}{data&&!data.rows?.length&&<p className="muted">Rien à afficher.</p>}</div>
  {shot&&<div className="fx-problem-shot" onClick={()=>setShot('')}><img src={shot} alt="Capture d’écran"/><button className="fx-icon-btn" aria-label="Fermer"><X size={18}/></button></div>}
 </section>;
}
