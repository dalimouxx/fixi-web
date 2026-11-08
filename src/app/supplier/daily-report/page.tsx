import {payLabel,statusLabel} from '@/lib/labels';
import {redirect} from 'next/navigation';
import Link from 'next/link';
import {getSupplierSession} from '@/lib/supplier-auth';
import {prisma} from '@/lib/prisma';
import {SupplierPrintButton} from '@/components/supplier-print-button';
import {money} from '@/lib/format';

export default async function DailyReport({searchParams}:{searchParams:Promise<{date?:string}>}){
 const s=await getSupplierSession();if(!s)redirect('/supplier/login');
 const q=await searchParams;// « Aujourd'hui » = le jour de Tunis (et non UTC : entre minuit et 1 h, le rapport montrait la veille).
 const date=/^\d{4}-\d{2}-\d{2}$/.test(String(q.date||''))?String(q.date):new Intl.DateTimeFormat('fr-CA',{timeZone:'Africa/Tunis'}).format(new Date());
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
 // Supplément « passager » : compris dans les ventes, invisible sur les tickets, tracé ici par caissier.
 const walkIn=sales.reduce((a,x)=>a+Number((x as any).walkInExtra||0),0);
 const walkInIds=[...new Set(sales.filter(x=>Number((x as any).walkInExtra||0)>0).map(x=>x.createdById).filter(Boolean) as string[])];
 const walkInNames=new Map((walkInIds.length?await prisma.supplierAccount.findMany({where:{id:{in:walkInIds},companyId:s.companyId},select:{id:true,fullName:true}}):[]).map(a=>[a.id,a.fullName]));
 const walkInBy=[...sales.filter(x=>Number((x as any).walkInExtra||0)>0).reduce((m,x)=>{const k=x.createdById||'';m.set(k,(m.get(k)||0)+Number((x as any).walkInExtra));return m},new Map<string,number>())].map(([id,v])=>({name:walkInNames.get(id)||'—',v}));
 return <div className="supplier-print-page"><header><div><b>{company?.name||'Fixi Supplier'}</b><span>Recette journalière · {new Date(date+'T12:00:00').toLocaleDateString('fr-FR')}</span></div><div className="no-print"><Link className="btn btn-soft" href="/supplier">Retour</Link><SupplierPrintButton label="Imprimer / Enregistrer PDF"/></div></header>
 <section className="supplier-print-summary"><div><span>Ventes</span><b>{money(salesTotal)}</b></div><div><span>dont supplément passagers</span><b>{money(walkIn)}</b></div><div><span>Encaissé sur ventes</span><b>{money(paid)}</b></div><div><span>Créé en dû</span><b>{money(due)}</b></div><div><span>Entrées caisse</span><b>{money(incoming)}</b></div><div><span>Sorties paiements</span><b>{money(outgoing)}</b></div><div><span>Dépenses</span><b>{money(expense)}</b></div><div><span>Retours / avoirs</span><b>{money(returnsTotal)}</b></div><div><span>Flux net</span><b>{money(incoming-outgoing-expense)}</b></div></section>
 {walkInBy.length>0&&<><h2>Supplément passagers par caissier</h2><table><thead><tr><th>Caissier</th><th>Supplément</th></tr></thead><tbody>{walkInBy.map(x=><tr key={x.name}><td>{x.name}</td><td>{money(x.v)}</td></tr>)}</tbody></table></>}
 <h2>Détail des ventes</h2><table><thead><tr><th>Heure</th><th>Référence</th><th>Statut</th><th>Total</th><th>Payé</th><th>Reste</th></tr></thead><tbody>{sales.map(x=><tr key={x.id}><td>{new Date(x.createdAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',timeZone:'Africa/Tunis'})}</td><td>{x.reference}</td><td>{statusLabel(x.status)}</td><td>{money(Number(x.total))}</td><td>{money(Number(x.paid))}</td><td>{money(Math.max(0,Number(x.total)-Number(x.paid)))}</td></tr>)}</tbody></table>
 <h2>Paiements</h2><table><thead><tr><th>Heure</th><th>Type</th><th>Moyen</th><th>Référence</th><th>Montant</th></tr></thead><tbody>{payments.map(x=><tr key={x.id}><td>{new Date(x.createdAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',timeZone:'Africa/Tunis'})}</td><td>{x.kind==="IN"?"Encaissement":x.kind==="OUT"?"Sortie":statusLabel(x.kind)}</td><td>{payLabel(x.method)}</td><td>{x.reference||'—'}</td><td>{money(Number(x.amount))}</td></tr>)}</tbody></table>
 <h2>Dépenses</h2><table><thead><tr><th>Heure</th><th>Catégorie</th><th>Libellé</th><th>Moyen</th><th>Montant</th></tr></thead><tbody>{expenses.map(x=><tr key={x.id}><td>{new Date(x.expenseDate).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',timeZone:'Africa/Tunis'})}</td><td>{x.category}</td><td>{x.label}</td><td>{payLabel(x.method)}</td><td>{money(Number(x.amount))}</td></tr>)}</tbody></table>
 <footer>Généré par Fixi Supplier · Document de contrôle interne</footer></div>
}
