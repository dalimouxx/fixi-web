import { NotificationType, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePlatformSession } from '@/lib/platform-auth';
import { bad, ok } from '@/lib/http';
import { plain } from '@/lib/serializers';
import { notifyShop } from '@/lib/notifications';

/** Ateliers par statut de vérification (?status=PENDING|NONE|REJECTED|VERIFIED), ou un dossier complet (?shopId=). */
export async function GET(req: Request) {
  try {
    await requirePlatformSession();
    const u = new URL(req.url);
    const shopId = u.searchParams.get('shopId');
    if (shopId) {
      const [shop, file] = await Promise.all([
        prisma.shop.findUnique({ where: { id: shopId }, select: { id: true, name: true, phone: true, region: true, city: true, createdAt: true, verificationStatus: true, verificationNote: true, _count: { select: { repairs: true, clients: true } } } }),
        prisma.shopVerification.findUnique({ where: { shopId } }),
      ]);
      if (!shop) return bad('Boutique introuvable', 404);
      return ok(plain({ shop, file }));
    }
    const status = ['PENDING', 'NONE', 'REJECTED', 'VERIFIED'].includes(String(u.searchParams.get('status'))) ? String(u.searchParams.get('status')) : 'PENDING';
    const shops = await prisma.shop.findMany({ where: { verificationStatus: status }, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, name: true, phone: true, region: true, city: true, createdAt: true, verificationStatus: true, verificationNote: true, verifiedAt: true, _count: { select: { repairs: true, clients: true, supplierMarketplaceOrders: true } } } });
    const files = await prisma.shopVerification.findMany({ where: { shopId: { in: shops.map(s => s.id) } }, select: { shopId: true, legalName: true, ownerName: true, taxId: true, submittedAt: true } });
    const byShop = new Map(files.map(f => [f.shopId, f]));
    const counts = await prisma.shop.groupBy({ by: ['verificationStatus'], _count: { _all: true } });
    return ok(plain({ status, counts: Object.fromEntries(counts.map(c => [c.verificationStatus, c._count._all])), rows: shops.map(s => ({ ...s, file: byShop.get(s.id) || null })) }));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

/** Décision : { shopId, decision: 'VERIFIED' | 'REJECTED' | 'NONE', note? } — l'atelier est prévenu. */
export async function POST(req: Request) {
  try {
    const admin = await requirePlatformSession();
    const b = await req.json().catch(() => ({}));
    const decision = ['VERIFIED', 'REJECTED', 'NONE'].includes(b.decision) ? String(b.decision) : null;
    if (!decision) return bad('Décision invalide');
    const note = String(b.note || '').trim().slice(0, 300) || null;
    if (decision === 'REJECTED' && !note) return bad('Indiquez le motif du refus (envoyé à l’atelier)');
    const shop = await prisma.shop.findUnique({ where: { id: String(b.shopId || '') }, select: { id: true, name: true } });
    if (!shop) return bad('Boutique introuvable', 404);
    await prisma.$transaction([
      prisma.shop.update({ where: { id: shop.id }, data: { verificationStatus: decision, verifiedAt: decision === 'VERIFIED' ? new Date() : null, verificationNote: decision === 'REJECTED' ? note : null } }),
      prisma.shopVerification.updateMany({ where: { shopId: shop.id }, data: { reviewedAt: new Date(), reviewedBy: admin.fullName, decision, note } }),
      prisma.auditLog.create({ data: { shopId: shop.id, action: 'VERIFICATION_' + decision, entity: 'Shop', entityId: shop.id, metadata: { by: admin.fullName, note } } }),
    ]);
    if (decision === 'VERIFIED') await notifyShop(shop.id, '✅ Atelier vérifié', 'Fixi a validé votre atelier : le catalogue des fournisseurs est ouvert. Bonnes commandes !', '/app/suppliers', NotificationType.SUCCESS, [UserRole.ADMIN]).catch(() => null);
    if (decision === 'REJECTED') await notifyShop(shop.id, 'Vérification refusée', `Motif : ${note}. Corrigez puis renvoyez vos documents dans Fournisseurs → Vérification.`, '/app/suppliers', NotificationType.WARNING, [UserRole.ADMIN]).catch(() => null);
    return ok({ ok: true, status: decision });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
