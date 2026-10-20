'use client';
import {useMemo,useState} from 'react';
import JsBarcode from 'jsbarcode';
import {Printer,Tag,X} from 'lucide-react';

type Entry={id:string;name:string;sku?:string|null;barcode?:string|null;brand?:string|null;price?:number|null;retailPrice?:number|null;active?:boolean;};
type LabelRow={product:Entry;copies:number};
type Props={products:Entry[];supplierName?:string};

const esc=(x:unknown)=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
const validCode=(x:string)=>/^[\x20-\x7e]+$/.test(x)&&x.length<=80;

export function SupplierLabelStudio({products,supplierName='Fournisseur'}:Props){
 const [open,setOpen]=useState(false),[q,setQ]=useState(''),[copies,setCopies]=useState<Record<string,number>>({}),[size,setSize]=useState<'50x30'|'60x40'>('50x30'),[showPrice,setShowPrice]=useState(true),[error,setError]=useState('');
 const available=useMemo(()=>products.filter(p=>p.active!==false&&(!q||[p.name,p.sku,p.barcode,p.brand].join(' ').toLowerCase().includes(q.toLowerCase()))).slice(0,80),[products,q]);
 const chosen=useMemo<LabelRow[]>(()=>products.filter(p=>(copies[p.id]||0)>0).map(product=>({product,copies:copies[product.id]})),[products,copies]);
 const total=chosen.reduce((n,row)=>n+row.copies,0);
 function setCount(id:string,n:number){setCopies(v=>({...v,[id]:Math.min(300,Math.max(0,Math.floor(n)||0))}));}
 function print(){
  setError('');
  if(!chosen.length)return setError('Sélectionnez au moins un produit.');
  if(total>500)return setError('Limite : 500 étiquettes par impression.');
  const labels:string[]=[];
  for(const {product,copies:n} of chosen){
   const code=String(product.barcode||product.sku||'').trim();
   if(!code||!validCode(code)){setError('Code-barres ou SKU manquant/non compatible Code 128 : '+product.name);return;}
   const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
   try{JsBarcode(svg,code,{format:'CODE128',width:1.5,height:38,displayValue:true,fontSize:10,margin:0});}
   catch{setError('Code-barres invalide : '+product.name);return;}
   const drawing=new XMLSerializer().serializeToString(svg);
   const price=Number(product.retailPrice??product.price);
   const priceHtml=showPrice&&Number.isFinite(price)?'<b class="price">'+esc(price.toFixed(3))+' DT</b>':'';
   const html='<section class="label"><header><strong>'+esc(product.name)+'</strong><span class="brand">FIXI</span></header><small>'+esc(supplierName)+'</small><div class="barcode">'+drawing+'</div><footer><span>'+esc(product.sku||code)+'</span>'+priceHtml+'</footer></section>';
   for(let i=0;i<n;i++)labels.push(html);
  }
  const popup=window.open('','_blank','noopener,noreferrer,width=850,height=750');
  if(!popup){setError('Autorisez les fenêtres popup pour imprimer les étiquettes.');return;}
  const [w,h]=size.split('x').map(Number);
  popup.document.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Étiquettes FIXI</title><style>@page{size:'+w+'mm '+h+'mm;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#111}.label{width:'+w+'mm;height:'+h+'mm;padding:2mm;break-after:page;page-break-after:always;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between}.label header,.label footer{display:flex;align-items:center;justify-content:space-between;gap:2mm}.label strong{font-size:9pt;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.label small{font-size:7pt}.brand{font-weight:800;font-size:8pt;color:#fff;background:#111;padding:1mm;border-radius:1mm}.barcode{display:flex;justify-content:center;overflow:hidden}.barcode svg{max-width:100%;height:14mm}.label footer{font-size:7pt}.price{font-size:8pt}@media screen{body{background:#ddd}.label{background:white;margin:5mm auto;box-shadow:0 1px 9px #aaa}}</style></head><body>'+labels.join('')+'</body></html>');
  popup.document.close();
  popup.focus();
  // User triggers the native print dialog from the preview window to allow printer/stock selection.
 }
 return <>
  <button type="button" className="btn btn-soft btn-sm" onClick={()=>setOpen(true)}><Tag size={16}/> Étiquettes code-barres</button>
  {open&&<div className="supplier-modal-backdrop"><div className="supplier-modal" role="dialog" aria-modal="true" aria-labelledby="fixi-label-heading" style={{maxWidth:740,width:'min(96vw,740px)',maxHeight:'88vh',overflow:'auto'}}>
   <button type="button" className="supplier-modal-x" aria-label="Fermer" onClick={()=>setOpen(false)}><X/></button>
   <h2 id="fixi-label-heading">Studio étiquettes FIXI</h2><p>Imprimez plusieurs produits et quantités dans une même série. Les codes utilisent Code 128.</p>
   <div className="toolbar" style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:12}}>
    <label>Format <select className="input" value={size} onChange={e=>setSize(e.target.value as '50x30'|'60x40')}><option value="50x30">50 × 30 mm</option><option value="60x40">60 × 40 mm</option></select></label>
    <label style={{display:'flex',alignItems:'center',gap:6}}><input type="checkbox" checked={showPrice} onChange={e=>setShowPrice(e.target.checked)}/> Afficher prix</label>
    <input className="input" placeholder="Rechercher produit, SKU ou barcode" value={q} onChange={e=>setQ(e.target.value)} style={{flex:1,minWidth:190}}/>
   </div>
   <div style={{maxHeight:330,overflow:'auto',border:'1px solid #d6dce5',borderRadius:10}}>
    {available.map(p=><div key={p.id} style={{display:'flex',alignItems:'center',gap:12,padding:10,borderBottom:'1px solid #e5e8ef'}}>
     <span style={{flex:1,minWidth:0}}><b>{p.name}</b><small style={{display:'block'}}>{p.sku||p.barcode||'Code manquant'}</small></span>
     <label>Copies <input aria-label={'Nombre étiquettes pour '+p.name} type="number" min="0" max="300" step="1" style={{width:75}} value={copies[p.id]||0} onChange={e=>setCount(p.id,Number(e.target.value))}/></label>
    </div>)}
    {!available.length&&<p style={{padding:12}}>Aucun produit trouvé.</p>}
   </div>
   <p><b>{chosen.length}</b> produit(s) · <b>{total}</b> étiquette(s)</p>
   {error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}
   <button className="btn btn-primary" type="button" onClick={print} disabled={!total||total>500}><Printer size={16}/> Ouvrir aperçu d’impression</button>
   <p style={{fontSize:12}}>L’impression n’altère pas le stock. Choisissez votre imprimante et calibrez les étiquettes dans la fenêtre d’impression.</p>
  </div></div>}
 </>;
}
