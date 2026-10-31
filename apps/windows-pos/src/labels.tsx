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
 return <div className="label-studio"><div className="label-controls"><header><h2>Étiquettes Code 128</h2><button onClick={onClose}>Fermer</button></header><p>Fournisseur, produit, prix, référence et marque FIXI · impression par lot</p><label>Nom fournisseur<input value={supplier} maxLength={100} onChange={e=>setSupplier(e.target.value)}/></label><label>Format<select value={format} onChange={e=>setFormat(e.target.value as LabelFormat)}><option value="40x20">40 × 20 mm — votre format</option><option value="50x30">50 × 30 mm</option><option value="60x40">60 × 40 mm</option></select></label><input placeholder="Rechercher les produits..." value={filter} onChange={e=>setFilter(e.target.value)}/><div className="label-catalog">{products.filter(p=>(p.name+' '+p.sku).toLowerCase().includes(filter.toLowerCase())).map(p=><label key={p.id}><span><b>{p.name}</b><small>{p.sku}</small></span><input type="number" min={0} max={300} value={quantities[p.id]||0} onChange={e=>setCopies(p.id,Number(e.target.value))} aria-label={'Copies '+p.name}/></label>)}</div><b>{lines.length} produit(s), {total} étiquette(s)</b>{error&&<p role="alert" className="connect-error">{error}</p>}<button className="print-action" onClick={print} disabled={!total}>Imprimer les étiquettes</button><p>Format préconfiguré : 40 mm de largeur × 20 mm de hauteur, horizontal, marges 0, impression à 100 %. Choisissez aussi ce papier dans le pilote Windows (le logiciel ne peut pas imposer les paramètres du matériel). Les étiquettes ne modifient pas le stock.</p></div><div className="labels-print-area">{selected.map(({p,i})=><article key={p.id+'-'+i} className="fixi-label"><header><b>{p.name}</b><strong>FIXI</strong></header><small>{supplier}</small><Barcode code={compactCode(p,format)||escapeCode(p)} compact={format==='40x20'}/><footer><span>{p.sku}</span><b>{p.price.toFixed(3)} DT</b></footer></article>)}</div></div>;
}
