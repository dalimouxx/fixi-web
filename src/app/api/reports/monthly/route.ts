import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { UserRole } from '@prisma/client';
import { monthlyData } from '@/lib/monthly-data';
import { previousMonth } from '@/lib/monthly-report';

export async function GET(req: Request) {
  try {
    const s = await requireSession([UserRole.ADMIN]);
    const m = new URL(req.url).searchParams.get('m') || previousMonth();
    const d = await monthlyData(s.shopId, m);
    return ok({ ym: m, shop: d.shop, summary: d.summary });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
