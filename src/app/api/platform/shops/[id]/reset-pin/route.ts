import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePlatformSession } from '@/lib/platform-auth';
import { bad, ok } from '@/lib/http';
import { audit } from '@/lib/audit';
import { temporaryPin } from '@/lib/recovery';

/**
 * Fixi Control : PIN temporaire pour le gérant d'une boutique (après vérification d'identité par téléphone).
 * Le gérant devra le changer à la connexion suivante.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformSession();
    const { id } = await params;
    const b = await req.json().catch(() => ({}));
    const u = await prisma.user.findFirst({ where: { shopId: id, isActive: true, ...(b.userId ? { id: String(b.userId) } : { role: UserRole.ADMIN }) }, orderBy: { createdAt: 'asc' } });
    if (!u) return bad('Aucun gérant actif dans cette boutique', 404);
    const pin = temporaryPin();
    await prisma.user.update({ where: { id: u.id }, data: { pinHash: await bcrypt.hash(pin, 12), mustChangePin: true } });
    await audit(id, undefined, 'PLATFORM_RESET_PIN', 'USER', u.id, { by: (admin as any).login || (admin as any).id });
    return ok({ pin, user: { id: u.id, fullName: u.fullName, loginCode: u.loginCode } });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
