import {prisma} from '@/lib/prisma';
import {requireSupplierRole} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';

/** Restricted, paginated-ish recent sales view for Windows POS. */
export async function GET(){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER','SALES','CASHIER']);
  const own=s.role==='CASHIER';
  const [sales,sessions]=await Promise.all([
   prisma.supplierErpSale.findMany({where:{companyId:s.companyId,...(own?{createdById:s.id}:{})},
    orderBy:{createdAt:'desc'},take:100,
    select:{id:true,reference:true,createdAt:true,status:true,total:true,paid:true,customerId:true,createdById:true}}),
   prisma.supplierErpCashSession.findMany({where:{companyId:s.companyId,...(own?{accountId:s.id}:{})},
    orderBy:{openedAt:'desc'},take:10,select:{id:true,status:true,openedAt:true,closedAt:true,accountId:true}})
  ]);
  return ok({sales:sales.map(x=>({...x,total:Number(x.total),paid:Number(x.paid)})),sessions});
 }catch(e:any){return bad(e.message||'Erreur de lecture',e.status||500)}
}
