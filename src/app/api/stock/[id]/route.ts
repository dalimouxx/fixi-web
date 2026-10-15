import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad,ok } from '@/lib/http';
import { UserRole,StockMovementType,Prisma } from '@prisma/client';
import { audit } from '@/lib/audit';
import { plain } from '@/lib/serializers';
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const s=await requireSession([UserRole.ADMIN]);const{id}=await params;const b=await req.json();
    const result=await prisma.$transaction(async tx=>{
      const exists=await tx.inventoryItem.findFirst({where:{id,shopId:s.shopId}});if(!exists)throw Object.assign(new Error('Article introuvable'),{status:404});
      if(b.supplierId){const sup=await tx.supplier.findFirst({where:{id:b.supplierId,shopId:s.shopId}});if(!sup)throw Object.assign(new Error('Fournisseur invalide'),{status:400});}
      const nextQty=b.quantity===undefined?exists.quantity:Math.trunc(Number(b.quantity));if(!Number.isFinite(nextQty)||nextQty<0)throw Object.assign(new Error('Stock invalide'),{status:400});
      const u=await tx.inventoryItem.update({where:{id},data:{name:b.name===undefined?undefined:String(b.name),sku:b.sku===undefined?undefined:String(b.sku),category:b.category===undefined?undefined:(b.category||null),quantity:nextQty,minQuantity:b.minQuantity===undefined?undefined:Math.max(0,Math.trunc(Number(b.minQuantity))),purchasePrice:b.purchasePrice===undefined?undefined:Number(b.purchasePrice),salePrice:b.salePrice===undefined?undefined:Number(b.salePrice),supplierId:b.supplierId===undefined?undefined:(b.supplierId||null)}});
      const delta=nextQty-exists.quantity;if(delta!==0)await tx.stockMovement.create({data:{shopId:s.shopId,inventoryItemId:id,userId:s.id,type:StockMovementType.ADJUSTMENT,quantityChange:delta,quantityAfter:nextQty,unitCost:u.purchasePrice,note:'Modification article'}});
      return u;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    await audit(s.shopId,s.id,'UPDATE','STOCK',id,{quantity:result.quantity});return ok(plain(result));
  }catch(e:any){return bad(e.code==='P2002'?'Référence déjà utilisée':e.message,e.status||500)}
}
