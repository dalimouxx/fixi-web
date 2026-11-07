import React,{useEffect,useState} from 'react';
import {invoke} from '@tauri-apps/api/core';
import {Banknote,Check,Monitor,Moon,PackagePlus,Percent,Printer,RefreshCw,Sparkles,Sun,SunMoon,X} from 'lucide-react';
import type {Settings} from './storage';

export const dt=(n:number)=>'\u2066'+new Intl.NumberFormat('fr-TN',{minimumFractionDigits:3,maximumFractionDigits:3}).format(n)+' DT\u2069';

export function Modal({title,icon,onClose,children,wide}:{title:string;icon?:React.ReactNode;onClose:()=>void;children:React.ReactNode;wide?:boolean}){
 useEffect(()=>{const k=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();onClose()}};window.addEventListener('keydown',k,true);return()=>window.removeEventListener('keydown',k,true)},[onClose]);
 return <div className="v6-modal-back" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <div className={'v5-card v6-modal'+(wide?' is-wide':'')} role="dialog" aria-modal="true" aria-label={title}>
   <header className="v6-modal-head"><h2>{icon}{title}</h2><button className="v5-icon-btn" aria-label="Fermer" onClick={onClose}><X size={17}/></button></header>
   {children}
  </div></div>;
}

const presets=['Main-d’œuvre','Accessoire','Service','Réparation','Divers'];
export function FreeItemDialog({onAdd,onClose}:{onAdd:(x:{name:string;price:number;quantity:number})=>void;onClose:()=>void}){
 const [name,setName]=useState(''),[price,setPrice]=useState(''),[qty,setQty]=useState('1');
 const p=Number(price.replace(',','.')),q=Math.trunc(Number(qty));
 const ok=name.trim().length>=2&&Number.isFinite(p)&&p>0&&q>=1&&q<=1000;
 return <Modal title="Article libre" onClose={onClose}>
  <p className="v5-hint">Pour une pièce sans code-barres ou un service. Le stock n’est pas touché.</p>
  <div className="v6-presets">{presets.map(x=><button key={x} type="button" aria-pressed={name===x} onClick={()=>setName(x)}>{x}</button>)}</div>
  <form className="v6-form" onSubmit={e=>{e.preventDefault();if(ok){onAdd({name:name.trim(),price:Math.round(p*1000)/1000,quantity:q});onClose()}}}>
   <label className="v5-field"><span>Nom</span><input autoFocus value={name} maxLength={120} onChange={e=>setName(e.target.value)} placeholder="Ex. Pose écran, câble USB…"/></label>
   <div className="v6-form-2"><label className="v5-field"><span>Prix unitaire (DT)</span><input type="number" min="0.001" step="0.001" value={price} onChange={e=>setPrice(e.target.value)} placeholder="0,000"/></label>
    <label className="v5-field"><span>Quantité</span><input type="number" min="1" max="1000" step="1" value={qty} onChange={e=>setQty(e.target.value)}/></label></div>
   <button className="v5-btn v5-btn--primary v5-btn--lg" disabled={!ok}><Check size={18}/> Ajouter {ok?dt(p*q):''}</button>
  </form></Modal>;
}

export type NewProduct={name:string;barcode:string;price:number;stock:number;purchasePrice:number};
/** Création d'une pièce depuis la caisse (gérant / stock). Le serveur ajoute SKU, catégorie et marque. */
export function NewProductDialog({barcode:initial,onCreate,onClose,stockIn}:{barcode:string;onCreate:(p:NewProduct,addToCart:boolean)=>Promise<void>;onClose:()=>void;stockIn?:boolean}){
 const [barcode,setBarcode]=useState(initial),[name,setName]=useState(''),[price,setPrice]=useState(''),[stock,setStock]=useState('1'),[cost,setCost]=useState('');
 const [cart,setCart]=useState(!stockIn),[busy,setBusy]=useState(false),[err,setErr]=useState(''),[hint,setHint]=useState('');
 useEffect(()=>{const b=initial.trim();if(!/^[A-Za-z0-9._-]{3,64}$/.test(b))return;let live=true;
  invoke<any>('supplier_lookup_barcode',{barcode:b}).then(r=>{if(!live)return;if(r?.suggestion?.name){setName(n=>n||r.suggestion.name);setHint('Reconnu sur le réseau Fixi : nom pré-rempli.')}}).catch(()=>{});
  return()=>{live=false}},[initial]);
 const p=Number(price.replace(',','.')),q=Math.trunc(Number(stock||0)),c=cost.trim()?Number(cost.replace(',','.')):0;
 const ok=name.trim().length>=2&&Number.isFinite(p)&&p>=0&&price.trim()!==''&&Number.isFinite(q)&&q>=0&&q<=100000&&Number.isFinite(c)&&c>=0;
 async function submit(e:React.FormEvent){e.preventDefault();if(!ok||busy)return;setBusy(true);setErr('');
  try{await onCreate({name:name.trim(),barcode:barcode.trim(),price:Math.round(p*1000)/1000,stock:q,purchasePrice:Math.round(c*1000)/1000},cart&&q>0);onClose()}catch(x){setErr(String(x));setBusy(false)}}
 return <Modal title="Nouvelle pièce" icon={<PackagePlus size={19}/>} onClose={onClose}>
  <p className="v5-hint">{hint?<><Sparkles size={14}/> {hint}</>:'La pièce est ajoutée à votre catalogue FIXI. SKU, catégorie et marque sont remplis automatiquement.'}</p>
  <form className="v6-form" onSubmit={submit}>
   <label className="v5-field"><span>Code-barres</span><input value={barcode} maxLength={64} onChange={e=>setBarcode(e.target.value)} placeholder="Vide = code court automatique (ex. 0000A04)"/></label>
   <label className="v5-field"><span>Nom</span><input autoFocus value={name} maxLength={160} onChange={e=>setName(e.target.value)} placeholder="Ex. Écran iPhone 13 OLED"/></label>
   <div className="v6-form-2"><label className="v5-field"><span>Prix de vente (DT)</span><input inputMode="decimal" value={price} onChange={e=>setPrice(e.target.value)} placeholder="0,000"/></label>
    <label className="v5-field"><span>{stockIn?'Quantité reçue':'Stock'}</span><input type="number" min="0" step="1" value={stock} onChange={e=>setStock(e.target.value)}/></label></div>
   <label className="v5-field"><span>Coût d’achat (DT, facultatif)</span><input inputMode="decimal" value={cost} onChange={e=>setCost(e.target.value)} placeholder="0,000"/></label>
   {!stockIn&&<label className="v6-check"><input type="checkbox" checked={cart} onChange={e=>setCart(e.target.checked)}/> Ajouter 1 au panier après création</label>}
   {err&&<div className="v5-alert v5-alert--danger" role="alert">{err}</div>}
   <button className="v5-btn v5-btn--primary v5-btn--lg" disabled={!ok||busy}><Check size={18}/> {busy?'Création…':'Créer la pièce'}{ok&&!busy?' · '+dt(p):''}</button>
  </form></Modal>;
}

export type DiscountLine={key:string;name:string;quantity:number;base:number;price:number};
export function DiscountDialog({lines,subtotal,discount,onApply,onClose}:{lines:DiscountLine[];subtotal:number;discount:number;onApply:(discount:number,prices:Record<string,number>)=>void;onClose:()=>void}){
 const [mode,setMode]=useState<'pct'|'dt'>('pct');
 const [value,setValue]=useState(discount?String(discount):'');
 const [prices,setPrices]=useState<Record<string,string>>(()=>Object.fromEntries(lines.map(l=>[l.key,String(l.price)])));
 const lineTotal=lines.reduce((a,l)=>{const v=Number(prices[l.key]);return a+(Number.isFinite(v)&&v>0?v:l.price)*l.quantity},0);
 const raw=Number(value.replace(',','.'))||0;
 const cart=Math.min(lineTotal,Math.max(0,Math.round((mode==='pct'?lineTotal*raw/100:raw)*1000)/1000));
 const invalid=mode==='pct'?raw<0||raw>100:raw<0||raw>lineTotal;
 return <Modal title="Remise" icon={<Percent size={19}/>} onClose={onClose} wide>
  <h3 className="v6-sub">Sur tout le panier</h3>
  <div className="v6-form-2"><div className="v5-seg v5-seg--block" role="group"><button type="button" aria-pressed={mode==='pct'} onClick={()=>setMode('pct')}>En %</button><button type="button" aria-pressed={mode==='dt'} onClick={()=>setMode('dt')}>En DT</button></div>
   <label className="v5-field"><span>{mode==='pct'?'Pourcentage':'Montant (DT)'}</span><input autoFocus type="number" min="0" step={mode==='pct'?'1':'0.5'} value={value} onChange={e=>setValue(e.target.value)} placeholder="0"/></label></div>
  {mode==='pct'&&<div className="v6-presets">{[5,10,15,20].map(x=><button key={x} type="button" aria-pressed={raw===x} onClick={()=>setValue(String(x))}>{x} %</button>)}</div>}
  {lines.length>0&&<><h3 className="v6-sub">Prix d’une ligne</h3><div className="v6-price-lines">{lines.map(l=><label key={l.key} className="v6-price-line"><span><b>{l.name}</b><small>×{l.quantity} · prix normal {dt(l.base)}</small></span>
   <input type="number" min="0.001" step="0.001" value={prices[l.key]} onChange={e=>setPrices(p=>({...p,[l.key]:e.target.value}))} aria-label={'Prix '+l.name}/></label>)}</div></>}
  <div className="v6-summary"><span>Sous-total {dt(subtotal)}</span>{lineTotal!==subtotal&&<span>Après prix modifiés {dt(lineTotal)}</span>}<span>Remise <b>-{dt(cart)}</b></span><strong>Nouveau total {dt(Math.max(0,lineTotal-cart))}</strong></div>
  <div className="v6-actions"><button className="v5-btn v5-btn--ghost" onClick={()=>{onApply(0,Object.fromEntries(lines.map(l=>[l.key,l.base])));onClose()}}>Retirer les remises</button>
   <button className="v5-btn v5-btn--primary" disabled={invalid} onClick={()=>{const out:Record<string,number>={};for(const l of lines){const v=Math.round(Number(prices[l.key])*1000)/1000;out[l.key]=Number.isFinite(v)&&v>0?v:l.base}onApply(cart,out);onClose()}}><Check size={17}/> Appliquer</button></div>
 </Modal>;
}

export function SettingsDialog({settings,onChange,onClose,version,onCheckUpdate,demo,onRemoveCashier,onReport}:{settings:Settings;onChange:(s:Settings)=>void;onClose:()=>void;version:string;onCheckUpdate:()=>void;demo:boolean;onRemoveCashier?:()=>void;onReport?:()=>void}){
 const [printers,setPrinters]=useState<string[]>([]),[note,setNote]=useState('');
 useEffect(()=>{void invoke<string[]>('list_printers').then(setPrinters).catch(()=>setPrinters([]))},[]);
 const set=(patch:Partial<Settings>)=>onChange({...settings,...patch});
 async function testDrawer(){setNote('');try{await invoke('cash_drawer_open',{printer:settings.drawerPrinter});setNote('Tiroir ouvert.')}catch(e){setNote(String(e))}}
 async function toggleDisplay(on:boolean){setNote('');try{if(on){const second=await invoke<boolean>('open_customer_display');setNote(second?'Écran client ouvert sur le 2ᵉ écran.':'Un seul écran détecté : l’écran client s’ouvre dans une fenêtre.')}else await invoke('close_customer_display');set({customerDisplay:on})}catch(e){setNote(String(e))}}
 return <Modal title="Réglages de la caisse" onClose={onClose} wide>
  <div className="v6-settings">
   <section><h3 className="v6-sub">Langue</h3><div className="v5-seg v5-seg--block" role="group"><button type="button" aria-pressed={settings.lang==='fr'} onClick={()=>set({lang:'fr'})}>Français</button><button type="button" aria-pressed={settings.lang==='ar'} onClick={()=>set({lang:'ar'})}>العربية</button></div></section>
   <section><h3 className="v6-sub">Apparence</h3><div className="v5-seg v5-seg--block" role="group"><button type="button" aria-pressed={settings.theme==='light'} onClick={()=>set({theme:'light'})}><Sun size={16}/> Clair</button><button type="button" aria-pressed={settings.theme==='dark'} onClick={()=>set({theme:'dark'})}><Moon size={16}/> Sombre</button><button type="button" aria-pressed={settings.theme==='auto'} onClick={()=>set({theme:'auto'})}><SunMoon size={16}/> Auto</button></div></section>
   <section><h3 className="v6-sub"><Banknote size={17}/> Tiroir-caisse</h3><p className="v5-hint">Le tiroir branché sur l’imprimante de tickets s’ouvre à chaque encaissement en espèces.</p>
    <label className="v5-field"><span>Imprimante du tiroir</span><select value={settings.drawerPrinter} onChange={e=>set({drawerPrinter:e.target.value})}><option value="">Aucun tiroir</option>{printers.map(p=><option key={p} value={p}>{p}</option>)}</select></label>
    <label className="v6-check"><input type="checkbox" checked={settings.drawerAuto} onChange={e=>set({drawerAuto:e.target.checked})}/> Ouvrir automatiquement après une vente en espèces</label>
    <button className="v5-btn v5-btn--ghost v5-btn--sm" disabled={!settings.drawerPrinter} onClick={()=>void testDrawer()}><Printer size={15}/> Tester l’ouverture</button></section>
   <section><h3 className="v6-sub"><Monitor size={17}/> Écran client</h3><p className="v5-hint">Sur un 2ᵉ moniteur tourné vers le client : articles, total et monnaie rendue.</p>
    <div className="v5-seg v5-seg--block" role="group"><button type="button" aria-pressed={settings.customerDisplay} onClick={()=>void toggleDisplay(true)}>Afficher</button><button type="button" aria-pressed={!settings.customerDisplay} onClick={()=>void toggleDisplay(false)}>Masquer</button></div></section>
   <section><h3 className="v6-sub"><RefreshCw size={17}/> Mises à jour</h3><p className="v5-hint">Version installée : <b>{version||'—'}</b>. La caisse vérifie toute seule au démarrage.</p>
    <button className="v5-btn v5-btn--ghost v5-btn--sm" disabled={demo} onClick={onCheckUpdate}><RefreshCw size={15}/> Vérifier maintenant</button></section>
   {onReport&&<section><h3 className="v6-sub">Un souci ?</h3><p className="v5-hint">Décrivez le problème : l’équipe Fixi le reçoit avec la version de la caisse.</p><button className="v5-btn v5-btn--ghost v5-btn--sm" onClick={onReport}>Signaler un problème</button></section>}
   {onRemoveCashier&&<section><h3 className="v6-sub">Caissier</h3><p className="v5-hint">Retire le caissier connecté de ce PC (son code PIN est effacé, son compte FIXI reste intact).</p><button className="v5-btn v5-btn--ghost v5-btn--sm v6-danger" onClick={onRemoveCashier}>Retirer ce caissier du PC</button></section>}
  </div>
  {note&&<p className="v6-note" role="status">{note}</p>}
 </Modal>;
}
