import type {KeyboardEvent} from 'react';
export type FoundReceipt={id:string;reference:string;createdAt:string;customer:string;phone:string;total:number;paid:number;status:string;items:{name:string;sku:string|null;quantity:number;price:number}[]};
const dt=(n:number)=>new Intl.NumberFormat('fr-TN',{minimumFractionDigits:3,maximumFractionDigits:3}).format(n)+' DT';
type Props={
 query:string;from:string;to:string;busy:boolean;results:FoundReceipt[];
 onQuery:(v:string)=>void;onFrom:(v:string)=>void;onTo:(v:string)=>void;
 onSearch:()=>void;onPrint:(r:FoundReceipt)=>void;
 onReturn?:(r:FoundReceipt)=>void;
 onShare?:(r:FoundReceipt)=>void;
};
export function TicketSearchV4({query,from,to,busy,results,onQuery,onFrom,onTo,onSearch,onPrint,onReturn,onShare}:Props){
 const enter=(e:KeyboardEvent<HTMLInputElement>)=>{if(e.key==='Enter'){e.preventDefault();onSearch()}};
 return <div className="v5-ticket-finder">
  <div className="v5-form-row">
   <label className="v5-field v5-field--wide"><span>Code du ticket, nom, téléphone ou référence</span>
    <input placeholder="Scannez le ticket ou tapez, puis Entrée" value={query} onChange={e=>onQuery(e.target.value)}
      onKeyDown={enter} aria-label="Rechercher ou scanner le ticket"/>
   </label>
   <label className="v5-field"><span>Du</span><input type="date" value={from} onChange={e=>onFrom(e.target.value)}/></label>
   <label className="v5-field"><span>Au</span><input type="date" value={to} onChange={e=>onTo(e.target.value)}/></label>
   <button type="button" className="v5-btn v5-btn--primary" disabled={busy} onClick={onSearch}>Rechercher</button>
  </div>
  {results.length>0&&<div className="v5-found">
   <p className="v5-hint">{results.length} ticket{results.length>1?'s':''} trouvé{results.length>1?'s':''}</p>
   <div className="v5-table-wrap"><table className="v5-table"><thead><tr><th>Ticket</th><th>Client</th><th className="num">Total</th><th className="act"></th></tr></thead><tbody>
    {results.map(r=><tr key={r.id}><td><b className="v5-mono">{r.reference}</b><small>{new Date(r.createdAt).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})} · {r.items.length} article{r.items.length>1?'s':''}</small></td>
     <td>{r.customer}{r.phone&&<small>{r.phone}</small>}</td><td className="num"><b>{dt(r.total)}</b></td>
     <td className="act"><div className="v5-row-actions">
      <button type="button" className="v5-btn v5-btn--ghost v5-btn--sm" disabled={busy} onClick={()=>onPrint(r)}>Réimprimer</button>
      {onShare&&<button type="button" className="v5-btn v5-btn--ghost v5-btn--sm" disabled={busy} onClick={()=>onShare(r)}>WhatsApp</button>}
      {onReturn&&<button type="button" className="v5-btn v5-btn--soft v5-btn--sm" disabled={busy} onClick={()=>onReturn(r)}>Faire un retour</button>}
     </div></td></tr>)}
   </tbody></table></div>
  </div>}
 </div>
}
