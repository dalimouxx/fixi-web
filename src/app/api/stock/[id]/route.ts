import { prisma } from '@/lib/prisma';
import { deleteMode, deleteMessage } from '@/lib/stock-delete';
import { requireSession } from '@/lib/auth';
import { bad,ok } from '@/lib/http';
import { UserRole,StockMovementType,Prisma } from '@prisma/client';
import { audit } from '@/lib/audit';
import { plain } from '@/lib/serializers';
import { barcodeTaken, normalizeBarcode } from '@/lib/barcode';
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const s=await requireSession([UserRole.ADMIN]);const{id}=await params;const b=await req.json();
    const result=await prisma.$transaction(async tx=>{
      const exists=await tx.inventoryItem.findFirst({where:{id,shopId:s.shopId}});if(!exists)throw Object.assign(new Error('Article introuvable'),{status:404});
      if(b.supplierId){const sup=await tx.supplier.findFirst({where:{id:b.supplierId,shopId:s.shopId}});if(!sup)throw Object.assign(new Error('Fournisseur invalide'),{status:400});}
      if(b.barcode!==undefined){const taken=await barcodeTaken(tx,s.shopId,normalizeBarcode(b.barcode),id);if(taken)throw Object.assign(new Error(taken),{status:409});}
      const nextQty=b.quantity===undefined?exists.quantity:Math.trunc(Number(b.quantity));if(!Number.isFinite(nextQty)||nextQty<0)throw Object.assign(new Error('Stock invalide'),{status:400});
      const u=await tx.inventoryItem.update({where:{id},data:{active:b.active===undefined?undefined:!!b.active,name:b.name===undefined?undefined:String(b.name),sku:b.sku===undefined?undefined:String(b.sku),barcode:b.barcode===undefined?undefined:normalizeBarcode(b.barcode),category:b.category===undefined?undefined:(b.category||null),quantity:nextQty,minQuantity:b.minQuantity===undefined?undefined:Math.max(0,Math.trunc(Number(b.minQuantity))),purchasePrice:b.purchasePrice===undefined?undefined:Number(b.purchasePrice),salePrice:b.salePrice===undefined?undefined:Number(b.salePrice),supplierId:b.supplierId===undefined?undefined:(b.supplierId||null)}});
      const delta=nextQty-exists.quantity;if(delta!==0)await tx.stockMovement.create({data:{shopId:s.shopId,inventoryItemId:id,userId:s.id,type:StockMovementType.ADJUSTMENT,quantityChange:delta,quantityAfter:nextQty,unitCost:u.purchasePrice,note:'Modification article'}});
      return u;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    await audit(s.shopId,s.id,'UPDATE','STOCK',id,{quantity:result.quantity});return ok(plain(result));
  }catch(e:any){return bad(e.code==='P2002'?(String(e.meta?.target||'').includes('barcode')?'Code-barres déjà utilisé par un autre article':'Référence déjà utilisée'):e.message,e.status||500)}
}

/** Supprimer un article (jamais utilisé) ou l'archiver (déjà utilisé). Gérant uniquement. */
export async function DELETE(_req:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const s=await requireSession([UserRole.ADMIN]);const{id}=await params;
    const item=await prisma.inventoryItem.findFirst({where:{id,shopId:s.shopId},select:{id:true,name:true,_count:{select:{repairParts:true,purchaseItems:true,counterSaleLines:true,marketListings:true}}}});
    if(!item)return bad('Article introuvable',404);
    const moves=await prisma.stockMovement.count({where:{inventoryItemId:id,NOT:{note:'Stock initial'}}});
    const mode=deleteMode({...item._count,moves});
    if(mode==='DELETE'){
      try{await prisma.$transaction([prisma.stockMovement.deleteMany({where:{inventoryItemId:id}}),prisma.inventoryItem.delete({where:{id}})]);}
      catch{await prisma.inventoryItem.update({where:{id},data:{active:false}});await audit(s.shopId,s.id,'ARCHIVE','STOCK',id,{name:item.name});return ok({mode:'ARCHIVE',message:deleteMessage(item.name,'ARCHIVE')});}
    }else await prisma.inventoryItem.update({where:{id},data:{active:false}});
    await audit(s.shopId,s.id,mode,'STOCK',id,{name:item.name});
    return ok({mode,message:deleteMessage(item.name,mode)});
  }catch(e:any){return bad(e.message,e.status||500)}
}
