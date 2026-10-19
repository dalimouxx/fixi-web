'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,CheckCircle2,CreditCard,CalendarClock,Plus,RefreshCw,Users,Truck,Package,ShieldCheck} from 'lucide-react';

type Plan={id:string;code:string;name:string;description:string|null;price:number|string;trialDays:number;maxProducts:number;maxDrivers:number;maxStaff:number;maxOrdersPerMonth:number;active:boolean;durationValue:number;durationUnit:string};
type Payment={id:string;amount:number|string;method:string;reference:string;paidAt:string};
type Sub={id:string;plan:Plan;status:string;startsAt:string;endsAt:string|null;agreedPrice:string|number|null;payments:Payment[]};
type Company={id:string;name:string;region?:string|null;active:boolean;saasSubscriptions:Sub[];_count:{products:number;orders:number;accounts:number}};
type Data={plans:Plan[];companies:Company[]};
const fmt=(v:any)=>Number(v||0).toFixed(3)+' DT';
const day=(v:any)=>v?new Date(v).toLocaleDateString('fr-TN'):'—';

export default function SupplierBillingAdmin(){
 const [data,setData]=useState<Data>({plans:[],companies:[]}),[loading,setLoading]=useState(true);
 const [companyId,setCompanyId]=useState(''),[planId,setPlanId]=useState(''),[status,setStatus]=useState('TRIAL');
 const [endsAt,setEndsAt]=useState(''),[agreedPrice,setAgreedPrice]=useState(''),[note,setNote]=useState('');
 const [payAmount,setPayAmount]=useState(''),[payMethod,setPayMethod]=useState('ESPECES'),[payReference,setPayReference]=useState('');
 const [msg,setMsg]=useState(''),[err,setErr]=useState(''),[busy,setBusy]=useState(false),[showPlanForm,setShowPlanForm]=useState(false);
 const [newPlan,setNewPlan]=useState({code:'',name:'',description:'',price:'',maxProducts:'500',maxDrivers:'1',maxStaff:'2',maxOrdersPerMonth:'200',durationValue:'1',durationUnit:'MONTH',trialDays:'14'});
 const [planPrices,setPlanPrices]=useState<Record<string,string>>({});
 const selected=data.companies.find(c=>c.id===companyId);
 const current=selected?.saasSubscriptions?.[0];
 const chosenPlan=data.plans.find(p=>p.id===planId);
 const sorted=useMemo(()=>data.companies.slice().sort((a,b)=>a.name.localeCompare(b.name)),[data]);
 async function load(){setLoading(true);try{
  const r=await fetch('/api/platform/supplier-billing',{cache:'no-store'}),j=await r.json();
  if(!r.ok)throw new Error(j.error||'Impossible de charger les fournisseurs');
  setData(j);setCompanyId(x=>x||j.companies?.[0]?.id||'');setPlanId(x=>x||j.plans?.[0]?.id||'');
  setPlanPrices(Object.fromEntries((j.plans||[]).map((p:Plan)=>[p.id,String(p.price)])));setErr('');
 }catch(e){setErr(e instanceof Error?e.message:'Erreur')}finally{setLoading(false)}}
 useEffect(()=>{void load()},[]);
 async function send(method:'POST'|'PATCH',body:unknown,done:string){
  if(busy)return false;setBusy(true);setMsg('');setErr('');
  try{const r=await fetch('/api/platform/supplier-billing',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const j=await r.json();if(!r.ok)throw new Error(j.error||'Enregistrement impossible');
    setMsg(done);await load();return true;
  }catch(e){setErr(e instanceof Error?e.message:'Erreur');return false;}finally{setBusy(false);}
 }
 async function assign(e:React.FormEvent){e.preventDefault();
   if(!companyId||!planId)return setErr('Choisissez un fournisseur et une offre.');
   if(!confirm('Attribuer une nouvelle période à ce fournisseur ? Son ancien historique sera conservé.'))return;
   await send('POST',{action:'ASSIGN',companyId,planId,status,
      endsAt:endsAt?new Date(endsAt+'T23:59:59').toISOString():undefined,
      agreedPrice:agreedPrice||undefined,note},'Formule attribuée et historisée.');
 }
 async function payment(e:React.FormEvent){e.preventDefault();if(!current)return;
   if(!confirm('Confirmer ce paiement fournisseur ?'))return;
   if(await send('POST',{action:'PAYMENT',subscriptionId:current.id,amount:payAmount,method:payMethod,
      reference:payReference.trim()||undefined},'Paiement enregistré et daté.')){
      setPayAmount('');setPayReference('');
   }
 }
 async function savePrice(p:Plan){
   const price=planPrices[p.id];if(!confirm('Modifier le prix affiché de '+p.name+' ? Les prix déjà convenus restent enregistrés.'))return;
   await send('PATCH',{action:'PLAN',id:p.id,price},'Tarif de '+p.name+' mis à jour.');
 }
 async function createPlan(e:React.FormEvent){e.preventDefault();
   if(await send('POST',{action:'PLAN',...newPlan,price:Number(newPlan.price),
      maxProducts:Number(newPlan.maxProducts),maxDrivers:Number(newPlan.maxDrivers),
      maxStaff:Number(newPlan.maxStaff),maxOrdersPerMonth:Number(newPlan.maxOrdersPerMonth),
      durationValue:Number(newPlan.durationValue),trialDays:Number(newPlan.trialDays)},'Nouvelle formule créée.'))
     setShowPlanForm(false);
 }
 const statusLabel=(s:string)=>({ACTIVE:'Actif',TRIAL:'Essai',PAST_DUE:'Impayé',SUSPENDED:'Suspendu',CANCELLED:'Annulé'} as Record<string,string>)[s]||s;
 return <main className="fixi-supplier-billing fixi-supplier-billing-admin">
  <Link className="fixi-supplier-back" href="/saas/suppliers"><ArrowLeft size={16}/> Réseau fournisseurs</Link>
  <div className="fixi-supplier-billing-title"><div><span>FIXI CONTROL · BILLING</span><h1>Abonnements fournisseurs</h1>
   <p>Forfaits indépendants des abonnements Atelier. Affectation manuelle, suivi des périodes et paiements horodatés.</p></div>
   <button className="fixi-supplier-back" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/> Actualiser</button>
  </div>
  {err&&<div className="fixi-billing-error" role="alert">{err}</div>}
  {msg&&<div className="fixi-billing-success" role="status"><CheckCircle2 size={17}/>{msg}</div>}
  <div className="fixi-billing-stats">
   <div><Users size={19}/><span>Fournisseurs</span><strong>{data.companies.length}</strong></div>
   <div><CheckCircle2 size={19}/><span>Avec une offre</span><strong>{data.companies.filter(c=>c.saasSubscriptions.length>0).length}</strong></div>
   <div><ShieldCheck size={19}/><span>Accès historique conservé</span><strong>{data.companies.filter(c=>!c.saasSubscriptions.length).length}</strong></div>
  </div>
  <div className="fixi-billing-admin-grid">
   <section className="fixi-billing-card">
    <h2>Affecter ou renouveler une offre</h2>
    <p>Les anciens fournisseurs ne sont pas coupés automatiquement.</p>
    <form className="fixi-billing-form" onSubmit={assign}>
     <label>Fournisseur<select value={companyId} onChange={e=>setCompanyId(e.target.value)} required>
       <option value="">Choisir</option>{sorted.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
     </select></label>
     <label>Offre<select value={planId} onChange={e=>{setPlanId(e.target.value);setAgreedPrice('')}} required>
       <option value="">Choisir</option>{data.plans.filter(p=>p.active).map(p=><option key={p.id} value={p.id}>{p.name} · {fmt(p.price)}</option>)}
     </select></label>
     {chosenPlan&&<div className="fixi-billing-selection"><Package size={16}/><span>
       <b>{chosenPlan.name}</b> — {chosenPlan.maxProducts} produits, {chosenPlan.maxDrivers} livreurs,
       {chosenPlan.maxStaff} collaborateurs, essai {chosenPlan.trialDays} jours
     </span></div>}
     <div className="fixi-billing-form-grid">
      <label>Statut<select value={status} onChange={e=>setStatus(e.target.value)}>
       <option value="TRIAL">Essai</option><option value="ACTIVE">Actif</option><option value="PAST_DUE">Impayé</option>
       <option value="SUSPENDED">Suspendu</option></select></label>
      <label>Prix négocié (DT)<input type="number" min="0" step="0.001" inputMode="decimal" placeholder={String(chosenPlan?.price||0)}
        value={agreedPrice} onChange={e=>setAgreedPrice(e.target.value)}/></label>
      <label>Date de fin (optionnelle)<input type="date" value={endsAt} onChange={e=>setEndsAt(e.target.value)}/></label>
      <label>Note interne<input value={note} onChange={e=>setNote(e.target.value)} placeholder="Accord commercial, remise…"/></label>
     </div>
     <button className="fixi-billing-button" disabled={busy||!companyId||!planId}>{busy?'Enregistrement…':'Attribuer l’abonnement'}</button>
    </form>
   </section>
   <section className="fixi-billing-card">
    <h2>{selected?.name||'Choisir un fournisseur'}</h2>
    <p>Compte courant et historique conservés.</p>
    <div className="fixi-billing-selection">
     <div><b>Offre actuelle : {current?.plan.name||'Accès historique'}</b>
      <p>{current?statusLabel(current.status)+' · '+day(current.startsAt)+' au '+day(current.endsAt):'Aucune facturation encore attribuée'}</p></div>
    </div>
    {current&&<><h3>Confirmer un paiement</h3><form className="fixi-billing-form" onSubmit={payment}>
      <label>Montant reçu (DT)<input type="number" min="0.001" step="0.001" inputMode="decimal" required value={payAmount}
        onChange={e=>setPayAmount(e.target.value)} placeholder="Ex. 59"/></label>
      <label>Mode<select value={payMethod} onChange={e=>setPayMethod(e.target.value)}>
        <option value="ESPECES">Espèces</option><option value="D17">D17</option>
        <option value="FLOUCI">Flouci</option><option value="VIREMENT">Virement</option></select></label>
      <label>Référence du reçu (optionnelle)<input value={payReference} onChange={e=>setPayReference(e.target.value)} placeholder="Générée automatiquement"/></label>
      <button className="fixi-billing-button" disabled={busy}>Confirmer le paiement</button>
    </form>
    <h3 style={{marginTop:22}}>Paiements confirmés</h3>
    {selected?.saasSubscriptions.flatMap(s=>s.payments.map(p=>({...p,plan:s.plan.name}))).map(p=>
      <div key={p.id} className="fixi-billing-pay">
        <b>{fmt(p.amount)}</b> · {day(p.paidAt)} · {p.method}<small>{p.plan} · Réf. {p.reference}</small>
      </div>)||null}
    {!selected?.saasSubscriptions.some(s=>s.payments.length>0)&&<p>Aucun paiement enregistré.</p>}
    </>}
   </section>
  </div>
  <div className="fixi-billing-title-row"><h2>Tarifs fournisseur configurables</h2>
   <button className="fixi-supplier-back" onClick={()=>setShowPlanForm(v=>!v)}><Plus size={16}/> Nouvelle formule</button></div>
  {showPlanForm&&<form className="fixi-billing-card fixi-billing-form" onSubmit={createPlan}>
    <h3>Créer une formule personnalisée</h3><div className="fixi-billing-form-grid">
     {Object.entries(newPlan).filter(([key])=>!['durationUnit'].includes(key)).map(([key,value])=>
       <label key={key}>{({code:'Code',name:'Nom',description:'Description',price:'Prix DT',maxProducts:'Max produits',
        maxDrivers:'Max livreurs',maxStaff:'Max collaborateurs',maxOrdersPerMonth:'Max commandes/mois',
        durationValue:'Durée',trialDays:'Essai jours'} as Record<string,string>)[key]||key}
       <input type={['price','maxProducts','maxDrivers','maxStaff','maxOrdersPerMonth','durationValue','trialDays'].includes(key)?'number':'text'}
        min="0" required={key!=='description'} value={value} onChange={e=>setNewPlan(p=>({...p,[key]:e.target.value}))}/></label>)}
     <label>Unité<select value={newPlan.durationUnit} onChange={e=>setNewPlan(p=>({...p,durationUnit:e.target.value}))}>
       <option value="MONTH">Mois</option><option value="YEAR">Année</option><option value="WEEK">Semaine</option><option value="DAY">Jour</option></select></label>
    </div><button disabled={busy} className="fixi-billing-button">Créer l’offre</button>
  </form>}
  <div className="fixi-billing-plans">
   {data.plans.map(p=><article className="fixi-billing-card" key={p.id}>
     <div className="fixi-billing-eyebrow">{p.code} · {p.active?'Activée':'Désactivée'}</div><h3>{p.name}</h3>
     <p>{p.description}</p>
     <label className="fixi-billing-inline-price">Prix / {p.durationUnit==='MONTH'?'mois':p.durationUnit==='YEAR'?'an':p.durationUnit}
       <input type="number" step="0.001" min="0" value={planPrices[p.id]??String(p.price)}
         onChange={e=>setPlanPrices(x=>({...x,[p.id]:e.target.value}))}/></label>
     <button className="fixi-supplier-back" disabled={busy} onClick={()=>void savePrice(p)}>Enregistrer le tarif</button>
     <div className="fixi-billing-perks"><span><Package size={16}/> {p.maxProducts} produits</span>
       <span><Truck size={16}/> {p.maxDrivers} livreurs</span>
       <span><Users size={16}/> {p.maxStaff} employés</span>
       <span><CalendarClock size={16}/> {p.trialDays} jours d’essai</span></div>
   </article>)}
  </div>
 </main>;
}
