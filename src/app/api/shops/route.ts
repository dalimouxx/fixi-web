import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { UserRole } from '@prisma/client';

export async function GET() {
  try {
    const s = await requireSession([UserRole.ADMIN]);
    const rows = await prisma.shop.findMany({
      where: { tenantId: s.tenantId },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
    return ok(rows.map(x => ({ ...x, isCurrent: x.id === s.shopId })));
  } catch (e: any) {
    return bad(e.message, e.status || 500);
  }
}
