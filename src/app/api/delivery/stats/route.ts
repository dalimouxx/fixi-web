import { requireDeliverySession } from '@/lib/delivery-auth';
import { bad, ok } from '@/lib/http';
import { companyDriverStats } from '@/lib/driver-stats';

export const dynamic = 'force-dynamic';

/** Mes chiffres : aujourd'hui et 7 jours. */
export async function GET() {
  try {
    const s = await requireDeliverySession();
    const [today, week] = await Promise.all([companyDriverStats(s.companyId, 1, s.id), companyDriverStats(s.companyId, 7, s.id)]);
    return ok({ today: today.rows[0] || null, week: week.rows[0] || null, bonusPerDelivery: week.bonusPerDelivery });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
