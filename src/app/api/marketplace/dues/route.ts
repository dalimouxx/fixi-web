import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { UserRole } from '@prisma/client';
import { shopSupplierStatement } from '@/lib/supplier-due-statement';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const session = await requireSession([UserRole.ADMIN, UserRole.RECEPTION, UserRole.CASHIER]);
    return ok(await shopSupplierStatement(session.shopId));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
