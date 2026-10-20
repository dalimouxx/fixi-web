'use client';
import {Printer,ArrowLeft,ReceiptText,FileText} from 'lucide-react';
import Link from 'next/link';

export function SupplierDocumentActions({invoiceHref,ticketHref,selected='invoice'}:{
 invoiceHref?:string;ticketHref?:string;selected?:'invoice'|'ticket'
}){
 return <div className="supplier-document-actions no-print">
   <button type="button" onClick={()=>history.back()}><ArrowLeft/> Retour</button>
   <div className="fixi-doc-action-group">
    {invoiceHref&&<Link href={invoiceHref} className={selected==='invoice'?'selected':''}>
      <FileText size={17}/> Facture A4</Link>}
    {ticketHref&&<Link href={ticketHref} className={selected==='ticket'?'selected':''}>
      <ReceiptText size={17}/> Ticket 80 mm</Link>}
    <button type="button" className="primary" onClick={()=>window.print()}>
      <Printer/> Imprimer / PDF
    </button>
   </div>
 </div>;
}
