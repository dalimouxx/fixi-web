import {prisma} from '@/lib/prisma';
import {requireSupplierRole} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';

/** Read-only reconciliation for Windows operations after connectivity failures. */
export async function GET(req:Request){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER','SALES','CASHIER']);
  const url=new URL(req.url);
  const kind=url.searchParams.get('kind')||'';
  const reference=url.searchParams.get('reference')||'';
  if(!['sale','debt','return'].includes(kind))return bad('Type d’opération invalide',400);
  const regex=kind==='sale'?/^WIN-[a-f0-9-]{36}$/i:kind==='debt'?/^WIN(?:PAY|CUST)-[a-f0-9-]{36}$/i:/^WINRET-[a-f0-9-]{36}$/i;
  if(!regex.test(reference))return bad('Référence invalide',400);
  if(kind==='sale'){
   const sale=await prisma.supplierErpSale.findFirst({where:{companyId:s.companyId,reference},select:{id:true,reference:true,total:true,paid:true,status:true}});
   return ok({exists:!!sale,kind,reference,record:sale?{id:sale.id,total:Number(sale.total),paid:Number(sale.paid),status:sale.status}:null});
  }
  if(kind==='debt'){
   const payment=await prisma.supplierErpPayment.findFirst({where:{companyId:s.companyId,reference,kind:'IN'},select:{id:true,saleId:true,amount:true,method:true}});
   return ok({exists:!!payment,kind,reference,record:payment?{id:payment.id,saleId:payment.saleId,amount:Number(payment.amount),method:payment.method}:null});
  }
  const credit=await prisma.supplierReturn.findFirst({where:{companyId:s.companyId,reference,type:'SALE_RETURN'},select:{id:true,sourceSaleId:true,total:true,refund:true,status:true}});
  return ok({exists:!!credit,kind,reference,record:credit?{id:credit.id,sourceSaleId:credit.sourceSaleId,total:Number(credit.total),refund:Number(credit.refund),status:credit.status}:null});
 }catch(e:any){return bad(e.message||'Vérification d’opération indisponible',e.status||500)}
}
