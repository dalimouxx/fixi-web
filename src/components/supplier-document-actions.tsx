'use client';
import {Printer,ArrowLeft} from 'lucide-react';
export function SupplierDocumentActions(){
 return <div className="supplier-document-actions no-print"><button onClick={()=>history.back()}><ArrowLeft/> Retour</button><button className="primary" onClick={()=>window.print()}><Printer/> Imprimer / PDF</button></div>
}
