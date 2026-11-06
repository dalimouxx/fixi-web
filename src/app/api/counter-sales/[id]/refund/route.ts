import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { CashSessionStatus, PaymentKind, PaymentMethod, Prisma, StockMovementType, UserRole } from '@prisma/client';
import { audit } from '@/lib/audit';
import { publish } from '@/lib/realtime';
import { plain } from '@/lib/serializers';
import { priceRefund, round3 } from '@/lib/counter-sale';

const err = (message: string, status = 400) => Object.assign(new Error(message), { status });

/**
 * Remboursement (total ou partiel) d'une vente comptoir.
 * Gérant : direct. Caissier : avec le code PIN d'un gérant.
 * Les articles rendus en bon état reviennent en stock ; un article défectueux peut rester hors stock.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireSession([UserRole.ADMIN, UserRole.CASHIER]);
    const { id } = await params;
    const b = await req.json();
    const reason = String(b.reason || '').trim().slice(0, 250);
    if (reason.length < 3) return bad('Indiquez le motif du remboursement');
    let approvedBy = s.role === UserRole.ADMIN ? s.fullName : '';
    if (!approvedBy) {
      const pin = String(b.managerPin || '');
      if (!/^\d{6}$/.test(pin)) return bad('Code du gérant requis pour un remboursement', 403);
      const managers = await prisma.user.findMany({ where: { shopId: s.shopId, role: UserRole.ADMIN, isActive: true }, select: { fullName: true, pinHash: true } });
      for (const m of managers) if (await bcrypt.compare(pin, m.pinHash)) { approvedBy = m.fullName; break; }
      if (!approvedBy) return bad('Code gérant invalide', 403);
    }
    const result = await prisma.$transaction(async tx => {
      const sale = await tx.counterSale.findFirst({ where: { shopId: s.shopId, OR: [{ id }, { number: id }] }, include: { lines: true, payments: true } });
      if (!sale) throw err('Vente introuvable', 404);
      let priced;
      try {
        priced = priceRefund(
          { subtotal: Number(sale.subtotal), total: Number(sale.total), refundedTotal: Number(sale.refundedTotal) },
          sale.lines.map(l => ({ id: l.id, name: l.name, quantity: l.quantity, returnedQuantity: l.returnedQuantity, unitPrice: Number(l.unitPrice) })),
          b.lines,
        );
      } catch (e: any) { throw err(e.message, 409); }
      const firstMethod = sale.payments.find(p => p.kind === PaymentKind.PAYMENT)?.method || PaymentMethod.CASH;
      const method = Object.values(PaymentMethod).includes(b.method) ? b.method as PaymentMethod : firstMethod;
      const shop = await tx.shop.findUniqueOrThrow({ where: { id: s.shopId }, select: { cashRequireSession: true } });
      const session = await tx.cashSession.findFirst({ where: { shopId: s.shopId, status: CashSessionStatus.OPEN }, orderBy: { openedAt: 'desc' } });
      if (method === PaymentMethod.CASH && shop.cashRequireSession && !session) throw err('Ouvrez la caisse avant de rendre des espèces', 409);

      for (const l of priced.lines) {
        const line = sale.lines.find(x => x.id === l.lineId)!;
        // Garde-fou concurrent : jamais plus que la quantité vendue.
        const upd = await tx.counterSaleLine.updateMany({ where: { id: line.id, returnedQuantity: { lte: line.quantity - l.quantity } }, data: { returnedQuantity: { increment: l.quantity } } });
        if (upd.count !== 1) throw err(`${l.name} : déjà remboursé entre-temps`, 409);
        if (l.restock && line.inventoryItemId) {
          const item = await tx.inventoryItem.update({ where: { id: line.inventoryItemId }, data: { quantity: { increment: l.quantity } } });
          await tx.stockMovement.create({ data: { shopId: s.shopId, inventoryItemId: item.id, userId: s.id, type: StockMovementType.RETURN, quantityChange: l.quantity, quantityAfter: item.quantity, unitCost: line.unitCost, reference: sale.number, note: `Retour client · ${reason}` } });
        }
      }
      const updated = await tx.counterSale.updateMany({ where: { id: sale.id, refundedTotal: { lte: round3(Number(sale.total) - priced.amount) } }, data: { refundedTotal: { increment: priced.amount } } });
      if (updated.count !== 1) throw err('Remboursement supérieur au montant encaissé', 409);
      const refund = await tx.payment.create({ data: {
        shopId: s.shopId, counterSaleId: sale.id, userId: s.id, cashSessionId: session?.id || null, kind: PaymentKind.REFUND, method, amount: priced.amount,
        note: `Remboursement ${sale.number} · ${reason}${approvedBy !== s.fullName ? ` · validé par ${approvedBy}` : ''}`.slice(0, 300),
      } });
      return { saleId: sale.id, number: sale.number, refund, amount: priced.amount, remaining: priced.remaining, lines: priced.lines, method, approvedBy };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await audit(s.shopId, s.id, 'REFUND', 'COUNTER_SALE', result.saleId, { number: result.number, amount: result.amount, method: result.method, reason, approvedBy: result.approvedBy, lines: result.lines.map(l => ({ name: l.name, quantity: l.quantity, restock: l.restock })) });
    publish(s.shopId, 'payment.refund', { counterSaleId: result.saleId });
    if (result.lines.some(l => l.restock)) publish(s.shopId, 'stock.changed', { reference: result.number });
    return ok(plain(result), { status: 201 });
  } catch (e: any) {
    if (e?.code === 'P2034') return bad('Opération concurrente détectée. Réessayez.', 409);
    return bad(e.message, e.status || 500);
  }
}
