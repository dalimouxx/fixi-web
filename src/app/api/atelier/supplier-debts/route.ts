import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { UserRole } from '@prisma/client';
import { shopSupplierStatement } from '@/lib/supplier-due-statement';
import { customerMonthly } from '@/lib/supplier-collections';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const session = await requireSession([UserRole.ADMIN, UserRole.RECEPTION, UserRole.CASHIER],'CONNECT');
    const st = await shopSupplierStatement(session.shopId);
    // Règlement mensuel demandé par chaque fournisseur : l'atelier voit ce qu'il doit régler ce mois-ci et si ses achats sont bloqués.
    const suppliers = await Promise.all(st.suppliers.map(async (x: any) => ({ ...x, monthly: x.company?.id ? await customerMonthly(x.company.id, x.customerId).catch(() => null) : null })));
    return ok({ ...st, suppliers });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
