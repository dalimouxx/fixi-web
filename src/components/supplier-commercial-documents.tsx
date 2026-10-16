'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {FileText,Plus,Search,X,Trash2,PackagePlus,CheckCircle2,Send,ReceiptText} from 'lucide-react';
import {api} from './ui';
import {dateTime,money} from '@/lib/format';

type Props={products:any[];customers:any[];vendors:any[];warehouses:any[];onChanged?:()=>void};
const labels:Record<string,string>={QUOTE:'Devis',PROFORMA:'Proforma',DELIVERY_NOTE:'Bon de livraison',PURCHASE_ORDER:'Bon de commande',RECEIPT:'Reçu'};

export function SupplierCommercialDocuments({products,customers,vendors,warehouses,onChanged}:Props){
 const[data,setData]=useState<any>({rows:[],items:[]});const[q,setQ]=useState('');const[show,setShow]=useState(false);const[busy,setBusy]=useState(false);const[err,setErr]=useState('');const[msg,setMsg]=useState('');
 const[type,setType]=useState('QUOTE');const[customerId,setCustomerId]=useState('');const[party,setParty]=useState({name:'',phone:'',address:'',taxId:''});const[warehouseId,setWarehouseId]=useState('');const[validUntil,setValidUntil]=useState('');const[note,setNote]=useState('');
 const[lines,setLines]=useState<any[]>([]);
 async function load(){const r=await fetch('/api/supplier/documents',{cache:'no-store'});const j=await r.json();if(r.ok)setData(j)}
 useEffect(()=>{load()},[]);
 const filtered=(data.rows||[]).filter((x:any)=>!q||[x.reference,labels[x.type],x.partyName,x.status].join(' ').toLowerCase().includes(q.toLowerCase()));
 const subtotal=lines.reduce((a,l)=>a+Math.max(0,Number(l.unitPrice||0)*Number(l.quantity||1)-Number(l.discount||0)),0);
 const tax=lines.reduce((a,l)=>{const base=Math.max(0,Number(l.unitPrice||0)*Number(l.quantity||1)-Number(l.discount||0));return a+base*Number(l.taxRate||0)/100},0);
 const total=subtotal+tax;
 function reset(){setType('QUOTE');setCustomerId('');setParty({name:'',phone:'',address:'',taxId:''});setWarehouseId('');setValidUntil('');setNote('');setLines([]);setErr('')}
 function open(){reset();setShow(true)}
 function chooseCustomer(id:string){setCustomerId(id);const c=customers.find(x=>x.id===id);if(c)setParty({name:c.name||'',phone:c.phone||'',address:c.address||c.region||'',taxId:c.taxId||''})}
 function addProduct(id:string){const p=products.find(x=>x.id===id);if(!p)return;setLines(cur=>{const found=cur.find(x=>x.productId===p.id);if(found)return cur.map(x=>x.productId===p.id?{...x,quantity:x.quantity+1}:x);return [...cur,{productId:p.id,sku:p.sku,name:p.name,quantity:1,unitPrice:Number(p.retailPrice??p.price),discount:0,taxRate:Number(p.taxRate||0)}]})}
 function update(i:number,k:string,v:any){setLines(cur=>cur.map((x,n)=>n===i?{...x,[k]:v}:x))}
 async function submit(e:any){
  e.preventDefault();if(!lines.length){setErr('Ajoutez au moins une ligne.');return}
  setBusy(true);setErr('');
  try{
   const doc=await api('/api/supplier/documents',{method:'POST',body:JSON.stringify({type,customerId:customerId||null,partyName:party.name,partyPhone:party.phone,partyAddress:party.address,partyTaxId:party.taxId,warehouseId:warehouseId||null,validUntil:validUntil||null,note:note||null,items:lines})});
   setShow(false);setMsg(labels[type]+' '+doc.reference+' créé.');await load();onChanged?.();
  }catch(e:any){setErr(e.message||'Création impossible')}finally{setBusy(false)}
 }
 return <div className="supplier-commercial-docs">
  <div className="supplier-docs-head"><div><span className="smart-kicker"><FileText size={13}/> DOCUMENTS COMMERCIAUX</span><h3>Devis, proforma, BL, BC & reçus</h3><p>Un même moteur, des numéros uniques et une mise en page prête à imprimer/PDF.</p></div><button className="btn btn-primary btn-sm" onClick={open}><Plus/> Nouveau document</button></div>
  {msg&&<div className="supplier-pos-alert success"><CheckCircle2/>{msg}</div>}
  <div className="global-search"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Référence, destinataire, type…"/></div>
  <div className="supplier-commercial-list">{filtered.map((x:any)=><article key={x.id}><i><ReceiptText/></i><span><code>{x.reference}</code><b>{labels[x.type]||x.type}</b><small>{x.partyName||'—'} · {dateTime(x.issuedAt)}</small></span><em>{x.status}</em><strong>{money(x.total)}</strong><Link className="btn btn-soft btn-sm" target="_blank" href={'/supplier/commercial-documents/'+x.id}><FileText/> Ouvrir</Link></article>)}{!filtered.length&&<div className="rt-empty"><FileText/><b>Aucun document</b><span>Créez un devis, une proforma, un BL ou un bon de commande.</span></div>}</div>
  {show&&<div className="supplier-modal-backdrop"><form className="supplier-modal supplier-doc-modal" onSubmit={submit}><button type="button" className="supplier-modal-x" onClick={()=>setShow(false)}><X/></button><span className="smart-kicker"><Send size={13}/> NOUVEAU DOCUMENT</span><h2>{labels[type]}</h2>{err&&<div className="supplier-pos-alert error"><X/>{err}</div>}
   <div className="supplier-action-grid"><label className="supplier-action-field"><span>Type</span><select className="input" value={type} onChange={e=>setType(e.target.value)}>{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label className="supplier-action-field"><span>Dépôt</span><select className="input" value={warehouseId} onChange={e=>setWarehouseId(e.target.value)}><option value="">Non spécifié</option>{warehouses.filter(w=>w.active).map(w=><option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></label>
   {type!=='PURCHASE_ORDER'?<label className="supplier-action-field wide"><span>Client</span><select className="input" value={customerId} onChange={e=>chooseCustomer(e.target.value)}><option value="">Saisie libre</option>{customers.filter(c=>c.active!==false).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>:<label className="supplier-action-field wide"><span>Fournisseur</span><select className="input" value={party.name} onChange={e=>{const v=vendors.find(x=>x.name===e.target.value);setParty({name:e.target.value,phone:v?.phone||'',address:v?.address||'',taxId:v?.taxId||''})}}><option value="">Saisie libre</option>{vendors.filter(v=>v.active!==false).map(v=><option key={v.id} value={v.name}>{v.name}</option>)}</select></label>}
   <label className="supplier-action-field"><span>Nom / raison sociale</span><input className="input" value={party.name} onChange={e=>setParty({...party,name:e.target.value})}/></label><label className="supplier-action-field"><span>Téléphone</span><input className="input" value={party.phone} onChange={e=>setParty({...party,phone:e.target.value})}/></label><label className="supplier-action-field wide"><span>Adresse</span><input className="input" value={party.address} onChange={e=>setParty({...party,address:e.target.value})}/></label>{['QUOTE','PROFORMA'].includes(type)&&<label className="supplier-action-field"><span>Valable jusqu’au</span><input className="input" type="date" value={validUntil} onChange={e=>setValidUntil(e.target.value)}/></label>}</div>
   <div className="supplier-doc-product-add"><PackagePlus/><select onChange={e=>{addProduct(e.target.value);e.currentTarget.value=''}} defaultValue=""><option value="" disabled>Ajouter un produit…</option>{products.filter(p=>p.active!==false).map(p=><option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}</select></div>
   <div className="supplier-doc-lines">{lines.map((l,i)=><div key={l.productId||i}><span><b>{l.name}</b><small>{l.sku||'Ligne libre'}</small></span><input title="Qté" type="number" min={1} value={l.quantity} onChange={e=>update(i,'quantity',Math.max(1,Number(e.target.value)))}/><input title="Prix" type="number" min={0} step=".001" value={l.unitPrice} onChange={e=>update(i,'unitPrice',Number(e.target.value))}/><input title="TVA" type="number" min={0} step=".01" value={l.taxRate} onChange={e=>update(i,'taxRate',Number(e.target.value))}/><strong>{money(Math.max(0,l.unitPrice*l.quantity-l.discount)*(1+l.taxRate/100))}</strong><button type="button" onClick={()=>setLines(cur=>cur.filter((_,n)=>n!==i))}><Trash2/></button></div>)}</div>
   <div className="supplier-doc-total"><span>Sous-total <b>{money(subtotal)}</b></span><span>Taxes <b>{money(tax)}</b></span><strong>Total {money(total)}</strong></div><label className="label">Note</label><textarea className="input" value={note} onChange={e=>setNote(e.target.value)}/><button disabled={busy||!lines.length} className="btn btn-primary btn-block"><FileText/> {busy?'Création…':'Créer '+labels[type]}</button>
  </form></div>}
 </div>
}
