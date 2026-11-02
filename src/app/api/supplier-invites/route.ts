import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { UserRole } from '@prisma/client';
import { audit } from '@/lib/audit';
import { cleanPhone, cleanText, inviteCode, inviteLink, inviteMessage } from '@/lib/supplier-invite';

// L'atelier invite son fournisseur habituel : on prépare le lien et le message WhatsApp.
export async function GET() {
  try {
    const s = await requireSession([UserRole.ADMIN, UserRole.RECEPTION], 'CONNECT');
    const rows = await prisma.supplierInvite.findMany({ where: { inviterShopId: s.shopId }, orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, code: true, supplierName: true, supplierPhone: true, status: true, createdAt: true, requestedAt: true, convertedAt: true } });
    return ok(rows);
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

export async function POST(req: Request) {
  try {
    const s = await requireSession([UserRole.ADMIN, UserRole.RECEPTION], 'CONNECT');
    const b = await req.json().catch(() => ({}));
    const supplierName = cleanText(b.supplierName, 80);
    const supplierPhone = cleanPhone(b.supplierPhone);
    if (supplierName.length < 2) return bad('Nom du fournisseur requis');
    const recent = await prisma.supplierInvite.count({ where: { inviterShopId: s.shopId, createdAt: { gte: new Date(Date.now() - 86400000) } } });
    if (recent >= 20) return bad('Trop d’invitations aujourd’hui. Réessayez demain.', 429);
    const shop = await prisma.shop.findUniqueOrThrow({ where: { id: s.shopId }, select: { name: true } });
    const x = await prisma.supplierInvite.create({ data: { code: inviteCode(), inviterShopId: s.shopId, supplierName, supplierPhone: supplierPhone || null } });
    await audit(s.shopId, s.id, 'INVITE', 'SUPPLIER', x.id, { supplierName });
    const link = inviteLink(process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin, x.code);
    return ok({ id: x.id, code: x.code, link, phone: supplierPhone, message: inviteMessage({ supplier: supplierName, shop: shop.name, link }) }, { status: 201 });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
