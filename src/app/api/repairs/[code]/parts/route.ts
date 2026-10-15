import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { UserRole,StockMovementType,Prisma } from '@prisma/client';
import { audit } from '@/lib/audit';
import { publish } from '@/lib/realtime';
import { plain } from '@/lib/serializers';
import { notifyShop } from '@/lib/notifications';

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const s = await requireSession([UserRole.ADMIN, UserRole.TECHNICIAN]);
    const { code } = await params;
    const b = await req.json();
    const qty = Math.max(1, Math.floor(Number(b.quantity || 1)));
    const item = await prisma.inventoryItem.findFirst({ where: { id: b.inventoryItemId, shopId: s.shopId, active: true } });
    if (!item) return bad('Pièce de stock introuvable', 404);
    const repair = await prisma.repair.findUnique({ where: { shopId_code: { shopId: s.shopId, code } } });
    if (!repair) return bad('Réparation introuvable', 404);
    if (s.role === UserRole.TECHNICIAN && repair.technicianId && repair.technicianId !== s.id) return bad('Accès refusé', 403);

    const result = await prisma.$transaction(async (tx) => {
      const changed = await tx.inventoryItem.updateMany({where: { id: item.id, shopId: s.shopId, quantity: { gte: qty } },data: { quantity: { decrement: qty } }});
      if (changed.count !== 1) throw Object.assign(new Error('Stock insuffisant ou modifié entre-temps'), { status: 409 });
      const updated=await tx.inventoryItem.findUniqueOrThrow({where:{id:item.id}});
      const part=await tx.repairPart.create({data: {repairId: repair.id,inventoryItemId: item.id,name: item.name,quantity: qty,unitCost: item.purchasePrice,unitPrice: b.unitPrice !== undefined ? Number(b.unitPrice) : item.salePrice}});
      await tx.stockMovement.create({data:{shopId:s.shopId,inventoryItemId:item.id,userId:s.id,type:StockMovementType.CONSUMPTION,quantityChange:-qty,quantityAfter:updated.quantity,unitCost:item.purchasePrice,reference:repair.code,note:`Utilisé sur ${repair.code}`}});
      return {part,updated};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    await audit(s.shopId, s.id, 'ADD_PART', 'REPAIR', repair.id, { itemId: item.id, qty });
    publish(s.shopId, 'stock.changed', { itemId: item.id });
    const settings=await prisma.shop.findUnique({where:{id:s.shopId},select:{lowStockNotifications:true}});
    if(settings?.lowStockNotifications&&result.updated.quantity<=result.updated.minQuantity)await notifyShop(s.shopId,'Stock faible',`${result.updated.name} : ${result.updated.quantity} restant(s)`,'/app/stock','STOCK' as any,[UserRole.ADMIN]);
    return ok(plain(result.part), { status: 201 });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
