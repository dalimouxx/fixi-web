import {prisma} from '@/lib/prisma';
import {requireSupplierRole} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';

/** Minimal read-only payload for connected Windows POS clients.
 * Never return supplier costs, internal finance ledgers or password hashes.
 */
export async function GET(){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER','SALES','CASHIER']);
  const since=new Date(Date.now()-30*86400000);
  const [products,customers,profile,sold]=await Promise.all([
   prisma.supplierProduct.findMany({
    where:{companyId:s.companyId,active:true},orderBy:{name:'asc'},take:5000,
    select:{id:true,name:true,sku:true,barcode:true,category:true,brand:true,retailPrice:true,wholesalePrice:true,price:true,minStock:true,stock:true,reservedStock:true,updatedAt:true}
   }),
   prisma.supplierErpCustomer.findMany({
    where:{companyId:s.companyId,active:true},orderBy:{name:'asc'},take:2000,
    select:{id:true,name:true,phone:true}
   }),
   prisma.supplierCompany.findUnique({where:{id:s.companyId},select:{
    legalName:true,phone:true,address:true,taxId:true,receiptMessage:true,tradeRegister:true,logoUrl:true
   }}),
   // Quantités vendues sur 30 jours : la caisse met les articles les plus vendus en premier.
   prisma.supplierErpSale.findMany({where:{companyId:s.companyId,createdAt:{gte:since},status:{not:'CANCELLED'}},select:{id:true},take:5000})
    .then(rows=>rows.length?prisma.supplierErpSaleItem.groupBy({by:['productId'],where:{saleId:{in:rows.map(r=>r.id)},productId:{not:null}},_sum:{quantity:true}}):[])
    .catch(()=>[] as any[])
  ]);
  const soldBy=new Map<string,number>((sold as any[]).map(x=>[String(x.productId),Number(x._sum?.quantity||0)]));
  return ok({connected:true,companyName:s.companyName,role:s.role,account:{id:s.id,fullName:s.fullName},receiptProfile:profile,products:products.map(p=>({
   id:p.id,name:p.name,sku:p.sku,barcode:p.barcode,category:p.category,brand:p.brand,
   price:Number(p.retailPrice??p.price),wholesalePrice:p.wholesalePrice===null?null:Number(p.wholesalePrice),minStock:p.minStock,stock:Math.max(0,p.stock-p.reservedStock),
   updatedAt:p.updatedAt,sold30:soldBy.get(p.id)||0
  })),customers});
 }catch(e:any){return bad(e.message,e.status||500)}
}
