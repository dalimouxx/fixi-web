/** Champs obligatoires de la réception, dans l'ordre de la page. */
export function missingReception(f:{clientPhone?:string;clientName?:string;model?:string;reportedIssue?:string}){
  const out:{key:string;label:string}[]=[];
  if(String(f.clientPhone||'').replace(/\D/g,'').length<8)out.push({key:'clientPhone',label:'téléphone du client'});
  if(String(f.clientName||'').trim().length<2)out.push({key:'clientName',label:'nom du client'});
  if(!String(f.model||'').trim())out.push({key:'model',label:'modèle'});
  if(String(f.reportedIssue||'').trim().length<2)out.push({key:'reportedIssue',label:'panne'});
  return out;
}
