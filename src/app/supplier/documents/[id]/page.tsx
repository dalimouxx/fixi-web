import {redirect,notFound} from 'next/navigation';
import {getSupplierSession} from '@/lib/supplier-auth';
import {prisma} from '@/lib/prisma';
import {money,dateTime} from '@/lib/format';
import {SupplierDocumentActions} from '@/components/supplier-document-actions';

export default async function SupplierDocumentPage({params}:{params:Promise<{id:string}>}){
 const s=await getSupplierSession();if(!s)redirect('/supplier/login');const{id}=await params;
 const sale=await prisma.supplierErpSale.findFirst({where:{id,companyId:s.companyId}});if(!sale)notFound();
 const [items,company,customer,order,payments]=await Promise.all([
  prisma.supplierErpSaleItem.findMany({where:{saleId:sale.id}}),
  prisma.supplierCompany.findUnique({where:{id:s.companyId}}),
  sale.customerId?prisma.supplierErpCustomer.findUnique({where:{id:sale.customerId}}):Promise.resolve(null),
  sale.sourceOrderId?prisma.supplierOrder.findUnique({where:{id:sale.sourceOrderId},include:{shop:{select:{name:true,phone:true,address:true,region:true,taxId:true}}}}):Promise.resolve(null),
  prisma.supplierErpPayment.findMany({where:{saleId:sale.id},orderBy:{createdAt:'asc'}})
 ]);
 const client=customer?{name:customer.name,phone:customer.phone,address:customer.address,region:customer.region,taxId:customer.taxId}:order?.shop?{name:order.shop.name,phone:order.shop.phone,address:order.shop.address,region:order.shop.region,taxId:order.shop.taxId}:null;
 const due=Math.max(0,Number(sale.total)-Number(sale.paid));
 return <div className="supplier-document-page">
  <SupplierDocumentActions/>
  <article className="supplier-invoice-sheet">
   <header><div className="supplier-invoice-brand">{company?.logoUrl?<img src={company.logoUrl} alt=""/>:<i>F</i>}<div><h1>{company?.name||s.companyName}</h1><p>{company?.address||''}{company?.region?' · '+company.region:''}</p><p>{company?.phone||''}{company?.email?' · '+company.email:''}</p>{company?.taxId&&<p>MF : {company.taxId}</p>}</div></div><div className="supplier-invoice-title"><span>FACTURE</span><b>{sale.reference}</b><small>{dateTime(sale.createdAt)}</small></div></header>
   <section className="supplier-invoice-parties"><div><span>ÉMETTEUR</span><b>{company?.name}</b><p>{company?.address||'—'}</p></div><div><span>CLIENT</span><b>{client?.name||'Client comptoir'}</b><p>{client?.address||client?.region||'—'}</p><p>{client?.phone||''}{client?.taxId?' · MF '+client.taxId:''}</p></div></section>
   {order&&<div className="supplier-invoice-origin">Commande Fixi Marketplace : <b>{order.reference}</b></div>}
   <table className="supplier-invoice-table"><thead><tr><th>Référence</th><th>Désignation</th><th>Qté</th><th>Prix U.</th><th>Total</th></tr></thead><tbody>{items.map(x=><tr key={x.id}><td>{x.sku||'—'}</td><td>{x.name}</td><td>{x.quantity}</td><td>{money(x.unitPrice)}</td><td>{money(Number(x.unitPrice)*x.quantity-Number(x.discount||0))}</td></tr>)}</tbody></table>
   <div className="supplier-invoice-bottom"><div className="supplier-invoice-payments"><h3>Règlements</h3>{payments.length?payments.map(p=><div key={p.id}><span>{p.method} · {dateTime(p.createdAt)}</span><b>{money(p.amount)}</b></div>):<p>Aucun règlement enregistré.</p>}</div><div className="supplier-invoice-totals"><div><span>Sous-total</span><b>{money(sale.subtotal)}</b></div><div><span>Remise</span><b>- {money(sale.discount)}</b></div><div><span>Taxes</span><b>{money(sale.tax)}</b></div><div className="total"><span>Total TTC</span><b>{money(sale.total)}</b></div><div><span>Payé</span><b>{money(sale.paid)}</b></div><div className={due>0?'due':''}><span>Reste</span><b>{money(due)}</b></div></div></div>
   {sale.note&&<div className="supplier-invoice-note"><b>Note</b><p>{sale.note}</p></div>}
   <footer><span>Document généré par Fixi Supplier</span><b>{company?.currency||'DT'}</b></footer>
  </article>
 </div>
}
