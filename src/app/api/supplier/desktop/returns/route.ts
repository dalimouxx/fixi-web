import {prisma} from '@/lib/prisma';
import {requireSupplierRole} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';

export async function GET(){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER','SALES','CASHIER']);
  const [sales,returns]=await Promise.all([
   prisma.supplierErpSale.findMany({where:{companyId:s.companyId,status:{not:'CANCELLED'}},orderBy:{createdAt:'desc'},take:100,
    select:{id:true,reference:true,createdAt:true,total:true}}),
   prisma.supplierReturn.findMany({where:{companyId:s.companyId,type:'SALE_RETURN'},orderBy:{createdAt:'desc'},take:100,
    select:{id:true,reference:true,sourceRef:true,createdAt:true,total:true,refund:true,status:true,note:true}})
  ]);
  const saleIds=sales.map(x=>x.id);
  const items=await prisma.supplierErpSaleItem.findMany({where:{saleId:{in:saleIds}},select:{id:true,saleId:true,name:true,sku:true,quantity:true,unitPrice:true}});
  return ok({sales:sales.map(x=>({id:x.id,reference:x.reference,createdAt:x.createdAt,total:Number(x.total),
   items:items.filter(i=>i.saleId===x.id).map(i=>({id:i.id,name:i.name,sku:i.sku,quantity:i.quantity,unitPrice:Number(i.unitPrice)}))})),
   returns:returns.map(x=>({...x,total:Number(x.total),refund:Number(x.refund)}))});
 }catch(e:any){return bad(e.message||'Retours indisponibles',e.status||500)}
}
