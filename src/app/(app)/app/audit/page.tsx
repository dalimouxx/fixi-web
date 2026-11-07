'use client';
import {useMemo,useState} from 'react';
import {useApi} from '@/components/ui';
import {dateTime,money} from '@/lib/format';
import {actionLabel,entityLabel} from '@/lib/labels';
import {Activity,Search,ShieldCheck,UserRound,Filter} from 'lucide-react';
export default function Audit(){
 const{data,error}=useApi<any[]>('/api/audit');const[q,setQ]=useState(''),[action,setAction]=useState('ALL');
 const actions=[...new Set((data||[]).map(x=>x.action).filter(Boolean))] as string[];
 const rows=useMemo(()=>(data||[]).filter(x=>(action==='ALL'||x.action===action)&&(!q||[x.user?.fullName,actionLabel(x.action),entityLabel(x.entity),detail(x),x.entityId].join(' ').toLowerCase().includes(q.toLowerCase()))),[data,q,action]);
 const users=new Set((data||[]).map(x=>x.user?.fullName).filter(Boolean)).size;
 return <div className="page atelier-ops-page"><div className="page-head"><div><div className="smart-kicker"><ShieldCheck size={13}/> Sécurité & traçabilité</div><h1 className="page-title">Journal d’activité</h1><div className="page-sub">Actions sensibles, utilisateurs et objets modifiés dans la boutique.</div></div></div>{error&&<div className="error">{error}</div>}<div className="atelier-mini-kpis"><Mini icon={Activity} label="Événements chargés" value={(data||[]).length}/><Mini icon={UserRound} label="Utilisateurs distincts" value={users}/><Mini icon={ShieldCheck} label="Actions distinctes" value={actions.length}/></div><section className="card atelier-table-card"><div className="atelier-table-toolbar"><div className="global-search"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Utilisateur, action, élément…"/></div><div className="atelier-select-group"><Filter/><select className="select" value={action} onChange={e=>setAction(e.target.value)}><option value="ALL">Toutes les actions</option>{actions.map(x=><option key={x} value={x}>{actionLabel(x)}</option>)}</select></div></div><div className="table-wrap"><table className="table"><thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Élément</th><th>Détail</th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td>{dateTime(x.createdAt)}</td><td><b>{x.user?.fullName||'Système'}</b></td><td><span className="badge badge-blue">{actionLabel(x.action)}</span></td><td>{entityLabel(x.entity)}</td><td className="muted">{detail(x)}</td></tr>)}</tbody></table>{!rows.length&&<div className="atelier-empty"><Activity/><b>Aucun événement</b><span>Aucun événement ne correspond aux filtres.</span></div>}</div></section></div>
}
function Mini({icon:Icon,label,value}:any){return <div><i><Icon/></i><span>{label}</span><b>{value}</b></div>}
/** Résumé lisible de l'événement (nom, code, montant, motif) au lieu d'un identifiant technique. */
function detail(x:any){const m=x.metadata&&typeof x.metadata==='object'?x.metadata:{};const parts=[m.code,m.name,m.fullName,m.label,m.title,m.reason,m.number,typeof m.amount==='number'?money(m.amount):null].filter(v=>v!==undefined&&v!==null&&v!=='').map(String);return parts.slice(0,3).join(' · ')||'—'}
