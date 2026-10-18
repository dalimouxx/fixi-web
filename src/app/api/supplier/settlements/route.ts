import { prisma } from '@/lib/prisma';
import { requireSupplierRole } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';
import { plain } from '@/lib/serializers';
import { Prisma, PaymentMethod } from '@prisma/client';

export const dynamic = 'force-dynamic';
const roles = ['OWNER','ADMIN','MANAGER','ACCOUNTANT','CASHIER'] as const;
export async function GET(req: Request) {
  try {
    const s = await requireSupplierRole(roles);
    const url = new URL(req.url);
    const shopId = url.searchParams.get('shopId');
    const rows = await prisma.supplierSettlement.findMany({
      where: { companyId: s.companyId, ...(shopId ? { shopId } : {}) },
      include: { remittances: true, order: { select: { reference: true, total: true } } },
      orderBy: { createdAt: 'desc' }, take: 200,
    });
    return ok(plain(rows));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
export async function POST(req: Request) {
  try {
    const s = await requireSupplierRole(roles);
    const b = await req.json();
    if (typeof b.shopId !== 'string' || !b.shopId || typeof b.idempotencyKey !== 'string' || b.idempotencyKey.length < 12 || b.idempotencyKey.length > 128) return bad('Client ou cle de requete invalide', 400);
    if (typeof b.amount !== 'string' || !/^(?:0|[1-9]\\d{0,8})\\.\\d{3}$/.test(b.amount) || b.amount === '0.000') return bad('Montant invalide : utiliser 0.000 DT', 400);
    if (!Object.values(PaymentMethod).includes(b.method)) return bad('Mode de paiement invalide', 400);
    const amount = new Prisma.Decimal(b.amount);
    const result = await prisma.$transaction(async tx => {
      const shop = await tx.shop.findUnique({ where: { id: b.shopId }, select: { id: true } });
      if (!shop) throw Object.assign(new Error('Atelier introuvable'), { status: 404 });
      if (b.orderId) {
        const order = await tx.supplierOrder.findFirst({ where: { id: b.orderId, companyId: s.companyId, shopId: b.shopId } });
        if (!order) throw Object.assign(new Error('Commande invalide'), { status: 404 });
      }
      const existing = await tx.supplierSettlement.findUnique({ where: { idempotencyKey: b.idempotencyKey } });
      if (existing) throw Object.assign(new Error('Paiement deja enregistre'), { status: 409 });
      return tx.supplierSettlement.create({ data: {
        companyId: s.companyId, shopId: b.shopId, orderId: b.orderId || null,
        collector: 'SUPPLIER', status: 'PENDING', amount, method: b.method,
        reference: 'REG-' + crypto.randomUUID(), idempotencyKey: b.idempotencyKey,
        note: typeof b.note === 'string' ? b.note.slice(0, 500) : null,
      } });
    });
    return ok(plain(result), { status: 201 });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
