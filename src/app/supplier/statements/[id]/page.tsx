import {redirect,notFound} from 'next/navigation';
import {getSupplierSession} from '@/lib/supplier-auth';
import {prisma} from '@/lib/prisma';
import {money,dateTime} from '@/lib/format';
import {SupplierDocumentActions} from '@/components/supplier-document-actions';

export default async function CustomerStatementPage({params}:{params:Promise<{id:string}>}){
 const s=await getSupplierSession();if(!s)redirect('/supplier/login');const{id}=await params;
 const customer=await prisma.supplierErpCustomer.findFirst({where:{id,companyId:s.companyId}});if(!customer)notFound();
 const company=await prisma.supplierCompany.findUnique({where:{id:s.companyId}});
 const sales=await prisma.supplierErpSale.findMany({where:{companyId:s.companyId,customerId:id,status:{not:'CANCELLED'}},orderBy:{createdAt:'asc'}});
 const saleIds=sales.map(x=>x.id);
 const [payments,returns]=await Promise.all([
  prisma.supplierErpPayment.findMany({where:{companyId:s.companyId,customerId:id},orderBy:{createdAt:'asc'}}),
  saleIds.length?prisma.supplierReturn.findMany({where:{companyId:s.companyId,sourceSaleId:{in:saleIds},status:'COMPLETED'},orderBy:{createdAt:'asc'}}):Promise.resolve([])
 ]);
 const events:any[]=[];
 for(const sale of sales)events.push({date:sale.createdAt,type:'FACTURE',reference:sale.reference,debit:Number(sale.total),credit:0,note:sale.note||''});
 for(const ret of returns)events.push({date:ret.createdAt,type:'AVOIR',reference:ret.reference,debit:0,credit:Number(ret.total),note:ret.sourceRef?'Sur '+ret.sourceRef:''});
 for(const p of payments)if(p.kind==='IN')events.push({date:p.createdAt,type:'PAIEMENT',reference:p.reference||'Paiement',debit:0,credit:Number(p.amount),note:p.method});
 for(const p of payments)if(p.kind==='OUT')events.push({date:p.createdAt,type:'REMBOURSEMENT',reference:p.reference||'Remboursement',debit:Number(p.amount),credit:0,note:p.method});
 events.sort((a,b)=>new Date(a.date).getTime()-new Date(b.date).getTime());
 let balance=0;const rows=events.map(e=>{balance+=e.debit-e.credit;return {...e,balance}});
 const totalDebit=events.reduce((a,e)=>a+e.debit,0),totalCredit=events.reduce((a,e)=>a+e.credit,0);
 return <div className="supplier-document-page">
  <SupplierDocumentActions/>
  <article className="supplier-invoice-sheet supplier-statement-sheet">
   <header><div className="supplier-invoice-brand">{company?.logoUrl?<img src={company.logoUrl} alt=""/>:<i>F</i>}<div><h1>{company?.name||s.companyName}</h1><p>{company?.address||''}{company?.region?' · '+company.region:''}</p><p>{company?.phone||''}{company?.email?' · '+company.email:''}</p></div></div><div className="supplier-invoice-title"><span>RELEVÉ CLIENT</span><b>{customer.name}</b><small>Édité le {new Date().toLocaleDateString('fr-TN')}</small></div></header>
   <section className="supplier-invoice-parties"><div><span>CLIENT</span><b>{customer.name}</b><p>{customer.address||customer.region||'—'}</p><p>{customer.phone||''}{customer.taxId?' · MF '+customer.taxId:''}</p></div><div><span>SITUATION</span><b>Solde : {money(Math.max(0,balance))}</b><p>Plafond crédit : {money(Number(customer.creditLimit))}</p><p>{balance<=0?'Compte soldé / créditeur':'Montant dû au fournisseur'}</p></div></section>
   <table className="supplier-invoice-table supplier-statement-table"><thead><tr><th>Date</th><th>Opération</th><th>Référence</th><th>Débit</th><th>Crédit</th><th>Solde</th></tr></thead><tbody>{rows.map((e,i)=><tr key={i}><td>{dateTime(e.date)}</td><td>{e.type}<div className="muted">{e.note}</div></td><td>{e.reference}</td><td>{e.debit?money(e.debit):'—'}</td><td>{e.credit?money(e.credit):'—'}</td><td><b>{money(e.balance)}</b></td></tr>)}</tbody></table>
   <div className="supplier-invoice-bottom"><div/><div className="supplier-invoice-totals"><div><span>Total débit</span><b>{money(totalDebit)}</b></div><div><span>Total crédit</span><b>{money(totalCredit)}</b></div><div className="total"><span>Solde</span><b>{money(balance)}</b></div></div></div>
   <footer><span>Relevé généré par Fixi Supplier</span><b>{company?.currency||'DT'}</b></footer>
  </article>
 </div>
}
