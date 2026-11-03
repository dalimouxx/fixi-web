import {useEffect,useRef} from 'react';
import JsBarcode from 'jsbarcode';

export type ReceiptBusinessProfile={legalName?:string|null;phone?:string|null;address?:string|null;taxId?:string|null;tradeRegister?:string|null;receiptMessage?:string|null;logoUrl?:string|null};
export type ReceiptData={
 profile?:ReceiptBusinessProfile|null;
 reference:string;company:string;date:string;
 lines:{name:string;quantity:number;price:number}[];
 total:number;paid:number;customer?:string;
 discount?:number;cashier?:string;offline?:boolean;logo?:string;
};
const money=(n:number)=>new Intl.NumberFormat('fr-TN',{minimumFractionDigits:3,maximumFractionDigits:3}).format(n)+' DT';

/** Code128 scanner-compatible proof of ticket reference; lookup still requires an authenticated supplier session. */
export function TicketBarcode({reference}:{reference:string}){
 const svg=useRef<SVGSVGElement>(null);
 useEffect(()=>{if(!svg.current)return;
  try{JsBarcode(svg.current,reference,{format:'CODE128',lineColor:'#000',width:1.1,height:42,displayValue:true,
   fontSize:10,margin:5,background:'#fff'})}catch{svg.current.textContent='Référence : '+reference}
 },[reference]);
 return <svg ref={svg} className="v4-ticket-barcode" aria-label={'Code-barres du ticket '+reference}/>;
}
export function TicketPrint({ticket}:{ticket:ReceiptData|null}){
 if(!ticket)return null;
 return <div className="v4-receipt v6-ticket" aria-label="Ticket de caisse imprimable"><article>
  <header>{ticket.logo&&<img className="v6-receipt-logo" src={ticket.logo} alt=""/>}<strong>{ticket.profile?.legalName||ticket.company}</strong>{ticket.profile?.address&&<small>{ticket.profile.address}</small>}{ticket.profile?.phone&&<small>Tél. {ticket.profile.phone}</small>}{ticket.profile?.taxId&&<small>Matricule fiscal : {ticket.profile.taxId}</small>}{ticket.profile?.tradeRegister&&<small>Registre : {ticket.profile.tradeRegister}</small>}<small>{ticket.date}</small>{ticket.cashier&&<small>Caissier : {ticket.cashier}</small>}</header>
  <h3>Ticket de caisse</h3>
  <p className="v4-receipt-reference">{ticket.reference}</p>
  {ticket.customer&&<p>Client : {ticket.customer}</p>}
  <table><tbody>{ticket.lines.map((l,i)=><tr key={i}><td>{l.name} ×{l.quantity}</td><td>{money(l.price*l.quantity)}</td></tr>)}</tbody></table>
  {ticket.discount?<p>Remise : <span>-{money(ticket.discount)}</span></p>:null}
  <hr/><p><strong>TOTAL</strong><b>{money(ticket.total)}</b></p>
  <p>Reçu : <span>{money(ticket.paid)}</span></p>
  <p>Reste : <span>{money(Math.max(0,ticket.total-ticket.paid))}</span></p>
  {ticket.offline&&<small>Vente enregistrée hors connexion — synchronisation automatique.</small>}
  <TicketBarcode reference={ticket.reference}/>
  <small>Présentez ce code-barres pour retrouver le ticket, effectuer un retour ou demander une copie.</small>
  <small>{ticket.profile?.receiptMessage||'Merci de votre confiance'}</small>
 </article></div>;
}
