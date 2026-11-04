'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Truck,LockKeyhole,MapPinned} from 'lucide-react';
export default function DeliveryLogin(){const r=useRouter();const[f,setF]=useState({login:'',password:''});const[err,setErr]=useState('');const[busy,setBusy]=useState(false);async function submit(e:any){e.preventDefault();setBusy(true);setErr('');try{const x=await fetch('/api/delivery/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(f)});const j=await x.json();if(!x.ok)throw new Error(j.error||'Connexion impossible');r.push('/delivery');r.refresh()}catch(e:any){setErr(e.message)}finally{setBusy(false)}}return <div className="dv-login"><div className="dv-login-hero"><img src="/icons/delivery-192.png" alt="" width={64} height={64}/><h1>Fixi Livreur</h1><p>Vos missions, votre tournée et votre caisse, au même endroit.</p>
  <ul><li><Truck size={18}/> Missions en temps réel avec alerte sonore</li><li><MapPinned size={18}/> Itinéraire et tournée optimisée</li><li><LockKeyhole size={18}/> Preuve de remise sécurisée</li></ul></div>
 <form onSubmit={submit} className="dv-login-card"><h2>Connexion</h2><p>Avec l’identifiant donné par votre fournisseur.</p>{err&&<div className="error">{err}</div>}
  <label className="label">Identifiant</label><input className="input" autoComplete="username" autoCapitalize="off" value={f.login} onChange={e=>setF({...f,login:e.target.value})}/>
  <label className="label">Mot de passe</label><input className="input" type="password" autoComplete="current-password" value={f.password} onChange={e=>setF({...f,password:e.target.value})}/>
  <button className="btn btn-primary btn-block btn-lg" disabled={busy}><LockKeyhole/>{busy?'Connexion…':'Se connecter'}</button>
  <div className="dv-login-foot"><MapPinned size={15}/> Accès réservé aux livreurs autorisés</div></form></div>}