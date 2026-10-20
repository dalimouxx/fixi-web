import {prisma} from '@/lib/prisma';
import {requireSupplierSession} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';
import {plain} from '@/lib/serializers';
import {supplierCashSummary} from '@/lib/supplier-cash-ledger';

export const dynamic='force-dynamic';

/** The logged-in cashier only sees their own drawer and history. */
export async function GET(){
 try{
  const s=await requireSupplierSession();
  if(!['OWNER','ADMIN','MANAGER','CASHIER','SALES','ACCOUNTANT'].includes(s.role))
    return bad('Accès caisse interdit',403);
  const recent=await prisma.supplierErpCashSession.findMany({
    where:{companyId:s.companyId,accountId:s.id},orderBy:{openedAt:'desc'},take:8
  });
  const session=recent.find(x=>x.status==='OPEN')||recent[0]||null;
  if(!session)return ok({current:null,recent:[],summary:null,movements:[]});
  const [payments,expenses]=await Promise.all([
    prisma.supplierErpPayment.findMany({
      where:{companyId:s.companyId,cashSessionId:session.id},
      orderBy:{createdAt:'desc'},take:2000,
      select:{id:true,amount:true,method:true,kind:true,createdAt:true,reference:true,note:true,saleId:true}
    }),
    prisma.supplierErpExpense.findMany({
      where:{companyId:s.companyId,cashSessionId:session.id},
      orderBy:{expenseDate:'desc'},take:1000,
      select:{id:true,amount:true,method:true,category:true,label:true,expenseDate:true}
    })
  ]);
  const summary=supplierCashSummary(session.openingAmount,payments,expenses);
  const movements=[
    ...payments.map(p=>({id:p.id,type:p.kind==='IN'?'ENCASHMENT':'PAYOUT',
      method:p.method,amount:Number(p.amount),reference:p.reference||null,
      label:p.note||(p.kind==='IN'?'Encaissement':'Décaissement'),at:p.createdAt})),
    ...expenses.map(x=>({id:x.id,type:'EXPENSE',method:x.method,
      amount:Number(x.amount),reference:null,label:x.label,at:x.expenseDate}))
  ].sort((a,b)=>new Date(b.at).getTime()-new Date(a.at).getTime()).slice(0,75);
  return ok(plain({current:session,recent,summary,movements}));
 }catch(e:any){return bad(e.message,e.status||500)}
}
