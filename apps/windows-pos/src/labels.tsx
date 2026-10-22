import {useEffect,useMemo,useRef,useState} from 'react';
import JsBarcode from 'jsbarcode';

export type LabelProduct={id:string;name:string;sku:string;barcode?:string|null;price:number};
type Props={products:LabelProduct[];companyName:string;onClose:()=>void};
const escapeCode=(p:LabelProduct)=>String(p.barcode||p.sku||'').trim();
function Barcode({code}:{code:string}){
 const ref=useRef<SVGSVGElement>(null);
 useEffect(()=>{if(!ref.current)return;try{JsBarcode(ref.current,code,{format:'CODE128',height:34,width:1.45,margin:0,displayValue:true,fontSize:10});}catch{ref.current.innerHTML='';}},[code]);
 return <svg ref={ref} aria-label={'Code-barres '+code} className="label-svg"/>;
}
export function WindowsLabelStudio({products,companyName,onClose}:Props){
 const [quantities,setQuantities]=useState<Record<string,number>>({});
 const [supplier,setSupplier]=useState(companyName);
 const [format,setFormat]=useState<'50x30'|'60x40'>('50x30');
 const [filter,setFilter]=useState('');const [error,setError]=useState('');
 const lines=useMemo(()=>products.filter(p=>(quantities[p.id]||0)>0),[products,quantities]);
 const total=lines.reduce((a,p)=>a+(quantities[p.id]||0),0);
 const selected=lines.flatMap(p=>Array.from({length:quantities[p.id]||0},(_,i)=>({p,i})));
 const setCopies=(id:string,value:number)=>setQuantities(q=>({...q,[id]:Number.isFinite(value)?Math.max(0,Math.min(300,Math.floor(value))):0}));
 function print(){
  if(!selected.length)return setError('Choisissez des étiquettes.');
  if(total>500)return setError('Maximum 500 étiquettes par lot.');
  if(lines.some(p=>!escapeCode(p)||!/^[\x20-\x7e]{1,80}$/.test(escapeCode(p))))return setError('Code-barres manquant ou incompatible Code 128. Vérifiez les références.');
  setError('');document.body.dataset.printMode='labels';
  document.body.dataset.labelFormat=format;
  window.print();
  delete document.body.dataset.printMode;delete document.body.dataset.labelFormat;
 }
 return <div className="label-studio"><div className="label-controls"><header><h2>Étiquettes Code 128</h2><button onClick={onClose}>Fermer</button></header><p>Fournisseur, produit, prix, référence et marque FIXI · impression par lot</p><label>Nom fournisseur<input value={supplier} maxLength={100} onChange={e=>setSupplier(e.target.value)}/></label><label>Format<select value={format} onChange={e=>setFormat(e.target.value as '50x30'|'60x40')}><option value="50x30">50 × 30 mm</option><option value="60x40">60 × 40 mm</option></select></label><input placeholder="Rechercher les produits..." value={filter} onChange={e=>setFilter(e.target.value)}/><div className="label-catalog">{products.filter(p=>(p.name+' '+p.sku).toLowerCase().includes(filter.toLowerCase())).map(p=><label key={p.id}><span><b>{p.name}</b><small>{p.sku}</small></span><input type="number" min={0} max={300} value={quantities[p.id]||0} onChange={e=>setCopies(p.id,Number(e.target.value))} aria-label={'Copies '+p.name}/></label>)}</div><b>{lines.length} produit(s), {total} étiquette(s)</b>{error&&<p role="alert" className="connect-error">{error}</p>}<button className="print-action" onClick={print} disabled={!total}>Imprimer les étiquettes</button><p>Définissez les dimensions de papier correspondantes dans votre pilote d'imprimante. Les étiquettes ne modifient pas le stock.</p></div><div className="labels-print-area">{selected.map(({p,i})=><article key={p.id+'-'+i} className="fixi-label"><header><b>{p.name}</b><strong>FIXI</strong></header><small>{supplier}</small><Barcode code={escapeCode(p)}/><footer><span>{p.sku}</span><b>{p.price.toFixed(3)} DT</b></footer></article>)}</div></div>;
}
