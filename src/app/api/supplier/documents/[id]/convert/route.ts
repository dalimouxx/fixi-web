import {prisma} from '@/lib/prisma';
import {requireSupplierRole} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';
import {plain} from '@/lib/serializers';
import {nextSupplierReference} from '@/lib/supplier-sequences';
import {notifySupplierLowStock} from '@/lib/supplier-notifications';

const money=(v:any)=>Math.round(Number(v||0)*1000)/1000;

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER','SALES','ACCOUNTANT','STOCK']);
  const{id}=await params;const b=await req.json(),target=String(b.target||'');
  const doc=await prisma.supplierCommercialDocument.findFirst({where:{id,companyId:s.companyId}});
  if(!doc)return bad('Document introuvable',404);
  if(['CANCELLED','CONVERTED'].includes(doc.status))return bad('Ce document ne peut plus être converti',409);
  const items=await prisma.supplierCommercialDocumentItem.findMany({where:{documentId:id}});
  if(!items.length)return bad('Document sans lignes',409);
  const company=await prisma.supplierCompany.findUnique({where:{id:s.companyId},select:{invoicePrefix:true,purchasePrefix:true,receiptPrefix:true,currency:true}});

  if(['PROFORMA','DELIVERY_NOTE','RECEIPT'].includes(target)){
   const allowed:Record<string,string[]>={
    PROFORMA:['QUOTE'],
    DELIVERY_NOTE:['QUOTE','PROFORMA'],
    RECEIPT:['QUOTE','PROFORMA']
   };
   if(!allowed[target]?.includes(doc.type))return bad('Conversion non autorisée',409);
   const reference=await nextSupplierReference(s.companyId,target,target==='RECEIPT'?company?.receiptPrefix||undefined:undefined);
   const created=await prisma.$transaction(async tx=>{
    const d=await tx.supplierCommercialDocument.create({data:{
     companyId:s.companyId,type:target,reference,status:'ISSUED',customerId:doc.customerId,sourceSaleId:doc.sourceSaleId,sourceOrderId:doc.sourceOrderId,warehouseId:doc.warehouseId,
     partyName:doc.partyName,partyPhone:doc.partyPhone,partyAddress:doc.partyAddress,partyTaxId:doc.partyTaxId,currency:doc.currency,
     subtotal:doc.subtotal,discount:doc.discount,tax:doc.tax,total:doc.total,note:`Converti depuis ${doc.reference}${doc.note?' · '+doc.note:''}`,createdById:s.id
    }});
    await tx.supplierCommercialDocumentItem.createMany({data:items.map(i=>({documentId:d.id,productId:i.productId,sku:i.sku,name:i.name,quantity:i.quantity,unitPrice:i.unitPrice,discount:i.discount,taxRate:i.taxRate}))});
    await tx.supplierCommercialDocument.update({where:{id:doc.id},data:{status:'CONVERTED'}});
    await tx.supplierAuditEvent.create({data:{companyId:s.companyId,accountId:s.id,action:'CONVERT',entity:'COMMERCIAL_DOCUMENT',entityId:doc.id,metadata:{from:doc.type,to:target,targetId:d.id,reference:d.reference}}});
    return d;
   });
   return ok(plain({kind:'DOCUMENT',document:created}));
  }

  if(target==='SALE'){
   if(!['QUOTE','PROFORMA'].includes(doc.type))return bad('Seuls un devis ou une proforma peuvent devenir une vente',409);
   if(!doc.customerId)return bad('Associez ce document à un client avant de le convertir en vente',409);
   if(items.some(i=>!i.productId))return bad('Toutes les lignes doivent être liées à un produit pour créer la vente',409);
   const ids=items.map(i=>i.productId!).filter(Boolean);
   const [products,warehouseRows]=await Promise.all([
    prisma.supplierProduct.findMany({where:{companyId:s.companyId,id:{in:ids},active:true}}),
    prisma.supplierWarehouseStock.findMany({where:{companyId:s.companyId,productId:{in:ids}},orderBy:{updatedAt:'asc'}})
   ]);
   if(products.length!==new Set(ids).size)return bad('Un produit du document n’est plus disponible',409);
   const normalized:any[]=[];
   for(const i of items){
    const p=products.find(x=>x.id===i.productId)!;
    const rows=warehouseRows.filter(x=>x.productId===p.id),selected=doc.warehouseId?rows.find(x=>x.warehouseId===doc.warehouseId):null;
    const available=doc.warehouseId?Number(selected?.quantity||0)-Number(selected?.reserved||0):p.stock-p.reservedStock;
    if(available<i.quantity)return bad(`Stock insuffisant pour ${p.name}`,409);
    const allocated=rows.reduce((a,x)=>a+Number(x.quantity||0),0),unallocated=Math.max(0,p.stock-allocated),warehouseConsumption=doc.warehouseId?0:Math.max(0,i.quantity-unallocated);
    if(!doc.warehouseId&&rows.reduce((a,x)=>a+Math.max(0,x.quantity-x.reserved),0)<warehouseConsumption)return bad(`Répartition dépôt incohérente pour ${p.name}`,409);
    normalized.push({item:i,p,rows,selected,warehouseConsumption});
   }
   const reference=await nextSupplierReference(s.companyId,'SALE',company?.invoicePrefix||undefined);
   const sale=await prisma.$transaction(async tx=>{
    const sale=await tx.supplierErpSale.create({data:{
     companyId:s.companyId,customerId:doc.customerId,warehouseId:doc.warehouseId,reference,status:'CREDIT',subtotal:doc.subtotal,discount:doc.discount,tax:doc.tax,total:doc.total,paid:0,note:`Converti depuis ${doc.reference}`,createdById:s.id
    }});
    for(const x of normalized){
     await tx.supplierErpSaleItem.create({data:{saleId:sale.id,productId:x.p.id,sku:x.p.sku,name:x.item.name,quantity:x.item.quantity,unitCost:Number(x.p.averageCost||x.p.purchasePrice||0),unitPrice:x.item.unitPrice,discount:x.item.discount}});
     const before=x.p.stock,after=before-x.item.quantity;
     await tx.supplierProduct.update({where:{id:x.p.id},data:{stock:after}});
     if(doc.warehouseId&&x.selected)await tx.supplierWarehouseStock.update({where:{id:x.selected.id},data:{quantity:{decrement:x.item.quantity}}});
     if(!doc.warehouseId&&x.warehouseConsumption>0){let remaining=x.warehouseConsumption;for(const row of x.rows){if(remaining<=0)break;const take=Math.min(remaining,Math.max(0,row.quantity-row.reserved));if(take){await tx.supplierWarehouseStock.update({where:{id:row.id},data:{quantity:{decrement:take}}});remaining-=take}}}
     await tx.supplierErpStockMovement.create({data:{companyId:s.companyId,productId:x.p.id,type:'SALE',quantity:-x.item.quantity,beforeQty:before,afterQty:after,unitCost:x.p.averageCost||x.p.purchasePrice,reference,accountId:s.id,note:'Conversion '+doc.reference}});
    }
    await tx.supplierCommercialDocument.update({where:{id:doc.id},data:{status:'CONVERTED',sourceSaleId:sale.id}});
    await tx.supplierAuditEvent.create({data:{companyId:s.companyId,accountId:s.id,action:'CONVERT',entity:'COMMERCIAL_DOCUMENT',entityId:doc.id,metadata:{from:doc.type,to:'SALE',saleId:sale.id,reference}}});
    return sale;
   });
   await Promise.allSettled(normalized.map(x=>notifySupplierLowStock(s.companyId,x.p.id)));
   return ok(plain({kind:'SALE',sale}));
  }

  if(target==='PURCHASE'){
   if(doc.type!=='PURCHASE_ORDER')return bad('Seul un bon de commande peut être réceptionné en achat',409);
   if(items.some(i=>!i.productId))return bad('Toutes les lignes doivent être liées à un produit',409);
   const ids=items.map(i=>i.productId!).filter(Boolean),products=await prisma.supplierProduct.findMany({where:{companyId:s.companyId,id:{in:ids}}});
   if(products.length!==new Set(ids).size)return bad('Produit introuvable',404);
   if(doc.warehouseId){const w=await prisma.supplierWarehouse.findFirst({where:{id:doc.warehouseId,companyId:s.companyId,active:true}});if(!w)return bad('Dépôt destination invalide',404)}
   const reference=await nextSupplierReference(s.companyId,'PURCHASE',company?.purchasePrefix||undefined);
   const purchase=await prisma.$transaction(async tx=>{
    const p=await tx.supplierErpPurchase.create({data:{companyId:s.companyId,warehouseId:doc.warehouseId,vendorName:doc.partyName||'Fournisseur',reference,status:'RECEIVED',total:doc.total,paid:0,note:`Réception depuis ${doc.reference}`,receivedAt:new Date()}});
    for(const i of items){
     const product=products.find(x=>x.id===i.productId)!;const unitCost=Number(i.unitPrice),before=product.stock,after=before+i.quantity;
     await tx.supplierErpPurchaseItem.create({data:{purchaseId:p.id,productId:product.id,sku:product.sku,name:i.name,quantity:i.quantity,unitCost}});
     const oldValue=Number(product.averageCost||product.purchasePrice||0)*Math.max(0,before),avg=after?money((oldValue+unitCost*i.quantity)/after):unitCost;
     await tx.supplierProduct.update({where:{id:product.id},data:{stock:after,purchasePrice:unitCost,averageCost:avg}});
     if(doc.warehouseId)await tx.supplierWarehouseStock.upsert({where:{warehouseId_productId:{warehouseId:doc.warehouseId,productId:product.id}},update:{quantity:{increment:i.quantity}},create:{companyId:s.companyId,warehouseId:doc.warehouseId,productId:product.id,quantity:i.quantity}});
     await tx.supplierErpStockMovement.create({data:{companyId:s.companyId,productId:product.id,type:'PURCHASE',quantity:i.quantity,beforeQty:before,afterQty:after,unitCost,reference,accountId:s.id,note:'Réception '+doc.reference}});
    }
    await tx.supplierCommercialDocument.update({where:{id:doc.id},data:{status:'CONVERTED'}});
    await tx.supplierAuditEvent.create({data:{companyId:s.companyId,accountId:s.id,action:'CONVERT',entity:'COMMERCIAL_DOCUMENT',entityId:doc.id,metadata:{from:'PURCHASE_ORDER',to:'PURCHASE',purchaseId:p.id,reference}}});
    return p;
   });
   return ok(plain({kind:'PURCHASE',purchase}));
  }

  return bad('Conversion inconnue');
 }catch(e:any){return bad(e.message,e.status||500)}
}
