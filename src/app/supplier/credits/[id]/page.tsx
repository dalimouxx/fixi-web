import {redirect,notFound} from 'next/navigation';
import {getSupplierSession} from '@/lib/supplier-auth';
import {prisma} from '@/lib/prisma';
import {money,dateTime} from '@/lib/format';
import {SupplierDocumentActions} from '@/components/supplier-document-actions';

export default async function SupplierCreditPage({params}:{params:Promise<{id:string}>}){
 const s=await getSupplierSession();if(!s)redirect('/supplier/login');const{id}=await params;
 const credit=await prisma.supplierReturn.findFirst({where:{id,companyId:s.companyId,type:'SALE_RETURN'}});
 if(!credit)notFound();
 const [items,company,sale,customer,payments]=await Promise.all([
  prisma.supplierReturnItem.findMany({where:{returnId:credit.id}}),
  prisma.supplierCompany.findUnique({where:{id:s.companyId}}),
  credit.sourceSaleId?prisma.supplierErpSale.findUnique({where:{id:credit.sourceSaleId}}):Promise.resolve(null),
  credit.customerId?prisma.supplierErpCustomer.findUnique({where:{id:credit.customerId}}):Promise.resolve(null),
  credit.sourceSaleId?prisma.supplierErpPayment.findMany({where:{saleId:credit.sourceSaleId,kind:'OUT',reference:credit.reference}}):Promise.resolve([])
 ]);
 return <div className="supplier-document-page">
  <SupplierDocumentActions/>
  <article className="supplier-invoice-sheet supplier-credit-sheet">
   <header><div className="supplier-invoice-brand">{company?.logoUrl?<img src={company.logoUrl} alt=""/>:<i>F</i>}<div><h1>{company?.name||s.companyName}</h1><p>{company?.address||''}{company?.region?' · '+company.region:''}</p><p>{company?.phone||''}{company?.email?' · '+company.email:''}</p>{company?.taxId&&<p>MF : {company.taxId}</p>}</div></div><div className="supplier-invoice-title"><span>AVOIR</span><b>{credit.reference}</b><small>{dateTime(credit.createdAt)}</small></div></header>
   <section className="supplier-invoice-parties"><div><span>ÉMETTEUR</span><b>{company?.name}</b><p>{company?.address||'—'}</p></div><div><span>CLIENT</span><b>{customer?.name||'Client comptoir'}</b><p>{customer?.address||customer?.region||'—'}</p><p>{customer?.phone||''}{customer?.taxId?' · MF '+customer.taxId:''}</p></div></section>
   <div className="supplier-invoice-origin">Facture / vente d’origine : <b>{credit.sourceRef||sale?.reference||'—'}</b></div>
   <table className="supplier-invoice-table"><thead><tr><th>Référence</th><th>Désignation</th><th>Qté</th><th>Prix U.</th><th>Remise stock</th></tr></thead><tbody>{items.map(x=><tr key={x.id}><td>{x.sku||'—'}</td><td>{x.name}<div className="muted">{x.reason||''}{x.condition?' · '+x.condition:''}</div></td><td>{x.quantity}</td><td>{money(Number(x.unitPrice))}</td><td>{x.restock?'Oui':'Non'}</td></tr>)}</tbody></table>
   <div className="supplier-invoice-bottom"><div className="supplier-invoice-payments"><h3>Remboursement</h3>{payments.length?payments.map(p=><div key={p.id}><span>{p.method} · {dateTime(p.createdAt)}</span><b>{money(Number(p.amount))}</b></div>):<p>Aucun remboursement monétaire. L’avoir reste comptabilisé.</p>}</div><div className="supplier-invoice-totals"><div className="total"><span>Total avoir</span><b>- {money(Number(credit.total))}</b></div><div><span>Remboursé</span><b>{money(Number(credit.refund))}</b></div><div><span>Solde avoir</span><b>{money(Math.max(0,Number(credit.total)-Number(credit.refund)))}</b></div></div></div>
   {credit.note&&<div className="supplier-invoice-note"><b>Note</b><p>{credit.note}</p></div>}
   <footer><span>Avoir généré par Fixi Supplier</span><b>{company?.currency||'DT'}</b></footer>
  </article>
 </div>
}
