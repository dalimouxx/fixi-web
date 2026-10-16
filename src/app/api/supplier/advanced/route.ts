import {prisma} from '@/lib/prisma';
import {requireSupplierSession,requireSupplierRole} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';
import {plain} from '@/lib/serializers';
import {notifySupplier,notifySupplierLowStock} from '@/lib/supplier-notifications';

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
  const countItems=counts.length?await prisma.supplierStockCountItem.findMany({where:{stockCountId:{in:counts.map(x=>x.id)}},orderBy:{productId:'asc'}}):[];
  if(['OWNER','ADMIN','MANAGER'].includes(s.role))return ok(plain({warehouses,warehouseStock,vendors,returns,counts,countItems,tiers,events}));
  if(s.role==='STOCK')return ok(plain({warehouses,warehouseStock,vendors,returns,counts,countItems,tiers,events:[]}));
  if(s.role==='ACCOUNTANT')return ok(plain({warehouses:[],warehouseStock:[],vendors,returns,counts:[],countItems:[],tiers:[],events:[]}));
  if(s.role==='DELIVERY_MANAGER')return ok(plain({warehouses:[],warehouseStock:[],vendors:[],returns:[],counts:[],countItems:[],tiers:[],events}));
  if(s.role==='SALES')return ok(plain({warehouses:[],warehouseStock:[],vendors:[],returns,counts:[],countItems:[],tiers,events:[]}));
  return ok(plain({warehouses:[],warehouseStock:[],vendors:[],returns:[],counts:[],countItems:[],tiers:[],events:[]}));
 }catch(e:any){return bad(e.message,e.status||500)}
}

export async function POST(req:Request){
 try{
  const s=await requireSupplierSession();const b=await req.json();const action=String(b.action||'');
  const stockActions=['WAREHOUSE','VENDOR','PRICE_TIER','RETURN','STOCK_COUNT_START','STOCK_COUNT_ITEM','STOCK_COUNT_CLOSE','WAREHOUSE_STOCK_SET','WAREHOUSE_TRANSFER'];
  const deliveryActions=['DELIVERY_EVENT'];
  if(stockActions.includes(action))await requireSupplierRole(['OWNER','ADMIN','MANAGER','STOCK','ACCOUNTANT']);
  if(deliveryActions.includes(action))await requireSupplierRole(['OWNER','ADMIN','MANAGER','DELIVERY_MANAGER']);
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
   const warehouseId=String(b.warehouseId||'')||null;
   if(warehouseId){const w=await prisma.supplierWarehouse.findFirst({where:{id:warehouseId,companyId:s.companyId,active:true}});if(!w)return bad('Dépôt invalide',404)}
   const existing=await prisma.supplierStockCount.findFirst({where:{companyId:s.companyId,warehouseId,status:'OPEN'}});
   if(existing)return bad('Un inventaire est déjà ouvert pour ce périmètre',409);
   const ref=String(b.reference||('INV-'+Date.now()));
   const products=await prisma.supplierProduct.findMany({where:{companyId:s.companyId,active:true},select:{id:true,stock:true}});
   const wh=warehouseId?await prisma.supplierWarehouseStock.findMany({where:{companyId:s.companyId,warehouseId},select:{productId:true,quantity:true}}):[];
   const whMap=new Map(wh.map(x=>[x.productId,x.quantity]));
   const count=await prisma.$transaction(async tx=>{
    const row=await tx.supplierStockCount.create({data:{companyId:s.companyId,warehouseId,reference:ref,note:b.note||null,createdById:s.id}});
    if(products.length)await tx.supplierStockCountItem.createMany({data:products.map(p=>({stockCountId:row.id,productId:p.id,expectedQty:warehouseId?(whMap.get(p.id)||0):p.stock}))});
    return row;
   });
   return ok(plain(count),{status:201});
  }
  if(action==='STOCK_COUNT_ITEM'){
   const countId=String(b.stockCountId||''),productId=String(b.productId||''),countedQty=Math.max(0,Math.trunc(Number(b.countedQty)));
   if(!countId||!productId||!Number.isFinite(countedQty))return bad('Comptage invalide');
   const count=await prisma.supplierStockCount.findFirst({where:{id:countId,companyId:s.companyId,status:'OPEN'}});if(!count)return bad('Inventaire introuvable ou clôturé',404);
   const item=await prisma.supplierStockCountItem.findFirst({where:{stockCountId:countId,productId}});if(!item)return bad('Article hors inventaire',404);
   const x=await prisma.supplierStockCountItem.update({where:{id:item.id},data:{countedQty,difference:countedQty-item.expectedQty}});
   return ok(plain(x));
  }
  if(action==='STOCK_COUNT_CLOSE'){
   const countId=String(b.stockCountId||'');const count=await prisma.supplierStockCount.findFirst({where:{id:countId,companyId:s.companyId,status:'OPEN'}});if(!count)return bad('Inventaire introuvable ou clôturé',404);
   const items=await prisma.supplierStockCountItem.findMany({where:{stockCountId:count.id}});
   const missing=items.filter(i=>i.countedQty===null);if(missing.length&&!b.force)return bad(`${missing.length} article(s) ne sont pas encore comptés`,409);
   let adjustments=0,absoluteDifference=0;
   await prisma.$transaction(async tx=>{
    for(const i of items){
     const counted=i.countedQty??i.expectedQty,diff=counted-i.expectedQty;if(!diff)continue;
     adjustments++;absoluteDifference+=Math.abs(diff);
     const p=await tx.supplierProduct.findFirst({where:{id:i.productId,companyId:s.companyId}});if(!p)continue;
     if(count.warehouseId){
      const ws=await tx.supplierWarehouseStock.findUnique({where:{warehouseId_productId:{warehouseId:count.warehouseId,productId:i.productId}}});
      await tx.supplierWarehouseStock.upsert({where:{warehouseId_productId:{warehouseId:count.warehouseId,productId:i.productId}},update:{quantity:counted},create:{companyId:s.companyId,warehouseId:count.warehouseId,productId:i.productId,quantity:counted}});
     }
     const after=Math.max(0,p.stock+diff);
     await tx.supplierProduct.update({where:{id:p.id},data:{stock:after}});
     await tx.supplierErpStockMovement.create({data:{companyId:s.companyId,productId:p.id,type:'INVENTORY_ADJUST',quantity:diff,beforeQty:p.stock,afterQty:after,reference:count.reference,note:count.warehouseId?'Inventaire dépôt':'Inventaire global',accountId:s.id}});
    }
    await tx.supplierStockCount.update({where:{id:count.id},data:{status:'CLOSED',closedAt:new Date()}});
   });
   await Promise.allSettled(items.map(i=>notifySupplierLowStock(s.companyId,i.productId)));
   if(adjustments)await notifySupplier(s.companyId,'Inventaire clôturé',`${count.reference} · ${adjustments} correction(s), écart absolu ${absoluteDifference} unité(s).`,{href:'/supplier?tab=inventory',kind:'STOCK',priority:absoluteDifference>=10?'HIGH':'NORMAL',soundKey:absoluteDifference>=10?'WARNING':'CHIME',roles:['OWNER','ADMIN','MANAGER','STOCK'],metadata:{stockCountId:count.id,reference:count.reference,adjustments,absoluteDifference}});
   return ok({ok:true,adjustments,absoluteDifference});
  }
  if(action==='WAREHOUSE_STOCK_SET'){
   const warehouseId=String(b.warehouseId||''),productId=String(b.productId||'');const quantity=Math.max(0,Math.trunc(Number(b.quantity||0)));
   if(!warehouseId||!productId)return bad('Dépôt et produit requis');
   const [w,p,current]=await Promise.all([prisma.supplierWarehouse.findFirst({where:{id:warehouseId,companyId:s.companyId,active:true}}),prisma.supplierProduct.findFirst({where:{id:productId,companyId:s.companyId}}),prisma.supplierWarehouseStock.findUnique({where:{warehouseId_productId:{warehouseId,productId}}})]);
   if(!w||!p)return bad('Dépôt ou produit invalide',404);
   const before=current?.quantity||0,diff=quantity-before,after=Math.max(0,p.stock+diff);
   const [x]=await prisma.$transaction([
    prisma.supplierWarehouseStock.upsert({where:{warehouseId_productId:{warehouseId,productId}},update:{quantity,location:b.location||undefined},create:{companyId:s.companyId,warehouseId,productId,quantity,location:b.location||null}}),
    prisma.supplierProduct.update({where:{id:p.id},data:{stock:after}}),
    prisma.supplierErpStockMovement.create({data:{companyId:s.companyId,productId:p.id,type:'WAREHOUSE_ADJUST',quantity:diff,beforeQty:p.stock,afterQty:after,reference:w.code,note:'Ajustement dépôt '+w.name,accountId:s.id}})
   ]);
   await notifySupplierLowStock(s.companyId,p.id);return ok(plain(x));
  }
  if(action==='WAREHOUSE_TRANSFER'){
   const fromId=String(b.fromWarehouseId||''),toId=String(b.toWarehouseId||''),productId=String(b.productId||''),quantity=Math.max(1,Math.trunc(Number(b.quantity||1)));
   if(!fromId||!toId||fromId===toId||!productId)return bad('Transfert invalide');
   const [from,to,p,src,dst]=await Promise.all([
    prisma.supplierWarehouse.findFirst({where:{id:fromId,companyId:s.companyId,active:true}}),
    prisma.supplierWarehouse.findFirst({where:{id:toId,companyId:s.companyId,active:true}}),
    prisma.supplierProduct.findFirst({where:{id:productId,companyId:s.companyId}}),
    prisma.supplierWarehouseStock.findUnique({where:{warehouseId_productId:{warehouseId:fromId,productId}}}),
    prisma.supplierWarehouseStock.findUnique({where:{warehouseId_productId:{warehouseId:toId,productId}}})
   ]);
   if(!from||!to||!p)return bad('Dépôt ou produit invalide',404);if(!src||src.quantity-src.reserved<quantity)return bad('Stock dépôt source insuffisant',409);
   await prisma.$transaction([
    prisma.supplierWarehouseStock.update({where:{id:src.id},data:{quantity:src.quantity-quantity}}),
    prisma.supplierWarehouseStock.upsert({where:{warehouseId_productId:{warehouseId:toId,productId}},update:{quantity:(dst?.quantity||0)+quantity},create:{companyId:s.companyId,warehouseId:toId,productId,quantity}}),
    prisma.supplierAuditEvent.create({data:{companyId:s.companyId,accountId:s.id,action:'TRANSFER',entity:'WAREHOUSE_STOCK',entityId:productId,metadata:{productId,sku:p.sku,quantity,fromWarehouseId:fromId,from:from.name,toWarehouseId:toId,to:to.name}}})
   ]);
   return ok({ok:true});
  }
  return bad('Action avancée inconnue');
 }catch(e:any){return bad(e.message,e.status||500)}
}
