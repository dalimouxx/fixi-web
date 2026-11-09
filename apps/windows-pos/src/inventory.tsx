import React,{useEffect,useMemo,useRef,useState} from 'react';
import {invoke} from '@tauri-apps/api/core';
import {Check,ClipboardList,Minus,Plus,ScanBarcode,Trash2} from 'lucide-react';
import {readJson,writeJson} from './storage';
import {findByCode} from './stock-in';

type P={id:string;name:string;sku:string;barcode?:string|null;stock:number;onHand?:number};
type Session={countId:string;reference:string;counts:Record<string,number>;startedAt:string};

/** Inventaire au scanner : chaque article scanné est compté, l'écart avec le stock FIXI s'affiche,
 * puis la clôture corrige le stock (les articles non comptés ne changent pas). */
export function InventoryPage({products,storageKey,canClose,demo,onDone,onError,onMessage}:{products:P[];storageKey:string;canClose:boolean;demo:boolean;onDone:()=>void;onError:(m:string)=>void;onMessage:(m:string)=>void}){
 const [session,setSession]=useState<Session|null>(()=>readJson<Session|null>(storageKey,null));
 const [scan,setScan]=useState(''),[busy,setBusy]=useState(false),[last,setLast]=useState('');
 // Inventaire d'une seule ligne (ex. MG) ou de tout le stock.
 const [lineScope,setLineScope]=useState(''),[lineOpts,setLineOpts]=useState<{id:string;tag:string;name:string}[]>([]),[ownTag,setOwnTag]=useState('');
 useEffect(()=>{if(demo)return;invoke<any>('supplier_api',{method:'GET',path:'/api/supplier/lines',body:null}).then(j=>{setLineOpts((j?.lines||[]).filter((l:any)=>l.active));setOwnTag(j?.ownTag||'')}).catch(()=>{})},[]);
 const ref=useRef<HTMLInputElement>(null);
 const pending=useRef<Record<string,number>>({});
 const timer=useRef<number|undefined>(undefined);
 useEffect(()=>{if(session)writeJson(storageKey,session);else try{localStorage.removeItem(storageKey)}catch{}},[session,storageKey]);
 useEffect(()=>{ref.current?.focus()},[session]);
 const expected=(p:P)=>p.onHand??p.stock;
 const rows=useMemo(()=>session?Object.entries(session.counts).map(([id,n])=>{const p=products.find(x=>x.id===id);return p?{p,n,diff:n-expected(p)}:null}).filter(Boolean) as {p:P;n:number;diff:number}[]:[],[session,products]);
 function flush(){const batch=pending.current;pending.current={};if(!session||demo)return;
  for(const [productId,countedQty] of Object.entries(batch))void invoke('supplier_stock_count',{request:{action:'STOCK_COUNT_ITEM',stockCountId:session.countId,productId,countedQty}}).catch(e=>onError('Comptage non enregistré : '+String(e)))}
 function setCount(id:string,n:number){if(!session)return;const v=Math.max(0,Math.trunc(n));setSession({...session,counts:{...session.counts,[id]:v}});pending.current[id]=v;window.clearTimeout(timer.current);timer.current=window.setTimeout(flush,800)}
 async function start(){setBusy(true);
  try{if(demo){setSession({countId:'demo',reference:'INV-DEMO',counts:{},startedAt:new Date().toISOString()});return}
   let c:any;try{c=await invoke('supplier_stock_count',{request:{action:'STOCK_COUNT_START',reference:'INV-WIN-'+Date.now(),note:'Inventaire depuis FIXI Caisse',...(lineScope?{lineId:lineScope}:{})}})}
   catch(e){if(!/déjà ouvert/i.test(String(e)))throw e;const open=await invoke<{counts:any[]}>('supplier_open_stock_counts');c=open.counts.find(x=>!x.warehouseId)||open.counts[0];if(!c)throw e;onMessage('Inventaire déjà ouvert repris : '+c.reference)}
   setSession({countId:c.id,reference:c.reference,counts:{},startedAt:new Date().toISOString()})
  }catch(e){onError(String(e))}finally{setBusy(false)}}
 function onScan(){const v=scan.trim().toLowerCase();setScan('');if(!v||!session)return;
  const p=findByCode(products,v);
  if(!p){onError('Code-barres introuvable : '+v);return}
  setCount(p.id,(session.counts[p.id]||0)+1);setLast(p.id)}
 async function close(){if(!session)return;const changes=rows.filter(r=>r.diff!==0);
  if(!window.confirm(`Clôturer l’inventaire ? ${changes.length} article(s) seront corrigés dans le stock FIXI. Les articles non comptés ne changent pas.`))return;
  window.clearTimeout(timer.current);flush();setBusy(true);
  try{if(!demo){await new Promise(r=>setTimeout(r,600));
    for(const r of rows)await invoke('supplier_stock_count',{request:{action:'STOCK_COUNT_ITEM',stockCountId:session.countId,productId:r.p.id,countedQty:r.n}});
    const res=await invoke<{adjustments:number}>('supplier_stock_count',{request:{action:'STOCK_COUNT_CLOSE',stockCountId:session.countId,force:true}});onMessage('Inventaire clôturé : '+res.adjustments+' correction(s) de stock.')}
   setSession(null);onDone()}catch(e){onError(String(e))}finally{setBusy(false)}}
 if(!session)return <section className="v5-card v6-inv-start"><ClipboardList size={36}/><h2>Inventaire au scanner</h2>
  <p className="v5-hint">Scannez chaque article du rayon : la caisse compte et montre l’écart avec le stock FIXI. À la fin, le gérant valide et le stock est corrigé.</p>
  {lineOpts.length>0&&<label className="v5-field"><span>Ligne à compter</span><select className="v5-input" value={lineScope} onChange={e=>setLineScope(e.target.value)}><option value="">Tout le stock</option><option value="own">{ownTag||'Mes produits'}</option>{lineOpts.map(l=><option key={l.id} value={l.id}>{l.tag} · {l.name}</option>)}</select></label>}
  <button className="v5-btn v5-btn--primary v5-btn--lg" disabled={busy} onClick={()=>void start()}><ScanBarcode size={18}/> Commencer un inventaire</button></section>;
 const counted=rows.reduce((a,r)=>a+r.n,0),gaps=rows.filter(r=>r.diff!==0).length;
 return <section className="v5-stack">
  <div className="v5-scan"><ScanBarcode size={22}/><input ref={ref} autoFocus placeholder="Scannez chaque article (1 scan = 1 pièce)" value={scan} onChange={e=>setScan(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')onScan()}}/><button className="v5-btn v5-btn--primary" onClick={onScan}><Plus size={18}/> Compter</button></div>
  <div className="v5-kpis"><div className="v5-kpi"><span>Inventaire</span><b className="v5-mono">{session.reference}</b></div><div className="v5-kpi"><span>Articles comptés</span><b>{rows.length}</b></div><div className="v5-kpi"><span>Pièces comptées</span><b>{counted}</b></div><div className={'v5-kpi'+(gaps?' is-warning':'')}><span>Écarts</span><b>{gaps}</b></div></div>
  <div className="v5-card">{rows.length===0?<p className="v5-hint">Scannez le premier article pour commencer.</p>:
   <div className="v5-table-wrap"><table className="v5-table"><thead><tr><th>Article</th><th className="num">Stock FIXI</th><th className="num">Compté</th><th className="num">Écart</th><th className="act"></th></tr></thead><tbody>
    {[...rows].sort((a,b)=>a.p.id===last?-1:b.p.id===last?1:Math.abs(b.diff)-Math.abs(a.diff)).map(r=><tr key={r.p.id} className={r.p.id===last?'is-selected':''}><td><b>{r.p.name}</b><small className="v5-mono">{r.p.sku}</small></td><td className="num">{expected(r.p)}</td>
     <td className="num"><div className="v5-stepper v6-inv-step"><button aria-label="Moins" onClick={()=>setCount(r.p.id,r.n-1)}><Minus size={14}/></button><input type="number" min={0} value={r.n} onChange={e=>setCount(r.p.id,Number(e.target.value))} aria-label={'Compté '+r.p.name}/><button aria-label="Plus" onClick={()=>setCount(r.p.id,r.n+1)}><Plus size={14}/></button></div></td>
     <td className="num"><span className={'v5-chip '+(r.diff===0?'is-ok':r.diff<0?'is-danger':'is-warning')}>{r.diff>0?'+':''}{r.diff}</span></td>
     <td className="act"><button className="v5-icon-btn" aria-label="Retirer" onClick={()=>{const c={...session.counts};delete c[r.p.id];setSession({...session,counts:c})}}><Trash2 size={15}/></button></td></tr>)}
   </tbody></table></div>}</div>
  <div className="v6-actions"><button className="v5-btn v5-btn--ghost" disabled={busy} onClick={()=>{if(window.confirm('Abandonner ce comptage sur ce PC ? L’inventaire reste ouvert dans FIXI.'))setSession(null)}}>Abandonner</button>
   {canClose?<button className="v5-btn v5-btn--primary" disabled={busy||!rows.length} onClick={()=>void close()}><Check size={17}/> Valider et corriger le stock</button>:<span className="v5-hint">Le gérant valide l’inventaire.</span>}</div>
 </section>;
}
