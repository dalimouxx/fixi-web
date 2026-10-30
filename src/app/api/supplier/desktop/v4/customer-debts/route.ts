import {prisma} from '@/lib/prisma';
import {requireSupplierRole} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';

const money=(n:number)=>Math.round((n+Number.EPSILON)*1000)/1000;
const invalid=(message:string,status=409)=>Object.assign(new Error(message),{status});

/** Aggregate customer ledger; the cashier never has to choose a particular invoice. */
export async function GET(){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER','SALES','CASHIER','ACCOUNTANT']);
  const sales=await prisma.supplierErpSale.findMany({
   where:{companyId:s.companyId,customerId:{not:null},status:{in:['CREDIT','PARTIALLY_PAID']}},
   select:{id:true,customerId:true,total:true,paid:true,reference:true,createdAt:true},orderBy:{createdAt:'asc'},take:2500
  });
  const credits=sales.length?await prisma.supplierReturn.findMany({
   where:{companyId:s.companyId,sourceSaleId:{in:sales.map(x=>x.id)},type:'SALE_RETURN',status:'COMPLETED'},
   select:{sourceSaleId:true,total:true,refund:true}
  }):[];
  const sums=new Map<string,{credit:number;refund:number}>();
  for(const c of credits){const id=c.sourceSaleId||'';const prev=sums.get(id)||{credit:0,refund:0};prev.credit+=Number(c.total);prev.refund+=Number(c.refund);sums.set(id,prev)}
  const grouped=new Map<string,{customerId:string;due:number;invoices:number}>();
  for(const sale of sales){if(!sale.customerId)continue;const credit=sums.get(sale.id)||{credit:0,refund:0};
   const due=money(Math.max(0,Number(sale.total)-credit.credit-(Number(sale.paid)-credit.refund)));
   if(due<0.001)continue;const x=grouped.get(sale.customerId)||{customerId:sale.customerId,due:0,invoices:0};
   x.due=money(x.due+due);x.invoices+=1;grouped.set(sale.customerId,x)
  }
  const customers=grouped.size?await prisma.supplierErpCustomer.findMany({
   where:{companyId:s.companyId,id:{in:[...grouped.keys()]}},select:{id:true,name:true,phone:true}
  }):[];
  return ok({customers:customers.map(c=>({...grouped.get(c.id),customer:c.name,phone:c.phone||''}))
   .sort((a,b)=>b.due-a.due)});
 }catch(e:any){return bad(e.message||'Créances clients indisponibles',e.status||500)}
}

/** Single idempotent payment allocated oldest-invoice-first in one transaction. */
export async function POST(req:Request){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER','SALES','CASHIER']);
  const b=await req.json();
  const customerId=String(b.customerId||''),reference=String(b.reference||'');
  const amount=Number(b.amount),method=String(b.method||'CASH').toUpperCase();
  if(!customerId||!/^WINCUST-[a-f0-9-]{36}$/i.test(reference))return bad('Référence de versement invalide',400);
  if(!Number.isFinite(amount)||amount<=0||amount>100000000||Math.abs(money(amount)-amount)>0.00001)return bad('Montant non valide (3 décimales)',400);
  if(!['CASH','CARD','TRANSFER'].includes(method))return bad('Moyen de paiement invalide',400);
  const result=await prisma.$transaction(async tx=>{
   // One aggregate customer payment at a time, including retries from another workstation.
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${s.companyId}),hashtext(${customerId}))`;
   const previous=await tx.supplierErpPayment.findMany({where:{companyId:s.companyId,reference,kind:'IN'}});
   if(previous.length){
    const total=money(previous.reduce((n,p)=>n+Number(p.amount),0));
    if(previous.some(p=>p.customerId!==customerId||p.method!==method)||Math.abs(total-amount)>.0005)
     throw invalid('Référence déjà affectée à une autre opération');
    return {reference,allocated:previous.length,amount:total,replayed:true};
   }
   const customer=await tx.supplierErpCustomer.findFirst({where:{id:customerId,companyId:s.companyId,active:true}});
   if(!customer)throw invalid('Client introuvable',404);
   const sales=await tx.supplierErpSale.findMany({where:{
    companyId:s.companyId,customerId,status:{in:['CREDIT','PARTIALLY_PAID']}
   },orderBy:[{createdAt:'asc'},{id:'asc'}],take:1000});
   const credits=sales.length?await tx.supplierReturn.findMany({where:{
    companyId:s.companyId,sourceSaleId:{in:sales.map(x=>x.id)},type:'SALE_RETURN',status:'COMPLETED'
   },select:{sourceSaleId:true,total:true,refund:true}}):[];
   const creditsBySale=new Map<string,{total:number;refund:number}>();
   for(const c of credits){const id=c.sourceSaleId||'';const prev=creditsBySale.get(id)||{total:0,refund:0};prev.total+=Number(c.total);prev.refund+=Number(c.refund);creditsBySale.set(id,prev)}
   const dueSales=sales.map(sale=>{const c=creditsBySale.get(sale.id)||{total:0,refund:0};
    const due=money(Math.max(0,Number(sale.total)-c.total-(Number(sale.paid)-c.refund)));
    return {sale,due}
   }).filter(x=>x.due>=.001);
   const totalDue=money(dueSales.reduce((v,x)=>v+x.due,0));
   if(amount>totalDue+.0005)throw invalid('Le versement dépasse la dette totale du client : '+totalDue.toFixed(3)+' DT');
   if(!dueSales.length)throw invalid('Ce client n’a plus de dette');
   const session=method==='CASH'?await tx.supplierErpCashSession.findFirst({
    where:{companyId:s.companyId,accountId:s.id,status:'OPEN'},orderBy:{openedAt:'desc'}
   }):null;
   if(method==='CASH'&&!session)throw invalid('Ouvrez votre session de caisse pour recevoir des espèces');
   let left=money(amount);const applied:{saleId:string;reference:string;amount:number}[]=[];
   for(const {sale,due} of dueSales){if(left<.001)break;
    const paidNow=money(Math.min(due,left));if(paidNow<.001)continue;
    const newPaid=money(Number(sale.paid)+paidNow);
    const changed=await tx.supplierErpSale.updateMany({where:{
      id:sale.id,companyId:s.companyId,paid:sale.paid,status:sale.status
     },data:{paid:newPaid,status:money(due-paidNow)<.001?'PAID':'PARTIALLY_PAID'}});
    if(changed.count!==1)throw invalid('La dette a changé pendant le règlement. Réactualisez.');
    await tx.supplierErpPayment.create({data:{
      companyId:s.companyId,customerId,saleId:sale.id,cashSessionId:session?.id||null,
      kind:'IN',method,amount:paidNow,reference,accountId:s.id,
      note:'Règlement global FIXI Windows (répartition chronologique)'
    }});
    applied.push({saleId:sale.id,reference:sale.reference,amount:paidNow});left=money(left-paidNow)
   }
   if(left>.0005)throw invalid('Versement non totalement réparti : opération annulée');
   await tx.supplierAuditEvent.create({data:{
    companyId:s.companyId,accountId:s.id,action:'WINDOWS_CUSTOMER_PAYMENT',
    entity:'SUPPLIER_ERP_CUSTOMER',entityId:customerId,
    metadata:{reference,amount,method,allocations:applied}
   }});
   return {reference,amount:money(amount),allocated:applied.length,remaining:money(totalDue-amount),replayed:false,allocations:applied};
  },{timeout:15000});
  return ok(result,{status:result.replayed?200:201});
 }catch(e:any){return bad(e.message||'Règlement client refusé',e.status||500)}
}
