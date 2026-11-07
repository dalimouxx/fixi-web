import {useEffect,useMemo,useRef,useState} from 'react';
import {invoke} from '@tauri-apps/api/core';
import {Check,Minus,PackagePlus,Plus,ScanBarcode,Trash2} from 'lucide-react';
import {readJson,writeJson} from './storage';

type P={id:string;name:string;sku:string;barcode?:string|null;stock:number;onHand?:number};
type Line={id:string;qty:number;cost:string};
const norm=(s?:string|null)=>String(s||'').toUpperCase().replace(/\s+/g,'');
export const findByCode=<T extends {barcode?:string|null;sku:string}>(items:T[],raw:string)=>{const v=norm(raw);if(!v)return undefined;return items.find(i=>norm(i.barcode)===v)||items.find(i=>norm(i.sku)===v)};
const dt=(n:number)=>n.toLocaleString('fr-FR',{minimumFractionDigits:3,maximumFractionDigits:3})+' DT';

/** Entrée de stock au scanner (fournisseur) : 1 scan = +1 pièce, coût d'achat modifiable, validation par le gérant. */
export function StockInPage({products,storageKey,canEnter,demo,onDone,onError,onMessage,onUnknown}:{products:P[];storageKey:string;canEnter:boolean;demo:boolean;onDone:()=>void;onError:(m:string)=>void;onMessage:(m:string)=>void;onUnknown:(code:string)=>void}){
 const [lines,setLines]=useState<Line[]>(()=>readJson<Line[]>(storageKey,[]));
 const [source,setSource]=useState(()=>readJson<string>(storageKey+':src',''));
 const [costs,setCosts]=useState<Record<string,number>>({});
 const [scan,setScan]=useState(''),[busy,setBusy]=useState(false),[last,setLast]=useState('');
 const ref=useRef<HTMLInputElement>(null);
 useEffect(()=>{writeJson(storageKey,lines)},[lines,storageKey]);
 useEffect(()=>{writeJson(storageKey+':src',source)},[source,storageKey]);
 useEffect(()=>{ref.current?.focus()},[]);
 useEffect(()=>{if(!canEnter||demo)return;invoke<{costs:Record<string,number>}>('supplier_stock_in_costs').then(r=>setCosts(r.costs||{})).catch(()=>{})},[canEnter,demo]);
 const rows=useMemo(()=>lines.map(l=>({l,p:products.find(x=>x.id===l.id)})).filter(r=>r.p) as {l:Line;p:P}[],[lines,products]);
 const units=rows.reduce((a,r)=>a+r.l.qty,0),value=rows.reduce((a,r)=>a+r.l.qty*(Number(r.l.cost.replace(',','.'))||0),0);
 function add(p:P,n=1){setLast(p.id);setLines(ls=>{const i=ls.findIndex(x=>x.id===p.id);if(i<0)return [{id:p.id,qty:n,cost:costs[p.id]!=null?String(costs[p.id]):''},...ls];const c=[...ls];c[i]={...c[i],qty:Math.max(1,c[i].qty+n)};return c})}
 function set(id:string,patch:Partial<Line>){setLines(ls=>ls.map(x=>x.id===id?{...x,...patch}:x))}
 function onScan(){const v=scan.trim();setScan('');if(!v)return;const p=findByCode(products,v);
  if(!p){onError('Code inconnu : '+v+(canEnter?' — créez la pièce, elle sera ajoutée à l’entrée.':''));if(canEnter)onUnknown(v);return}
  add(p,1);ref.current?.focus()}
 async function validate(){if(!rows.length)return;
  if(!window.confirm(`Valider l’entrée de ${units} pièce(s) (${rows.length} article(s)) ? Le stock FIXI sera augmenté.`))return;
  setBusy(true);
  try{let refNo='ENT-DEMO';
   if(!demo){const r=await invoke<{reference:string}>('supplier_stock_in',{request:{source,items:rows.map(r=>({productId:r.p.id,quantity:r.l.qty,unitCost:r.l.cost.trim()===''?null:Number(r.l.cost.replace(',','.'))}))}});refNo=r.reference}
   onMessage(`Entrée ${refNo} validée : +${units} pièce(s) en stock.`);setLines([]);setSource('');onDone()}
  catch(e){onError(String(e))}finally{setBusy(false);ref.current?.focus()}}
 if(!canEnter)return <section className="v5-card v6-inv-start"><PackagePlus size={36}/><h2>Entrée de stock</h2><p className="v5-hint">Réservée au gérant : demandez-lui de se connecter pour entrer la marchandise reçue.</p></section>;
 return <section className="v5-stack">
  <div className="v5-scan"><ScanBarcode size={22}/><input ref={ref} autoFocus placeholder="Scannez ou tapez le code (ex. 0000A04) : 1 scan = +1 pièce" value={scan} onChange={e=>setScan(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')onScan()}}/><button className="v5-btn v5-btn--primary" onClick={onScan}><Plus size={18}/> Ajouter</button></div>
  <div className="v5-kpis"><div className="v5-kpi"><span>Articles</span><b>{rows.length}</b></div><div className="v5-kpi"><span>Pièces</span><b>{units}</b></div><div className="v5-kpi"><span>Valeur d’achat</span><b>{dt(value)}</b></div>
   <label className="v5-kpi v6-in-src"><span>Provenance (facultatif)</span><input value={source} onChange={e=>setSource(e.target.value)} placeholder="Grossiste, n° de bon…" maxLength={120}/></label></div>
  <div className="v5-card">{rows.length===0?<p className="v5-hint">Scannez le premier article reçu. Code inconnu ? Fixi propose de créer la pièce avec un code court (ex. 0000A04).</p>:
   <div className="v5-table-wrap"><table className="v5-table"><thead><tr><th>Article</th><th className="num">Stock actuel</th><th className="num">Quantité reçue</th><th className="num">Coût d’achat (DT)</th><th className="act"></th></tr></thead><tbody>
    {rows.map(r=><tr key={r.p.id} className={r.p.id===last?'is-selected':''}><td><b>{r.p.name}</b><small className="v5-mono">{r.p.barcode||r.p.sku}</small></td><td className="num">{r.p.onHand??r.p.stock} → <b>{(r.p.onHand??r.p.stock)+r.l.qty}</b></td>
     <td className="num"><div className="v5-stepper v6-inv-step"><button aria-label="Moins" onClick={()=>set(r.p.id,{qty:Math.max(1,r.l.qty-1)})}><Minus size={14}/></button><input type="number" min={1} value={r.l.qty} onChange={e=>set(r.p.id,{qty:Math.max(1,Math.trunc(Number(e.target.value)||1))})} aria-label={'Quantité '+r.p.name}/><button aria-label="Plus" onClick={()=>set(r.p.id,{qty:r.l.qty+1})}><Plus size={14}/></button></div></td>
     <td className="num"><input className="v5-input v6-in-cost" inputMode="decimal" value={r.l.cost} placeholder="inchangé" onChange={e=>set(r.p.id,{cost:e.target.value.replace(/[^0-9.,]/g,'')})} aria-label={'Coût '+r.p.name}/></td>
     <td className="act"><button className="v5-icon-btn" aria-label="Retirer" onClick={()=>setLines(ls=>ls.filter(x=>x.id!==r.p.id))}><Trash2 size={15}/></button></td></tr>)}
   </tbody></table></div>}</div>
  <div className="v6-actions"><button className="v5-btn v5-btn--ghost" disabled={busy||!rows.length} onClick={()=>{if(window.confirm('Vider cette entrée de stock ?')){setLines([]);setSource('')}}}>Vider</button>
   <button className="v5-btn v5-btn--primary" disabled={busy||!rows.length} onClick={()=>void validate()}><Check size={17}/> Valider l’entrée de stock</button></div>
 </section>;
}
