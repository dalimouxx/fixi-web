import { prisma } from '@/lib/prisma';
import { requireSupplierRole, requireSupplierSession } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';
import { permsOf, ROLE_LABEL, ROLE_PERMS } from '@/lib/supplier-permissions';
import { APPROVER_ROLES, hashApprovalPin, validApprovalPin } from '@/lib/supplier-approval';

/** Mes droits (la caisse Windows construit ses menus avec), la limite de remise et l'état du code gérant. */
export async function GET() {
  try {
    const s = await requireSupplierSession();
    const [me, company, approvers] = await Promise.all([
      prisma.supplierAccount.findUnique({ where: { id: s.id }, select: { approvalPinHash: true } }),
      prisma.supplierCompany.findUnique({ where: { id: s.companyId }, select: { staffDiscountLimitPct: true } }),
      prisma.supplierAccount.count({ where: { companyId: s.companyId, isActive: true, role: { in: APPROVER_ROLES }, approvalPinHash: { not: null } } }),
    ]);
    return ok({ role: s.role, roleLabel: ROLE_LABEL[s.role] || s.role, perms: permsOf(s.role), discountLimitPct: company?.staffDiscountLimitPct ?? 10, canApprove: APPROVER_ROLES.includes(s.role), hasApprovalPin: !!me?.approvalPinHash, approvers, matrix: ROLE_PERMS, roleLabels: ROLE_LABEL });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

/** { approvalPin } : le gérant crée / change son code · { approvalPin: null } : le retire · { discountLimitPct } : propriétaire. */
export async function PATCH(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    if (b.discountLimitPct !== undefined) {
      const s = await requireSupplierRole(['OWNER', 'ADMIN']);
      const v = Math.round(Number(b.discountLimitPct));
      if (!(v >= 0 && v <= 100)) return bad('Limite de remise entre 0 et 100 %');
      await prisma.supplierCompany.update({ where: { id: s.companyId }, data: { staffDiscountLimitPct: v } });
      await prisma.supplierAuditEvent.create({ data: { companyId: s.companyId, accountId: s.id, action: 'DISCOUNT_LIMIT', entity: 'COMPANY', metadata: { pct: v } } }).catch(() => null);
    }
    if (b.approvalPin !== undefined) {
      const s = await requireSupplierRole(APPROVER_ROLES as any);
      if (b.approvalPin !== null && !validApprovalPin(b.approvalPin)) return bad('Le code gérant fait 4 à 6 chiffres');
      await prisma.supplierAccount.update({ where: { id: s.id }, data: { approvalPinHash: b.approvalPin === null ? null : await hashApprovalPin(String(b.approvalPin)) } });
      await prisma.supplierAuditEvent.create({ data: { companyId: s.companyId, accountId: s.id, action: b.approvalPin === null ? 'APPROVAL_PIN_REMOVED' : 'APPROVAL_PIN_SET', entity: 'ACCOUNT', entityId: s.id } }).catch(() => null);
    }
    return ok({ ok: true });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
