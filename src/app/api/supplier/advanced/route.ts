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
  const [countItems,returnItems]=await Promise.all([
   counts.length?prisma.supplierStockCountItem.findMany({where:{stockCountId:{in:counts.map(x=>x.id)}},orderBy:{productId:'asc'}}):Promise.resolve([]),
   returns.length?prisma.supplierReturnItem.findMany({where:{returnId:{in:returns.map(x=>x.id)}}}):Promise.resolve([])
  ]);
  if(['OWNER','ADMIN','MANAGER'].includes(s.role))return ok(plain({warehouses,warehouseStock,vendors,returns,returnItems,counts,countItems,tiers,events}));
  if(s.role==='STOCK')return ok(plain({warehouses,warehouseStock,vendors,returns,returnItems,counts,countItems,tiers,events:[]}));
  if(s.role==='ACCOUNTANT')return ok(plain({warehouses:[],warehouseStock:[],vendors,returns,returnItems,counts:[],countItems:[],tiers:[],events:[]}));
  if(s.role==='DELIVERY_MANAGER')return ok(plain({warehouses:[],warehouseStock:[],vendors:[],returns:[],returnItems:[],counts:[],countItems:[],tiers:[],events}));
  if(s.role==='SALES')return ok(plain({warehouses,warehouseStock,vendors:[],returns,counts:[],countItems:[],tiers,events:[]}));
  if(s.role==='CASHIER')return ok(plain({warehouses,warehouseStock,vendors:[],returns:[],returnItems:[],counts:[],countItems:[],tiers:[],events:[]}));
  return ok(plain({warehouses:[],warehouseStock:[],vendors:[],returns:[],returnItems:[],counts:[],countItems:[],tiers:[],events:[]}));
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
   const type=String(b.type||'SALE_RETURN');
   if(type!=='SALE_RETURN')return bad('Ce flux de retour doit être lié à une vente',409);
   const sourceSaleId=String(b.sourceSaleId||'');const requested=Array.isArray(b.items)?b.items:[];
   if(!sourceSaleId||!requested.length)return bad('Vente source et articles requis');
   const sale=await prisma.supplierErpSale.findFirst({where:{id:sourceSaleId,companyId:s.companyId,status:{not:'CANCELLED'}}});
   if(!sale)return bad('Vente source introuvable',404);
   const saleItems=await prisma.supplierErpSaleItem.findMany({where:{saleId:sale.id}});
   const priorReturns=await prisma.supplierReturn.findMany({where:{companyId:s.companyId,sourceSaleId:sale.id,status:'COMPLETED'},select:{id:true}});
   const priorItems=priorReturns.length?await prisma.supplierReturnItem.findMany({where:{returnId:{in:priorReturns.map(x=>x.id)}}}):[];
   const already=new Map<string,number>();for(const x of priorItems)if(x.saleItemId)already.set(x.saleItemId,(already.get(x.saleItemId)||0)+x.quantity);
   const normalized:any[]=[];let rawTotal=0;
   for(const i of requested){
    const saleItem=saleItems.find(x=>x.id===String(i.saleItemId||''));if(!saleItem)return bad('Ligne de vente invalide',404);
    const q=Math.max(1,Math.trunc(Number(i.quantity||1))),remaining=saleItem.quantity-(already.get(saleItem.id)||0);
    if(q>remaining)return bad(`Quantité retournée supérieure au disponible pour ${saleItem.name} (max ${remaining})`,409);
    rawTotal+=Number(saleItem.unitPrice)*q;
    normalized.push({saleItem,q,reason:String(i.reason||'Retour client'),condition:String(i.condition||'BON'),restock:i.restock!==false});
   }
   const factor=Number(sale.subtotal)>0?Number(sale.total)/Number(sale.subtotal):1;
   const total=Math.round(rawTotal*factor*1000)/1000;
   const refund=Math.max(0,Math.round(Number(b.refund??total)*1000)/1000);if(refund>total+0.001)return bad('Le remboursement ne peut pas dépasser le montant de l’avoir',409);
   const refundMethod=String(b.refundMethod||'CASH').toUpperCase();
   const warehouseId=String(b.warehouseId||sale.warehouseId||'')||null;
   if(warehouseId){const w=await prisma.supplierWarehouse.findFirst({where:{id:warehouseId,companyId:s.companyId,active:true}});if(!w)return bad('Dépôt de retour invalide',404)}
   let cashSession:any=null;
   if(refund>0){
    const pm=refundMethod==='CASH'?{cashLike:true}:await prisma.supplierPaymentMethod.findFirst({where:{companyId:s.companyId,code:refundMethod,active:true}});
    if(pm?.cashLike){cashSession=await prisma.supplierErpCashSession.findFirst({where:{companyId:s.companyId,accountId:s.id,status:'OPEN'},orderBy:{openedAt:'desc'}});if(!cashSession)return bad('Ouvrez votre caisse avant un remboursement espèces',409)}
   }
   const ref=String(b.reference||('AV-'+Date.now()));
   const ret=await prisma.$transaction(async tx=>{
    // Serialize all returns for a sale before checking remaining units or refundable cash.
    // Outside checks above are only fast preflight; THESE checks protect concurrent requests.
    const locked=await tx.$queryRaw<{id:string}[]>`SELECT "id" FROM "SupplierErpSale" WHERE "id"=${sale.id} AND "companyId"=${s.companyId} FOR UPDATE`;
    if(locked.length!==1)throw Object.assign(new Error('Vente source introuvable'),{status:404});
    const currentSale=await tx.supplierErpSale.findFirst({where:{id:sale.id,companyId:s.companyId},select:{paid:true}});
    const previous=await tx.supplierReturn.findMany({where:{companyId:s.companyId,sourceSaleId:sale.id,status:'COMPLETED'},select:{id:true,refund:true}});
    const previouslyReturned=previous.length?await tx.supplierReturnItem.findMany({where:{returnId:{in:previous.map(x=>x.id)}},select:{saleItemId:true,quantity:true}}):[];
    const used=new Map<string,number>();
    for(const item of previouslyReturned)if(item.saleItemId)used.set(item.saleItemId,(used.get(item.saleItemId)||0)+item.quantity);
    for(const item of normalized){
      const left=item.saleItem.quantity-(used.get(item.saleItem.id)||0);
      if(item.q>left)throw Object.assign(new Error('Quantité déjà retournée pour '+item.saleItem.name+'. Reste : '+Math.max(0,left)),{status:409});
    }
    const refundableNow=Math.max(0,Number(currentSale?.paid||0)-previous.reduce((sum,p)=>sum+Number(p.refund),0));
    if(refund>refundableNow+0.001)throw Object.assign(new Error('Remboursement supérieur au montant réellement encaissé'),{status:409});
    const r=await tx.supplierReturn.create({data:{companyId:s.companyId,type:'SALE_RETURN',reference:ref,sourceRef:sale.reference,sourceSaleId:sale.id,warehouseId,customerId:sale.customerId,refundMethod:refund>0?refundMethod:null,status:'COMPLETED',total,refund,note:b.note||null,createdById:s.id,completedAt:new Date()}});
    for(const x of normalized){
     await tx.supplierReturnItem.create({data:{returnId:r.id,saleItemId:x.saleItem.id,productId:x.saleItem.productId,sku:x.saleItem.sku,name:x.saleItem.name,quantity:x.q,unitCost:Number(x.saleItem.unitCost),unitPrice:Number(x.saleItem.unitPrice),reason:x.reason,condition:x.condition,restock:x.restock}});
     if(x.restock&&x.saleItem.productId){
      const p=await tx.supplierProduct.findFirst({where:{id:x.saleItem.productId,companyId:s.companyId}});
      if(p){
       await tx.supplierProduct.update({where:{id:p.id},data:{stock:{increment:x.q}}});
       if(warehouseId)await tx.supplierWarehouseStock.upsert({where:{warehouseId_productId:{warehouseId,productId:p.id}},update:{quantity:{increment:x.q}},create:{companyId:s.companyId,warehouseId,productId:p.id,quantity:x.q}});
       await tx.supplierErpStockMovement.create({data:{companyId:s.companyId,productId:p.id,type:'SALE_RETURN',quantity:x.q,beforeQty:p.stock,afterQty:p.stock+x.q,unitCost:x.saleItem.unitCost,reference:ref,note:'Avoir '+sale.reference,accountId:s.id}});
      }
     }
    }
    if(refund>0)await tx.supplierErpPayment.create({data:{companyId:s.companyId,customerId:sale.customerId,saleId:sale.id,cashSessionId:cashSession?.id||null,kind:'OUT',method:refundMethod,amount:refund,reference:ref,note:'Remboursement avoir '+sale.reference,accountId:s.id}});
    await tx.supplierAuditEvent.create({data:{companyId:s.companyId,accountId:s.id,action:'RETURN',entity:'SALE',entityId:sale.id,metadata:{returnId:r.id,reference:ref,total,refund,warehouseId}}});
    return r;
   });
   await Promise.allSettled(normalized.filter(x=>x.saleItem.productId).map(x=>notifySupplierLowStock(s.companyId,x.saleItem.productId)));
   await notifySupplier(s.companyId,'Avoir client créé',`${ref} sur ${sale.reference} · ${total.toFixed(3)} DT${refund>0?' · remboursé '+refund.toFixed(3)+' DT':''}`,{href:'/supplier?tab=returns',kind:'PAYMENT',soundKey:refund>0?'SUCCESS':'CHIME',roles:['OWNER','ADMIN','MANAGER','ACCOUNTANT','SALES'],metadata:{returnId:ret.id,saleId:sale.id,reference:ref,total,refund}});
   return ok(plain(ret),{status:201});
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
     let globalDiff=diff;
     if(count.warehouseId){
      const allocated=await tx.supplierWarehouseStock.aggregate({where:{companyId:s.companyId,productId:i.productId},_sum:{quantity:true}});
      const allocatedTotal=Number(allocated._sum.quantity||0),unallocated=Math.max(0,p.stock-allocatedTotal);
      globalDiff=diff>0?Math.max(0,diff-unallocated):diff;
      await tx.supplierWarehouseStock.upsert({where:{warehouseId_productId:{warehouseId:count.warehouseId,productId:i.productId}},update:{quantity:counted},create:{companyId:s.companyId,warehouseId:count.warehouseId,productId:i.productId,quantity:counted}});
     }
     const after=Math.max(0,p.stock+globalDiff);
     await tx.supplierProduct.update({where:{id:p.id},data:{stock:after}});
     await tx.supplierErpStockMovement.create({data:{companyId:s.companyId,productId:p.id,type:'INVENTORY_ADJUST',quantity:globalDiff,beforeQty:p.stock,afterQty:after,reference:count.reference,note:count.warehouseId?'Inventaire dépôt · écart physique '+diff:'Inventaire global',accountId:s.id}});
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
   const before=current?.quantity||0,diff=quantity-before;
   const allocated=await prisma.supplierWarehouseStock.aggregate({where:{companyId:s.companyId,productId},_sum:{quantity:true}});
   const allocatedTotal=Number(allocated._sum.quantity||0),unallocated=Math.max(0,p.stock-allocatedTotal);
   const globalDiff=diff>0?Math.max(0,diff-unallocated):diff,after=Math.max(0,p.stock+globalDiff);
   const [x]=await prisma.$transaction([
    prisma.supplierWarehouseStock.upsert({where:{warehouseId_productId:{warehouseId,productId}},update:{quantity,location:b.location||undefined},create:{companyId:s.companyId,warehouseId,productId,quantity,location:b.location||null}}),
    prisma.supplierProduct.update({where:{id:p.id},data:{stock:after}}),
    prisma.supplierErpStockMovement.create({data:{companyId:s.companyId,productId:p.id,type:'WAREHOUSE_ADJUST',quantity:globalDiff,beforeQty:p.stock,afterQty:after,reference:w.code,note:'Dépôt '+w.name+' · variation dépôt '+diff,accountId:s.id}})
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
