import {prisma} from '@/lib/prisma';

export async function ensureMarketplaceAccounting(orderId:string,accountId?:string|null){
 const existing=await prisma.supplierErpSale.findFirst({where:{sourceOrderId:orderId}});
 if(existing)return existing;
 const order=await prisma.supplierOrder.findUnique({where:{id:orderId},include:{items:{include:{product:true}},delivery:true,shop:{select:{name:true,phone:true,address:true,region:true}}}});
 if(!order)return null;
 const collected=Math.min(Number(order.total),Math.max(0,Number(order.delivery?.cashCollected||0)));
 return prisma.$transaction(async tx=>{
  const again=await tx.supplierErpSale.findFirst({where:{sourceOrderId:orderId}});
  if(again)return again;
  const sale=await tx.supplierErpSale.create({data:{
   companyId:order.companyId,
   sourceOrderId:order.id,
   reference:order.reference,
   status:collected>=Number(order.total)?'PAID':collected>0?'PARTIALLY_PAID':'CREDIT',
   subtotal:order.total,
   discount:0,
   tax:0,
   total:order.total,
   paid:collected,
   note:`Marketplace Fixi · ${order.shop.name}${order.shop.region?' · '+order.shop.region:''}`,
   createdById:accountId||null,
   createdAt:order.createdAt
  }});
  for(const item of order.items){
   await tx.supplierErpSaleItem.create({data:{
    saleId:sale.id,
    productId:item.productId,
    sku:item.product.sku,
    name:item.product.name,
    quantity:item.quantity,
    unitCost:Number(item.product.averageCost||item.product.purchasePrice||0),
    unitPrice:item.unitPrice
   }});
  }
  if(collected>0)await tx.supplierErpPayment.create({data:{
   companyId:order.companyId,
   saleId:sale.id,
   kind:'IN',
   method:'CASH',
   amount:collected,
   reference:order.reference,
   note:'COD Fixi Delivery',
   accountId:accountId||null
  }});
  await tx.supplierAuditEvent.create({data:{companyId:order.companyId,accountId:accountId||null,action:'ACCOUNT',entity:'MARKETPLACE_ORDER',entityId:order.id,metadata:{reference:order.reference,total:Number(order.total),collected,shop:order.shop.name}}});
  return sale;
 });
}
