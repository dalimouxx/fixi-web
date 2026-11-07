import { prisma } from '@/lib/prisma';
import { requireSupplierSession } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';
import { loginGuard, TOO_MANY } from '@/lib/login-guard';
import { APPROVABLE } from '@/lib/supplier-permissions';
import { issueApproval, validApprovalPin } from '@/lib/supplier-approval';

/** { perm: 'discount' | 'refund', pin } → jeton d'autorisation de 3 minutes (le gérant tape son code sur la caisse). */
export async function POST(req: Request) {
  try {
    const s = await requireSupplierSession();
    const b = await req.json().catch(() => ({}));
    if (!APPROVABLE.includes(b.perm)) return bad('Action non autorisable par code');
    if (!validApprovalPin(b.pin)) return bad('Code gérant : 4 à 6 chiffres');
    // 5 essais ratés en 5 minutes → blocage (le code gérant ne se devine pas à la caisse).
    const guard = loginGuard('supplier-approval', req, s.companyId);
    if (await guard.blocked()) return bad(TOO_MANY, 429);
    try {
      const a = await issueApproval(s.companyId, s.id, b.perm, String(b.pin));
      await guard.success();
      await prisma.supplierAuditEvent.create({ data: { companyId: s.companyId, accountId: s.id, action: 'APPROVAL_GRANTED', entity: 'PERMISSION', entityId: b.perm, metadata: { by: a.approverName, reason: String(b.reason || '').slice(0, 200) || null } } }).catch(() => null);
      return ok(a);
    } catch (e) { await guard.fail(); throw e; }
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
