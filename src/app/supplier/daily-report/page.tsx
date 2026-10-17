import {redirect} from 'next/navigation';
import Link from 'next/link';
import {getSupplierSession} from '@/lib/supplier-auth';
import {prisma} from '@/lib/prisma';
import {SupplierPrintButton} from '@/components/supplier-print-button';
import {money} from '@/lib/format';

export default async function DailyReport({searchParams}:{searchParams:Promise<{date?:string}>}){
 const s=await getSupplierSession();if(!s)redirect('/supplier/login');
 const q=await searchParams;const date=q.date||new Date().toISOString().slice(0,10);
 const from=new Date(date+'T00:00:00+01:00'),to=new Date(date+'T23:59:59.999+01:00');
 const [company,sales,payments,expenses,returns]=await Promise.all([
  prisma.supplierCompany.findUnique({where:{id:s.companyId}}),
  prisma.supplierErpSale.findMany({where:{companyId:s.companyId,createdAt:{gte:from,lte:to},status:{not:'CANCELLED'}},orderBy:{createdAt:'asc'}}),
  prisma.supplierErpPayment.findMany({where:{companyId:s.companyId,createdAt:{gte:from,lte:to}},orderBy:{createdAt:'asc'}}),
  prisma.supplierErpExpense.findMany({where:{companyId:s.companyId,expenseDate:{gte:from,lte:to}},orderBy:{expenseDate:'asc'}}),
  prisma.supplierReturn.findMany({where:{companyId:s.companyId,createdAt:{gte:from,lte:to},status:'COMPLETED'},orderBy:{createdAt:'asc'}})
 ]);
 const salesTotal=sales.reduce((a,x)=>a+Number(x.total),0),paid=sales.reduce((a,x)=>a+Number(x.paid),0),due=sales.reduce((a,x)=>a+Math.max(0,Number(x.total)-Number(x.paid)),0);
 const incoming=payments.filter(x=>x.kind==='IN').reduce((a,x)=>a+Number(x.amount),0),outgoing=payments.filter(x=>x.kind==='OUT').reduce((a,x)=>a+Number(x.amount),0),expense=expenses.reduce((a,x)=>a+Number(x.amount),0),returnsTotal=returns.reduce((a,x)=>a+Number(x.total),0);
 return <div className="supplier-print-page"><header><div><b>{company?.name||'Fixi Supplier'}</b><span>Recette journalière · {new Date(date+'T12:00:00').toLocaleDateString('fr-TN')}</span></div><div className="no-print"><Link className="btn btn-soft" href="/supplier">Retour</Link><SupplierPrintButton label="Imprimer / Enregistrer PDF"/></div></header>
 <section className="supplier-print-summary"><div><span>Ventes</span><b>{money(salesTotal)}</b></div><div><span>Encaissé sur ventes</span><b>{money(paid)}</b></div><div><span>Créé en dû</span><b>{money(due)}</b></div><div><span>Entrées caisse</span><b>{money(incoming)}</b></div><div><span>Sorties paiements</span><b>{money(outgoing)}</b></div><div><span>Dépenses</span><b>{money(expense)}</b></div><div><span>Retours / avoirs</span><b>{money(returnsTotal)}</b></div><div><span>Flux net</span><b>{money(incoming-outgoing-expense)}</b></div></section>
 <h2>Détail des ventes</h2><table><thead><tr><th>Heure</th><th>Référence</th><th>Statut</th><th>Total</th><th>Payé</th><th>Reste</th></tr></thead><tbody>{sales.map(x=><tr key={x.id}><td>{new Date(x.createdAt).toLocaleTimeString('fr-TN',{hour:'2-digit',minute:'2-digit'})}</td><td>{x.reference}</td><td>{x.status}</td><td>{money(Number(x.total))}</td><td>{money(Number(x.paid))}</td><td>{money(Math.max(0,Number(x.total)-Number(x.paid)))}</td></tr>)}</tbody></table>
 <h2>Paiements</h2><table><thead><tr><th>Heure</th><th>Type</th><th>Moyen</th><th>Référence</th><th>Montant</th></tr></thead><tbody>{payments.map(x=><tr key={x.id}><td>{new Date(x.createdAt).toLocaleTimeString('fr-TN',{hour:'2-digit',minute:'2-digit'})}</td><td>{x.kind}</td><td>{x.method}</td><td>{x.reference||'—'}</td><td>{money(Number(x.amount))}</td></tr>)}</tbody></table>
 <h2>Dépenses</h2><table><thead><tr><th>Heure</th><th>Catégorie</th><th>Libellé</th><th>Moyen</th><th>Montant</th></tr></thead><tbody>{expenses.map(x=><tr key={x.id}><td>{new Date(x.expenseDate).toLocaleTimeString('fr-TN',{hour:'2-digit',minute:'2-digit'})}</td><td>{x.category}</td><td>{x.label}</td><td>{x.method}</td><td>{money(Number(x.amount))}</td></tr>)}</tbody></table>
 <footer>Généré par Fixi Supplier · Document de contrôle interne</footer></div>
}
