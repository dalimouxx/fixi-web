import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { paymentSchema } from '@/lib/validators';
import { UserRole, PaymentKind, Prisma, CashSessionStatus, PaymentMethod, DocumentType, DocumentStatus } from '@prisma/client';
import { audit } from '@/lib/audit';
import { publish } from '@/lib/realtime';
import { plain } from '@/lib/serializers';
import { notifyShop } from '@/lib/notifications';

export async function GET() {
  try {const s = await requireSession([UserRole.ADMIN, UserRole.CASHIER]);const start = new Date(); start.setHours(0, 0, 0, 0);const rows = await prisma.payment.findMany({ where: { shopId: s.shopId, createdAt: { gte: start } }, include: { repair: { include: { client: true } }, user: { select: { fullName: true } },cashSession:true }, orderBy: { createdAt: 'desc' } });return ok(plain(rows));} catch (e: any) { return bad(e.message, e.status || 500); }
}

export async function POST(req: Request) {
  try {
    const s = await requireSession([UserRole.ADMIN, UserRole.CASHIER]);
    const b = paymentSchema.parse(await req.json());
    const result = await prisma.$transaction(async (tx) => {
      const r = await tx.repair.findFirst({ where: { id: b.repairId, shopId: s.shopId }, include: { payments: true,client:true } });
      if (!r) throw Object.assign(new Error('Réparation introuvable'), { status: 404 });
      if (r.finalPrice === null) throw Object.assign(new Error('Définissez le prix final avant le paiement'), { status: 409 });
      const shop=await tx.shop.findUniqueOrThrow({where:{id:s.shopId}});
      const session=await tx.cashSession.findFirst({where:{shopId:s.shopId,status:CashSessionStatus.OPEN},orderBy:{openedAt:'desc'}});
      if(shop.cashRequireSession&&b.method===PaymentMethod.CASH&&!session)throw Object.assign(new Error('Ouvrez une session de caisse avant un paiement en espèces'),{status:409});
      const paid = r.payments.reduce((a, p) => a + (p.kind === PaymentKind.PAYMENT ? Number(p.amount) : -Number(p.amount)), 0);
      const balance = Math.max(0, Number(r.finalPrice) - Number(r.discountAmount||0) - paid);
      if (balance <= 0.0001) throw Object.assign(new Error('Cette réparation est déjà réglée'), { status: 409 });
      if (b.amount - balance > 0.0001) throw Object.assign(new Error(`Le montant appliqué dépasse le solde (${balance.toFixed(3)})`), { status: 409 });
      if (b.method === 'CASH' && Number(b.receivedAmount || 0) + 0.0001 < b.amount) throw Object.assign(new Error('Le montant reçu est inférieur au montant encaissé'), { status: 409 });
      const received = b.method === 'CASH' ? Number(b.receivedAmount || b.amount) : b.amount;
      const change = Math.max(0, received - b.amount);
      const p = await tx.payment.create({ data: { shopId: s.shopId, repairId: r.id, userId: s.id,cashSessionId:session?.id||null, method: b.method, amount: b.amount, receivedAmount: received, changeAmount: change, note: b.note || null } });
      const balanceAfter=Math.max(0,balance-b.amount);
      await tx.salesDocument.updateMany({where:{shopId:s.shopId,repairId:r.id,type:DocumentType.INVOICE,status:{not:DocumentStatus.CANCELLED}},data:{status:balanceAfter<=0.0001?DocumentStatus.PAID:DocumentStatus.PARTIALLY_PAID}});
      return { payment: p, repairId: r.id,repairCode:r.code,clientName:r.client.fullName, balanceAfter };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await audit(s.shopId, s.id, 'PAYMENT', 'REPAIR', result.repairId, { amount: b.amount, method: b.method });
    if(result.balanceAfter<=0.0001)await notifyShop(s.shopId,'Réparation réglée',`${result.repairCode} · ${result.clientName}` ,`/app/repairs/${result.repairCode}`,'PAYMENT' as any,[UserRole.ADMIN,UserRole.RECEPTION]);
    publish(s.shopId, 'payment.created', { repairId: result.repairId });
    return ok(plain({ ...result.payment, balanceAfter: result.balanceAfter }), { status: 201 });
  } catch (e: any) {
    if (e?.issues) return bad('Paiement invalide', 400, e.issues);
    if (e?.code === 'P2034') return bad('Paiement concurrent détecté. Réessayez.', 409);
    return bad(e.message, e.status || 500);
  }
}
