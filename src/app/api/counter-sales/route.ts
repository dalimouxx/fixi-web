import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { CashSessionStatus, PaymentMethod, Prisma, StockMovementType, UserRole } from '@prisma/client';
import { audit } from '@/lib/audit';
import { publish } from '@/lib/realtime';
import { plain } from '@/lib/serializers';
import { normalizeBarcode } from '@/lib/barcode';
import { checkSplits, maxDiscountFor, priceSale, round3, saleNumber } from '@/lib/counter-sale';

const methods = new Set<string>(Object.values(PaymentMethod));
const err = (message: string, status = 400) => Object.assign(new Error(message), { status });

/** Articles vendables au comptoir et ventes du jour. */
export async function GET(req: Request) {
  try {
    const s = await requireSession([UserRole.ADMIN, UserRole.CASHIER]);
    const q = (new URL(req.url).searchParams.get('q') || '').trim();
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const where: Prisma.InventoryItemWhereInput = { shopId: s.shopId, active: true, salePrice: { gt: 0 } };
    if (q) where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { sku: { contains: q, mode: 'insensitive' } }, { barcode: { equals: normalizeBarcode(q) || '', mode: 'insensitive' } }, { category: { contains: q, mode: 'insensitive' } }];
    const [items, sales, shop, session] = await Promise.all([
      prisma.inventoryItem.findMany({ where, select: { id: true, sku: true, barcode: true, name: true, category: true, quantity: true, minQuantity: true, salePrice: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }], take: 120 }),
      prisma.counterSale.findMany({ where: { shopId: s.shopId, createdAt: { gte: start } }, include: { lines: { select: { name: true, quantity: true } }, payments: { select: { method: true, amount: true } }, client: { select: { fullName: true } }, user: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' }, take: 30 }),
      prisma.shop.findUniqueOrThrow({ where: { id: s.shopId }, select: { currency: true, cashierMaxDiscount: true, cashRequireSession: true } }),
      prisma.cashSession.findFirst({ where: { shopId: s.shopId, status: CashSessionStatus.OPEN }, select: { id: true } }),
    ]);
    return ok(plain({ items, sales, shop, role: s.role, sessionOpen: Boolean(session), todayTotal: sales.reduce((a, x) => a + Number(x.total), 0) }));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

/** Encaisse une vente d'accessoires : stock décrémenté, paiements rattachés à la session de caisse. */
export async function POST(req: Request) {
  try {
    const s = await requireSession([UserRole.ADMIN, UserRole.CASHIER]);
    const b = await req.json();
    const result = await prisma.$transaction(async tx => {
      const shop = await tx.shop.findUniqueOrThrow({ where: { id: s.shopId }, select: { currency: true, cashierMaxDiscount: true, cashRequireSession: true } });
      const ids = (Array.isArray(b.lines) ? b.lines : []).map((l: any) => String(l?.itemId || '')).filter(Boolean);
      const items = await tx.inventoryItem.findMany({ where: { shopId: s.shopId, id: { in: ids } } });
      let priced;
      try { priced = priceSale(b.lines, items.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, salePrice: Number(i.salePrice), purchasePrice: Number(i.purchasePrice), active: i.active })), Number(b.discount) || 0); }
      catch (e: any) { throw err(e.message, 409); }
      const cap = maxDiscountFor(s.role, Number(shop.cashierMaxDiscount || 0), priced.subtotal);
      if (priced.discount - cap > 0.0001) throw err(`Remise maximale autorisée : ${cap.toFixed(3)} ${shop.currency}`, 403);
      let paid: number;
      try { paid = checkSplits(b.splits, priced.total, methods); } catch (e: any) { throw err(e.message, 409); }
      const session = await tx.cashSession.findFirst({ where: { shopId: s.shopId, status: CashSessionStatus.OPEN }, orderBy: { openedAt: 'desc' } });
      if (shop.cashRequireSession && b.splits.some((x: any) => x.method === PaymentMethod.CASH) && !session) throw err('Ouvrez la caisse avant une vente en espèces', 409);

      // Client facultatif : retrouvé ou créé par son téléphone.
      let clientId: string | null = null;
      const phone = String(b.client?.phone || '').replace(/[^\d+]/g, '').slice(0, 20);
      if (phone.length >= 8) {
        const name = String(b.client?.fullName || '').trim().slice(0, 120) || 'Client comptoir';
        const c = await tx.client.upsert({ where: { shopId_phone: { shopId: s.shopId, phone } }, update: {}, create: { shopId: s.shopId, phone, fullName: name } });
        clientId = c.id;
      }

      const count = await tx.counterSale.count({ where: { shopId: s.shopId } });
      const number = saleNumber(count + 1);
      const sale = await tx.counterSale.create({ data: {
        shopId: s.shopId, number, clientId, userId: s.id, subtotal: priced.subtotal, discount: priced.discount, total: priced.total,
        note: String(b.note || '').slice(0, 300) || null,
        lines: { create: priced.lines.map(l => ({ inventoryItemId: l.itemId, name: l.name, quantity: l.quantity, unitCost: l.unitCost, unitPrice: l.unitPrice, total: l.total })) },
      } });
      for (const l of priced.lines) {
        // Garde-fou concurrent : on ne décrémente que si le stock suffit encore.
        const upd = await tx.inventoryItem.updateMany({ where: { id: l.itemId, shopId: s.shopId, quantity: { gte: l.quantity } }, data: { quantity: { decrement: l.quantity } } });
        if (upd.count !== 1) throw err(`Stock insuffisant : ${l.name}`, 409);
        const after = await tx.inventoryItem.findUniqueOrThrow({ where: { id: l.itemId }, select: { quantity: true } });
        await tx.stockMovement.create({ data: { shopId: s.shopId, inventoryItemId: l.itemId, userId: s.id, type: StockMovementType.SALE, quantityChange: -l.quantity, quantityAfter: after.quantity, unitCost: l.unitCost, reference: number, note: 'Vente comptoir' } });
      }
      const payments = [] as any[];
      for (const x of b.splits) {
        const amount = round3(Number(x.amount));
        const received = x.method === PaymentMethod.CASH ? round3(Number(x.receivedAmount ?? amount)) : amount;
        payments.push(await tx.payment.create({ data: { shopId: s.shopId, counterSaleId: sale.id, userId: s.id, cashSessionId: session?.id || null, method: x.method as PaymentMethod, amount, receivedAmount: received, changeAmount: Math.max(0, round3(received - amount)), note: `Vente comptoir ${number}` } }));
      }
      return { id: sale.id, number, total: priced.total, discount: priced.discount, paid, change: round3(payments.reduce((a, p) => a + Number(p.changeAmount || 0), 0)), lines: priced.lines };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await audit(s.shopId, s.id, 'COUNTER_SALE', 'COUNTER_SALE', result.id, { number: result.number, total: result.total, discount: result.discount, lines: result.lines.map(l => ({ name: l.name, quantity: l.quantity })) });
    publish(s.shopId, 'payment.created', { counterSaleId: result.id });
    publish(s.shopId, 'stock.changed', { reference: result.number });
    return ok(plain(result), { status: 201 });
  } catch (e: any) {
    if (e?.code === 'P2034' || e?.code === 'P2002') return bad('Opération concurrente détectée. Réessayez.', 409);
    return bad(e.message, e.status || 500);
  }
}
