import {useEffect,useMemo,useRef,useState} from 'react';
import JsBarcode from 'jsbarcode';

export type LabelProduct={id:string;name:string;sku:string;barcode?:string|null;price:number};
type Props={products:LabelProduct[];companyName:string;onClose:()=>void};
const escapeCode=(p:LabelProduct)=>String(p.barcode||p.sku||'').trim();
type LabelFormat='40x20'|'50x30'|'60x40';
const compactCode=(p:LabelProduct,format:LabelFormat)=>{
 if(format!=='40x20')return escapeCode(p);
 const candidates=[p.barcode,p.sku].map(value=>String(value||'').trim()).filter(Boolean);
 return candidates.find(code=>/^\d{8,14}$/.test(code)||/^[a-z0-9-]{1,9}$/i.test(code))||'';
};
function Barcode({code,compact=false}:{code:string;compact?:boolean}){
 const ref=useRef<SVGSVGElement>(null);
 useEffect(()=>{if(!ref.current)return;try{JsBarcode(ref.current,code,{format:'CODE128',height:compact?24:34,width:compact?1.15:1.45,margin:0,displayValue:true,fontSize:compact?8:10,textMargin:compact?1:2});}catch{ref.current.innerHTML='';}},[code,compact]);
 return <svg ref={ref} aria-label={'Code-barres '+code} className="label-svg"/>;
}
export function WindowsLabelStudio({products,companyName,onClose}:Props){
 const [quantities,setQuantities]=useState<Record<string,number>>({});
 const [supplier,setSupplier]=useState(companyName);
 const [format,setFormat]=useState<LabelFormat>('40x20');
 const [filter,setFilter]=useState('');const [error,setError]=useState('');
 const lines=useMemo(()=>products.filter(p=>(quantities[p.id]||0)>0),[products,quantities]);
 const total=lines.reduce((a,p)=>a+(quantities[p.id]||0),0);
 const selected=lines.flatMap(p=>Array.from({length:quantities[p.id]||0},(_,i)=>({p,i})));
 const setCopies=(id:string,value:number)=>setQuantities(q=>({...q,[id]:Number.isFinite(value)?Math.max(0,Math.min(300,Math.floor(value))):0}));
 function print(){
  if(!selected.length)return setError('Choisissez des étiquettes.');
  if(total>500)return setError('Maximum 500 étiquettes par lot.');
  if(lines.some(p=>!escapeCode(p)||!/^[\x20-\x7e]{1,80}$/.test(escapeCode(p))))return setError('Code-barres manquant ou incompatible Code 128. Vérifiez les références.');
  if(format==='40x20'&&lines.some(p=>!compactCode(p,format)))return setError('Étiquette 40 × 20 mm : référence trop longue pour un code-barres fiable. Utilisez un code numérique de 8–14 chiffres ou un SKU alphanumérique de 9 caractères maximum. Aucun stock modifié.');
  setError('');document.body.dataset.printMode='labels';
  document.body.dataset.labelFormat=format;
  const reset=()=>{delete document.body.dataset.printMode;delete document.body.dataset.labelFormat};
  window.addEventListener('afterprint',reset,{once:true});
  requestAnimationFrame(()=>window.print());
 }
 const shown=products.filter(p=>(p.name+' '+p.sku+' '+(p.barcode||'')).toLowerCase().includes(filter.toLowerCase()));
 return <div className="label-studio v6-labels"><div className="label-controls v5-card v6-labels-card">
  <header className="v6-modal-head"><h2>Étiquettes Code 128</h2><button className="v5-icon-btn" aria-label="Fermer" onClick={onClose}>✕</button></header>
  <p className="v5-hint">Choisissez les articles et le nombre d’étiquettes, puis imprimez. Le stock n’est pas modifié.</p>
  <div className="v6-form-2"><label className="v5-field"><span>Nom affiché sur l’étiquette</span><input value={supplier} maxLength={100} onChange={e=>setSupplier(e.target.value)}/></label>
   <div className="v5-field"><span>Format</span><div className="v5-seg v5-seg--block" role="group">{(['40x20','50x30','60x40'] as LabelFormat[]).map(f=><button type="button" key={f} aria-pressed={format===f} onClick={()=>setFormat(f)}>{f.replace('x',' × ')} mm</button>)}</div></div></div>
  <label className="v5-search"><input placeholder="Rechercher les produits..." value={filter} onChange={e=>setFilter(e.target.value)}/></label>
  <div className="label-catalog v6-label-list">{shown.map(p=>{const n=quantities[p.id]||0;return <div key={p.id} className={'v6-label-row'+(n?' is-on':'')}><span><b>{p.name}</b><small className="v5-mono">{p.sku}{p.barcode&&p.barcode!==p.sku?' · '+p.barcode:''}</small></span>
   <div className="v5-stepper"><button type="button" aria-label="Moins" disabled={!n} onClick={()=>setCopies(p.id,n-1)}>−</button><input type="number" min={0} max={300} value={n} onChange={e=>setCopies(p.id,Number(e.target.value))} aria-label={'Copies '+p.name}/><button type="button" aria-label="Plus" onClick={()=>setCopies(p.id,n+1)}>+</button></div></div>})}</div>
  {error&&<p role="alert" className="v5-alert v5-alert--danger">{error}</p>}
  <div className="v6-labels-foot"><b>{lines.length} produit(s), {total} étiquette(s)</b><button className="v5-btn v5-btn--primary print-action" onClick={print} disabled={!total}>Imprimer les étiquettes</button></div>
  <p className="v5-hint">Réglez aussi ce format dans le pilote de l’imprimante Windows : {format.replace('x',' × ')} mm, horizontal, marges 0, échelle 100 %.</p></div><div className="labels-print-area">{selected.map(({p,i})=><article key={p.id+'-'+i} className="fixi-label"><header><b>{p.name}</b><strong>FIXI</strong></header><small>{supplier}</small><Barcode code={compactCode(p,format)||escapeCode(p)} compact={format==='40x20'}/><footer><span>{p.sku}</span><b>{p.price.toFixed(3)} DT</b></footer></article>)}</div></div>;
}
