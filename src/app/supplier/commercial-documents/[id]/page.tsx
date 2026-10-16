import {redirect,notFound} from 'next/navigation';
import {getSupplierSession} from '@/lib/supplier-auth';
import {prisma} from '@/lib/prisma';
import {money,dateTime} from '@/lib/format';
import {SupplierDocumentActions} from '@/components/supplier-document-actions';

const labels:Record<string,string>={QUOTE:'DEVIS',PROFORMA:'FACTURE PROFORMA',DELIVERY_NOTE:'BON DE LIVRAISON',PURCHASE_ORDER:'BON DE COMMANDE',RECEIPT:'REÇU'};
export default async function SupplierCommercialDocumentPage({params}:{params:Promise<{id:string}>}){
 const s=await getSupplierSession();if(!s)redirect('/supplier/login');const{id}=await params;
 const doc=await prisma.supplierCommercialDocument.findFirst({where:{id,companyId:s.companyId}});if(!doc)notFound();
 const [items,company]=await Promise.all([
  prisma.supplierCommercialDocumentItem.findMany({where:{documentId:doc.id}}),
  prisma.supplierCompany.findUnique({where:{id:s.companyId}})
 ]);
 return <div className="supplier-document-page">
  <SupplierDocumentActions/>
  <article className="supplier-invoice-sheet">
   <header><div className="supplier-invoice-brand">{company?.logoUrl?<img src={company.logoUrl} alt=""/>:<i>F</i>}<div><h1>{company?.name||s.companyName}</h1><p>{company?.address||''}{company?.region?' · '+company.region:''}</p><p>{company?.phone||''}{company?.email?' · '+company.email:''}</p>{company?.taxId&&<p>MF : {company.taxId}</p>}</div></div><div className="supplier-invoice-title"><span>{labels[doc.type]||doc.type}</span><b>{doc.reference}</b><small>{dateTime(doc.issuedAt)}</small></div></header>
   <section className="supplier-invoice-parties"><div><span>ÉMETTEUR</span><b>{company?.name}</b><p>{company?.address||'—'}</p></div><div><span>{doc.type==='PURCHASE_ORDER'?'FOURNISSEUR':'DESTINATAIRE'}</span><b>{doc.partyName||'—'}</b><p>{doc.partyAddress||'—'}</p><p>{doc.partyPhone||''}{doc.partyTaxId?' · MF '+doc.partyTaxId:''}</p></div></section>
   {doc.validUntil&&<div className="supplier-invoice-origin">Valable jusqu’au : <b>{new Date(doc.validUntil).toLocaleDateString('fr-TN')}</b> · Statut : <b>{doc.status}</b></div>}
   <table className="supplier-invoice-table"><thead><tr><th>Référence</th><th>Désignation</th><th>Qté</th><th>Prix U.</th><th>Remise</th><th>TVA</th><th>Total</th></tr></thead><tbody>{items.map(x=>{const base=Math.max(0,Number(x.unitPrice)*x.quantity-Number(x.discount));const line=base*(1+Number(x.taxRate)/100);return <tr key={x.id}><td>{x.sku||'—'}</td><td>{x.name}</td><td>{x.quantity}</td><td>{money(Number(x.unitPrice))}</td><td>{money(Number(x.discount))}</td><td>{Number(x.taxRate).toFixed(2)}%</td><td>{money(line)}</td></tr>})}</tbody></table>
   <div className="supplier-invoice-bottom"><div>{doc.note&&<div className="supplier-invoice-note"><b>Note</b><p>{doc.note}</p></div>}</div><div className="supplier-invoice-totals"><div><span>Sous-total</span><b>{money(Number(doc.subtotal))}</b></div><div><span>Remise globale</span><b>- {money(Number(doc.discount))}</b></div><div><span>Taxes</span><b>{money(Number(doc.tax))}</b></div><div className="total"><span>Total</span><b>{money(Number(doc.total))}</b></div></div></div>
   <footer><span>{labels[doc.type]||'Document'} généré par Fixi Supplier</span><b>{doc.currency}</b></footer>
  </article>
 </div>
}
