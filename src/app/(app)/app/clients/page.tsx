'use client';
import Link from 'next/link';
import {useMemo,useState} from 'react';
import {Search,Users,UserRound,TrendingUp,Wrench,Star,Phone} from 'lucide-react';
import {useApi} from '@/components/ui';
import {dateOnly,money} from '@/lib/format';

export default function Clients(){
 const[q,setQ]=useState('');const[sort,setSort]=useState<'recent'|'value'|'repairs'>('recent');
 const{data,loading,error}=useApi<any[]>(`/api/clients?q=${encodeURIComponent(q)}`);
 const rows=useMemo(()=>[...(data||[])].sort((a,b)=>sort==='value'?Number(b.totalValue)-Number(a.totalValue):sort==='repairs'?Number(b.repairCount)-Number(a.repairCount):+new Date(b.updatedAt)-+new Date(a.updatedAt)),[data,sort]);
 const totalValue=rows.reduce((a,c)=>a+Number(c.totalValue||0),0),repairs=rows.reduce((a,c)=>a+Number(c.repairCount||0),0),loyal=rows.filter(c=>Number(c.loyaltyPoints||0)>0).length;
 return <div className="page atelier-ops-page">
  <div className="page-head"><div><div className="smart-kicker"><Users size={13}/> CRM ATELIER</div><h1 className="page-title">Clients</h1><div className="page-sub">Vue consolidée de la relation client, fidélité et historique atelier.</div></div></div>
  <div className="atelier-mini-kpis"><Mini icon={UserRound} label="Clients affichés" value={rows.length}/><Mini icon={Wrench} label="Réparations" value={repairs}/><Mini icon={TrendingUp} label="Valeur historique" value={money(totalValue)}/><Mini icon={Star} label="Clients fidélisés" value={loyal}/></div>
  <section className="card atelier-table-card"><div className="atelier-table-toolbar"><div className="global-search"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Nom ou téléphone…"/></div><select className="select" value={sort} onChange={e=>setSort(e.target.value as any)}><option value="recent">Plus récents</option><option value="value">Valeur décroissante</option><option value="repairs">Plus de réparations</option></select></div>{error&&<div className="error">{error}</div>}<div className="table-wrap"><table className="table"><thead><tr><th>Client</th><th>Contact</th><th>Réparations</th><th>Fidélité</th><th>Valeur historique</th><th>Client depuis</th><th></th></tr></thead><tbody>{rows.map(c=><tr key={c.id}><td><Link className="atelier-client-link" href={`/app/clients/${c.id}`}><UserRound/><span><b>{c.fullName}</b><small>Fiche client</small></span></Link></td><td><a className="atelier-phone" href={'tel:'+c.phone}><Phone/>{c.phone}</a></td><td><span className="badge badge-blue"><Wrench size={12}/>{c.repairCount}</span></td><td><span className="badge badge-amber">★ {c.loyaltyPoints||0} pts</span></td><td><b>{money(c.totalValue)}</b></td><td className="muted">{dateOnly(c.createdAt)}</td><td><Link className="btn btn-soft btn-sm" href={`/app/clients/${c.id}`}>Ouvrir</Link></td></tr>)}</tbody></table>{!loading&&!rows.length&&<div className="atelier-empty"><Users/><b>Aucun client trouvé</b><span>Essayez un autre nom ou numéro.</span></div>}</div></section>
 </div>
}
function Mini({icon:Icon,label,value}:any){return <div><i><Icon/></i><span>{label}</span><b>{value}</b></div>}