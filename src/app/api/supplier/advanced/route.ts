import {prisma} from '@/lib/prisma';
import {requireSupplierSession} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';
import {plain} from '@/lib/serializers';

export async function GET(){
 try{
  const s=await requireSupplierSession();
  const [warehouses,warehouseStock,vendors,returns,counts,tiers,events]=await Promise.all([
   prisma.supplierWarehouse.findMany({where:{companyId:s.companyId},orderBy:{createdAt:'asc'}}),
   prisma.supplierWarehouseStock.findMany({where:{companyId:s.companyId},orderBy:{updatedAt:'desc'},take:1000}),
   prisma.supplierVendor.findMany({where:{companyId:s.companyId},orderBy:{name:'asc'}}),
   prisma.supplierReturn.findMany({where:{companyId:s.companyId},orderBy:{createdAt:'desc'},take:300}),
   prisma.supplierStockCount.findMany({where:{companyId:s.companyId},orderBy:{createdAt:'desc'},take:100}),
   prisma.supplierPriceTier.findMany({where:{companyId:s.companyId,active:true},orderBy:[{productId:'asc'},{minQty:'asc'}]}),
   prisma.supplierDeliveryEvent.findMany({where:{companyId:s.companyId},orderBy:{createdAt:'desc'},take:500})
  ]);
  return ok(plain({warehouses,warehouseStock,vendors,returns,counts,tiers,events}));
 }catch(e:any){return bad(e.message,e.status||500)}
}

export async function POST(req:Request){
 try{
  const s=await requireSupplierSession();const b=await req.json();const action=String(b.action||'');
  if(action==='WAREHOUSE'){
   if(!b.name||!b.code)return bad('Nom et code requis');
   return ok(plain(await prisma.supplierWarehouse.create({data:{companyId:s.companyId,name:String(b.name),code:String(b.code).toUpperCase(),address:b.address||null,region:b.region||null}})),{status:201});
  }
  if(action==='VENDOR'){
   if(!b.name)return bad('Nom fournisseur requis');
   return ok(plain(await prisma.supplierVendor.create({data:{companyId:s.companyId,name:String(b.name),phone:b.phone||null,email:b.email||null,address:b.address||null,taxId:b.taxId||null,creditLimit:Number(b.creditLimit||0),openingDue:Number(b.openingDue||0),notes:b.notes||null}})),{status:201});
  }
  if(action==='PRICE_TIER'){
   if(!b.productId||!b.name||!(Number(b.minQty)>0)||!(Number(b.unitPrice)>=0))return bad('Palier invalide');
   return ok(plain(await prisma.supplierPriceTier.create({data:{companyId:s.companyId,productId:String(b.productId),name:String(b.name),minQty:Math.trunc(Number(b.minQty)),unitPrice:Number(b.unitPrice)}})),{status:201});
  }
  if(action==='DELIVERY_EVENT'){
   if(!b.orderId||!b.type)return bad('Événement livraison invalide');
   return ok(plain(await prisma.supplierDeliveryEvent.create({data:{companyId:s.companyId,orderId:String(b.orderId),accountId:s.id,type:String(b.type),note:b.note||null,amount:Number.isFinite(Number(b.amount))?Number(b.amount):null,latitude:Number.isFinite(Number(b.latitude))?Number(b.latitude):null,longitude:Number.isFinite(Number(b.longitude))?Number(b.longitude):null,proofUrl:b.proofUrl||null}})),{status:201});
  }
  if(action==='RETURN'){
   const items=Array.isArray(b.items)?b.items:[];if(!items.length)return bad('Aucun article retourné');
   const ref=String(b.reference||('RET-'+Date.now()));let total=0;
   const ret=await prisma.$transaction(async tx=>{const r=await tx.supplierReturn.create({data:{companyId:s.companyId,type:String(b.type||'SALE_RETURN'),reference:ref,sourceRef:b.sourceRef||null,customerId:b.customerId||null,vendorId:b.vendorId||null,status:'COMPLETED',note:b.note||null,createdById:s.id,completedAt:new Date()}});
    for(const i of items){const q=Math.max(1,Math.trunc(Number(i.quantity||1)));const unit=Number(i.unitPrice||0);total+=q*unit;await tx.supplierReturnItem.create({data:{returnId:r.id,productId:i.productId||null,sku:i.sku||null,name:String(i.name||'Article'),quantity:q,unitPrice:unit,reason:i.reason||null,condition:i.condition||null,restock:i.restock!==false}});
     if(i.productId&&i.restock!==false){const p=await tx.supplierProduct.findFirst({where:{id:String(i.productId),companyId:s.companyId}});if(p){await tx.supplierProduct.update({where:{id:p.id},data:{stock:{increment:q}}});await tx.supplierErpStockMovement.create({data:{companyId:s.companyId,productId:p.id,type:'RETURN_IN',quantity:q,beforeQty:p.stock,afterQty:p.stock+q,reference:ref,accountId:s.id}})}}}
    return tx.supplierReturn.update({where:{id:r.id},data:{total,refund:Number(b.refund||0)}})
   });return ok(plain(ret),{status:201});
  }
  if(action==='STOCK_COUNT_START'){
   const ref=String(b.reference||('INV-'+Date.now()));const count=await prisma.supplierStockCount.create({data:{companyId:s.companyId,warehouseId:b.warehouseId||null,reference:ref,note:b.note||null,createdById:s.id}});return ok(plain(count),{status:201});
  }
  if(action==='WAREHOUSE_STOCK_SET'){
   const warehouseId=String(b.warehouseId||''),productId=String(b.productId||'');const quantity=Math.max(0,Math.trunc(Number(b.quantity||0)));
   if(!warehouseId||!productId)return bad('Dépôt et produit requis');
   const x=await prisma.supplierWarehouseStock.upsert({where:{warehouseId_productId:{warehouseId,productId}},update:{quantity,location:b.location||undefined},create:{companyId:s.companyId,warehouseId,productId,quantity,location:b.location||null}});
   return ok(plain(x));
  }
  return bad('Action avancée inconnue');
 }catch(e:any){return bad(e.message,e.status||500)}
}
