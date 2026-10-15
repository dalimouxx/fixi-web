'use client';
import Link from 'next/link';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {Plus,Search,Columns3,List,ChevronRight} from 'lucide-react';
import {api,PriorityBadge,StatusBadge,useApi,useRealtimeRefresh} from '@/components/ui';
import {dateTime,money} from '@/lib/format';

const cols=[['RECEIVED','Reçu'],['DIAGNOSIS','Diagnostic'],['IN_REPAIR','En réparation'],['WAITING_PART','Attente pièce'],['READY','Prêt'],['DELIVERED','Livré']] as const;

export default function Repairs(){
  const[q,setQ]=useState('');
  const[view,setView]=useState<'kanban'|'table'>('kanban');
  useEffect(()=>{const v=new URLSearchParams(window.location.search).get('q');if(v)setQ(v);const saved=localStorage.getItem('fixi-repairs-view');if(saved==='table')setView('table')},[]);
  useEffect(()=>{localStorage.setItem('fixi-repairs-view',view)},[view]);
  const[refresh,setRefresh]=useState(0);
  const{data,loading,error,reload}=useApi<any[]>(`/api/repairs?q=${encodeURIComponent(q)}`,refresh);
  useRealtimeRefresh(useCallback(()=>reload(),[]));
  const grouped=useMemo(()=>Object.fromEntries(cols.map(([k])=>[k,(data||[]).filter(r=>r.status===k)])),[data]);
  async function move(code:string,status:string){try{await api(`/api/repairs/${code}/status`,{method:'PATCH',body:JSON.stringify({status})});setRefresh(x=>x+1)}catch(e:any){alert(e.message)}}
  return <div className="page" style={{maxWidth:'none'}}>
    <div className="page-head">
      <div><h1 className="page-title">Réparations</h1><div className="page-sub">Suivez chaque appareil de la réception jusqu’à la livraison.</div></div>
      <Link href="/app/repairs/new" className="btn btn-primary"><Plus size={17}/> Nouvelle réception</Link>
    </div>

    <div className="card card-pad repairs-toolbar-v2" style={{marginBottom:16,padding:14}}>
      <div className="searchbox" style={{width:'min(650px,100%)'}}><Search/><input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="Code, client, téléphone, appareil…"/></div>
      <div className="view-toggle">
        <button className={view==='kanban'?'active':''} onClick={()=>setView('kanban')}><Columns3 size={14}/> Kanban</button>
        <button className={view==='table'?'active':''} onClick={()=>setView('table')}><List size={14}/> Tableau</button>
      </div>
    </div>

    {error&&<div className="error" style={{marginBottom:15}}>{error}</div>}
    {loading?<div className="card card-pad">Chargement…</div>:view==='kanban'?<div className="kanban">{cols.map(([key,label],ci)=><div className="kanban-col" key={key}>
      <div className="kanban-head"><span>{label}</span><span className="kanban-count">{grouped[key]?.length||0}</span></div>
      {(grouped[key]||[]).map((r:any)=><div className={`repair-card ${r.priority==='URGENT'?'priority-urgent':''}`} key={r.id}>
        <div style={{display:'flex',justifyContent:'space-between',gap:8}}><Link href={`/app/repairs/${r.code}`} className="repair-code">{r.code}</Link><PriorityBadge priority={r.priority}/></div>
        <div className="repair-device">{[r.brand,r.model].filter(Boolean).join(' ')}</div>
        <div className="repair-issue">{r.reportedIssue}</div>
        <div style={{fontSize:12,marginTop:10,fontWeight:750}}>{r.client.fullName}</div>
        <div className="repair-meta"><span>{r.technician?.fullName||'Non assigné'}</span><span>{dateTime(r.createdAt)}</span></div>
        <div style={{display:'flex',gap:5,marginTop:10,flexWrap:'wrap'}}>{ci<cols.length-1&&key!=='DELIVERED'?<button className="btn btn-soft btn-sm" onClick={()=>move(r.code,cols[ci+1][0])}>→ {cols[ci+1][1]}</button>:null}{r.finalPrice!==null&&<span className="badge badge-green">{money(r.finalPrice)}</span>}</div>
      </div>)}
    </div>)}</div>:<div className="card"><div className="table-wrap"><table className="table">
      <thead><tr><th>Code</th><th>Client</th><th>Appareil</th><th>Panne</th><th>Technicien</th><th>Statut</th><th>Prix</th><th>Création</th><th></th></tr></thead>
      <tbody>{(data||[]).map((r:any)=><tr key={r.id}>
        <td><Link href={`/app/repairs/${r.code}`} className="mono table-primary-link">{r.code}</Link></td>
        <td>{r.client.fullName}</td><td>{[r.brand,r.model].filter(Boolean).join(' ')}</td><td className="muted">{r.reportedIssue}</td><td>{r.technician?.fullName||'Non assigné'}</td>
        <td><StatusBadge status={r.status}/></td><td>{r.finalPrice!==null?money(r.finalPrice):'—'}</td><td className="muted">{dateTime(r.createdAt)}</td>
        <td><Link href={`/app/repairs/${r.code}`} className="btn btn-soft btn-sm"><ChevronRight size={14}/></Link></td>
      </tr>)}</tbody>
    </table></div></div>}
  </div>
}
