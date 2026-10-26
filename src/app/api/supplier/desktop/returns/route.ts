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
  const completed=await prisma.supplierReturn.findMany({
   where:{companyId:s.companyId,type:'SALE_RETURN',status:'COMPLETED',sourceSaleId:{in:saleIds}},
   select:{id:true}
  });
  const returnedLines=completed.length?await prisma.supplierReturnItem.findMany({
   where:{returnId:{in:completed.map(x=>x.id)}},select:{saleItemId:true,quantity:true}
  }):[];
  const returnedByLine=new Map<string,number>();
  for(const item of returnedLines)if(item.saleItemId)returnedByLine.set(item.saleItemId,(returnedByLine.get(item.saleItemId)||0)+item.quantity);
  return ok({sales:sales.map(x=>({id:x.id,reference:x.reference,createdAt:x.createdAt,total:Number(x.total),
   items:items.filter(i=>i.saleId===x.id).map(i=>({id:i.id,name:i.name,sku:i.sku,quantity:i.quantity,remaining:Math.max(0,i.quantity-(returnedByLine.get(i.id)||0)),unitPrice:Number(i.unitPrice)}))})),
   returns:returns.map(x=>({...x,total:Number(x.total),refund:Number(x.refund)}))});
 }catch(e:any){return bad(e.message||'Retours indisponibles',e.status||500)}
}
