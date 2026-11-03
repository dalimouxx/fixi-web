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
    select:{id:true,name:true,phone:true,taxId:true,address:true,creditLimit:true,priceMode:true,discountPct:true}
   }),
   prisma.supplierCompany.findUnique({where:{id:s.companyId},select:{
    legalName:true,phone:true,address:true,taxId:true,receiptMessage:true,tradeRegister:true,logoUrl:true
   }}),
   // Quantités vendues sur 30 jours : la caisse met les articles les plus vendus en premier.
   prisma.supplierErpSale.findMany({where:{companyId:s.companyId,createdAt:{gte:since},status:{not:'CANCELLED'}},select:{id:true},take:5000})
    .then(rows=>rows.length?prisma.supplierErpSaleItem.groupBy({by:['productId'],where:{saleId:{in:rows.map(r=>r.id)},productId:{not:null}},_sum:{quantity:true}}):[])
    .catch(()=>[] as any[])
  ]);
  const ids=products.map(p=>p.id);
  const [tiers,dues]=await Promise.all([
   ids.length?prisma.supplierPriceTier.findMany({where:{companyId:s.companyId,active:true,productId:{in:ids}},select:{productId:true,minQty:true,unitPrice:true},orderBy:{minQty:'asc'}}).catch(()=>[]):[],
   prisma.supplierErpSale.groupBy({by:['customerId'],where:{companyId:s.companyId,customerId:{not:null},status:{not:'CANCELLED'}},_sum:{total:true,paid:true}}).catch(()=>[] as any[])
  ]);
  const tiersBy=new Map<string,{minQty:number;unitPrice:number}[]>();for(const t of tiers){const l=tiersBy.get(t.productId)||[];l.push({minQty:t.minQty,unitPrice:Number(t.unitPrice)});tiersBy.set(t.productId,l)}
  const dueBy=new Map<string,number>((dues as any[]).map(d=>[String(d.customerId),Math.max(0,Number(d._sum?.total||0)-Number(d._sum?.paid||0))]));
  const soldBy=new Map<string,number>((sold as any[]).map(x=>[String(x.productId),Number(x._sum?.quantity||0)]));
  return ok({connected:true,companyName:s.companyName,role:s.role,account:{id:s.id,fullName:s.fullName},receiptProfile:profile,products:products.map(p=>({
   id:p.id,name:p.name,sku:p.sku,barcode:p.barcode,category:p.category,brand:p.brand,
   price:Number(p.retailPrice??p.price),wholesalePrice:p.wholesalePrice===null?null:Number(p.wholesalePrice),minStock:p.minStock,stock:Math.max(0,p.stock-p.reservedStock),
   updatedAt:p.updatedAt,sold30:soldBy.get(p.id)||0,onHand:p.stock,tiers:tiersBy.get(p.id)||[]
  })),customers:customers.map(c=>({id:c.id,name:c.name,phone:c.phone,taxId:c.taxId,address:c.address,creditLimit:Number(c.creditLimit||0),priceMode:c.priceMode,discountPct:Number(c.discountPct||0),
   due:Math.round((dueBy.get(c.id)||0)*1000)/1000}))});
 }catch(e:any){return bad(e.message,e.status||500)}
}
