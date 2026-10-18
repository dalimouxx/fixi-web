'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, RefreshCw, WalletCards, Truck, ReceiptText, Clock3, Users, FileText } from 'lucide-react';
import st from '@/components/finance-ledger.module.css';
import { FinanceSelectionSummary } from '@/components/finance-selection-summary';

type Client = {id:string;name:string;shopId?:string|null;phone?:string|null;region?:string|null;due:number;paid:number;
  invoices:{id:string;reference:string;sourceOrderId?:string|null;total:number;paid:number;due:number;createdAt:string}[]};
type Receipt = {id:string;reference:string;shopName:string;orderReference?:string|null;collector:string;driverName?:string|null;
  amount:number;status:string;method:string;note?:string|null;proofUrl?:string|null;collectedAt:string;confirmedAt?:string|null;
  remitted:number;remainingToRemit:number;remittances:{id:string;amount:number;reference:string;confirmedAt?:string|null}[]};
type Shift = {id:string;driverName:string;status:string;collected:number;remitted:number;outstanding:number;
  openedAt:string;submittedAt?:string|null;confirmedAt?:string|null;declared:number};
type Journal = {id:string;date:string;type:string;amount:number;reference:string;invoiceReference:string;
  customerName:string;method:string;source:string;status:string;proofUrl?:string|null;note?:string|null};
type Overview = {role:string;metrics:{customerDue:number;atelierDue:number;outstandingCourierCash:number;
  pendingCourierCollections:number;openInvoices:number};clients:Client[];invoices:Client['invoices'];
  settlements:Receipt[];deliveryShifts:Shift[];journal:Journal[]};
const cur = (x:number)=>Number(x||0).toFixed(3)+' DT';
const date = (x:string|null|undefined)=>x?new Date(x).toLocaleString('fr-TN',{dateStyle:'medium',timeStyle:'short'}):'—';
const via = (x:string)=>({CASH:'Espèces',BANK_TRANSFER:'Virement',D17:'D17',FLOUCI:'Flouci',CARD:'Carte',ONLINE:'En ligne'} as Record<string,string>)[x]||x;
const label = (x:string)=>({PAIEMENT:'Paiement reçu',PAIEMENT_A_VALIDER:'Encaissement déclaré',
  REMISE_LIVREUR:'Livreur → Fournisseur',REMBOURSEMENT:'Remboursement',AVOIR:'Avoir / retour'} as Record<string,string>)[x]||x;
type Tab = 'ATELIERS'|'LIVREURS'|'JOURNAL';

export default function SupplierFinancialLedger(){
 const [data,setData]=useState<Overview|null>(null);
 const [tab,setTab]=useState<Tab>('ATELIERS');
 const [search,setSearch]=useState('');
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [orderId,setOrderId]=useState('');
 const [amount,setAmount]=useState('');
 const [method,setMethod]=useState('CASH');
 const [remittanceId,setRemittanceId]=useState('');
 const [remittanceAmount,setRemittanceAmount]=useState('');
 const load=useCallback(async()=>{
   setLoading(true);
   try{
     const res=await fetch('/api/supplier/finance-overview',{cache:'no-store'});
     const info=await res.json();
     if(!res.ok)throw new Error(info.error||'Chargement impossible');
     setData(info);
     setError('');
   }catch(e){setError(e instanceof Error?e.message:'Erreur de connexion');}
   finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();window.addEventListener('focus',load);return()=>window.removeEventListener('focus',load)},[load]);
 const authorised=data?['OWNER','ADMIN','MANAGER','ACCOUNTANT'].includes(data.role):false;
 const pending=(data?.settlements||[]).filter(x=>x.collector==='DRIVER'&&x.status==='PENDING');
 const unremitted=(data?.settlements||[]).filter(x=>x.collector==='DRIVER'&&x.status==='CONFIRMED'&&x.remainingToRemit>0.0001);
 const invoiceOptions=(data?.clients||[]).flatMap(c=>c.invoices.filter(i=>!!i.sourceOrderId&&i.due>0.0001)
   .map(i=>({...i,clientName:c.name})));
 const selectedInvoice=invoiceOptions.find(i=>i.sourceOrderId===orderId);
 const selectedRemittance=unremitted.find(r=>r.id===remittanceId);
  const clients=useMemo(()=>(data?.clients||[]).filter(c=>!!c.shopId && c.due>.0001
   &&(c.name+' '+c.invoices.map(i=>i.reference).join(' ')).toLowerCase().includes(search.toLowerCase())),[data,search]);
 const events=useMemo(()=>(data?.journal||[]).filter(j=>(j.reference+' '+j.customerName+' '+j.source+' '+j.invoiceReference+' '+j.type).toLowerCase()
   .includes(search.toLowerCase())),[data,search]);

 async function post(url:string,payload:unknown,success:string){
   if(busy)return;
   setBusy(true);setMessage('');setError('');
   try{
     const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
     const response=await r.json();
     if(!r.ok)throw new Error(response.error||'Opération impossible');
     setMessage(success);await load();return true;
   }catch(e){setError(e instanceof Error?e.message:'Erreur');return false;}
   finally{setBusy(false);}
 }
 async function collect(e:React.FormEvent){e.preventDefault();
   if(!selectedInvoice){setError('Choisissez une facture.');return;}
   const normalized=amount.trim().replace(',','.');
   if(!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/.test(normalized)||Number(normalized)<=0){
     setError('Saisissez 50, 50.5 ou 50,5 DT.');return;
   }
   if(Math.round(Number(normalized)*1000)>Math.round(selectedInvoice.due*1000)){
     setError('Le paiement dépasse le reste de la facture : '+cur(selectedInvoice.due));return;
   }
   if(await post('/api/supplier/settlements',{orderId,amount:amount.trim(),method,idempotencyKey:crypto.randomUUID()+'-supplier'},
      'Paiement de '+cur(Number(normalized))+' enregistré et ajouté à l’historique.')){setAmount('');}
 }
 async function confirm(r:Receipt){if(!window.confirm('Confirmer '+cur(r.amount)+' reçus par '+(r.driverName||'le livreur')+' ?'))return;
   await post('/api/supplier/settlements/'+encodeURIComponent(r.id)+'/confirm',{},'Encaissement validé. La dette de l’atelier a été mise à jour.');
 }
 async function remit(e:React.FormEvent){e.preventDefault();
   if(await post('/api/supplier/settlements/remittances',{settlementId:remittanceId,amount:remittanceAmount.trim(),
     reference:'REM-'+crypto.randomUUID()},'Remise du livreur enregistrée, datée et historisée.')){
     setRemittanceAmount('');setRemittanceId('');
   }
 }

 return <main className={st.page}>
   <div className={st.head}>
     <div><Link href="/supplier" className={st.action}><ArrowLeft size={15}/> Tableau de bord Supplier</Link>
       <div style={{marginTop:16}} className={st.eyebrow}>FIXI SUPPLIER · FINANCES</div>
       <h1>Comptes, dettes & règlements</h1>
       <p>Une vue claire : ce que les ateliers doivent, ce qui a été payé, ce que les livreurs doivent reverser, et les preuves datées.</p>
     </div>
     <button className={st.action} disabled={loading} onClick={()=>void load()}><RefreshCw size={16}/> Actualiser</button>
   </div>
   <div className={st.cards}>
     <div className={st.card+' '+st.highlight}><span>Ateliers : reste à payer</span><strong>{cur(data?.metrics.atelierDue||0)}</strong><small>Factures comptabilisées (pas les commandes en attente)</small></div>
     <div className={st.card}><span>Livreurs : argent à reverser</span><strong>{cur(data?.metrics.outstandingCourierCash||0)}</strong><small>Encaissements confirmés, hors caisse de tournée historique</small></div>
     <div className={st.card}><span>Encaissements livreur à vérifier</span><strong>{cur(data?.metrics.pendingCourierCollections||0)}</strong><small>À confirmer avant de réduire le dû de l’atelier</small></div>
   </div>
   {error&&<div className={st.errorMsg} role="alert">{error}</div>}
   {message&&<div className={st.successMsg} role="status">{message}</div>}
   <div className={st.toolbar}>
     <button className={st.action+(tab==='ATELIERS'?' '+st.primary:'')} onClick={()=>{setTab('ATELIERS');setSearch('')}}><Users size={15}/> Créances ateliers</button>
     <button className={st.action+(tab==='LIVREURS'?' '+st.primary:'')} onClick={()=>{setTab('LIVREURS');setSearch('')}}><Truck size={15}/> Caisse livreurs</button>
     <button className={st.action+(tab==='JOURNAL'?' '+st.primary:'')} onClick={()=>{setTab('JOURNAL');setSearch('')}}><ReceiptText size={15}/> Historique & preuves</button>
     <input value={search} onChange={e=>setSearch(e.target.value)} className={st.input+' '+st.search} placeholder="Rechercher un client, une facture…"/>
   </div>
   {tab==='ATELIERS'&&<>
     <div className={st.note}><FileText size={14} style={{verticalAlign:'middle'}}/> Ici, la dette est calculée sur les mêmes factures que l’application Atelier. Un paiement validé apparaît dans l’historique des deux côtés.</div>
     {invoiceOptions.length>0&&<section className={st.paymentPanel}>
       <div className={st.paymentPanelTop}>
         <i><WalletCards size={22}/></i>
         <div><h2>Enregistrer un paiement Atelier</h2><p>Choisissez une facture, vérifiez son solde puis encaissez la somme reçue.</p></div>
       </div>
       <form onSubmit={collect} className={st.paymentPanelBody}>
         <label className={st.paymentField}>Facture / atelier
           <select required value={orderId} onChange={e=>{setOrderId(e.target.value);setAmount('');setError('')}}>
             <option value="">Sélectionner une facture</option>
             {invoiceOptions.map(i=><option key={i.id} value={i.sourceOrderId!}>{i.clientName} · {i.reference} · reste {cur(i.due)}</option>)}
           </select>
         </label>
         {selectedInvoice&&<FinanceSelectionSummary
           kind="Facture" reference={selectedInvoice.reference} customerName={selectedInvoice.clientName}
           total={selectedInvoice.total} paid={selectedInvoice.paid} due={selectedInvoice.due}/>}
         <div className={st.grid2}>
           <label className={st.paymentField}>Montant reçu (DT)
             <input required value={amount} onChange={e=>{setAmount(e.target.value);setError('')}}
               placeholder="Ex. 50" inputMode="decimal" autoComplete="off" disabled={!selectedInvoice||busy}/>
             <span className={st.paymentHelp}>Saisissez simplement 50, 50.5 ou 50,5 DT.</span>
           </label>
           <label className={st.paymentField}>Moyen de paiement
             <select value={method} onChange={e=>setMethod(e.target.value)} disabled={busy}>
               <option value="CASH">Espèces</option><option value="BANK_TRANSFER">Virement bancaire</option>
               <option value="D17">D17</option><option value="FLOUCI">Flouci</option><option value="CARD">Carte</option>
             </select>
           </label>
         </div>
         <div className={st.formActions}>
           {selectedInvoice&&<button type="button" className={st.action} disabled={busy}
              onClick={()=>setAmount(String(selectedInvoice.due))}>
              Utiliser le solde restant : {cur(selectedInvoice.due)}
           </button>}
         </div>
         <button type="submit" className={st.paymentSubmit} disabled={busy||!selectedInvoice}>
           <CheckCircle2 size={18}/>{busy?'Enregistrement…':'Confirmer et enregistrer le paiement'}
         </button>
         <p className={st.paymentHelp}>La date, la facture et l’encaissement apparaîtront dans « Historique & preuves » et dans le relevé Atelier.</p>
       </form>
     </section>}
     {clients.length===0&&<div className={st.panel+' '+st.block}>Aucune créance atelier ouverte.</div>}
     {clients.map(c=><section key={c.id} className={st.panel}>
       <div className={st.panelTop}><div><h2>{c.name}</h2><small>{c.phone||''}{c.region?' · '+c.region:''} · {c.invoices.length} facture(s)
         {' '}<Link href={'/supplier/statements/'+c.id} className={st.action} style={{padding:'5px 9px'}}><FileText size={12}/> Relevé imprimable</Link></small></div>
         <div><small>Reste à encaisser</small><strong style={{display:'block'}}>{cur(c.due)}</strong></div>
       </div>
       {c.invoices.filter(i=>i.due>.0001).map(i=><details className={st.order} key={i.id}>
         <summary><div className={st.orderTitle}><strong>{i.reference}</strong><span>{date(i.createdAt)}</span></div>
           <div className={st.amount}><strong>{cur(i.due)}</strong><span>Payé {cur(i.paid)} / {cur(i.total)}</span></div></summary>
         <div className={st.detail}><h3>Paiements de cette facture</h3>
           {events.filter(e=>e.type==='PAIEMENT'&&e.invoiceReference===i.reference).map(e=><div className={st.transaction} key={e.id}>
             <div className={st.transactionHead}><b>{cur(e.amount)}</b><span className={st.state+' '+st.ok}>Confirmé</span></div>
             <div className={st.transactionSub}>{date(e.date)} · {via(e.method)} · {e.source} · {e.reference}</div></div>)}
           <Link href={'/supplier/statements/'+c.id} className={st.action}>Relevé détaillé + justificatifs</Link>
         </div>
       </details>)}
     </section>)}
   </>}
   {tab==='LIVREURS'&&<>
     <div className={st.note}><Truck size={15} style={{verticalAlign:'middle'}}/> <strong>Deux étapes distinctes :</strong> (1) le livreur déclare l’argent reçu de l’atelier ;
       (2) le fournisseur confirme la réception de cet argent. Tant que la remise n’est pas validée, le montant reste « à reverser ».</div>
     {pending.length>0&&<section className={st.panel}><div className={st.panelTop}><h2><Clock3 size={17}/> Encaissements à vérifier ({pending.length})</h2></div>
       <div className={st.block}>{pending.map(r=><div className={st.line} key={r.id}>
         <div><b>{r.shopName}</b><div><span>{r.orderReference||'Commande'} · {r.driverName||'Livreur'} · {date(r.collectedAt)}</span></div>
           {r.proofUrl&&<a href={r.proofUrl} rel="noreferrer" target="_blank">Preuve</a>}</div>
         <div style={{textAlign:'right'}}><strong>{cur(r.amount)}</strong><div style={{marginTop:6}}>{authorised&&<button className={st.action} disabled={busy} onClick={()=>void confirm(r)}>Valider réception atelier</button>}</div></div>
       </div>)}</div></section>}
     {unremitted.length>0&&<section className={st.panel}>
       <div className={st.panelTop}><div><h2>Sommes à remettre au fournisseur</h2><small>Chaque remise, même partielle, est conservée dans l’historique.</small></div><strong>{cur(data?.metrics.outstandingCourierCash||0)}</strong></div>
       <div className={st.block}>{unremitted.map(r=><div key={r.id} className={st.line}>
         <div><b>{r.driverName||'Livreur'}</b><div><span>{r.shopName} · {r.orderReference} · encaissé le {date(r.confirmedAt||r.collectedAt)}</span></div>
           <div><span>Référence : {r.reference} · reçu {cur(r.amount)} · déjà remis {cur(r.remitted)}</span></div></div>
         <strong>À reverser : {cur(r.remainingToRemit)}</strong>
       </div>)}</div>
       {authorised&&<form className={st.form} onSubmit={remit}>
         <div className={st.grid2}><label>Encaissement du livreur<select required className={st.select} value={remittanceId} onChange={e=>setRemittanceId(e.target.value)}>
           <option value="">Choisir l'encaissement</option>{unremitted.map(r=><option key={r.id} value={r.id}>{r.driverName||'Livreur'} · {r.shopName} · {cur(r.remainingToRemit)}</option>)}
         </select></label>
         <label>Somme réellement reçue (DT)<input className={st.input} required inputMode="decimal" placeholder="Ex. 50" value={remittanceAmount} onChange={e=>setRemittanceAmount(e.target.value)}/></label></div>
         {selectedRemittance&&<div className={st.invoiceSummaryInfo} style={{borderRadius:12,padding:14}}>
           <strong>{selectedRemittance.driverName||'Livreur'} · {selectedRemittance.shopName}</strong>
           <div style={{marginTop:7}}>Encaissement initial : <b>{cur(selectedRemittance.amount)}</b> · Déjà remis : <b>{cur(selectedRemittance.remitted)}</b></div>
           <div style={{marginTop:5}}>À reverser maintenant : <b>{cur(selectedRemittance.remainingToRemit)}</b> · Réf. {selectedRemittance.reference}</div>
         </div>}
         <button className={st.action+' '+st.primary} disabled={busy}>Enregistrer la remise du livreur</button>
       </form>}
     </section>}
     {pending.length===0&&unremitted.length===0&&<div className={st.panel+' '+st.block}><CheckCircle2 size={16}/> Aucun encaissement livreur en attente de validation ou de remise dans ce module.</div>}
     <section className={st.panel}><div className={st.panelTop}><div><h2>Caisses de tournée (livraisons classiques)</h2>
       <small>Les remises de fin de tournée sont suivies séparément, pour ne jamais compter deux fois le même argent.</small></div>
       <Link href="/supplier?tab=delivery" className={st.action}>Gérer les tournées</Link></div>
       <div className={st.tableScroll}><table className={st.table}><thead><tr><th>Livreur</th><th>Journée</th><th>Collecté</th><th>Confirmé remis</th><th>Écart non réglé</th><th>État</th></tr></thead>
         <tbody>{(data?.deliveryShifts||[]).slice(0,30).map(x=><tr key={x.id}>
           <td><b>{x.driverName}</b></td><td>{date(x.openedAt)}</td><td>{cur(x.collected)}</td><td>{cur(x.remitted)}</td>
           <td><strong>{cur(x.outstanding)}</strong></td><td>{x.status==='OPEN'?'En cours':x.status==='PENDING_CASHIER'?'Remise à confirmer':'Clôturée'}</td>
         </tr>)}{!data?.deliveryShifts?.length&&<tr><td colSpan={6}>Aucune tournée enregistrée.</td></tr>}</tbody></table></div>
     </section>
   </>}
   {tab==='JOURNAL'&&<section className={st.panel}>
     <div className={st.panelTop}><div><h2>Journal des règlements et justificatifs</h2>
       <small>Date exacte, client, référence, encaisseur, état, preuve. Dernières 1 000 opérations.</small></div>
       <button className={st.action} onClick={()=>window.print()}>Imprimer</button></div>
     <div className={st.tableScroll}><table className={st.table}>
       <thead><tr><th>Date et heure</th><th>Opération</th><th>Atelier / client</th><th>Facture / référence</th><th>Montant</th><th>Qui a encaissé</th><th>Statut / preuve</th></tr></thead>
       <tbody>{events.map(e=><tr key={e.id}>
         <td>{date(e.date)}</td><td><b>{label(e.type)}</b><small>{via(e.method)}</small></td>
         <td>{e.customerName}</td><td>{e.invoiceReference}<small>{e.reference}</small></td>
         <td><b>{cur(e.amount)}</b></td><td>{e.source}</td>
         <td>{e.status==='PENDING'?<span className={st.state+' '+st.pending}>À valider</span>:<span className={st.state+' '+st.ok}>Confirmé</span>}
           {e.proofUrl&&<small><a href={e.proofUrl} target="_blank" rel="noreferrer">Voir preuve</a></small>}
           {e.note&&<small>{e.note}</small>}
         </td>
       </tr>)}{!events.length&&<tr><td colSpan={7}>Aucun mouvement enregistré.</td></tr>}</tbody>
     </table></div>
   </section>}
 </main>;
}
