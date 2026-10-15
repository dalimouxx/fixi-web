'use client';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { CheckCircle2,XCircle,ShieldCheck,Phone } from 'lucide-react';
import { api,useApi } from '@/components/ui';
import { money,dateOnly } from '@/lib/format';

export default function ApproveQuote(){
  const p=useParams<{token:string}>();
  const{data:d,error,reload}=useApi<any>(`/api/public/quote/${p.token}`);
  const[note,setNote]=useState('');const[busy,setBusy]=useState(false);
  async function decide(decision:string){setBusy(true);try{await api(`/api/public/quote/${p.token}`,{method:'PATCH',body:JSON.stringify({decision,note})});await reload()}catch(e:any){alert(e.message)}finally{setBusy(false)}}
  if(error)return <div className="public-decision"><div className="decision-card"><div className="error">{error}</div></div></div>;
  if(!d)return <div className="public-decision"><div className="decision-loading">Chargement du devis…</div></div>;
  const final=['APPROVED','REJECTED','CONVERTED'].includes(d.status);
  return <div className="public-decision"><header><div className="track-brand">{d.shop.logoDataUrl?<img src={d.shop.logoDataUrl}/>:<i>F</i>}<div><b>{d.shop.name}</b><span>Validation sécurisée du devis</span></div></div><span className="secure-chip"><ShieldCheck/> Lien privé</span></header><main className="decision-card"><div className="decision-kicker">DEVIS {d.number}</div><h1>{d.repair?[d.repair.brand,d.repair.model].filter(Boolean).join(' '):'Votre devis'}</h1><p>Bonjour {d.client.fullName}, vérifiez le montant et les prestations avant de donner votre accord.</p><div className="decision-lines">{d.lines.map((l:any)=><div key={l.id}><span>{l.description}<small>{Number(l.quantity)} × {money(l.unitPrice,d.shop.currency)}</small></span><b>{money(l.total,d.shop.currency)}</b></div>)}</div><div className="decision-total"><span>Total</span><b>{money(d.total,d.shop.currency)}</b></div>{d.validUntil&&<small className="decision-valid">Valable jusqu’au {dateOnly(d.validUntil)}</small>}{final?<div className={`decision-result ${d.status==='APPROVED'||d.status==='CONVERTED'?'ok':'no'}`}>{d.status==='REJECTED'?<XCircle/>:<CheckCircle2/>}<div><b>{d.status==='REJECTED'?'Devis refusé':'Devis accepté'}</b><span>Votre boutique a été informée automatiquement.</span></div></div>:<><textarea className="textarea" placeholder="Message facultatif pour la boutique" value={note} onChange={e=>setNote(e.target.value)}/><div className="decision-actions"><button disabled={busy} className="btn btn-danger" onClick={()=>decide('REJECTED')}><XCircle size={18}/> Refuser</button><button disabled={busy} className="btn btn-primary" onClick={()=>decide('APPROVED')}><CheckCircle2 size={18}/> J’accepte la réparation</button></div></>}{d.shop.phone&&<a href={`tel:${d.shop.phone}`} className="decision-phone"><Phone size={15}/> Une question ? Appeler {d.shop.name}</a>}<footer><ShieldCheck size={13}/> Décision enregistrée par Fixi</footer></main></div>
}
