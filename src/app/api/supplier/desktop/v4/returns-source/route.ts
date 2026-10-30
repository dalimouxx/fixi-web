import {prisma} from '@/lib/prisma';
import {requireSupplierRole} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';

export async function GET(req:Request){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER','SALES','CASHIER']);
  const reference=String(new URL(req.url).searchParams.get('reference')||'').trim();
  if(!reference||reference.length>100)return bad('Référence du ticket requise',400);
  const sale=await prisma.supplierErpSale.findFirst({where:{companyId:s.companyId,reference,status:{not:'CANCELLED'}},
   select:{id:true,reference:true,createdAt:true,total:true}});
  if(!sale)return bad('Ticket introuvable chez ce fournisseur',404);
  const lines=await prisma.supplierErpSaleItem.findMany({where:{saleId:sale.id},
   select:{id:true,name:true,sku:true,quantity:true,unitPrice:true}});
  const prior=await prisma.supplierReturn.findMany({where:{
   companyId:s.companyId,sourceSaleId:sale.id,type:'SALE_RETURN',status:'COMPLETED'
  },select:{id:true}});
  const returned=prior.length?await prisma.supplierReturnItem.findMany({
   where:{returnId:{in:prior.map(x=>x.id)}},select:{saleItemId:true,quantity:true}
  }):[];
  const used=new Map<string,number>();
  for(const line of returned)if(line.saleItemId)used.set(line.saleItemId,(used.get(line.saleItemId)||0)+line.quantity);
  return ok({sale:{id:sale.id,reference:sale.reference,createdAt:sale.createdAt,total:Number(sale.total),
   items:lines.map(line=>({...line,unitPrice:Number(line.unitPrice),
    remaining:Math.max(0,line.quantity-(used.get(line.id)||0))}))}});
 }catch(e:any){return bad(e.message||'Recherche du retour impossible',e.status||500)}
}
