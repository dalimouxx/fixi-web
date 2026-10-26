import {prisma} from '@/lib/prisma';
import {requireSupplierRole} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';

const round=(n:number)=>Math.round((n+Number.EPSILON)*1000)/1000;
export async function POST(req:Request){
 try{
  const user=await requireSupplierRole(['OWNER','ADMIN','MANAGER','SALES','CASHIER']);
  // V4 uses Supplier ERP roles and atomic ledger checks. No legacy Windows feature flag.

  const body=await req.json();
  const saleId=String(body.saleId||''),reference=String(body.reference||'');
  const amount=Number(body.amount),method=String(body.method||'CASH').toUpperCase();
  if(!/^WINPAY-[a-f0-9-]{36}$/i.test(reference)||!saleId)return bad('Référence de règlement invalide',400);
  if(!Number.isFinite(amount)||amount<=0||amount>100000000||Math.abs(round(amount)-amount)>0.00001)return bad('Montant invalide : trois décimales maximum',400);
  if(!['CASH','CARD','TRANSFER'].includes(method))return bad('Méthode de paiement invalide',400);
  const result=await prisma.$transaction(async tx=>{
   // Serialize retries with the same reference, across multiple Windows clients.
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.companyId}),hashtext(${reference}))`;
   const previous=await tx.supplierErpPayment.findFirst({where:{companyId:user.companyId,reference,kind:'IN'}});
   if(previous){
    if(previous.saleId!==saleId||Math.abs(Number(previous.amount)-amount)>0.0001||previous.method!==method)throw Object.assign(new Error('Référence déjà utilisée pour un autre paiement'),{status:409});
    return {id:previous.id,reference,amount:Number(previous.amount),replayed:true};
   }
   const sale=await tx.supplierErpSale.findFirst({where:{id:saleId,companyId:user.companyId,status:{in:['CREDIT','PARTIALLY_PAID']}}});
   if(!sale||!sale.customerId)throw Object.assign(new Error('Dette non trouvée ou déjà soldée'),{status:409});
   const credits=await tx.supplierReturn.findMany({where:{companyId:user.companyId,sourceSaleId:sale.id,type:'SALE_RETURN',status:'COMPLETED'},select:{total:true,refund:true}});
   const netTotal=round(Math.max(0,Number(sale.total)-credits.reduce((a,x)=>a+Number(x.total),0)));
   const refunded=credits.reduce((a,x)=>a+Number(x.refund),0);
   const remaining=round(Math.max(0,netTotal-(Number(sale.paid)-refunded)));
   if(round(amount)>remaining)throw Object.assign(new Error('Montant supérieur au reste dû'),{status:409});
   const session=method==='CASH'?await tx.supplierErpCashSession.findFirst({where:{companyId:user.companyId,accountId:user.id,status:'OPEN'},orderBy:{openedAt:'desc'}}):null;
   if(method==='CASH'&&!session)throw Object.assign(new Error('Ouvrez la caisse avant un règlement en espèces'),{status:409});
   const paid=round(Number(sale.paid)+amount);
   const nextRemaining=round(Math.max(0,netTotal-(paid-refunded)));
   const changed=await tx.supplierErpSale.updateMany({where:{id:sale.id,companyId:user.companyId,paid:sale.paid,status:sale.status},
      data:{paid,status:nextRemaining<=0?'PAID':'PARTIALLY_PAID'}});
   if(changed.count!==1)throw Object.assign(new Error('La dette a changé : actualisez avant de confirmer'),{status:409});
   const payment=await tx.supplierErpPayment.create({data:{companyId:user.companyId,customerId:sale.customerId,saleId:sale.id,cashSessionId:session?.id||null,kind:'IN',method,amount:round(amount),reference,accountId:user.id,note:'Règlement de dette depuis FIXI Caisse Windows'}});
   await tx.supplierAuditEvent.create({data:{companyId:user.companyId,accountId:user.id,action:'WINDOWS_DEBT_PAYMENT',entity:'SUPPLIER_ERP_SALE',entityId:sale.id,metadata:{paymentId:payment.id,reference,amount:round(amount),method,remaining:nextRemaining}}});
   return {id:payment.id,reference,amount:round(amount),remaining:nextRemaining,replayed:false};
  },{timeout:10000});
  return ok(result,{status:result.replayed?200:201});
 }catch(e:any){return bad(e.message||'Encaissement refusé',e.status||500)}
}
