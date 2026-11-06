import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { audit } from '@/lib/audit';
import { newRecoveryCode, normalizeRecoveryCode } from '@/lib/recovery';

/** État du code de secours du gérant connecté. */
export async function GET() {
  try {
    const s = await requireSession([UserRole.ADMIN], 'CONNECT');
    const u = await prisma.user.findUnique({ where: { id: s.id }, select: { recoveryCodeHash: true, recoveryCodeAt: true } });
    return ok({ exists: !!u?.recoveryCodeHash, createdAt: u?.recoveryCodeAt || null });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

/** Crée (ou remplace) le code de secours. Il n'est affiché qu'une seule fois. */
export async function POST() {
  try {
    const s = await requireSession([UserRole.ADMIN], 'CONNECT');
    const code = newRecoveryCode();
    await prisma.user.update({ where: { id: s.id }, data: { recoveryCodeHash: await bcrypt.hash(normalizeRecoveryCode(code), 12), recoveryCodeAt: new Date() } });
    await audit(s.shopId, s.id, 'RECOVERY_CODE', 'USER', s.id);
    return ok({ code });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
