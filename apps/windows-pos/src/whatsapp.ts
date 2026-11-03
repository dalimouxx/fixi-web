import type {ReceiptData} from './TicketV4';
const dt=(n:number)=>new Intl.NumberFormat('fr-TN',{minimumFractionDigits:3,maximumFractionDigits:3}).format(n)+' DT';
/** Numéro tunisien au format international (8 chiffres → 216XXXXXXXX). */
export function waPhone(raw:string){
 let d=String(raw||'').replace(/\D/g,'');
 if(d.startsWith('00'))d=d.slice(2);
 if(d.length===8)d='216'+d;
 return d.length>=10&&d.length<=15?d:'';
}
export function ticketMessage(t:ReceiptData){
 const lines=t.lines.map(l=>`• ${l.name} ×${l.quantity} : ${dt(l.price*l.quantity)}`);
 const due=Math.max(0,t.total-t.paid);
 return [`*${t.profile?.legalName||t.company}*`,`Ticket ${t.reference} — ${t.date}`,'',...lines,
  ...(t.discount?[`Remise : -${dt(t.discount)}`]:[]),`*Total : ${dt(t.total)}*`,`Payé : ${dt(t.paid)}`,...(due>0?[`Reste à payer : ${dt(due)}`]:[]),
  '',t.profile?.receiptMessage||'Merci de votre confiance'].join('\n');
}
export const waUrl=(phone:string,text:string)=>`https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
