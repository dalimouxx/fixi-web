import {prisma} from '@/lib/prisma';
import {requireSupplierRole} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';

export async function GET(){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER','SALES','CASHIER']);
  const orders=await prisma.supplierOrder.findMany({
   where:{companyId:s.companyId,status:{in:['PENDING','CONFIRMED','PREPARING','READY_FOR_DELIVERY']}},
   orderBy:{createdAt:'desc'},take:100,
   select:{id:true,status:true,createdAt:true,shop:{select:{name:true}},items:{select:{quantity:true,product:{select:{name:true,sku:true}}}}}
  });
  return ok({orders:orders.map(o=>({id:o.id,status:o.status,createdAt:o.createdAt,customer:o.shop?.name||'Atelier',items:o.items.map(i=>({name:i.product?.name||'Produit',sku:i.product?.sku||'',quantity:i.quantity}))}))});
 }catch(e:any){return bad(e.message||'Erreur commandes Windows',e.status||500)}
}
