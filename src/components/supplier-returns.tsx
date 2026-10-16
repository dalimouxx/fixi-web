'use client';

import Link from 'next/link';
import {useMemo,useState} from 'react';
import {RotateCcw,Search,Plus,ReceiptText,PackageCheck,WalletCards,X,CheckCircle2,FileText} from 'lucide-react';
import {api} from './ui';
import {dateTime,money} from '@/lib/format';

type Props={sales:any[];saleItems:any[];returns:any[];returnItems:any[];warehouses:any[];methods:any[];onChanged:()=>void};

export function SupplierReturns({sales,saleItems,returns,returnItems,warehouses,methods,onChanged}:Props){
 const[q,setQ]=useState('');const[show,setShow]=useState(false);const[saleId,setSaleId]=useState('');const[lines,setLines]=useState<Record<string,{qty:number;restock:boolean;condition:string;reason:string}>>({});const[warehouseId,setWarehouseId]=useState('');const[refundMethod,setRefundMethod]=useState('CASH');const[refund,setRefund]=useState('0');const[note,setNote]=useState('');const[busy,setBusy]=useState(false);const[err,setErr]=useState('');const[msg,setMsg]=useState('');
 const sale=useMemo(()=>sales.find(x=>x.id===saleId)||null,[sales,saleId]);
 const filteredReturns=returns.filter(r=>!q||[r.reference,r.sourceRef,r.type].join(' ').toLowerCase().includes(q.toLowerCase()));
 const returnedBySaleItem=useMemo(()=>{const map=new Map<string,number>();for(const item of returnItems){const ret=returns.find(r=>r.id===item.returnId);if(ret?.status==='COMPLETED'&&item.saleItemId)map.set(item.saleItemId,(map.get(item.saleItemId)||0)+Number(item.quantity||0))}return map},[returns,returnItems]);
 const availableLines=sale?saleItems.filter(x=>x.saleId===sale.id).map(x=>({...x,remaining:Math.max(0,x.quantity-(returnedBySaleItem.get(x.id)||0))})).filter(x=>x.remaining>0):[];
 const factor=sale&&Number(sale.subtotal)>0?Number(sale.total)/Number(sale.subtotal):1;
 const selectedRaw=availableLines.reduce((a,x)=>a+Number(x.unitPrice)*Math.min(x.remaining,Math.max(0,lines[x.id]?.qty||0)),0);
 const creditTotal=Math.round(selectedRaw*factor*1000)/1000;

 function chooseSale(id:string){
  const s=sales.find(x=>x.id===id);setSaleId(id);setLines({});setWarehouseId(s?.warehouseId||'');setRefund('0');setNote('');setErr('');
 }
 function update(id:string,patch:any){setLines(cur=>({...cur,[id]:{qty:cur[id]?.qty||0,restock:cur[id]?.restock??true,condition:cur[id]?.condition||'BON',reason:cur[id]?.reason||'Retour client',...patch}}))}
 function useMax(x:any){update(x.id,{qty:x.remaining,restock:true,condition:'BON',reason:'Retour client'})}
 async function submit(e:any){
  e.preventDefault();const selected=availableLines.filter(x=>(lines[x.id]?.qty||0)>0);
  if(!selected.length)return setErr('Sélectionnez au moins un article à retourner.');
  const refundValue=Math.max(0,Number(refund||0));if(refundValue>creditTotal+.001)return setErr('Le remboursement dépasse le montant de l’avoir.');
  setBusy(true);setErr('');setMsg('');
  try{
   await api('/api/supplier/advanced',{method:'POST',body:JSON.stringify({action:'RETURN',type:'SALE_RETURN',sourceSaleId:sale.id,warehouseId:warehouseId||null,refund:refundValue,refundMethod,note:note||null,items:selected.map(x=>({saleItemId:x.id,quantity:lines[x.id].qty,restock:lines[x.id].restock,condition:lines[x.id].condition,reason:lines[x.id].reason}))})});
   setShow(false);setSaleId('');setLines({});setMsg('Avoir créé et stock/comptabilité mis à jour.');onChanged();
  }catch(e:any){setErr(e.message||'Retour impossible')}finally{setBusy(false)}
 }
 return <div className="supplier-returns-v2">
  <div className="supplier-inventory-head"><div><span className="smart-kicker"><RotateCcw size={13}/> RETOURS & AVOIRS</span><h2>Retours clients</h2><p>Chaque retour est relié à la vente d’origine, avec contrôle des quantités, remise en stock et remboursement traçable.</p></div><button className="btn btn-primary" onClick={()=>setShow(true)}><Plus/> Nouvel avoir</button></div>
  {err&&!show&&<div className="supplier-pos-alert error"><X/>{err}</div>}{msg&&<div className="supplier-pos-alert success"><CheckCircle2/>{msg}</div>}
  <section className="supplier-panel">
   <div className="global-search"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Avoir, facture source…"/></div>
   <div className="supplier-credit-list">{filteredReturns.map(r=><article key={r.id}><i><RotateCcw/></i><span><code>{r.reference}</code><b>{r.sourceRef||'Retour'}</b><small>{dateTime(r.createdAt)} · {returnItems.filter(x=>x.returnId===r.id).reduce((a,x)=>a+Number(x.quantity||0),0)} article(s)</small></span><div><b>{money(r.total)}</b><small>{Number(r.refund)>0?'Remboursé '+money(r.refund):'Avoir sans remboursement'}</small></div><Link className="btn btn-soft btn-sm" href={'/supplier/credits/'+r.id} target="_blank"><FileText/> Avoir</Link></article>)}{!filteredReturns.length&&<div className="rt-empty"><RotateCcw/><b>Aucun avoir</b><span>Les retours validés apparaîtront ici.</span></div>}</div>
  </section>
  {show&&<div className="supplier-modal-backdrop"><form className="supplier-modal supplier-return-modal" onSubmit={submit}><button type="button" className="supplier-modal-x" onClick={()=>setShow(false)}><X/></button><span className="smart-kicker"><ReceiptText size={13}/> AVOIR CLIENT</span><h2>Retourner une vente</h2><p>Fixi empêche automatiquement de retourner plus que la quantité réellement vendue.</p>
   {err&&<div className="supplier-pos-alert error"><X/>{err}</div>}
   <label className="label">Facture / vente source</label><select className="input" required value={saleId} onChange={e=>chooseSale(e.target.value)}><option value="">Choisir une vente…</option>{sales.filter(x=>x.status!=='CANCELLED').map(x=><option key={x.id} value={x.id}>{x.reference} · {money(x.total)} · {new Date(x.createdAt).toLocaleDateString('fr-TN')}</option>)}</select>
   {sale&&<><div className="supplier-return-lines">{availableLines.map(x=>{const l=lines[x.id]||{qty:0,restock:true,condition:'BON',reason:'Retour client'};return <div key={x.id} className={l.qty>0?'selected':''}><div className="supplier-return-line-head"><span><b>{x.name}</b><small>{x.sku||'—'} · vendu {x.quantity} · encore retournable {x.remaining}</small></span><button type="button" onClick={()=>useMax(x)}>Tout</button></div><div className="supplier-return-line-grid"><label><span>Qté</span><input type="number" min={0} max={x.remaining} value={l.qty} onChange={e=>update(x.id,{qty:Math.min(x.remaining,Math.max(0,Number(e.target.value)))})}/></label><label><span>État</span><select value={l.condition} onChange={e=>update(x.id,{condition:e.target.value})}><option value="BON">Bon</option><option value="OUVERT">Ouvert</option><option value="ENDOMMAGE">Endommagé</option><option value="DEFECTUEUX">Défectueux</option></select></label><label className="wide"><span>Motif</span><input value={l.reason} onChange={e=>update(x.id,{reason:e.target.value})}/></label><label className="supplier-check wide"><input type="checkbox" checked={l.restock} onChange={e=>update(x.id,{restock:e.target.checked})}/><span><PackageCheck/> Remettre en stock</span></label></div></div>})}{!availableLines.length&&<div className="rt-empty"><CheckCircle2/><b>Cette vente est déjà entièrement retournée</b></div>}</div>
   <div className="supplier-return-summary"><span>Montant estimé de l’avoir</span><b>{money(creditTotal)}</b></div>
   <div className="supplier-action-grid"><label className="supplier-action-field"><span>Dépôt de retour</span><select className="input" value={warehouseId} onChange={e=>setWarehouseId(e.target.value)}><option value="">Stock global / non réparti</option>{warehouses.filter(w=>w.active).map(w=><option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></label><label className="supplier-action-field"><span>Moyen de remboursement</span><select className="input" value={refundMethod} onChange={e=>setRefundMethod(e.target.value)}>{methods.filter(m=>m.active&&m.code!=='CREDIT').map(m=><option key={m.code} value={m.code}>{m.name}</option>)}</select></label><label className="supplier-action-field"><span>Montant remboursé</span><input className="input" type="number" min={0} max={creditTotal} step=".001" value={refund} onChange={e=>setRefund(e.target.value)}/></label><label className="supplier-action-field wide"><span>Note</span><textarea className="input" value={note} onChange={e=>setNote(e.target.value)}/></label></div>
   <button disabled={busy||!sale||creditTotal<=0} className="btn btn-primary btn-block"><WalletCards/> {busy?'Validation…':'Créer l’avoir '+money(creditTotal)}</button></>}
  </form></div>}
 </div>
}
