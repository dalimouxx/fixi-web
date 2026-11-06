import { CashSessionStatus, PaymentMethod, Prisma, UserRole, UsedDeviceStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { audit } from '@/lib/audit';
import { publish } from '@/lib/realtime';
import { plain } from '@/lib/serializers';
import { saleNumber } from '@/lib/counter-sale';
import { deviceTitle, conditionLabel } from '@/lib/used-devices';

/**
 * Revente : passe par la vente comptoir (ticket V-…, paiement dans la caisse du jour, rapports),
 * avec l'IMEI et la garantie sur le ticket. Le coût d'achat sert au calcul de la marge.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireSession([UserRole.ADMIN, UserRole.RECEPTION, UserRole.CASHIER]);
    const { id } = await params; const b = await req.json();
    const price = Math.round(Number(b.price) * 1000) / 1000;
    if (!(price > 0)) return bad('Prix de vente invalide');
    const method = Object.values(PaymentMethod).includes(b.method) ? b.method as PaymentMethod : PaymentMethod.CASH;
    const received = method === PaymentMethod.CASH ? Number(b.receivedAmount ?? price) : price;
    if (method === PaymentMethod.CASH && received + 0.0001 < price) return bad('Montant reçu inférieur au prix');
    const warrantyDays = Math.max(0, Math.min(365, Math.trunc(Number(b.warrantyDays ?? 0))));
    const result = await prisma.$transaction(async tx => {
      const d = await tx.usedDevice.findFirst({ where: { id, shopId: s.shopId } });
      if (!d) throw Object.assign(new Error('Appareil introuvable'), { status: 404 });
      if (d.status === UsedDeviceStatus.SOLD) throw Object.assign(new Error('Appareil déjà vendu'), { status: 409 });
      const shop = await tx.shop.findUniqueOrThrow({ where: { id: s.shopId }, select: { cashRequireSession: true } });
      const session = await tx.cashSession.findFirst({ where: { shopId: s.shopId, status: CashSessionStatus.OPEN }, orderBy: { openedAt: 'desc' } });
      if (method === PaymentMethod.CASH && shop.cashRequireSession && !session) throw Object.assign(new Error('Ouvrez la caisse avant une vente en espèces'), { status: 409 });
      let buyerId: string | null = null;
      const phone = String(b.buyer?.phone || '').replace(/[^\d+]/g, '').slice(0, 20);
      if (phone.length >= 8) { const c = await tx.client.upsert({ where: { shopId_phone: { shopId: s.shopId, phone } }, update: {}, create: { shopId: s.shopId, phone, fullName: String(b.buyer?.fullName || '').trim().slice(0, 120) || 'Client' } }); buyerId = c.id; }
      const number = saleNumber((await tx.counterSale.count({ where: { shopId: s.shopId } })) + 1);
      const label = `${deviceTitle(d)} · ${conditionLabel(d.condition)}${d.batteryHealth != null ? ` · batterie ${d.batteryHealth} %` : ''} · IMEI ${d.imei}${warrantyDays ? ` · garantie ${warrantyDays} j` : ''}`;
      const sale = await tx.counterSale.create({ data: {
        shopId: s.shopId, number, clientId: buyerId, userId: s.id, subtotal: price, discount: 0, total: price, note: `Occasion ${d.number}`,
        lines: { create: [{ name: label.slice(0, 250), quantity: 1, unitCost: d.purchasePrice, unitPrice: price, total: price }] },
        payments: { create: [{ shopId: s.shopId, userId: s.id, cashSessionId: session?.id || null, method, amount: price, receivedAmount: received, changeAmount: Math.max(0, Math.round((received - price) * 1000) / 1000), note: `Vente occasion ${d.number}` }] },
      } });
      const u = await tx.usedDevice.update({ where: { id: d.id }, data: { status: UsedDeviceStatus.SOLD, soldAt: new Date(), soldPrice: price, warrantyDays, buyerId, counterSaleId: sale.id } });
      return { device: u, saleNumber: sale.number, margin: Math.round((price - Number(d.purchasePrice)) * 1000) / 1000, change: Math.max(0, received - price) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await audit(s.shopId, s.id, 'SELL', 'USED_DEVICE', id, { sale: result.saleNumber, price, margin: result.margin });
    publish(s.shopId, 'payment.created', { usedDeviceId: id });
    const { sellerIdEncrypted, ...device } = result.device as any;
    return ok(plain({ ...result, device }), { status: 201 });
  } catch (e: any) {
    if (e?.code === 'P2034' || e?.code === 'P2002') return bad('Opération concurrente détectée. Réessayez.', 409);
    return bad(e.message, e.status || 500);
  }
}
