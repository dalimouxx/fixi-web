import React,{useState} from 'react';
import {invoke} from '@tauri-apps/api/core';
import {LifeBuoy,Send} from 'lucide-react';
import {Modal} from './dialogs';

let lastError='';
window.addEventListener('error',e=>{lastError=String(e.message||'')});
window.addEventListener('unhandledrejection',e=>{lastError='Promesse : '+String((e.reason&&e.reason.message)||e.reason||'')});

export function ReportDialog({page,onClose,onSent}:{page:string;onClose:()=>void;onSent:()=>void}){
 const [message,setMessage]=useState(''),[contact,setContact]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function send(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');
  try{await invoke('supplier_report_problem',{report:{message,contact,page:'caisse-windows/'+page,lastError}});onSent();onClose()}catch(err){setError(String(err))}finally{setBusy(false)}}
 return <Modal title="Signaler un problème" icon={<LifeBuoy size={19}/>} onClose={onClose}>
  <form className="v6-form" onSubmit={send}>
   <label className="v5-field"><span>Qu’est-ce qui ne marche pas ?</span><textarea className="v6-textarea" required minLength={5} maxLength={2000} rows={5} autoFocus value={message} onChange={e=>setMessage(e.target.value)} placeholder="Ex. le tiroir ne s’ouvre pas après une vente en espèces…"/></label>
   <label className="v5-field"><span>Téléphone pour vous rappeler (facultatif)</span><input value={contact} maxLength={40} onChange={e=>setContact(e.target.value)}/></label>
   {error&&<p className="v5-alert v5-alert--danger">{error}</p>}
   <button className="v5-btn v5-btn--primary v5-btn--lg" disabled={busy}><Send size={18}/> {busy?'Envoi…':'Envoyer à l’équipe Fixi'}</button>
  </form></Modal>;
}
