import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from './prisma';
import { can, type SupplierPerm } from './supplier-permissions';

/**
 * « Code gérant » : un vendeur ou caissier demande une action réservée (remise au-delà de la limite,
 * remboursement) ; le gérant tape son code sur la caisse. Le serveur délivre un jeton valable 3 minutes,
 * pour cette action uniquement, et le journal garde les deux noms.
 */
const secret = () => new TextEncoder().encode(process.env.SUPPLIER_AUTH_SECRET || process.env.AUTH_SECRET || 'dev-supplier-secret-change-me-123456789');
const TTL = 180;
export const APPROVER_ROLES = ['OWNER', 'ADMIN', 'MANAGER'];
export type Approval = { companyId: string; perm: SupplierPerm; approverId: string; approverName: string; forAccountId: string };

export const validApprovalPin = (pin: unknown) => /^\d{4,6}$/.test(String(pin ?? ''));
export const hashApprovalPin = (pin: string) => bcrypt.hash(pin, 10);

export async function issueApproval(companyId: string, forAccountId: string, perm: SupplierPerm, pin: string) {
  const managers = await prisma.supplierAccount.findMany({ where: { companyId, isActive: true, role: { in: APPROVER_ROLES }, approvalPinHash: { not: null } }, select: { id: true, fullName: true, approvalPinHash: true } });
  if (!managers.length) throw Object.assign(new Error('Aucun code gérant n’est configuré : le gérant le crée dans la caisse (Réglages → Code gérant).'), { status: 409 });
  for (const m of managers) {
    if (m.approvalPinHash && await bcrypt.compare(pin, m.approvalPinHash)) {
      const a: Approval = { companyId, perm, approverId: m.id, approverName: m.fullName, forAccountId };
      const token = await new SignJWT(a as any).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(Math.floor(Date.now() / 1000) + TTL).sign(secret());
      return { token, approverName: m.fullName, expiresIn: TTL };
    }
  }
  throw Object.assign(new Error('Code gérant incorrect'), { status: 403 });
}

/** Le compte a le droit lui-même, ou présente un jeton valide pour ce droit (sinon : erreur 403 explicite). */
export async function checkPermOrApproval(s: { id: string; companyId: string; role: string }, perm: SupplierPerm, token: unknown): Promise<Approval | null> {
  if (can(s.role, perm)) return null;
  if (typeof token === 'string' && token) {
    try {
      const a = (await jwtVerify(token, secret())).payload as unknown as Approval;
      if (a.companyId === s.companyId && a.perm === perm && a.forAccountId === s.id) return a;
    } catch { /* expiré ou falsifié */ }
  }
  throw Object.assign(new Error(perm === 'discount' ? 'Remise au-delà de votre limite : demandez le code gérant.' : 'Action réservée au gérant : demandez le code gérant.'), { status: 403, code: 'APPROBATION_REQUISE', perm });
}
