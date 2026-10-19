'use client';
import {useMemo,useState} from 'react';
import {api,Modal,useApi} from './ui';
import {CalendarClock,Check,Edit3,Plus,Trash2,Archive,RefreshCw,ShieldCheck,Users,Tag,Clock3,Search} from 'lucide-react';
import {dateOnly,money} from '@/lib/format';

const units:Record<string,string>={DAY:'jour',WEEK:'semaine',MONTH:'mois',YEAR:'an'};
const blank={code:'',name:'',description:'',price:0,durationValue:1,durationUnit:'MONTH',trialDays:0,publicVisible:true,maxShops:1,maxUsersPerShop:5,active:true};
const emptySubscription={tenantId:'',planId:'',status:'ACTIVE',startsAt:'',endsAt:'',agreedPrice:'',notes:''};
const states=['TRIAL','ACTIVE','PAST_DUE','SUSPENDED','CANCELLED'] as const;
const stateNames:Record<string,string>={TRIAL:'Essai',ACTIVE:'Actif',PAST_DUE:'Impayé',SUSPENDED:'Suspendu',CANCELLED:'Annulé'};
type Screen='plans'|'clients'|'requests';

export function SaasSubscriptionsV8(){
 const [refresh,setRefresh]=useState(0);
 const {data:plans}=useApi<any[]>('/api/platform/plans',refresh);
 const {data:requests}=useApi<any[]>('/api/platform/subscription-requests',refresh);
 const {data:tenants}=useApi<any[]>('/api/platform/tenants',refresh);
 const [screen,setScreen]=useState<Screen>('plans');
 const [edit,setEdit]=useState<any>(null),[subEdit,setSubEdit]=useState<any>(null);
 const [create,setCreate]=useState(false),[createSub,setCreateSub]=useState(false);
 const [f,setF]=useState<any>(blank),[sf,setSf]=useState<any>(emptySubscription);
 const [search,setSearch]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const active=(plans||[]).filter((p:any)=>p.active);
 const openClients=useMemo(()=>(tenants||[]).filter((t:any)=>
   (t.name+' '+(t.shops||[]).map((x:any)=>x.name).join(' ')).toLocaleLowerCase().includes(search.toLocaleLowerCase())),
   [tenants,search]);
 const stats=useMemo(()=>({
   total:(tenants||[]).length,
   active:(tenants||[]).filter((x:any)=>x.subscriptions?.[0]?.status==='ACTIVE').length,
   trial:(tenants||[]).filter((x:any)=>x.subscriptions?.[0]?.status==='TRIAL').length,
   requests:(requests||[]).filter((x:any)=>x.status==='PENDING').length,
 }),[tenants,requests]);

 async function mutate(task:()=>Promise<any>,success:string){
  if(busy)return;setBusy(true);setError('');setMessage('');
  try{const result=await task();setMessage(result?.message||success);setRefresh(x=>x+1);return true}
  catch(e:any){setError(e.message||'Opération impossible');return false}
  finally{setBusy(false)}
 }
 async function savePlan(e:React.FormEvent){
  e.preventDefault();
  if(await mutate(()=>api(edit?`/api/platform/plans/${edit.id}`:'/api/platform/plans',{
    method:edit?'PATCH':'POST',body:JSON.stringify(f)
  }),edit?'Formule modifiée.':'Nouvelle formule créée.')){setEdit(null);setCreate(false)}
 }
 function openEdit(p:any){setEdit(p);setF({...p})}
 async function remove(p:any){
  if(p.code==='CONNECT'){setError('Fixi Connect reste gratuit et ne peut pas être supprimé.');return;}
  if(!window.confirm('Supprimer la formule « '+p.name+' » ? Si elle est utilisée, conservez-la en la désactivant.'))return;
  await mutate(()=>api('/api/platform/plans/'+p.id,{method:'DELETE'}),'Formule supprimée.');
 }
 function beginSubscription(tenantId=''){
  setSf({...emptySubscription,tenantId,planId:active.find((p:any)=>p.code==='CONNECT')?.id||active[0]?.id||''});
  setCreateSub(true);setScreen('clients');
 }
 async function assignSub(e:React.FormEvent){
  e.preventDefault();
  if(!sf.tenantId||!sf.planId){setError('Choisissez le client et la formule.');return;}
  if(!window.confirm('Attribuer cette nouvelle période à la boutique ? L’historique précédent reste conservé.'))return;
  if(await mutate(()=>api('/api/platform/subscriptions',{method:'POST',body:JSON.stringify({
    ...sf,endsAt:sf.endsAt||undefined,startsAt:sf.startsAt||undefined,
  })}),'Abonnement attribué.'))setCreateSub(false);
 }
 function editSubscription(s:any){setSubEdit({
  ...s,startsAt:s.startsAt?String(s.startsAt).slice(0,10):'',
  endsAt:s.endsAt?String(s.endsAt).slice(0,10):'',
  agreedPrice:s.agreedPrice==null?'':String(s.agreedPrice),
 })}
 async function saveSub(e:React.FormEvent){
  e.preventDefault();
  if(await mutate(()=>api('/api/platform/subscriptions/'+subEdit.id,{
    method:'PATCH',body:JSON.stringify({
      status:subEdit.status,planId:subEdit.planId,startsAt:subEdit.startsAt,
      endsAt:subEdit.endsAt||null,notes:subEdit.notes||'',
      agreedPrice:subEdit.agreedPrice===''?undefined:Number(subEdit.agreedPrice),
    })
  }),'Abonnement modifié.'))setSubEdit(null);
 }
 async function deleteSub(s:any){
  if(!window.confirm('Supprimer la période ? Les abonnements avec historique de paiement sont archivés, jamais effacés.'))return;
  if(await mutate(()=>api('/api/platform/subscriptions/'+s.id,{method:'DELETE'}),'Période traitée.'))
    setSubEdit(null);
 }
 async function review(r:any,action:string){
  if(action==='REJECT'){
   const adminNote=window.prompt('Motif du refus','');
   if(adminNote===null)return;
   await mutate(()=>api('/api/platform/subscription-requests/'+r.id,{
      method:'PATCH',body:JSON.stringify({action:'REJECT',adminNote})
   }),'Demande refusée.');
  }else{
   const raw=window.prompt('Prix validé',String(r.requestedPrice??r.plan?.price??0));
   if(raw===null)return;
   const price=Number(raw);
   if(!Number.isFinite(price)||price<0){setError('Prix invalide');return;}
   const durationValue=Number(window.prompt('Durée',String(r.durationValue??r.plan?.durationValue??1)));
   if(!Number.isSafeInteger(durationValue)||durationValue<1){setError('Durée invalide');return;}
   const durationUnit=window.prompt('Unité : DAY / WEEK / MONTH / YEAR',r.durationUnit??r.plan?.durationUnit??'MONTH');
   if(!durationUnit||!units[durationUnit]){setError('Unité de durée invalide');return;}
   await mutate(()=>api('/api/platform/subscription-requests/'+r.id,{
    method:'PATCH',body:JSON.stringify({action:'APPROVE',planId:r.planId,price,durationValue,durationUnit,paymentMethod:r.paymentMethod})
   }),'Demande approuvée.');
  }
 }
 return <section className="control-content subscriptions-v8 fixi-subscription-admin">
  <div className="fixi-subs-title">
   <div><span className="control-kicker">FACTURATION ATELIER</span><h2>Abonnements des boutiques</h2>
    <p>Créez, modifiez, attribuez et archivez les offres. Fixi Connect reste toujours gratuit pour la commande et la livraison.</p>
   </div>
   <div className="toolbar">
    <button className="btn btn-soft" type="button" onClick={()=>setRefresh(x=>x+1)}><RefreshCw size={16}/> Actualiser</button>
    <button className="btn btn-primary" type="button" onClick={()=>beginSubscription()}><Plus size={16}/> Attribuer un abonnement</button>
   </div>
  </div>
  <div className="fixi-subs-metrics">
   <div><Users size={18}/><span>Comptes clients</span><strong>{stats.total}</strong></div>
   <div><ShieldCheck size={18}/><span>Abonnés actifs</span><strong>{stats.active}</strong></div>
   <div><Clock3 size={18}/><span>Essais</span><strong>{stats.trial}</strong></div>
   <div><CalendarClock size={18}/><span>Demandes en attente</span><strong>{stats.requests}</strong></div>
  </div>
  <div className="fixi-subs-tabs" role="group" aria-label="Gestion des abonnements">
   {([['plans','Formules',Tag],['clients','Clients & échéances',Users],['requests','Demandes',CalendarClock]] as const).map(([key,label,Icon])=>
    <button key={key} type="button" className={screen===key?'active':''} onClick={()=>{setScreen(key);setError('')}}>
      <Icon size={17}/>{label}{key==='requests'&&stats.requests>0&&<b>{stats.requests}</b>}
    </button>)}
  </div>
  {error&&<div role="alert" className="fixi-subs-feedback error">{error}</div>}
  {message&&<div role="status" className="fixi-subs-feedback success">{message}</div>}
  {screen==='plans'&&<>
   <div className="section-toolbar"><div><h2>Formules Atelier & Connect</h2>
     <p>Prix, durée, visibilité, nombres d’utilisateurs et essai : modifiables à tout moment.</p></div>
    <button type="button" className="btn btn-primary" onClick={()=>{setEdit(null);setF({...blank});setCreate(true)}}><Plus size={16}/> Nouvelle formule</button>
   </div>
   <div className="saas-plan-grid">
    {(plans||[]).map((p:any)=><article key={p.id} className={'saas-plan-card '+(!p.active?'disabled':'')}>
      <div className="saas-plan-top"><span>{p.code}</span>
       <div><button type="button" title="Modifier" aria-label={'Modifier '+p.name} onClick={()=>openEdit(p)}><Edit3 size={17}/></button>
       {p.code!=='CONNECT'&&<button type="button" title="Supprimer" aria-label={'Supprimer '+p.name} onClick={()=>void remove(p)}><Trash2 size={17}/></button>}</div>
      </div>
      <h3>{p.name}</h3><p>{p.description||'Offre Atelier personnalisable'}</p>
      <div className="saas-plan-price"><b>{p.code==='CONNECT'?'Gratuit':money(p.price)}</b>
       <span>{p.code==='CONNECT'?'Sans limitation de temps':'/ '+p.durationValue+' '+units[p.durationUnit]}</span></div>
      <small>{p.maxUsersPerShop} utilisateurs/boutique · {p.maxShops} boutique(s) · {p.publicVisible?'Public':'Privé'} · {p.active?'Actif':'Inactif'}</small>
      <button type="button" className="btn btn-soft btn-sm" onClick={()=>openEdit(p)}><Edit3 size={14}/> Configurer la formule</button>
    </article>)}
   </div>
  </>}
  {screen==='clients'&&<>
   <div className="section-toolbar fixi-subs-clients-toolbar"><div><h2>Abonnements par client</h2>
    <p>Gestion des périodes, renouvellement, changement de formule et statut.</p></div>
    <div className="toolbar"><div className="fixi-subs-search"><Search size={16}/>
     <input aria-label="Rechercher un client" placeholder="Rechercher une boutique…" value={search} onChange={e=>setSearch(e.target.value)}/>
    </div></div>
   </div>
   <div className="control-table-wrap"><table className="control-table">
    <thead><tr><th>Client</th><th>Boutiques</th><th>Formule</th><th>État</th><th>Échéance</th><th>Actions</th></tr></thead>
    <tbody>{openClients.map((t:any)=>{const sub=t.subscriptions?.[0];return <tr key={t.id}>
      <td><strong>{t.name}</strong></td><td>{(t.shops||[]).map((x:any)=>x.name).join(', ')||'—'}</td>
      <td>{sub?.plan?.name||'Fixi Connect (sans période)'}{sub?.agreedPrice!=null&&<small>Prix convenu : {money(sub.agreedPrice)}</small>}</td>
      <td><span className={'status-pill '+String(sub?.status||'active').toLowerCase()}>{sub?stateNames[sub.status]||sub.status:'Connect gratuit'}</span></td>
      <td>{sub?.endsAt?dateOnly(sub.endsAt):'Sans limite'}</td>
      <td><div className="fixi-subs-actions">
        {sub&&<button type="button" className="btn btn-soft btn-sm" onClick={()=>editSubscription(sub)}><Edit3 size={14}/> Modifier</button>}
        <button type="button" className="btn btn-primary btn-sm" onClick={()=>beginSubscription(t.id)}><Plus size={14}/> {sub?'Renouveler':'Attribuer'}</button>
        {sub&&<button type="button" title="Supprimer ou archiver la période" className="btn btn-soft btn-sm" onClick={()=>void deleteSub(sub)}><Archive size={14}/> Archiver</button>}
      </div></td></tr>})}
      {!openClients.length&&<tr><td colSpan={6}>Aucun client correspondant à la recherche.</td></tr>}
    </tbody>
   </table></div>
  </>}
  {screen==='requests'&&<>
   <div className="section-toolbar"><div><h2>Demandes des boutiques</h2>
    <p>Validation des renouvellements et des justificatifs envoyés par les clients.</p></div></div>
   <div className="control-table-wrap"><table className="control-table"><thead><tr>
    <th>Boutique</th><th>Offre</th><th>Durée</th><th>Prix</th><th>Paiement</th><th>État</th><th>Actions</th>
   </tr></thead><tbody>{(requests||[]).map((r:any)=><tr key={r.id}>
    <td><strong>{r.shop.name}</strong><small>{r.shop.region} · {r.shop.phone||''}</small></td>
    <td>{r.plan?.name||'Personnalisée'}</td>
    <td>{r.durationValue?r.durationValue+' '+units[r.durationUnit]:'—'}</td>
    <td>{r.requestedPrice!=null?money(r.requestedPrice):'—'}</td>
    <td>{r.paymentMethod||'—'}{r.proofDataUrl&&<small>Preuve jointe</small>}</td>
    <td><span className={'status-pill '+String(r.status).toLowerCase()}>{r.status}</span></td>
    <td>{r.status==='PENDING'&&<div className="fixi-subs-actions">
      <button type="button" className="btn btn-success btn-sm" onClick={()=>void review(r,'APPROVE')}><Check size={14}/> Approuver</button>
      <button type="button" className="btn btn-danger btn-sm" onClick={()=>void review(r,'REJECT')}>Refuser</button>
    </div>}</td>
   </tr>)}
   {!requests?.length&&<tr><td colSpan={7}>Aucune demande d’abonnement.</td></tr>}</tbody></table></div>
  </>}
  <Modal open={create||!!edit} onClose={()=>{setCreate(false);setEdit(null)}} title={edit?'Modifier la formule':'Créer une formule Atelier'} large>
   <form className="form-grid" onSubmit={savePlan}>
    <div className="field"><label className="label">Code *</label><input className="input" disabled={!!edit} required value={f.code||''} onChange={e=>setF({...f,code:e.target.value.toUpperCase()})}/></div>
    <div className="field"><label className="label">Nom *</label><input className="input" required value={f.name||''} onChange={e=>setF({...f,name:e.target.value})}/></div>
    <div className="field span-2"><label className="label">Description</label><textarea className="textarea" value={f.description||''} onChange={e=>setF({...f,description:e.target.value})}/></div>
    <div className="field"><label className="label">Prix (DT)</label><input className="input" type="number" min="0" step=".001" disabled={f.code==='CONNECT'} value={f.code==='CONNECT'?0:f.price} onChange={e=>setF({...f,price:Number(e.target.value)})}/></div>
    <div className="field"><label className="label">Durée</label><div className="duration-combo">
      <input className="input" type="number" min="1" value={f.durationValue} onChange={e=>setF({...f,durationValue:Number(e.target.value)})}/>
      <select className="select" value={f.durationUnit} onChange={e=>setF({...f,durationUnit:e.target.value})}>{Object.keys(units).map(k=><option key={k} value={k}>{units[k]}</option>)}</select>
    </div></div>
    <div className="field"><label className="label">Utilisateurs par boutique</label><input className="input" type="number" min="1" value={f.maxUsersPerShop} onChange={e=>setF({...f,maxUsersPerShop:Number(e.target.value)})}/></div>
    <div className="field"><label className="label">Boutiques max</label><input className="input" type="number" min="1" value={f.maxShops} onChange={e=>setF({...f,maxShops:Number(e.target.value)})}/></div>
    <div className="field"><label className="label">Essai (jours)</label><input className="input" type="number" min="0" value={f.trialDays||0} onChange={e=>setF({...f,trialDays:Number(e.target.value)})}/></div>
    <label className="toggle-line"><input type="checkbox" checked={f.publicVisible!==false} disabled={f.code==='CONNECT'} onChange={e=>setF({...f,publicVisible:e.target.checked})}/><span>Visible dans les offres</span></label>
    <label className="toggle-line"><input type="checkbox" checked={f.active!==false} disabled={f.code==='CONNECT'} onChange={e=>setF({...f,active:e.target.checked})}/><span>Formule active</span></label>
    <div className="span-2"><button className="btn btn-primary btn-block" disabled={busy}>Enregistrer la formule</button></div>
   </form>
  </Modal>
  <Modal open={createSub} onClose={()=>setCreateSub(false)} title="Attribuer / renouveler l’abonnement" large>
   <form className="form-grid" onSubmit={assignSub}>
    <div className="field span-2"><label className="label">Client / Atelier</label><select className="select" required value={sf.tenantId} onChange={e=>setSf({...sf,tenantId:e.target.value})}>
      <option value="">Choisir un client</option>{(tenants||[]).map((t:any)=><option key={t.id} value={t.id}>{t.name} · {(t.shops||[]).map((x:any)=>x.name).join(', ')}</option>)}
    </select></div>
    <div className="field span-2"><label className="label">Formule</label><select className="select" required value={sf.planId} onChange={e=>setSf({...sf,planId:e.target.value})}>
      <option value="">Choisir une offre</option>{active.map((p:any)=><option key={p.id} value={p.id}>{p.name} · {p.code==='CONNECT'?'Gratuit':money(p.price)}</option>)}
    </select></div>
    <div className="field"><label className="label">Statut</label><select className="select" value={sf.status} onChange={e=>setSf({...sf,status:e.target.value})}>
      {states.map(x=><option key={x} value={x}>{stateNames[x]}</option>)}
    </select></div>
    <div className="field"><label className="label">Date de début (auto si vide)</label><input className="input" type="date" value={sf.startsAt} onChange={e=>setSf({...sf,startsAt:e.target.value})}/></div>
    <div className="field"><label className="label">Prix personnalisé (DT) · optionnel</label>
      <input className="input" type="number" min="0" step=".001" placeholder="Prix public par défaut"
        value={sf.agreedPrice} onChange={e=>setSf({...sf,agreedPrice:e.target.value})}/></div>
    <div className="field"><label className="label">Date de fin (calculée si vide)</label><input className="input" type="date" value={sf.endsAt} onChange={e=>setSf({...sf,endsAt:e.target.value})}/></div>
    <div className="field span-2"><label className="label">Note interne</label><textarea className="textarea" value={sf.notes} onChange={e=>setSf({...sf,notes:e.target.value})}/></div>
    <p className="span-2 fixi-subs-help">Chaque nouvelle période est conservée dans l’historique. Les paiements sont gérés depuis « Facturation Fixi ».</p>
    <div className="span-2"><button className="btn btn-primary btn-block" disabled={busy}>Enregistrer l’abonnement</button></div>
   </form>
  </Modal>
  <Modal open={!!subEdit} onClose={()=>setSubEdit(null)} title="Modifier la période d’abonnement" large>
   <form className="form-grid" onSubmit={saveSub}>
    <div className="field span-2"><label className="label">Formule</label><select className="select" value={subEdit?.planId||''} onChange={e=>setSubEdit({...subEdit,planId:e.target.value})}>
      {(plans||[]).map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}
    </select></div>
    <div className="field"><label className="label">Statut</label><select className="select" value={subEdit?.status||'ACTIVE'} onChange={e=>setSubEdit({...subEdit,status:e.target.value})}>
      {states.map(x=><option value={x} key={x}>{stateNames[x]}</option>)}
    </select></div>
    <div className="field"><label className="label">Date de début</label><input className="input" type="date" required value={subEdit?.startsAt||''} onChange={e=>setSubEdit({...subEdit,startsAt:e.target.value})}/></div>
    <div className="field"><label className="label">Prix convenu (DT)</label><input className="input" type="number" min="0" step=".001"
       value={subEdit?.agreedPrice??''} onChange={e=>setSubEdit({...subEdit,agreedPrice:e.target.value})}/></div>
    <div className="field"><label className="label">Expiration (vide = sans limite)</label><input className="input" type="date" value={subEdit?.endsAt||''} onChange={e=>setSubEdit({...subEdit,endsAt:e.target.value})}/></div>
    <div className="field span-2"><label className="label">Note</label><textarea className="textarea" value={subEdit?.notes||''} onChange={e=>setSubEdit({...subEdit,notes:e.target.value})}/></div>
    <div className="span-2 fixi-subs-actions"><button className="btn btn-primary" disabled={busy}>Enregistrer les modifications</button>
      <button className="btn btn-soft" type="button" disabled={busy} onClick={()=>void deleteSub(subEdit)}><Archive size={15}/> Supprimer / archiver</button>
    </div>
   </form>
  </Modal>
 </section>;
}
