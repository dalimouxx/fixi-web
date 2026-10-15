'use client';
import { useState } from 'react';
import { CalendarDays,CheckCircle2,XCircle,Clock3 } from 'lucide-react';
import { api,useApi } from '@/components/ui';
import { dateTime } from '@/lib/format';

export default function Appointments(){
  const[r,setR]=useState(0);
  const{data}=useApi<any[]>('/api/appointments',r);
  const{data:shop}=useApi<any>('/api/settings',r);
  async function setStatus(id:string,status:string){
    await api('/api/appointments',{method:'PATCH',body:JSON.stringify({id,status})});
    setR(x=>x+1)
  }
  const kiosk=shop?.slug?`/kiosk?shop=${encodeURIComponent(shop.slug)}`:'/kiosk';
  return <div className="page"><div className="page-head"><div><h1 className="page-title">Rendez-vous</h1><div className="page-sub">Demandes reçues depuis le kiosk et la page publique.</div></div><a className="btn btn-primary" target="_blank" href={kiosk}><CalendarDays size={16}/> Ouvrir le Kiosk</a></div><section className="card"><div className="table-wrap"><table className="table"><thead><tr><th>Date</th><th>Client</th><th>Service</th><th>Appareil</th><th>Statut</th><th>Actions</th></tr></thead><tbody>{(data||[]).map(x=><tr key={x.id}><td><strong>{dateTime(x.scheduledAt)}</strong></td><td>{x.fullName}<small className="muted" style={{display:'block'}}>{x.phone}</small></td><td>{x.service}</td><td>{x.device||'—'}</td><td><span className="badge badge-gray">{x.status}</span></td><td><div className="toolbar"><button className="btn btn-success btn-sm" onClick={()=>setStatus(x.id,'CONFIRMED')}><CheckCircle2 size={13}/> Confirmer</button><button className="btn btn-soft btn-sm" onClick={()=>setStatus(x.id,'COMPLETED')}><Clock3 size={13}/> Terminer</button><button className="btn btn-danger btn-sm" onClick={()=>setStatus(x.id,'CANCELLED')}><XCircle size={13}/></button></div></td></tr>)}</tbody></table></div></section></div>
}
