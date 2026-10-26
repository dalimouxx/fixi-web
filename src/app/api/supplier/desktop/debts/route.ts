import {prisma} from '@/lib/prisma';
import {requireSupplierRole} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';

export async function GET(){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER','SALES','CASHIER']);
  const sales=await prisma.supplierErpSale.findMany({
   where:{companyId:s.companyId,customerId:{not:null},status:{in:['CREDIT','PARTIALLY_PAID']}},
   orderBy:{createdAt:'asc'},take:500,
   select:{id:true,reference:true,createdAt:true,customerId:true,total:true,paid:true,status:true}
  });
  const customers=await prisma.supplierErpCustomer.findMany({
   where:{companyId:s.companyId,active:true,id:{in:[...new Set(sales.map(x=>x.customerId).filter((x):x is string=>!!x))]}},
   select:{id:true,name:true}
  });
  const names=new Map(customers.map(c=>[c.id,c.name]));
  return ok({debts:sales.map(x=>({id:x.id,reference:x.reference,createdAt:x.createdAt,customerId:x.customerId,customer:names.get(x.customerId||'')||'Client',total:Number(x.total),paid:Number(x.paid),due:Math.max(0,Number(x.total)-Number(x.paid)),status:x.status})).filter(x=>x.due>0.001)});
 }catch(e:any){return bad(e.message||'Impossible de consulter les impayés',e.status||500)}
}
