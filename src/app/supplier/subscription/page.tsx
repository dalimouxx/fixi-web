'use client';

import Link from 'next/link';
import {useEffect,useState} from 'react';
import {ArrowLeft,CalendarDays,CheckCircle2,CreditCard,PackageOpen,Truck,Users,
  ShieldCheck,RefreshCw,UploadCloud,MessageCircle,Send,Landmark,Smartphone,
  Clock3,FileCheck2,AlertTriangle,Copy,ExternalLink} from 'lucide-react';

type Plan={id:string;code:string;name:string;description:string|null;price:number|string;
 durationValue:number;durationUnit:string;trialDays:number;maxProducts:number;maxDrivers:number;
 maxStaff:number;maxOrdersPerMonth:number};
type Payment={id:string;amount:number|string;paidAt:string;method:string;reference:string;note:string|null};
type Sub={id:string;status:string;startsAt:string;endsAt:string|null;agreedPrice:number|string|null;plan:Plan;payments:Payment[]};
type Payload={state:string;current:Sub|null;plans:Plan[];history:Sub[];
 usage:{products:number;drivers:number;staff:number};company:{name:string};support:string};
type RequestRow={id:string;planId:string;status:string;requestedPrice:number|string;paymentMethod:string;
 transferReference:string|null;createdAt:string;reviewedAt:string|null;hasProof:boolean;adminNote:string|null};
type Payee={d17Phone?:string|null;bankName?:string|null;bankRib?:string|null;instructions?:string|null;
 supportPhone?:string|null;supportEmail?:string|null};
type RequestsData={requests:RequestRow[];payee:Payee|null};
const money=(v:number|string|null)=>Number(v||0).toFixed(3)+' DT';
const date=(v?:string|null)=>v?new Date(v).toLocaleDateString('fr-TN'):'Sans échéance';
const status:Record<string,string>={ACTIVE:'Actif',TRIAL:'Essai',LEGACY:'Accès historique',EXPIRED:'Expiré',
 SUSPENDED:'Suspendu',CANCELLED:'Annulé',PAST_DUE:'Paiement en retard'};
const requestStatus:Record<string,string>={PENDING:'À vérifier',APPROVED:'Activée',REJECTED:'Refusée'};
const unit:Record<string,string>={DAY:'jour',WEEK:'semaine',MONTH:'mois',YEAR:'an'};
const limits=(n:number)=>n>=100000?'Volume élevé':new Intl.NumberFormat('fr-TN').format(n);
const stats=(n:number,max:number)=>max>0?Math.min(100,Math.round(n*100/max)):0;

export default function SupplierSubscriptionPage(){
 const [data,setData]=useState<Payload|null>(null),[requests,setRequests]=useState<RequestsData|null>(null);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [chosen,setChosen]=useState<Plan|null>(null),[method,setMethod]=useState<'D17'|'VIREMENT'|'CONTACT'>('CONTACT');
 const [proof,setProof]=useState(''),[reference,setReference]=useState(''),[note,setNote]=useState('');
 const [uploadFor,setUploadFor]=useState<string|null>(null);
 async function load(){
  setLoading(true);setError('');
  try{
   const [a,b]=await Promise.all([
    fetch('/api/supplier/subscription',{cache:'no-store'}),
    fetch('/api/supplier/subscription-requests',{cache:'no-store'})
   ]);
   const [j,k]=await Promise.all([a.json(),b.json()]);
   if(!a.ok||!b.ok)throw new Error(j.error||k.error||'Impossible de charger les abonnements');
   setData(j);setRequests(k);
  }catch(e){setError(e instanceof Error?e.message:'Erreur réseau');}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[]);
 const payee=requests?.payee;
 async function readProof(file?:File){
  if(!file)return;
  if(file.size>2*1024*1024){setError('Justificatif limité à 2 Mo.');return}
  if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)){
    setError('Joignez un fichier JPG, PNG, WebP ou PDF.');return;
  }
  try{
   const value=await new Promise<string>((resolve,reject)=>{
    const rd=new FileReader();rd.onload=()=>resolve(String(rd.result||''));
    rd.onerror=()=>reject(new Error('Lecture du fichier impossible'));rd.readAsDataURL(file);
   });
   setProof(value);setError('');setNotice('Justificatif prêt à être envoyé.');
  }catch(e){setError(e instanceof Error?e.message:'Lecture impossible')}
 }
 function selectPlan(p:Plan){
   setChosen(p);setMethod('CONTACT');setProof('');setReference('');setNote('');
   setUploadFor(null);setError('');setNotice('');
   document.getElementById('fixi-supplier-payment-center')?.scrollIntoView({behavior:'smooth',block:'start'});
 }
 async function requestSubscription(e:React.FormEvent){
  e.preventDefault();if(!chosen||busy)return;
  setBusy(true);setError('');setNotice('');
  try{
   const res=await fetch('/api/supplier/subscription-requests',{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({planId:chosen.id,paymentMethod:method,
      transferReference:reference.trim(),proofDataUrl:proof||null,note:note.trim()})
   });
   const j=await res.json();if(!res.ok)throw new Error(j.error||'Demande impossible');
   setNotice('Demande envoyée ! Aucun abonnement n’est activé avant le contrôle du paiement par Fixi.');
   setChosen(null);setProof('');setNote('');setReference('');await load();
  }catch(e){setError(e instanceof Error?e.message:'Erreur de demande')}
  finally{setBusy(false)}
 }
 async function attachProof(){
  if(!uploadFor||!proof||busy)return;
  setBusy(true);setError('');setNotice('');
  try{
   const res=await fetch('/api/supplier/subscription-requests',{method:'PATCH',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({id:uploadFor,proofDataUrl:proof,transferReference:reference.trim()})
   });
   const j=await res.json();if(!res.ok)throw new Error(j.error||'Justificatif refusé');
   setNotice('Justificatif transmis à Fixi pour vérification.');
   setUploadFor(null);setProof('');setReference('');await load();
  }catch(e){setError(e instanceof Error?e.message:'Envoi impossible')}
  finally{setBusy(false)}
 }
 async function copy(text:string){
  try{await navigator.clipboard.writeText(text);setNotice('Coordonnées copiées.')}
  catch{setNotice('Sélectionnez et copiez les coordonnées affichées.')}
 }
 const active=data?.current,plan=active?.plan;
 return <main className="fixi-supplier-billing fixi-supplier-payment-page">
  <div className="fixi-supplier-billing-head">
   <Link href="/supplier" className="fixi-supplier-back"><ArrowLeft size={17}/> Retour Supplier</Link>
   <div className="fixi-supplier-billing-title"><div><span>FIXI SUPPLIER · COMPTE ENTREPRISE</span>
    <h1>Abonnement fournisseur</h1>
    <p>Choisissez une formule, réglez par D17 ou virement et envoyez votre justificatif pour contrôle manuel.</p></div>
    <button type="button" onClick={()=>void load()} disabled={loading} className="fixi-supplier-back"><RefreshCw size={16}/> Actualiser</button>
   </div>
  </div>
  {error&&<p role="alert" className="fixi-billing-error">{error}</p>}
  {notice&&<p role="status" className="fixi-billing-success"><CheckCircle2 size={17}/>{notice}</p>}
  {loading&&!data&&<div className="fixi-billing-card">Chargement des offres et règlements…</div>}
  {data&&<>
   <div className="fixi-billing-overview">
    <section className="fixi-billing-card fixi-billing-highlight">
     <span className="fixi-billing-eyebrow">OFFRE ACTUELLE</span>
     <h2>{plan?.name||'Accès fournisseur historique'}</h2>
     <p>{plan?.description||'Votre accès existant reste utilisable. Fixi peut attribuer une formule sans interrompre vos commandes.'}</p>
     <span className={'fixi-billing-badge '+(['ACTIVE','TRIAL','LEGACY'].includes(data.state)?'good':'attention')}>{status[data.state]||data.state}</span>
     {active&&<div className="fixi-billing-dates"><div><CalendarDays size={16}/> Début : {date(active.startsAt)}</div><div><CalendarDays size={16}/> Fin : {date(active.endsAt)}</div></div>}
    </section>
    <section className="fixi-billing-card">
     <span className="fixi-billing-eyebrow">DÉTAILS FINANCIERS</span>
     <h2>{active?money(active.agreedPrice??plan?.price??0):'Aucune facturation'}</h2>
     <p>{active?'Tarif convenu pour cette période. Aucun débit automatique.':'Votre ancien accès n’est pas modifié.'}</p>
     <div className="fixi-billing-perks"><span><ShieldCheck size={16}/> Paiement manuel et vérifié</span>
      <span><CheckCircle2 size={16}/> Commandes et historique préservés</span></div>
    </section>
   </div>
   {plan&&<section className="fixi-billing-card"><h2>Capacité actuelle</h2>
    <div className="fixi-billing-usage">
     {([{label:'Produits',n:data.usage.products,max:plan.maxProducts,Icon:PackageOpen},
       {label:'Livreurs',n:data.usage.drivers,max:plan.maxDrivers,Icon:Truck},
       {label:'Équipe',n:data.usage.staff,max:plan.maxStaff,Icon:Users}]).map(({label,n,max,Icon})=>
       <div key={label}><div className="fixi-billing-usage-label"><span><Icon size={16}/> {label}</span>
        <strong>{n} / {limits(max)}</strong></div><div className="fixi-billing-track">
        <i style={{width:stats(n,max)+'%'}}/></div></div>)}
    </div></section>}
   <h2 className="fixi-billing-section-title">Choisir une formule Supplier</h2>
   <div className="fixi-billing-plans">{data.plans.map(p=>
    <article className={'fixi-billing-card '+(active?.plan.id===p.id?'selected':'')} key={p.id}>
     <span className="fixi-billing-eyebrow">{p.code}</span><h3>{p.name}</h3>
     <strong className="fixi-billing-price">{money(p.price)}
       <small> / {p.durationValue} {unit[p.durationUnit]||p.durationUnit}</small></strong>
     <p>{p.description||'Offre Fixi Supplier'}</p>
     <div className="fixi-billing-perks"><span><CheckCircle2 size={15}/> {limits(p.maxProducts)} produits</span>
       <span><CheckCircle2 size={15}/> {limits(p.maxDrivers)} livreurs</span>
       <span><CheckCircle2 size={15}/> {limits(p.maxStaff)} collaborateurs</span>
       <span><CheckCircle2 size={15}/> {limits(p.maxOrdersPerMonth)} commandes/mois</span></div>
     <button className="fixi-billing-button" type="button" onClick={()=>selectPlan(p)}>
       <Send size={16}/> {active?.plan.id===p.id?'Renouveler la formule':'Demander cette formule'}
     </button>
    </article>)}</div>

   <section className="fixi-billing-card fixi-supplier-payment-center" id="fixi-supplier-payment-center">
    <span className="fixi-billing-eyebrow">CENTRE DE RÈGLEMENT FIXI</span>
    <h2>Comment régler mon abonnement ?</h2>
    <p>Il n’y a pas de paiement automatique. Effectuez un transfert vers les coordonnées officielles
     affichées par Fixi, puis soumettez votre justificatif. Seul l’administrateur valide réellement le paiement.</p>
    <div className="fixi-payment-options">
     <div className="fixi-payment-option"><Smartphone size={24}/>
       <h3>Versement D17</h3>
       {payee?.d17Phone?<><b>{payee.d17Phone}</b><button type="button" onClick={()=>void copy(payee.d17Phone!)}><Copy size={15}/> Copier</button></>:
        <span>Numéro bénéficiaire non encore configuré.</span>}</div>
     <div className="fixi-payment-option"><Landmark size={24}/>
       <h3>Virement bancaire</h3>
       {payee?.bankRib?<><small>{payee.bankName||'Banque Fixi'}</small><b>{payee.bankRib}</b>
        <button type="button" onClick={()=>void copy(payee.bankRib!)}><Copy size={15}/> Copier le RIB</button></>:
        <span>RIB non encore configuré.</span>}</div>
     <div className="fixi-payment-option"><MessageCircle size={24}/><h3>Contacter Fixi</h3>
       {payee?.supportPhone&&<a href={'tel:'+payee.supportPhone}>{payee.supportPhone}</a>}
       {payee?.supportEmail&&<a href={'mailto:'+payee.supportEmail}>{payee.supportEmail}</a>}
       {!payee?.supportPhone&&!payee?.supportEmail&&<span>Envoyez une demande et attendez la réponse Fixi.</span>}</div>
    </div>
    {payee?.instructions&&<div className="fixi-payment-instructions"><ShieldCheck size={19}/>{payee.instructions}</div>}
    {chosen&&<form className="fixi-payment-request-form" onSubmit={e=>void requestSubscription(e)}>
     <div className="fixi-payment-request-head"><div><strong>Demande : {chosen.name}</strong>
       <span>Montant affiché : {money(chosen.price)} · Durée : {chosen.durationValue} {unit[chosen.durationUnit]}</span></div>
       <button type="button" onClick={()=>setChosen(null)}>Annuler</button>
     </div>
     <label>Moyen choisi<select value={method} onChange={e=>{setMethod(e.target.value as any);setProof('')}}>
       <option value="CONTACT">Contacter Fixi avant règlement</option>
       {payee?.d17Phone&&<option value="D17">D17 — transfert manuel</option>}
       {payee?.bankRib&&<option value="VIREMENT">Virement bancaire</option>}
     </select></label>
     {method!=='CONTACT'&&<>
       <label>Référence de transaction<input value={reference} maxLength={100}
         onChange={e=>setReference(e.target.value)} placeholder="Référence fournie par D17 ou la banque"/></label>
       <label className="fixi-payment-upload"><UploadCloud size={20}/>
         <span>{proof?'Justificatif joint ✓':'Ajouter la preuve (JPG, PNG, WebP ou PDF, 2 Mo max)'}</span>
         <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
           onChange={e=>void readProof(e.target.files?.[0])}/></label>
     </>}
     <label>Message ou précision<textarea value={note} maxLength={1200}
       onChange={e=>setNote(e.target.value)} placeholder="Ex. j’ai effectué le transfert ce matin"/></label>
     <button type="submit" className="fixi-billing-button" disabled={busy}>
       <Send size={16}/>{busy?'Transmission…':'Envoyer la demande à Fixi'}
     </button>
     <p className="fixi-payment-safety"><ShieldCheck size={16}/>
       Envoyer un justificatif ne signifie pas « paiement confirmé ». Fixi vérifie le transfert avant d’activer la formule.</p>
    </form>}
    {!chosen&&<p className="fixi-payment-hint">Cliquez sur « Demander cette formule » ci-dessus pour commencer.</p>}
   </section>
   <section className="fixi-billing-card" style={{marginTop:20}}>
    <h2>Mes demandes de règlement</h2><p>Suivez leur statut et complétez une demande en attente de justificatif.</p>
    <div className="fixi-billing-scroll"><table><thead><tr>
      <th>Date</th><th>Formule</th><th>Montant</th><th>Mode</th><th>Statut</th><th>Preuve</th><th>Action</th>
    </tr></thead><tbody>
     {(requests?.requests||[]).map(x=><tr key={x.id}>
      <td>{date(x.createdAt)}</td><td>{data.plans.find(p=>p.id===x.planId)?.name||x.planId}</td>
      <td>{money(x.requestedPrice)}</td><td>{x.paymentMethod}</td>
      <td><strong>{requestStatus[x.status]||x.status}</strong>{x.adminNote&&<small className="fixi-payment-request-note">{x.adminNote}</small>}</td>
      <td>{x.hasProof?'✓ Justificatif reçu':'Sans justificatif'}</td>
      <td>{x.status==='PENDING'&&x.paymentMethod!=='CONTACT'&&!x.hasProof?
       <button type="button" className="fixi-supplier-back" onClick={()=>{setUploadFor(x.id);setChosen(null);setProof('');setReference(x.transferReference||'')}}>Joindre preuve</button>:'—'}</td>
     </tr>)}
     {!requests?.requests?.length&&<tr><td colSpan={7}>Aucune demande. Choisissez une formule pour commencer.</td></tr>}
    </tbody></table></div>
    {uploadFor&&<div className="fixi-payment-request-form">
      <h3>Ajouter un justificatif à la demande</h3>
      <label>Référence transaction<input value={reference} onChange={e=>setReference(e.target.value)}/></label>
      <label className="fixi-payment-upload"><UploadCloud size={19}/>
        <span>{proof?'Fichier prêt ✓':'Photo ou PDF (2 Mo max)'}</span>
        <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={e=>void readProof(e.target.files?.[0])}/></label>
      <div className="fixi-payment-actions"><button type="button" className="fixi-billing-button"
        disabled={!proof||busy} onClick={()=>void attachProof()}>Transmettre à Fixi</button>
        <button type="button" className="fixi-supplier-back" onClick={()=>{setUploadFor(null);setProof('')}}>Annuler</button></div>
     </div>}
   </section>
   <section className="fixi-billing-card" style={{marginTop:20}}>
    <h2>Historique des abonnements validés</h2>
    <div className="fixi-billing-scroll"><table><thead><tr>
      <th>Offre</th><th>Période</th><th>Statut</th><th>Prix convenu</th><th>Paiements enregistrés</th>
    </tr></thead><tbody>{data.history.map(s=><tr key={s.id}>
     <td><b>{s.plan.name}</b></td><td>{date(s.startsAt)} → {date(s.endsAt)}</td>
     <td>{status[s.status]||s.status}</td><td>{money(s.agreedPrice??s.plan.price)}</td>
     <td>{s.payments.length?s.payments.map(p=><div key={p.id} className="fixi-billing-pay">
       <b>{money(p.amount)}</b> · {date(p.paidAt)} · {p.method}
       <small>Réf. Fixi : {p.reference}</small></div>):'Aucun paiement enregistré'}</td>
    </tr>)}
    {!data.history.length&&<tr><td colSpan={5}>Aucun abonnement validé à ce jour.</td></tr>}
    </tbody></table></div>
   </section>
   <div className="fixi-billing-footnote"><CreditCard size={18}/>{data.support}</div>
  </>}
 </main>;
}
