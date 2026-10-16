'use client';
import {useEffect,useMemo,useState} from 'react';
import {CheckCircle2,ClipboardCheck,Search,Warehouse,Plus,AlertTriangle,Save,X} from 'lucide-react';
import {api} from './ui';
import {dateTime} from '@/lib/format';

type Props={products:any[];warehouses:any[];counts:any[];countItems:any[];onChanged:()=>void};

export function SupplierInventory({products,warehouses,counts,countItems,onChanged}:Props){
 const[selected,setSelected]=useState('');
 const[showStart,setShowStart]=useState(false);
 const[warehouseId,setWarehouseId]=useState('');
 const[q,setQ]=useState('');
 const[values,setValues]=useState<Record<string,string>>({});
 const[busy,setBusy]=useState('');
 const[err,setErr]=useState('');
 const[msg,setMsg]=useState('');

 const active=counts.find(c=>c.id===selected)||counts.find(c=>c.status==='OPEN')||counts[0]||null;
 const items=active?countItems.filter(x=>x.stockCountId===active.id):[];
 useEffect(()=>{if(active&&!selected)setSelected(active.id)},[active?.id]);
 useEffect(()=>{const next:Record<string,string>={};for(const i of items)next[i.productId]=i.countedQty===null||i.countedQty===undefined?'':String(i.countedQty);setValues(next)},[active?.id,countItems.length]);
 const filtered=useMemo(()=>items.filter(i=>{const p=products.find(x=>x.id===i.productId);return !q||[p?.sku,p?.barcode,p?.name,p?.brand].join(' ').toLowerCase().includes(q.toLowerCase())}),[items,products,q]);
 const counted=items.filter(i=>i.countedQty!==null&&i.countedQty!==undefined).length;
 const diff=items.reduce((a,i)=>a+Number(i.difference||0),0);
 const absDiff=items.reduce((a,i)=>a+Math.abs(Number(i.difference||0)),0);

 async function action(payload:any){setBusy(payload.action+(payload.productId||''));setErr('');setMsg('');try{await api('/api/supplier/advanced',{method:'POST',body:JSON.stringify(payload)});onChanged();return true}catch(e:any){setErr(e.message);return false}finally{setBusy('')}}
 async function start(e:any){e.preventDefault();if(await action({action:'STOCK_COUNT_START',warehouseId:warehouseId||null,reference:'INV-'+Date.now()})){setShowStart(false);setMsg('Inventaire démarré. Les quantités attendues ont été figées.')} }
 async function save(item:any){
  const raw=values[item.productId];if(raw===''||!Number.isFinite(Number(raw)))return;
  const n=Math.max(0,Math.trunc(Number(raw)));const ok=await action({action:'STOCK_COUNT_ITEM',stockCountId:active.id,productId:item.productId,countedQty:n});if(ok)setMsg('Comptage enregistré.');
 }
 async function close(){if(!active)return;const missing=items.filter(i=>i.countedQty===null||i.countedQty===undefined).length;if(missing){setErr(missing+' article(s) doivent encore être comptés.');return}if(await action({action:'STOCK_COUNT_CLOSE',stockCountId:active.id})){setMsg('Inventaire clôturé et stock corrigé.')}}

 return <div className="supplier-inventory-v2">
  <div className="supplier-inventory-head"><div><span className="smart-kicker"><ClipboardCheck size={13}/> INVENTAIRE CONTRÔLÉ</span><h2>Inventaires physiques</h2><p>Les quantités attendues sont figées au démarrage. Chaque écart validé génère un mouvement de stock traçable.</p></div><button className="btn btn-primary" onClick={()=>setShowStart(true)}><Plus/> Nouvel inventaire</button></div>
  {err&&<div className="supplier-pos-alert error"><X/>{err}</div>}{msg&&<div className="supplier-pos-alert success"><CheckCircle2/>{msg}</div>}
  <div className="supplier-inventory-layout">
   <aside className="supplier-panel supplier-count-list"><div className="supplier-section-head"><div><b>Sessions</b><span>{counts.length} inventaire(s)</span></div></div>{counts.map(c=><button key={c.id} className={active?.id===c.id?'active':''} onClick={()=>setSelected(c.id)}><i className={c.status==='OPEN'?'open':''}/><span><b>{c.reference}</b><small>{warehouses.find(w=>w.id===c.warehouseId)?.name||'Stock global'} · {dateTime(c.createdAt)}</small></span><em>{c.status==='OPEN'?'OUVERT':'CLÔTURÉ'}</em></button>)}{!counts.length&&<div className="rt-empty"><ClipboardCheck/><b>Aucun inventaire</b><span>Démarrez un premier comptage physique.</span></div>}</aside>
   <section className="supplier-panel supplier-count-workspace">
    {active?<><div className="supplier-section-head"><div><b>{active.reference}</b><span>{warehouses.find(w=>w.id===active.warehouseId)?.name||'Inventaire global'} · {active.status}</span></div>{active.status==='OPEN'&&<button className="btn btn-primary btn-sm" disabled={busy!==''||counted<items.length} onClick={close}><CheckCircle2/> Clôturer</button>}</div>
     <div className="supplier-count-kpis"><div><span>Progression</span><b>{counted}/{items.length}</b><small>{items.length?Math.round(counted/items.length*100):100}%</small></div><div><span>Écart net</span><b className={diff?'warn':''}>{diff>0?'+':''}{diff}</b><small>unités</small></div><div><span>Écart absolu</span><b className={absDiff?'warn':''}>{absDiff}</b><small>unités à justifier</small></div></div>
     <div className="global-search supplier-count-search"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="SKU, code-barres, produit…"/></div>
     <div className="table-wrap"><table className="table supplier-count-table"><thead><tr><th>Produit</th><th>Attendu</th><th>Compté</th><th>Écart</th><th></th></tr></thead><tbody>{filtered.map(i=>{const p=products.find(x=>x.id===i.productId);const local=values[i.productId]??'';const preview=local===''?null:Number(local)-Number(i.expectedQty);return <tr key={i.id}><td><b>{p?.name||i.productId}</b><div className="muted">{p?.sku||'—'}{p?.location?' · '+p.location:''}</div></td><td><b>{i.expectedQty}</b></td><td>{active.status==='OPEN'?<input className="supplier-count-input" inputMode="numeric" type="number" min={0} value={local} onChange={e=>setValues({...values,[i.productId]:e.target.value})} onKeyDown={e=>e.key==='Enter'&&save(i)}/>:<b>{i.countedQty??'—'}</b>}</td><td><span className={'supplier-diff '+((preview??i.difference)>0?'plus':(preview??i.difference)<0?'minus':'')}>{(preview??i.difference)>0?'+':''}{preview??i.difference??'—'}</span></td><td>{active.status==='OPEN'&&<button className="supplier-save-count" disabled={busy!==''||local===''} onClick={()=>save(i)}><Save/></button>}</td></tr>})}</tbody></table></div>
    </>:<div className="rt-empty"><ClipboardCheck/><b>Sélectionnez un inventaire</b></div>}
   </section>
  </div>
  {showStart&&<div className="supplier-modal-backdrop"><form className="supplier-modal" onSubmit={start}><button type="button" className="supplier-modal-x" onClick={()=>setShowStart(false)}><X/></button><span className="smart-kicker"><Warehouse size={13}/> NOUVEL INVENTAIRE</span><h2>Figer le stock attendu</h2><p>Choisissez un dépôt précis ou le stock global. Les mouvements réalisés ensuite ne modifieront pas les quantités attendues de cette session.</p><label className="label">Périmètre</label><select className="input" value={warehouseId} onChange={e=>setWarehouseId(e.target.value)}><option value="">Stock global</option>{warehouses.filter(w=>w.active).map(w=><option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select><button disabled={busy!==''} className="btn btn-primary btn-block"><Plus/> Démarrer l’inventaire</button></form></div>}
 </div>
}
