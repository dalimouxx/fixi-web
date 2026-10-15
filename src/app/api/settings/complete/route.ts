import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { UserRole } from '@prisma/client';
import { audit } from '@/lib/audit';
import { plain } from '@/lib/serializers';

export async function POST(req: Request) {
  try {
    const s = await requireSession([UserRole.ADMIN]);
    const b = await req.json();
    const name = String(b.name || '').trim();
    if (name.length < 2) return bad('Nom de boutique requis');
    const data = {
      name,
      phone: String(b.phone || '').trim() || null,
      address: String(b.address || '').trim() || null,
      email: String(b.email || '').trim() || null,
      currency: String(b.currency || 'DT').trim().slice(0, 8) || 'DT',
      countryCode: String(b.countryCode || '216').replace(/\D/g, '').slice(0, 6) || '216',
      defaultTaxRate: Math.max(0, Math.min(100, Number(b.defaultTaxRate || 0))),
      cashRequireSession: b.cashRequireSession !== false,
      lowStockNotifications: b.lowStockNotifications !== false,
      setupCompletedAt: new Date(),
    };
    const shop = await prisma.shop.update({ where: { id: s.shopId }, data });
    await audit(s.shopId, s.id, 'COMPLETE', 'ONBOARDING', s.shopId);
    return ok(plain(shop));
  } catch (e: any) {
    return bad(e.message, e.status || 500);
  }
}
