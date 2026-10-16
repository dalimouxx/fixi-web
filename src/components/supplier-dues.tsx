'use client';

import {useMemo,useState} from 'react';
import {Banknote,ArrowDownToLine,Users,Clock3,CheckCircle2,WalletCards,X,Search} from 'lucide-react';
import {api} from './ui';
import {dateTime,money} from '@/lib/format';

type Props={sales:any[];purchases:any[];returns:any[];customers:any[];methods:any[];onChanged:()=>void};

export function SupplierDues({sales,purchases,returns,customers,methods,onChanged}:Props){
 const[mode,setMode]=useState<'CLIENTS'|'VENDORS'>('CLIENTS');
 const[q,setQ]=useState('');
 const[target,setTarget]=useState<any>(null);
 const[amount,setAmount]=useState('');
 const[method,setMethod]=useState('CASH');
 const[note,setNote]=useState('');
 const[busy,setBusy]=useState(false);
 const[err,setErr]=useState('');
 const[msg,setMsg]=useState('');

 const creditsBySale=useMemo(()=>{const m=new Map<string,{total:number;refund:number}>();for(const r of returns||[]){if(r.status!=='COMPLETED'||!r.sourceSaleId)continue;const x=m.get(r.sourceSaleId)||{total:0,refund:0};x.total+=Number(r.total||0);x.refund+=Number(r.refund||0);m.set(r.sourceSaleId,x)}return m},[returns]);

 const clientRows=sales.map(s=>{
  const cr=creditsBySale.get(s.id)||{total:0,refund:0},netTotal=Math.max(0,Number(s.total)-cr.total),netPaid=Math.max(0,Number(s.paid)-cr.refund),due=Math.max(0,netTotal-netPaid),customer=customers.find(c=>c.id===s.customerId);
  const days=Math.floor((Date.now()-new Date(s.createdAt).getTime())/86400000);
  return {...s,netTotal,netPaid,due,days,customerName:customer?.name||'Marketplace / client'};
 }).filter(x=>x.due>.0009&&(!q||[x.reference,x.customerName].join(' ').toLowerCase().includes(q.toLowerCase()))).sort((a,b)=>b.days-a.days);

 const vendorRows=purchases.map(p=>({...p,due:Math.max(0,Number(p.total)-Number(p.paid)),days:Math.floor((Date.now()-new Date(p.createdAt).getTime())/86400000)})).filter(x=>x.due>.0009&&(!q||[x.reference,x.vendorName].join(' ').toLowerCase().includes(q.toLowerCase()))).sort((a,b)=>b.days-a.days);
 const totalClients=clientRows.reduce((a,x)=>a+x.due,0),totalVendors=vendorRows.reduce((a,x)=>a+x.due,0);
 const overdueClients=clientRows.filter(x=>x.days>30).reduce((a,x)=>a+x.due,0),overdueVendors=vendorRows.filter(x=>x.days>30).reduce((a,x)=>a+x.due,0);

 function open(row:any){
  setTarget(row);setAmount(String(row.due.toFixed(3)));setMethod(methods.find(x=>x.active&&x.code==='CASH')?.code||methods.find(x=>x.active)?.code||'CASH');setNote('');setErr('');
 }
 async function pay(e:any){
  e.preventDefault();if(!target)return;
  const value=Math.max(0,Number(amount||0));if(!(value>0)||value>target.due+.001){setErr('Montant invalide.');return}
  setBusy(true);setErr('');
  try{
   const payload=mode==='CLIENTS'?{action:'PAYMENT',saleId:target.id,amount:value,method,note:note||null}:{action:'PURCHASE_PAYMENT',purchaseId:target.id,amount:value,method,note:note||null};
   await api('/api/supplier/erp',{method:'POST',body:JSON.stringify(payload)});
   setTarget(null);setMsg(mode==='CLIENTS'?'Encaissement enregistré.':'Paiement fournisseur enregistré.');onChanged();
  }catch(e:any){setErr(e.message||'Paiement impossible')}finally{setBusy(false)}
 }

 return <div className="supplier-dues-v2">
  <div className="supplier-inventory-head"><div><span className="smart-kicker"><Banknote size={13}/> CRÉDIT & RÈGLEMENTS</span><h2>Créances & dettes</h2><p>Suivi des soldes ouverts, ancienneté et règlements partiels ou complets.</p></div></div>
  {msg&&<div className="supplier-pos-alert success"><CheckCircle2/>{msg}</div>}
  <div className="supplier-dues-kpis"><D icon={Users} label="Créances clients" value={money(totalClients)} sub={clientRows.length+' facture(s)'}/><D icon={Clock3} label="Clients +30 jours" value={money(overdueClients)} sub="priorité recouvrement"/><D icon={ArrowDownToLine} label="Dettes fournisseurs" value={money(totalVendors)} sub={vendorRows.length+' achat(s)'}/><D icon={Clock3} label="Fournisseurs +30 jours" value={money(overdueVendors)} sub="à planifier"/></div>
  <div className="supplier-dues-tabs"><button className={mode==='CLIENTS'?'active':''} onClick={()=>setMode('CLIENTS')}><Users/> Clients</button><button className={mode==='VENDORS'?'active':''} onClick={()=>setMode('VENDORS')}><ArrowDownToLine/> Fournisseurs</button></div>
  <section className="supplier-panel">
   <div className="global-search"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder={mode==='CLIENTS'?'Client ou facture…':'Fournisseur ou achat…'}/></div>
   {mode==='CLIENTS'?<div className="table-wrap"><table className="table"><thead><tr><th>Facture</th><th>Client</th><th>Total net</th><th>Payé net</th><th>Reste</th><th>Âge</th><th></th></tr></thead><tbody>{clientRows.map(x=><tr key={x.id}><td><code>{x.reference}</code><div className="muted">{dateTime(x.createdAt)}</div></td><td><b>{x.customerName}</b></td><td>{money(x.netTotal)}</td><td>{money(x.netPaid)}</td><td><b className={x.days>30?'supplier-due-danger':''}>{money(x.due)}</b></td><td>{x.days} j</td><td><button className="btn btn-primary btn-sm" onClick={()=>open(x)}>Encaisser</button></td></tr>)}</tbody></table>{!clientRows.length&&<div className="rt-empty"><CheckCircle2/><b>Aucune créance ouverte</b></div>}</div>:<div className="table-wrap"><table className="table"><thead><tr><th>Achat</th><th>Fournisseur</th><th>Total</th><th>Payé</th><th>Reste</th><th>Âge</th><th></th></tr></thead><tbody>{vendorRows.map(x=><tr key={x.id}><td><code>{x.reference}</code><div className="muted">{dateTime(x.createdAt)}</div></td><td><b>{x.vendorName}</b></td><td>{money(x.total)}</td><td>{money(x.paid)}</td><td><b className={x.days>30?'supplier-due-danger':''}>{money(x.due)}</b></td><td>{x.days} j</td><td><button className="btn btn-primary btn-sm" onClick={()=>open(x)}>Payer</button></td></tr>)}</tbody></table>{!vendorRows.length&&<div className="rt-empty"><CheckCircle2/><b>Aucune dette ouverte</b></div>}</div>}
  </section>
  {target&&<div className="supplier-modal-backdrop"><form className="supplier-modal" onSubmit={pay}><button type="button" className="supplier-modal-x" onClick={()=>setTarget(null)}><X/></button><span className="smart-kicker"><WalletCards size={13}/> {mode==='CLIENTS'?'ENCAISSEMENT':'RÈGLEMENT FOURNISSEUR'}</span><h2>{target.reference}</h2><p>{mode==='CLIENTS'?target.customerName:target.vendorName} · reste {money(target.due)}</p>{err&&<div className="supplier-pos-alert error"><X/>{err}</div>}<label className="label">Montant</label><div className="supplier-money-input"><input autoFocus type="number" min=".001" max={target.due} step=".001" value={amount} onChange={e=>setAmount(e.target.value)}/><b>DT</b></div><label className="label">Moyen de paiement</label><select className="input" value={method} onChange={e=>setMethod(e.target.value)}>{methods.filter(x=>x.active&&x.code!=='CREDIT').map(x=><option key={x.code} value={x.code}>{x.name}</option>)}</select><label className="label">Note</label><textarea className="input" value={note} onChange={e=>setNote(e.target.value)}/><button disabled={busy} className="btn btn-primary btn-block"><Banknote/> {busy?'Validation…':mode==='CLIENTS'?'Enregistrer l’encaissement':'Enregistrer le paiement'}</button></form></div>}
 </div>
}
function D({icon:Icon,label,value,sub}:any){return <div><i><Icon/></i><span>{label}</span><b>{value}</b><small>{sub}</small></div>}
