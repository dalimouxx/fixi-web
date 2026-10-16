'use client';
import {useEffect,useState} from 'react';
import {UserCog,Plus,ShieldCheck,KeyRound,Power,PowerOff,X,CheckCircle2} from 'lucide-react';
import {api} from './ui';

const roleLabels:Record<string,string>={
 OWNER:'Propriétaire',ADMIN:'Administrateur',MANAGER:'Manager',STOCK:'Responsable stock',SALES:'Vendeur',CASHIER:'Caissier',ACCOUNTANT:'Comptable',DELIVERY_MANAGER:'Responsable livraison'
};
const roleHelp:Record<string,string>={
 OWNER:'Accès complet, sécurité et administration',
 ADMIN:'Accès complet opérationnel',
 MANAGER:'Pilotage quotidien et supervision',
 STOCK:'Produits, achats, inventaires et dépôts',
 SALES:'Commandes, clients, ventes et tarifs',
 CASHIER:'POS, encaissements et sessions caisse',
 ACCOUNTANT:'Finance, factures, créances et rapports',
 DELIVERY_MANAGER:'Affectations, livreurs, GPS et COD'
};
export function SupplierTeam({session}:{session:any}){
 const[rows,setRows]=useState<any[]>([]);const[show,setShow]=useState(false);const[form,setForm]=useState({fullName:'',login:'',phone:'',role:'CASHIER',password:''});const[busy,setBusy]=useState('');const[err,setErr]=useState('');const[msg,setMsg]=useState('');
 async function load(){const r=await fetch('/api/supplier/accounts',{cache:'no-store'});const j=await r.json();if(r.ok)setRows(Array.isArray(j)?j:[]);else setErr(j.error||'Accès refusé')}
 useEffect(()=>{load()},[]);
 async function create(e:any){e.preventDefault();setBusy('NEW');setErr('');try{await api('/api/supplier/accounts',{method:'POST',body:JSON.stringify(form)});setForm({fullName:'',login:'',phone:'',role:'CASHIER',password:''});setShow(false);setMsg('Compte créé.');await load()}catch(e:any){setErr(e.message)}finally{setBusy('')}}
 async function toggle(x:any){setBusy(x.id);setErr('');try{await api('/api/supplier/accounts',{method:'PATCH',body:JSON.stringify({id:x.id,isActive:!x.isActive})});setMsg(x.isActive?'Compte désactivé.':'Compte activé.');await load()}catch(e:any){setErr(e.message)}finally{setBusy('')}}
 async function reset(x:any){const password=window.prompt('Nouveau mot de passe (6 caractères minimum)');if(!password)return;setBusy(x.id);try{await api('/api/supplier/accounts',{method:'PATCH',body:JSON.stringify({id:x.id,password})});setMsg('Mot de passe mis à jour.')}catch(e:any){setErr(e.message)}finally{setBusy('')}}
 return <div className="supplier-team">
  <div className="supplier-master-hero"><div><span className="smart-kicker"><ShieldCheck size={13}/> ACCÈS & RESPONSABILITÉS</span><h2>Équipe fournisseur</h2><p>Chaque département travaille avec les droits nécessaires, sans accès inutile aux données sensibles.</p></div><button className="btn btn-primary" onClick={()=>setShow(true)}><Plus/> Nouveau compte</button></div>
  {err&&<div className="supplier-pos-alert error"><X/>{err}</div>}{msg&&<div className="supplier-pos-alert success"><CheckCircle2/>{msg}</div>}
  <section className="supplier-panel">
   <div className="supplier-role-guide">{Object.entries(roleLabels).filter(([k])=>k!=='OWNER'||session.role==='OWNER').map(([k,v])=><div key={k}><i><UserCog/></i><span><b>{v}</b><small>{roleHelp[k]}</small></span></div>)}</div>
  </section>
  <section className="supplier-panel" style={{marginTop:12}}>
   <div className="supplier-section-head"><div><b>Comptes actifs et suspendus</b><span>{rows.filter(x=>x.isActive).length} actif(s) · {rows.filter(x=>!x.isActive).length} suspendu(s)</span></div></div>
   <div className="table-wrap"><table className="table"><thead><tr><th>Utilisateur</th><th>Rôle</th><th>Téléphone</th><th>État</th><th>Créé le</th><th>Actions</th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td><b>{x.fullName}</b><div className="muted">@{x.login}</div></td><td><span className="supplier-role-pill">{roleLabels[x.role]||x.role}</span></td><td>{x.phone||'—'}</td><td><span className={x.isActive?'supplier-account-state on':'supplier-account-state'}><i/>{x.isActive?'Actif':'Suspendu'}</span></td><td>{new Date(x.createdAt).toLocaleDateString('fr-TN')}</td><td><div className="supplier-row-actions"><button disabled={busy===x.id} onClick={()=>reset(x)} title="Changer mot de passe"><KeyRound/></button><button disabled={busy===x.id||x.id===session.id} onClick={()=>toggle(x)} title={x.isActive?'Désactiver':'Activer'}>{x.isActive?<PowerOff/>:<Power/>}</button></div></td></tr>)}</tbody></table></div>
  </section>
  {show&&<div className="supplier-modal-backdrop"><form className="supplier-modal" onSubmit={create}><button type="button" className="supplier-modal-x" onClick={()=>setShow(false)}><X/></button><span className="smart-kicker"><UserCog size={13}/> NOUVEL UTILISATEUR</span><h2>Créer un compte département</h2><p>Le compte sera immédiatement limité au rôle choisi.</p><label className="label">Nom complet</label><input className="input" required value={form.fullName} onChange={e=>setForm({...form,fullName:e.target.value})}/><label className="label">Identifiant</label><input className="input" required autoCapitalize="none" value={form.login} onChange={e=>setForm({...form,login:e.target.value.toLowerCase()})}/><label className="label">Téléphone</label><input className="input" inputMode="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/><label className="label">Rôle</label><select className="input" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>{Object.entries(roleLabels).filter(([k])=>k!=='OWNER'||session.role==='OWNER').map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><div className="supplier-role-help">{roleHelp[form.role]}</div><label className="label">Mot de passe initial</label><input className="input" required minLength={6} type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/><button disabled={busy==='NEW'} className="btn btn-primary btn-block"><Plus/> Créer le compte</button></form></div>}
 </div>
}
