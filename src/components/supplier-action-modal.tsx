'use client';
import {useEffect,useState} from 'react';
import {X,Plus,Users,ReceiptText,PackagePlus,Warehouse,BadgeDollarSign,RotateCcw} from 'lucide-react';
import {api} from './ui';
type Action={type:'CUSTOMER'|'EXPENSE'|'PURCHASE'|'VENDOR'|'WAREHOUSE'|'PRICE_TIER'|'RETURN';product?:any}|null;
type Props={action:Action;products:any[];vendors:any[];methods:any[];warehouses:any[];onClose:()=>void;onDone:()=>void};
export function SupplierActionModal({action,products,vendors,methods,warehouses,onClose,onDone}:Props){
 const[form,setForm]=useState<any>({});const[busy,setBusy]=useState(false);const[err,setErr]=useState('');
 useEffect(()=>{if(!action)return;const p=action.product;const init:any={
  CUSTOMER:{name:'',phone:'',email:'',address:'',region:'',taxId:'',creditLimit:'0',notes:''},
  EXPENSE:{label:'',category:'Général',amount:'',method:'CASH',note:''},
  PURCHASE:{productId:p?.id||'',warehouseId:warehouses[0]?.id||'',quantity:'1',unitCost:String(Number(p?.purchasePrice||p?.averageCost||0)),vendorName:vendors[0]?.name||'',paid:'0',method:'CASH',note:''},
  VENDOR:{name:'',phone:'',email:'',address:'',taxId:'',creditLimit:'0',openingDue:'0',notes:''},
  WAREHOUSE:{name:'',code:'',address:'',region:''},
  PRICE_TIER:{productId:p?.id||'',name:'Grossiste',minQty:'5',unitPrice:String(Number(p?.wholesalePrice||p?.price||0))},
  RETURN:{productId:p?.id||'',quantity:'1',reason:'',condition:'BON',refund:'0',restock:true}
 };setForm(init[action.type]);setErr('')},[action?.type,action?.product?.id]);
 if(!action)return null;
 const actionType=action.type;
 const meta:any={
  CUSTOMER:{title:'Nouveau client professionnel',icon:Users,api:'erp'},
  EXPENSE:{title:'Nouvelle dépense',icon:ReceiptText,api:'erp'},
  PURCHASE:{title:'Réception / achat',icon:PackagePlus,api:'erp'},
  VENDOR:{title:'Nouveau fournisseur amont',icon:Users,api:'advanced'},
  WAREHOUSE:{title:'Nouveau dépôt',icon:Warehouse,api:'advanced'},
  PRICE_TIER:{title:'Nouveau palier de prix',icon:BadgeDollarSign,api:'advanced'},
  RETURN:{title:'Retour / avoir',icon:RotateCcw,api:'advanced'}
 }[actionType];const Icon=meta.icon;
 async function submit(e:any){e.preventDefault();setBusy(true);setErr('');try{
  let payload:any={action:actionType,...form};
  if(actionType==='PURCHASE')payload={action:'PURCHASE',warehouseId:form.warehouseId||null,items:[{productId:form.productId,quantity:Number(form.quantity),unitCost:Number(form.unitCost)}],vendorName:form.vendorName,paid:Number(form.paid||0),method:form.method,note:form.note||null};
  if(actionType==='CUSTOMER')payload={...payload,creditLimit:Number(form.creditLimit||0)};
  if(actionType==='EXPENSE')payload={...payload,amount:Number(form.amount||0)};
  if(actionType==='VENDOR')payload={...payload,creditLimit:Number(form.creditLimit||0),openingDue:Number(form.openingDue||0)};
  if(actionType==='PRICE_TIER')payload={...payload,minQty:Number(form.minQty||1),unitPrice:Number(form.unitPrice||0)};
  if(actionType==='RETURN'){const p=products.find(x=>x.id===form.productId);if(!p)throw new Error('Produit requis');payload={action:'RETURN',type:'SALE_RETURN',items:[{productId:p.id,sku:p.sku,name:p.name,quantity:Number(form.quantity||1),unitPrice:Number(p.retailPrice??p.price),reason:form.reason,condition:form.condition,restock:form.restock}],refund:Number(form.refund||0)}}
  await api(meta.api==='erp'?'/api/supplier/erp':'/api/supplier/advanced',{method:'POST',body:JSON.stringify(payload)});onDone();onClose();
 }catch(e:any){setErr(e.message||'Enregistrement impossible')}finally{setBusy(false)}}
 const field=(k:string,l:string,type='text',props:any={})=><label className="supplier-action-field"><span>{l}</span><input className="input" type={type} value={form[k]??''} onChange={e=>setForm({...form,[k]:e.target.value})} {...props}/></label>;
 return <div className="supplier-modal-backdrop"><form className="supplier-modal supplier-action-modal" onSubmit={submit}><button type="button" className="supplier-modal-x" onClick={onClose}><X/></button><span className="smart-kicker"><Icon size={13}/> OPÉRATION FOURNISSEUR</span><h2>{meta.title}</h2>
  {err&&<div className="supplier-pos-alert error"><X/>{err}</div>}
  <div className="supplier-action-grid">
   {actionType==='CUSTOMER'&&<>{field('name','Nom / raison sociale','text',{required:true})}{field('phone','Téléphone')}{field('email','Email','email')}{field('taxId','Matricule fiscal')}{field('region','Région')}{field('address','Adresse')}{field('creditLimit','Plafond crédit','number',{min:0,step:.001})}</>}
   {actionType==='EXPENSE'&&<>{field('label','Libellé','text',{required:true})}{field('category','Catégorie')}{field('amount','Montant','number',{required:true,min:0,step:.001})}<label className="supplier-action-field"><span>Paiement</span><select className="input" value={form.method||'CASH'} onChange={e=>setForm({...form,method:e.target.value})}>{methods.filter(x=>x.active).map(x=><option key={x.code} value={x.code}>{x.name}</option>)}</select></label></>}
   {actionType==='PURCHASE'&&<><label className="supplier-action-field wide"><span>Produit</span><select required className="input" value={form.productId||''} onChange={e=>{const p=products.find(x=>x.id===e.target.value);setForm({...form,productId:e.target.value,unitCost:String(Number(p?.purchasePrice||p?.averageCost||0))})}}><option value="">Choisir…</option>{products.filter(x=>x.active!==false).map(x=><option key={x.id} value={x.id}>{x.sku} · {x.name}</option>)}</select></label><label className="supplier-action-field wide"><span>Dépôt de réception</span><select className="input" value={form.warehouseId||''} onChange={e=>setForm({...form,warehouseId:e.target.value})}><option value="">Stock global / non réparti</option>{warehouses.filter(w=>w.active).map(w=><option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></label>{field('quantity','Quantité','number',{required:true,min:1})}{field('unitCost','Coût unitaire','number',{required:true,min:0,step:.001})}<label className="supplier-action-field wide"><span>Fournisseur</span><input className="input" list="supplier-vendors" value={form.vendorName||''} onChange={e=>setForm({...form,vendorName:e.target.value})}/><datalist id="supplier-vendors">{vendors.map(v=><option key={v.id} value={v.name}/>)}</datalist></label>{field('paid','Payé maintenant','number',{min:0,step:.001})}<label className="supplier-action-field"><span>Moyen</span><select className="input" value={form.method||'CASH'} onChange={e=>setForm({...form,method:e.target.value})}>{methods.filter(x=>x.active).map(x=><option key={x.code} value={x.code}>{x.name}</option>)}</select></label></>}
   {actionType==='VENDOR'&&<>{field('name','Nom / raison sociale','text',{required:true})}{field('phone','Téléphone')}{field('email','Email','email')}{field('taxId','Matricule fiscal')}{field('address','Adresse')}{field('creditLimit','Plafond','number',{min:0,step:.001})}{field('openingDue','Dette initiale','number',{min:0,step:.001})}</>}
   {actionType==='WAREHOUSE'&&<>{field('name','Nom dépôt','text',{required:true})}{field('code','Code','text',{required:true})}{field('region','Région')}{field('address','Adresse')}</>}
   {actionType==='PRICE_TIER'&&<><label className="supplier-action-field wide"><span>Produit</span><select required className="input" value={form.productId||''} onChange={e=>setForm({...form,productId:e.target.value})}><option value="">Choisir…</option>{products.map(x=><option key={x.id} value={x.id}>{x.sku} · {x.name}</option>)}</select></label>{field('name','Nom tarif','text',{required:true})}{field('minQty','Quantité minimum','number',{required:true,min:1})}{field('unitPrice','Prix unitaire','number',{required:true,min:0,step:.001})}</>}
   {actionType==='RETURN'&&<><label className="supplier-action-field wide"><span>Produit</span><select required className="input" value={form.productId||''} onChange={e=>setForm({...form,productId:e.target.value})}><option value="">Choisir…</option>{products.map(x=><option key={x.id} value={x.id}>{x.sku} · {x.name}</option>)}</select></label>{field('quantity','Quantité','number',{required:true,min:1})}{field('refund','Remboursement','number',{min:0,step:.001})}{field('reason','Motif','text',{required:true})}<label className="supplier-action-field"><span>État</span><select className="input" value={form.condition||'BON'} onChange={e=>setForm({...form,condition:e.target.value})}><option>BON</option><option>OUVERT</option><option>ENDOMMAGÉ</option><option>DÉFECTUEUX</option></select></label><label className="supplier-check wide"><input type="checkbox" checked={!!form.restock} onChange={e=>setForm({...form,restock:e.target.checked})}/><span>Remettre en stock</span></label></>}
   {['CUSTOMER','EXPENSE','PURCHASE','VENDOR'].includes(actionType)&&<label className="supplier-action-field wide"><span>Note</span><textarea className="input" value={form.notes??form.note??''} onChange={e=>setForm(actionType==='PURCHASE'||actionType==='EXPENSE'?{...form,note:e.target.value}:{...form,notes:e.target.value})}/></label>}
  </div><button disabled={busy} className="btn btn-primary btn-block"><Plus/> {busy?'Enregistrement…':'Enregistrer'}</button></form></div>
}
