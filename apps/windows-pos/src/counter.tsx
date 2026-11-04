import React,{useEffect,useState} from 'react';
import {Check,Lock,Printer} from 'lucide-react';
import {dt} from './dialogs';
import {FixiLogo} from './brand';

// ---------- Écran client (2ᵉ moniteur) ----------
export type DisplayState={company:string;logo?:string;lines:{name:string;quantity:number;price:number}[];discount:number;total:number;given:number|null;change:number|null;thanks?:string};
const CHANNEL='fixi-customer-display';
let channel:BroadcastChannel|null=null;
try{channel=new BroadcastChannel(CHANNEL)}catch{channel=null}
export function publishDisplay(state:DisplayState){
 try{channel?.postMessage(state)}catch{}
 try{localStorage.setItem(CHANNEL,JSON.stringify(state))}catch{}
}
export function CustomerDisplay(){
 const [s,setS]=useState<DisplayState|null>(()=>{try{const v=localStorage.getItem(CHANNEL);return v?JSON.parse(v):null}catch{return null}});
 useEffect(()=>{
  const onMsg=(e:MessageEvent)=>setS(e.data);
  const onStorage=(e:StorageEvent)=>{if(e.key===CHANNEL&&e.newValue)try{setS(JSON.parse(e.newValue))}catch{}};
  channel?.addEventListener('message',onMsg);window.addEventListener('storage',onStorage);
  document.documentElement.dataset.display='client';
  return()=>{channel?.removeEventListener('message',onMsg);window.removeEventListener('storage',onStorage)};
 },[]);
 const empty=!s||!s.lines.length;
 return <div className="v6-display">
  <header>{s?.logo?<img src={s.logo} alt=""/>:<FixiLogo size={64}/>}<strong>{s?.company||'FIXI'}</strong></header>
  {empty?<div className="v6-display-idle"><h1>{s?.thanks||'Bienvenue'}</h1><p>{s?.thanks?'À bientôt !':'Vos articles s’afficheront ici.'}</p></div>:
  <main><ul>{s!.lines.map((l,i)=><li key={i}><span><b>{l.name}</b><small>{l.quantity} × {dt(l.price)}</small></span><b>{dt(l.price*l.quantity)}</b></li>)}</ul>
   <footer>{s!.discount>0&&<p><span>Remise</span><b>-{dt(s!.discount)}</b></p>}<p className="v6-display-total"><span>Total</span><strong>{dt(s!.total)}</strong></p>
    {s!.given!==null&&<p><span>Reçu</span><b>{dt(s!.given)}</b></p>}{s!.change!==null&&s!.change>=0&&<p className="v6-display-change"><span>Monnaie rendue</span><strong>{dt(s!.change)}</strong></p>}</footer></main>}
 </div>;
}

// ---------- Clôture guidée et rapport Z ----------
export type CashSummary={session:{id:string;status:string;openedAt:string;closedAt?:string|null;opening:number;closing:number|null;difference:number|null}|null;
 cashier?:string;company?:string;expectedCash?:number;cashIn?:number;cashOut?:number;expenses?:number;
 sales?:{count:number;total:number;paid:number;credit:number;discounts:number};byMethod?:{method:string;incoming:number;outgoing:number}[]};
const NOTES=[50,20,10,5],COINS=[5,2,1,0.5,0.2,0.1,0.05,0.02,0.01];
const label=(v:number)=>v>=1?`${v} DT`:`${Math.round(v*1000)} mil.`;
export const methodLabel:Record<string,string>={CASH:'Espèces',CARD:'Carte',TRANSFER:'Virement',CHEQUE:'Chèque',D17:'D17',FLOUCI:'Flouci'};

export function CashCounter({expected,busy,onClose}:{expected:number|null;busy:boolean;onClose:(amount:number,note:string)=>void}){
 const [count,setCount]=useState<Record<string,string>>({}),[note,setNote]=useState('');
 const total=Math.round([...NOTES,...COINS].reduce((a,v)=>a+v*(Math.max(0,Math.trunc(Number(count[v])||0))),0)*1000)/1000;
 const diff=expected===null?null:Math.round((total-expected)*1000)/1000;
 const needNote=diff!==null&&Math.abs(diff)>=0.001&&!note.trim();
 const row=(v:number)=><label key={v} className="v6-denom"><span>{label(v)}</span><input type="number" min="0" step="1" inputMode="numeric" value={count[v]||''} placeholder="0" onChange={e=>setCount(c=>({...c,[v]:e.target.value.replace(/\D/g,'')}))} aria-label={'Nombre de '+label(v)}/><b>{dt(v*(Number(count[v])||0))}</b></label>;
 return <div className="v5-card">
  <h2 className="v5-card-title"><Lock size={19}/> Clôturer : compter la caisse</h2>
  <p className="v5-hint">Tapez le nombre de billets et de pièces. FIXI fait le total et compare avec l’attendu.</p>
  <div className="v6-denoms"><div><h3 className="v6-sub">Billets</h3>{NOTES.map(row)}</div><div><h3 className="v6-sub">Pièces</h3>{COINS.map(row)}</div></div>
  <div className="v6-count-sum">
   <p><span>Compté</span><strong>{dt(total)}</strong></p>
   {expected!==null&&<p><span>Attendu dans la caisse</span><b>{dt(expected)}</b></p>}
   {diff!==null&&<p className={'v6-diff '+(Math.abs(diff)<0.001?'is-ok':diff<0?'is-neg':'is-pos')}><span>{Math.abs(diff)<0.001?'Caisse juste':diff<0?'Il manque':'En trop'}</span><b>{Math.abs(diff)<0.001?'✓':dt(Math.abs(diff))}</b></p>}
  </div>
  <label className="v5-field"><span>Explication de l’écart{diff!==null&&Math.abs(diff)>=0.001?' *':''}</span><input value={note} maxLength={500} onChange={e=>setNote(e.target.value)} placeholder="Ex. monnaie rendue en trop, dépense non saisie…"/></label>
  <div className="v6-actions"><button className="v5-btn v5-btn--primary v5-btn--lg" disabled={busy||needNote} onClick={()=>onClose(total,note.trim())}><Check size={18}/> Clôturer et imprimer le rapport</button></div>
 </div>;
}

export function ZReport({data}:{data:CashSummary|null}){
 if(!data?.session)return null;
 const s=data.session,f=(d?:string|null)=>d?new Date(d).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'}):'—';
 return <div className="v4-receipt v6-z" aria-label="Rapport de fin de journée"><article>
  <header><strong>{data.company}</strong><small>Rapport de caisse (Z)</small><small>Caissier : {data.cashier}</small><small>Ouverture : {f(s.openedAt)}</small><small>Clôture : {f(s.closedAt)}</small></header>
  <hr/><p>Ventes <b>{data.sales?.count||0}</b></p><p>Chiffre d’affaires <b>{dt(data.sales?.total||0)}</b></p><p>Encaissé <b>{dt(data.sales?.paid||0)}</b></p><p>À crédit <b>{dt(data.sales?.credit||0)}</b></p>{(data.sales?.discounts||0)>0&&<p>Remises <b>{dt(data.sales!.discounts)}</b></p>}
  <hr/><h3>Par moyen de paiement</h3>{(data.byMethod||[]).map(m=><p key={m.method}>{methodLabel[m.method]||m.method} <b>{dt(m.incoming-m.outgoing)}</b></p>)}
  <hr/><h3>Espèces</h3><p>Fond de caisse <b>{dt(s.opening)}</b></p><p>Entrées <b>{dt(data.cashIn||0)}</b></p><p>Sorties <b>{dt((data.cashOut||0)+(data.expenses||0))}</b></p><p>Attendu <b>{dt(data.expectedCash||0)}</b></p>{s.closing!==null&&<p>Compté <b>{dt(s.closing)}</b></p>}{s.difference!==null&&<p>Écart <b>{dt(s.difference)}</b></p>}
  <hr/><small>Signature caissier : ____________</small><small>Imprimé le {new Date().toLocaleString('fr-FR')}</small>
 </article></div>;
}
export function ZButton({onPrint,disabled}:{onPrint:()=>void;disabled?:boolean}){return <button className="v5-btn v5-btn--ghost v5-btn--sm" disabled={disabled} onClick={onPrint}><Printer size={15}/> Imprimer le rapport Z</button>}
