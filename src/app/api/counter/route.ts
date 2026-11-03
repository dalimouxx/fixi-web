import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { PaymentKind } from '@prisma/client';
import { publish } from '@/lib/realtime';

// Écran côté client au comptoir : l'atelier choisit la réparation à montrer, la tablette du comptoir l'affiche.
export async function GET() {
  try {
    const s = await requireSession(undefined, 'CONNECT');
    const shop = await prisma.shop.findUnique({ where: { id: s.shopId }, select: { name: true, logoDataUrl: true, brandColor: true, currency: true, counterRepairCode: true, counterUpdatedAt: true } });
    if (!shop) return bad('Atelier introuvable', 404);
    let repair = null;
    if (shop.counterRepairCode) {
      const r = await prisma.repair.findUnique({ where: { shopId_code: { shopId: s.shopId, code: shop.counterRepairCode } }, include: { client: { select: { fullName: true } }, payments: { select: { amount: true, kind: true } }, attachments: { where: { type: 'SIGNATURE_RECEPTION' }, select: { id: true } } } });
      if (r) {
        const paid = r.payments.reduce((a, p) => a + (p.kind === PaymentKind.PAYMENT ? Number(p.amount) : -Number(p.amount)), 0);
        const price = r.finalPrice ?? r.estimatedPrice;
        repair = { code: r.code, device: [r.brand, r.model].filter(Boolean).join(' '), issue: r.reportedIssue, client: String(r.client.fullName || '').split(' ')[0], price: price == null ? null : Number(price), estimated: r.finalPrice == null && r.estimatedPrice != null, paid, balance: price == null ? null : Math.max(0, Number(price) - Number(r.discountAmount || 0) - paid), warrantyDays: r.warrantyDays, status: r.status, signed: r.attachments.length > 0 };
      }
    }
    return ok({ shop: { name: shop.name, logoDataUrl: shop.logoDataUrl, brandColor: shop.brandColor, currency: shop.currency }, repair, updatedAt: shop.counterUpdatedAt });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

export async function PUT(req: Request) {
  try {
    const s = await requireSession(undefined, 'CONNECT');
    const b = await req.json().catch(() => ({}));
    const code = b.code ? String(b.code) : null;
    if (code) { const r = await prisma.repair.findUnique({ where: { shopId_code: { shopId: s.shopId, code } }, select: { id: true } }); if (!r) return bad('Réparation introuvable', 404); }
    await prisma.shop.update({ where: { id: s.shopId }, data: { counterRepairCode: code, counterUpdatedAt: new Date() } });
    publish(s.shopId, 'counter.updated', { code });
    return ok({ ok: true, code });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
