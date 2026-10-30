import type {KeyboardEvent} from 'react';
export type FoundReceipt={id:string;reference:string;createdAt:string;customer:string;phone:string;total:number;paid:number;status:string;items:{name:string;sku:string|null;quantity:number;price:number}[]};
const dt=(n:number)=>new Intl.NumberFormat('fr-TN',{minimumFractionDigits:3,maximumFractionDigits:3}).format(n)+' DT';
type Props={
 query:string;from:string;to:string;busy:boolean;results:FoundReceipt[];
 onQuery:(v:string)=>void;onFrom:(v:string)=>void;onTo:(v:string)=>void;
 onSearch:()=>void;onPrint:(r:FoundReceipt)=>void;
 onReturn?:(r:FoundReceipt)=>void;
};
export function TicketSearchV4({query,from,to,busy,results,onQuery,onFrom,onTo,onSearch,onPrint,onReturn}:Props){
 const enter=(e:KeyboardEvent<HTMLInputElement>)=>{if(e.key==='Enter'){e.preventDefault();onSearch()}};
 return <div className="v4-ticket-finder">
  <div className="v4-ticket-filters">
   <label>Scanner le code du ticket, ou rechercher nom / téléphone / référence
    <input placeholder="Code-barres du ticket · saisir puis Entrée" value={query} onChange={e=>onQuery(e.target.value)}
      onKeyDown={enter} aria-label="Rechercher ou scanner le ticket"/>
   </label>
   <label>Du<input type="date" value={from} onChange={e=>onFrom(e.target.value)}/></label>
   <label>Au<input type="date" value={to} onChange={e=>onTo(e.target.value)}/></label>
   <button type="button" disabled={busy} onClick={onSearch}>Rechercher les tickets</button>
  </div>
  {results.length>0&&<div className="v4-found-tickets">
   <h3>{results.length} ticket(s) trouvé(s)</h3>
   <table><thead><tr><th>Référence / Date</th><th>Client</th><th>Total</th><th>Actions</th></tr></thead><tbody>
    {results.map(r=><tr key={r.id}><td><strong>{r.reference}</strong><small>{new Date(r.createdAt).toLocaleString('fr-TN')}</small></td>
     <td>{r.customer}{r.phone&&<small>{r.phone}</small>}</td><td>{dt(r.total)}</td>
     <td><div className="v4-ticket-actions">
      <button type="button" disabled={busy} onClick={()=>onPrint(r)}>Réimprimer</button>
      {onReturn&&<button type="button" disabled={busy} onClick={()=>onReturn(r)}>Sélectionner pour retour</button>}
     </div></td></tr>)}
   </tbody></table>
  </div>}
 </div>
}
