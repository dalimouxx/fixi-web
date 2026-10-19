'use client';

import Link from 'next/link';
import {useEffect,useState} from 'react';
import {ArrowLeft,CalendarDays,CheckCircle2,CreditCard,PackageOpen,Truck,Users,ShieldCheck,RefreshCw} from 'lucide-react';

type Plan={id:string;code:string;name:string;description:string|null;price:number|string;durationValue:number;durationUnit:string;trialDays:number;maxProducts:number;maxDrivers:number;maxStaff:number;maxOrdersPerMonth:number};
type Payment={id:string;amount:number|string;paidAt:string;method:string;reference:string;note:string|null};
type Sub={id:string;status:string;startsAt:string;endsAt:string|null;agreedPrice:number|string|null;plan:Plan;payments:Payment[]};
type Payload={state:string;current:Sub|null;plans:Plan[];history:Sub[];usage:{products:number;drivers:number;staff:number};company:{name:string};support:string};
const money=(v:number|string|null)=>Number(v||0).toFixed(3)+' DT';
const date=(v?:string|null)=>v?new Date(v).toLocaleDateString('fr-TN'):'Sans échéance';
const status:Record<string,string>={ACTIVE:'Actif',TRIAL:'Essai',LEGACY:'Accès historique',EXPIRED:'Expiré',SUSPENDED:'Suspendu',CANCELLED:'Annulé',PAST_DUE:'Paiement en retard'};
const limits=(n:number)=>n>=100000?'Volume élevé':new Intl.NumberFormat('fr-TN').format(n);
const stats=(n:number,max:number)=>max>0?Math.min(100,Math.round(n*100/max)):0;

export default function SupplierSubscriptionPage(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 async function load(){setLoading(true);setError('');try{
  const r=await fetch('/api/supplier/subscription',{cache:'no-store'}),j=await r.json();
  if(!r.ok)throw new Error(j.error||'Impossible de charger l’abonnement');
  setData(j);
 }catch(e){setError(e instanceof Error?e.message:'Erreur');}finally{setLoading(false)}}
 useEffect(()=>{void load()},[]);
 const active=data?.current,plan=active?.plan;
 return <main className="fixi-supplier-billing">
  <div className="fixi-supplier-billing-head">
   <Link href="/supplier" className="fixi-supplier-back"><ArrowLeft size={17}/> Retour Supplier</Link>
   <div className="fixi-supplier-billing-title"><div><span>FIXI SUPPLIER · COMPTE ENTREPRISE</span>
     <h1>Abonnement fournisseur</h1>
     <p>Suivez votre formule, les capacités de votre société et tous les règlements liés à Fixi.</p></div>
     <button onClick={()=>void load()} disabled={loading} className="fixi-supplier-back"><RefreshCw size={16}/> Actualiser</button>
   </div>
  </div>
  {error&&<p role="alert" className="fixi-billing-error">{error}</p>}
  {loading&&!data&&<div className="fixi-billing-card">Chargement des offres…</div>}
  {data&&<>
   <div className="fixi-billing-overview">
    <section className="fixi-billing-card fixi-billing-highlight">
      <span className="fixi-billing-eyebrow">OFFRE ACTUELLE</span>
      <h2>{plan?.name||'Accès fournisseur historique'}</h2>
      <p>{plan?.description||'Votre compte existant reste pleinement utilisable. L’administrateur Fixi peut vous attribuer une formule sans interrompre vos commandes.'}</p>
      <span className={'fixi-billing-badge '+(['ACTIVE','TRIAL','LEGACY'].includes(data.state)?'good':'attention')}>{status[data.state]||data.state}</span>
      {active&&<div className="fixi-billing-dates"><div><CalendarDays size={16}/> Début : {date(active.startsAt)}</div><div><CalendarDays size={16}/> Fin : {date(active.endsAt)}</div></div>}
    </section>
    <section className="fixi-billing-card">
      <span className="fixi-billing-eyebrow">DÉTAILS FINANCIERS</span>
      <h2>{active?money(active.agreedPrice??plan?.price??0):'Aucune facturation'}</h2>
      <p>{active?'Tarif convenu pour la période de votre abonnement. Paiement manuel confirmé par Fixi.':'Votre ancien accès n’est pas modifié par la mise en place des offres.'}</p>
      <div className="fixi-billing-perks"><span><ShieldCheck size={16}/> Aucun débit automatique</span><span><CheckCircle2 size={16}/> Commandes et dettes conservées</span></div>
    </section>
   </div>
   {plan&&<section className="fixi-billing-card">
    <h2>Votre capacité actuelle</h2><div className="fixi-billing-usage">
    {([{label:'Produits',n:data.usage.products,max:plan.maxProducts,Icon:PackageOpen},
      {label:'Livreurs',n:data.usage.drivers,max:plan.maxDrivers,Icon:Truck},
      {label:'Équipe',n:data.usage.staff,max:plan.maxStaff,Icon:Users}]).map(({label,n,max,Icon})=>
      <div key={label}><div className="fixi-billing-usage-label"><span><Icon size={16}/> {label}</span><strong>{n} / {limits(max)}</strong></div>
        <div className="fixi-billing-track"><i style={{width:stats(n,max)+'%'}}/></div></div>)}
    </div></section>}
   <h2 className="fixi-billing-section-title">Nos formules fournisseur</h2>
   <div className="fixi-billing-plans">
     {data.plans.map(p=><article key={p.id} className={'fixi-billing-card '+(active?.plan.id===p.id?'selected':'')}>
       <span className="fixi-billing-eyebrow">{p.code}</span><h3>{p.name}</h3>
       <strong className="fixi-billing-price">{money(p.price)} <small>/ {p.durationValue} {p.durationUnit==='MONTH'?'mois':p.durationUnit==='YEAR'?'an':p.durationUnit==='WEEK'?'semaine':'jour'}</small></strong>
       <p>{p.description}</p>
       <div className="fixi-billing-perks"><span><CheckCircle2 size={15}/> {limits(p.maxProducts)} produits</span>
         <span><CheckCircle2 size={15}/> {limits(p.maxDrivers)} livreurs</span>
         <span><CheckCircle2 size={15}/> {limits(p.maxStaff)} collaborateurs</span>
         <span><CheckCircle2 size={15}/> Jusqu’à {limits(p.maxOrdersPerMonth)} commandes/mois</span>
         <span><CheckCircle2 size={15}/> Essai possible : {p.trialDays} jours</span></div>
       <div className="fixi-billing-plan-bottom">{active?.plan.id===p.id?'Votre formule':'Demandez cette offre à Fixi Admin'}</div>
     </article>)}
   </div>
   <section className="fixi-billing-card" style={{marginTop:20}}>
    <h2>Historique et justificatifs des abonnements</h2>
    <p>Chaque période reste identifiable, même après un changement de formule.</p>
    <div className="fixi-billing-scroll"><table>
      <thead><tr><th>Offre</th><th>Période</th><th>Statut</th><th>Prix convenu</th><th>Paiements enregistrés</th></tr></thead>
      <tbody>{data.history.map(s=><tr key={s.id}><td><b>{s.plan.name}</b></td>
        <td>{date(s.startsAt)} → {date(s.endsAt)}</td><td>{status[s.status]||s.status}</td>
        <td>{money(s.agreedPrice??s.plan.price)}</td>
        <td>{s.payments.length?s.payments.map(p=><div key={p.id} className="fixi-billing-pay">
          <b>{money(p.amount)}</b> · {date(p.paidAt)} · {p.method}<small>Réf. {p.reference}</small>
        </div>):'Aucun paiement enregistré'}</td></tr>)}
        {!data.history.length&&<tr><td colSpan={5}>Aucune période payante attribuée à ce jour.</td></tr>}
      </tbody></table></div>
   </section>
   <div className="fixi-billing-footnote"><CreditCard size={18}/>{data.support}</div>
  </>}
 </main>;
}
