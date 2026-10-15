import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { UserRole, PaymentKind, PaymentMethod, CashSessionStatus, Prisma, DocumentType, DocumentStatus } from '@prisma/client';
import { audit } from '@/lib/audit';
import { publish } from '@/lib/realtime';
import { plain } from '@/lib/serializers';

export async function POST(req: Request) {
  try {
    const s = await requireSession([UserRole.ADMIN]);
    const b = await req.json();
    const amount = Number(b.amount);
    if (!Number.isFinite(amount) || amount <= 0) return bad('Montant invalide');
    const method = Object.values(PaymentMethod).includes(b.method as PaymentMethod) ? b.method as PaymentMethod : PaymentMethod.CASH;
    const result = await prisma.$transaction(async tx => {
      const repair = await tx.repair.findFirst({ where: { id: b.repairId, shopId: s.shopId }, include: { payments: true } });
      if (!repair) throw Object.assign(new Error('Réparation introuvable'), { status: 404 });
      const netPaid = repair.payments.reduce((a, p) => a + (p.kind === PaymentKind.PAYMENT ? Number(p.amount) : -Number(p.amount)), 0);
      if (amount - netPaid > 0.0001) throw Object.assign(new Error(`Remboursement supérieur au montant net encaissé (${netPaid.toFixed(3)})`), { status: 409 });
      const session=await tx.cashSession.findFirst({where:{shopId:s.shopId,status:CashSessionStatus.OPEN},orderBy:{openedAt:'desc'}});
      const refund = await tx.payment.create({ data: { shopId: s.shopId, repairId: repair.id, userId: s.id,cashSessionId:session?.id||null, kind: PaymentKind.REFUND, method, amount, note: b.note || 'Remboursement' } });
      const paidAfter=Math.max(0,netPaid-amount);
      const total=Math.max(0,Number(repair.finalPrice||0)-Number(repair.discountAmount||0));
      if(total>0){
        const status=paidAfter<=0.0001?DocumentStatus.SENT:paidAfter+0.0001<total?DocumentStatus.PARTIALLY_PAID:DocumentStatus.PAID;
        await tx.salesDocument.updateMany({where:{shopId:s.shopId,repairId:repair.id,type:DocumentType.INVOICE,status:{not:DocumentStatus.CANCELLED}},data:{status}});
      }
      return {refund,repairId:repair.id};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    await audit(s.shopId, s.id, 'REFUND', 'REPAIR', result.repairId, { amount, method });
    publish(s.shopId, 'payment.refund', { repairId: result.repairId });
    return ok(plain(result.refund), { status: 201 });
  } catch (e: any) {
    if(e?.code==='P2034')return bad('Opération concurrente détectée. Réessayez.',409);
    return bad(e.message, e.status || 500);
  }
}
