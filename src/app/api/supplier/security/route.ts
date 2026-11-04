import { requireSupplierSession } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';
import { securityAction, securityState } from '@/lib/security-actions';

export const dynamic = 'force-dynamic';
export async function GET() { try { const s = await requireSupplierSession(); return ok({ ...(await securityState('supplier', s.id)), role: s.role }); } catch (e: any) { return bad(e.message, e.status || 500); } }
export async function POST(req: Request) {
  try { const s = await requireSupplierSession(); return ok(await securityAction('supplier', s.id, `${s.fullName} · ${s.companyName}`, await req.json().catch(() => ({})))); }
  catch (e: any) { return bad(e.message, e.status || 500); }
}
