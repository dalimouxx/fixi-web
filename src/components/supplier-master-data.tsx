'use client';
import {useEffect,useState} from 'react';
import {Boxes,Tags,Factory,Ruler,WalletCards,Plus,CheckCircle2,X,Building2,ShieldCheck} from 'lucide-react';
import {api} from './ui';

type Props={data:any;onChanged:()=>void};

export function SupplierMasterData({data,onChanged}:Props){
 const[mode,setMode]=useState<'category'|'brand'|'unit'|'payment'|'company'>('category');const[busy,setBusy]=useState(false);const[msg,setMsg]=useState('');const[err,setErr]=useState('');
 const[category,setCategory]=useState({name:'',parentId:'',description:''});const[brand,setBrand]=useState({name:''});const[unit,setUnit]=useState({name:'',symbol:'',precision:0});const[payment,setPayment]=useState({name:'',code:'',cashLike:false});
 const company=data?.company||{};const[settings,setSettings]=useState<any>({});
 useEffect(()=>{
  if(!data?.company?.id)return;
  setSettings({
    ...data.company,
    defaultTaxRate:Number(data.company.defaultTaxRate||0),
    currency:data.company.currency||'DT',allowNegativeStock:!!data.company.allowNegativeStock,
  });
 },[data?.company?.id,data?.company?.updatedAt]);
 async function run(payload:any,after?:()=>void){setBusy(true);setErr('');setMsg('');try{await api('/api/supplier/master-data',{method:'POST',body:JSON.stringify(payload)});setMsg('Enregistré avec succès.');after?.();onChanged()}catch(e:any){setErr(e.message)}finally{setBusy(false)}}
 async function toggle(entity:string,x:any){await run({action:'TOGGLE',entity,id:x.id,active:!x.active})}
 const tabs=[['category','Catégories',Tags],['brand','Marques',Factory],['unit','Unités',Ruler],['payment','Paiements',WalletCards],['company','Société',Building2]] as const;
 return <div className="supplier-master">
  <div className="supplier-master-hero"><div><span className="smart-kicker"><ShieldCheck size={13}/> DONNÉES MAÎTRES</span><h2>Référentiels commerciaux</h2><p>Ces données alimentent le catalogue, le POS, les achats, le stock, les factures et les rapports.</p></div><div className="supplier-master-counts"><div><b>{data?.categories?.filter((x:any)=>x.active).length||0}</b><span>catégories</span></div><div><b>{data?.brands?.filter((x:any)=>x.active).length||0}</b><span>marques</span></div><div><b>{data?.paymentMethods?.filter((x:any)=>x.active).length||0}</b><span>paiements</span></div></div></div>
  <div className="supplier-master-tabs">{tabs.map(([k,l,I])=><button className={mode===k?'active':''} key={k} onClick={()=>setMode(k)}><I/>{l}</button>)}</div>
  {err&&<div className="supplier-pos-alert error"><X/>{err}</div>}{msg&&<div className="supplier-pos-alert success"><CheckCircle2/>{msg}</div>}
  <div className="supplier-master-layout">
   {mode==='category'&&<><section className="supplier-panel"><div className="supplier-section-head"><div><b>Catégories & sous-catégories</b><span>Structure propre au lieu de texte libre sur chaque produit.</span></div></div><div className="supplier-master-list">{(data?.categories||[]).map((x:any)=><div key={x.id}><span><b>{x.name}</b><small>{x.parentId?'Sous-catégorie':'Catégorie principale'} · {x.slug}</small></span><button className={x.active?'active':''} onClick={()=>toggle('CATEGORY',x)}>{x.active?'Active':'Inactive'}</button></div>)}</div></section><form className="supplier-panel supplier-master-form" onSubmit={e=>{e.preventDefault();run({action:'CATEGORY',...category},()=>setCategory({name:'',parentId:'',description:''}))}}><h3>Nouvelle catégorie</h3><label className="label">Nom</label><input className="input" required value={category.name} onChange={e=>setCategory({...category,name:e.target.value})}/><label className="label">Catégorie parente</label><select className="input" value={category.parentId} onChange={e=>setCategory({...category,parentId:e.target.value})}><option value="">Aucune</option>{(data?.categories||[]).filter((x:any)=>x.active&&!x.parentId).map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select><label className="label">Description</label><textarea className="input" value={category.description} onChange={e=>setCategory({...category,description:e.target.value})}/><button disabled={busy} className="btn btn-primary btn-block"><Plus/> Ajouter</button></form></>}
   {mode==='brand'&&<><section className="supplier-panel"><div className="supplier-section-head"><div><b>Marques</b><span>Samsung, Apple, Xiaomi, OEM, etc.</span></div></div><div className="supplier-master-list">{(data?.brands||[]).map((x:any)=><div key={x.id}><span><b>{x.name}</b><small>{x.slug}</small></span><button className={x.active?'active':''} onClick={()=>toggle('BRAND',x)}>{x.active?'Active':'Inactive'}</button></div>)}</div></section><form className="supplier-panel supplier-master-form" onSubmit={e=>{e.preventDefault();run({action:'BRAND',...brand},()=>setBrand({name:''}))}}><h3>Nouvelle marque</h3><label className="label">Nom</label><input className="input" required value={brand.name} onChange={e=>setBrand({name:e.target.value})}/><button disabled={busy} className="btn btn-primary btn-block"><Plus/> Ajouter</button></form></>}
   {mode==='unit'&&<><section className="supplier-panel"><div className="supplier-section-head"><div><b>Unités de vente</b><span>Pièce, boîte, pack, mètre…</span></div></div><div className="supplier-master-list">{(data?.units||[]).map((x:any)=><div key={x.id}><span><b>{x.name}</b><small>{x.symbol} · précision {x.precision}</small></span><button className={x.active?'active':''} onClick={()=>toggle('UNIT',x)}>{x.active?'Active':'Inactive'}</button></div>)}</div></section><form className="supplier-panel supplier-master-form" onSubmit={e=>{e.preventDefault();run({action:'UNIT',...unit},()=>setUnit({name:'',symbol:'',precision:0}))}}><h3>Nouvelle unité</h3><label className="label">Nom</label><input className="input" required value={unit.name} onChange={e=>setUnit({...unit,name:e.target.value})}/><label className="label">Symbole</label><input className="input" required value={unit.symbol} onChange={e=>setUnit({...unit,symbol:e.target.value})}/><label className="label">Décimales</label><input className="input" type="number" min={0} max={3} value={unit.precision} onChange={e=>setUnit({...unit,precision:Number(e.target.value)})}/><button disabled={busy} className="btn btn-primary btn-block"><Plus/> Ajouter</button></form></>}
   {mode==='payment'&&<><section className="supplier-panel"><div className="supplier-section-head"><div><b>Moyens de paiement</b><span>Utilisés par la caisse, les règlements et les rapports.</span></div></div><div className="supplier-master-list">{(data?.paymentMethods||[]).map((x:any)=><div key={x.id}><span><b>{x.name}</b><small>{x.code}{x.cashLike?' · affecte le tiroir caisse':''}</small></span><button className={x.active?'active':''} onClick={()=>toggle('PAYMENT_METHOD',x)}>{x.active?'Active':'Inactive'}</button></div>)}</div></section><form className="supplier-panel supplier-master-form" onSubmit={e=>{e.preventDefault();run({action:'PAYMENT_METHOD',...payment,code:payment.code.toUpperCase()},()=>setPayment({name:'',code:'',cashLike:false}))}}><h3>Nouveau moyen</h3><label className="label">Nom</label><input className="input" required value={payment.name} onChange={e=>setPayment({...payment,name:e.target.value})}/><label className="label">Code</label><input className="input" required value={payment.code} onChange={e=>setPayment({...payment,code:e.target.value.toUpperCase()})}/><label className="supplier-check"><input type="checkbox" checked={payment.cashLike} onChange={e=>setPayment({...payment,cashLike:e.target.checked})}/><span>Impacte physiquement la caisse</span></label><button disabled={busy} className="btn btn-primary btn-block"><Plus/> Ajouter</button></form></>}
   {mode==='company'&&<section className="supplier-panel supplier-company-settings">
     <div className="supplier-section-head"><div><b>Identité commerciale & documents</b>
       <span>Informations utilisées sur les factures, bons de livraison et tickets. Renseignez uniquement les mentions exactes.</span></div>
       {company.verified&&<span className="supplier-verified"><CheckCircle2/> Fournisseur vérifié</span>}
     </div>
     <div className="fixi-doc-settings-subhead">Identification de votre entreprise</div>
     <div className="supplier-settings-grid">
       {[
        ['name','Nom commercial'],['legalName','Raison sociale légale'],['taxId','Matricule fiscal'],
        ['tradeRegister','Registre de commerce / RNE'],['phone','Téléphone principal'],
        ['secondaryPhone','Autre téléphone'],['email','E-mail'],['website','Site Internet'],
        ['address','Adresse complète'],['region','Ville / région']
       ].map(([k,l])=><label key={k}><span>{l}</span><input className="input"
         value={settings[k]||''} onChange={e=>setSettings({...settings,[k]:e.target.value})}/></label>)}
     </div>
     <div className="fixi-doc-settings-subhead">Numérotation et fiscalité</div>
     <div className="supplier-settings-grid">
       {[
         ['currency','Devise (DT)'],['invoicePrefix','Préfixe facture'],
         ['receiptPrefix','Préfixe ticket'],['purchasePrefix','Préfixe achat']
       ].map(([k,l])=><label key={k}><span>{l}</span><input className="input"
         value={settings[k]||''} onChange={e=>setSettings({...settings,[k]:e.target.value})}/></label>)}
       <label><span>TVA par défaut (%)</span><input className="input" type="number" min={0} max={100} step="0.01"
         value={settings.defaultTaxRate??0} onChange={e=>setSettings({...settings,defaultTaxRate:Number(e.target.value)})}/></label>
     </div>
     <div className="fixi-doc-settings-subhead">Informations bancaires (facultatives)</div>
     <div className="supplier-settings-grid">
       {[
         ['bankName','Banque'],['bankRib','RIB / IBAN professionnel']
       ].map(([k,l])=><label key={k}><span>{l}</span><input className="input"
         value={settings[k]||''} onChange={e=>setSettings({...settings,[k]:e.target.value})}/></label>)}
     </div>
     <div className="fixi-doc-settings-subhead">Mentions à imprimer</div>
     <div className="supplier-settings-grid fixi-doc-textarea-grid">
       {[
         ['invoiceTerms','Conditions sur la facture (paiement, garanties)'],
         ['deliveryInstructions','Instructions sur le bon de livraison'],
         ['receiptMessage','Message sur le ticket de caisse'],
         ['documentFooter','Pied de page commun (mentions légales, retour, contact)']
       ].map(([k,l])=><label key={k}><span>{l}</span><textarea className="input"
         rows={3} value={settings[k]||''} onChange={e=>setSettings({...settings,[k]:e.target.value})}/></label>)}
     </div>
     <label className="supplier-check supplier-check-wide"><input type="checkbox"
       checked={!!settings.allowNegativeStock}
       onChange={e=>setSettings({...settings,allowNegativeStock:e.target.checked})}/>
       <span>Autoriser exceptionnellement le stock négatif</span></label>
     <p className="fixi-doc-settings-note">Les mentions fiscales obligatoires et les règles de numérotation dépendent de votre activité. Faites valider vos modèles par votre comptable avant de les utiliser comme factures réglementaires.</p>
     <button disabled={busy} className="btn btn-primary" onClick={()=>void run({action:'COMPANY_SETTINGS',...settings})}>
       Enregistrer l’identité et les mentions
     </button>
   </section>}
  </div>
 </div>
}
