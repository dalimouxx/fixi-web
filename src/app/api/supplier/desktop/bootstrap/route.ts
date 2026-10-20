import {prisma} from '@/lib/prisma';
import {requireSupplierRole} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';

/** Minimal read-only payload for connected Windows POS clients.
 * Never return supplier costs, internal finance ledgers or password hashes.
 */
export async function GET(){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER','SALES','CASHIER']);
  const [products,customers]=await Promise.all([
   prisma.supplierProduct.findMany({
    where:{companyId:s.companyId,active:true},orderBy:{name:'asc'},take:5000,
    select:{id:true,name:true,sku:true,barcode:true,category:true,brand:true,retailPrice:true,price:true,stock:true,reservedStock:true,updatedAt:true}
   }),
   prisma.supplierErpCustomer.findMany({
    where:{companyId:s.companyId,active:true},orderBy:{name:'asc'},take:2000,
    select:{id:true,name:true}
   })
  ]);
  return ok({connected:true,companyName:s.companyName,role:s.role,products:products.map(p=>({
   id:p.id,name:p.name,sku:p.sku,barcode:p.barcode,category:p.category,brand:p.brand,
   price:Number(p.retailPrice??p.price),stock:Math.max(0,p.stock-p.reservedStock),
   updatedAt:p.updatedAt
  })),customers});
 }catch(e:any){return bad(e.message,e.status||500)}
}
