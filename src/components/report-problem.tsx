'use client';
import {useEffect,useState} from 'react';
import {LifeBuoy,Send,ImagePlus,X} from 'lucide-react';
import {FxSheet} from './fx-sheet';

// Dernière erreur JavaScript de la page : jointe au signalement pour aider à corriger.
let lastError='';
if(typeof window!=='undefined'){
 window.addEventListener('error',e=>{lastError=String(e.message||'')+(e.filename?` @ ${e.filename}:${e.lineno}`:'')});
 window.addEventListener('unhandledrejection',e=>{lastError='Promesse : '+String((e.reason&&e.reason.message)||e.reason||'')});
}

async function shrink(file:File):Promise<string>{
 const url=URL.createObjectURL(file);
 try{const img=await new Promise<HTMLImageElement>((ok,ko)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=ko;i.src=url});
  const scale=Math.min(1,1280/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);
  c.getContext('2d')!.drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',0.75);
 }finally{URL.revokeObjectURL(url)}
}

/** Bouton « Signaler un problème » : texte, capture d'écran facultative, page et dernière erreur envoyés à l'admin Fixi. */
export function ReportProblemButton({space,className='fx-icon-btn',label=false}:{space:'atelier'|'supplier'|'delivery';className?:string;label?:boolean}){
 const [open,setOpen]=useState(false),[message,setMessage]=useState(''),[shot,setShot]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(!open){setDone(false);setError('')}},[open]);
 async function send(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');
  try{const r=await fetch('/api/problem-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({space,message,screenshot:shot||null,page:location.pathname+location.search,lastError,appVersion:document.documentElement.dataset.version||null})});
   const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Envoi impossible');setDone(true);setMessage('');setShot('')}
  catch(err:any){setError(err.message)}finally{setBusy(false)}}
 return <>
  <button type="button" className={className} onClick={()=>setOpen(true)} title="Signaler un problème" aria-label="Signaler un problème"><LifeBuoy size={18}/>{label&&<span>Signaler un problème</span>}</button>
  <FxSheet open={open} onClose={()=>setOpen(false)} side="bottom" title="Signaler un problème" subtitle="L’équipe Fixi reçoit votre message avec la page concernée." label="Signaler un problème">
   {done?<div className="fx-report-done"><b>Merci, c’est envoyé.</b><p>Nous regardons le problème au plus vite.</p><button className="btn btn-primary btn-block" onClick={()=>setOpen(false)}>Fermer</button></div>:
   <form className="fx-form-stack" onSubmit={send}>
    <label className="field"><span className="label">Qu’est-ce qui ne marche pas ?</span><textarea className="input" required minLength={5} maxLength={2000} rows={4} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Ex. le bouton Enregistrer ne fait rien sur la fiche réparation…"/></label>
    {shot?<div className="fx-report-shot"><img src={shot} alt="Capture jointe"/><button type="button" className="fx-icon-btn" aria-label="Retirer la capture" onClick={()=>setShot('')}><X size={16}/></button></div>:
    <label className="btn btn-ghost btn-block fx-report-attach"><ImagePlus size={18}/> Joindre une capture d’écran<input type="file" accept="image/*" hidden onChange={async e=>{const f=e.target.files?.[0];if(f)try{setShot(await shrink(f))}catch{setError('Image illisible')}}}/></label>}
    {error&&<div className="error">{error}</div>}
    <button className="btn btn-primary btn-block" disabled={busy}><Send size={18}/> {busy?'Envoi…':'Envoyer'}</button>
   </form>}
  </FxSheet></>;
}
