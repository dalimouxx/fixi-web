import {prisma} from '@/lib/prisma';
import {requireSupplierRole} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';
import {supplierCashSummary} from '@/lib/supplier-cash-ledger';

const money=(v:unknown)=>Math.round(Number(v||0)*1000)/1000;

/** Résumé de la session de caisse du caissier connecté (ouverte, ou la dernière clôturée) :
 * espèces attendues pour la clôture guidée et chiffres du rapport de fin de journée (Z). */
export async function GET(req:Request){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER','SALES','CASHIER']);
  const id=new URL(req.url).searchParams.get('session')||'';
  const session=await prisma.supplierErpCashSession.findFirst({
   where:{companyId:s.companyId,accountId:s.id,...(id?{id}:{})},orderBy:{openedAt:'desc'}
  });
  if(!session)return ok({session:null});
  const until=session.closedAt||new Date();
  const [cashPayments,expenses,sales,payments]=await Promise.all([
   prisma.supplierErpPayment.findMany({where:{companyId:s.companyId,cashSessionId:session.id},select:{kind:true,method:true,amount:true}}),
   prisma.supplierErpExpense.findMany({where:{companyId:s.companyId,cashSessionId:session.id},select:{method:true,amount:true}}),
   prisma.supplierErpSale.findMany({where:{companyId:s.companyId,createdById:s.id,createdAt:{gte:session.openedAt,lte:until},status:{not:'CANCELLED'}},select:{total:true,paid:true,discount:true}}),
   prisma.supplierErpPayment.findMany({where:{companyId:s.companyId,accountId:s.id,createdAt:{gte:session.openedAt,lte:until}},select:{kind:true,method:true,amount:true}})
  ]);
  const cash=supplierCashSummary(session.openingAmount,cashPayments,expenses);
  const byMethod=new Map<string,{in:number;out:number}>();
  for(const p of payments){const r=byMethod.get(p.method)||{in:0,out:0};if(p.kind==='IN')r.in+=Number(p.amount);else if(p.kind==='OUT')r.out+=Number(p.amount);byMethod.set(p.method,r)}
  return ok({
   session:{id:session.id,status:session.status,openedAt:session.openedAt,closedAt:session.closedAt,
    opening:money(session.openingAmount),closing:session.closingAmount===null?null:money(session.closingAmount),difference:session.difference===null?null:money(session.difference)},
   cashier:s.fullName,company:s.companyName,
   expectedCash:session.status==='OPEN'?cash.expected:money(session.expectedCash),
   cashIn:cash.incoming,cashOut:cash.outgoing,expenses:cash.expenses,
   sales:{count:sales.length,total:money(sales.reduce((a,x)=>a+Number(x.total),0)),paid:money(sales.reduce((a,x)=>a+Number(x.paid),0)),
    credit:money(sales.reduce((a,x)=>a+Math.max(0,Number(x.total)-Number(x.paid)),0)),discounts:money(sales.reduce((a,x)=>a+Number(x.discount||0),0))},
   byMethod:[...byMethod].map(([method,v])=>({method,incoming:money(v.in),outgoing:money(v.out)}))
  });
 }catch(e:any){return bad(e.message||'Résumé de caisse indisponible',e.status||500)}
}
