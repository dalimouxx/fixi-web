import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { audit } from '@/lib/audit';

export async function POST(req: Request) {
  try {
    const s = await requireSession();
    const b = await req.json();
    const currentPin = String(b.currentPin || '');
    const newPin = String(b.newPin || '');
    if (!/^\d{6}$/.test(newPin)) return bad('Le nouveau PIN doit contenir exactement 6 chiffres.');
    if (currentPin === newPin) return bad('Choisissez un PIN différent du PIN actuel.');
    const u = await prisma.user.findFirst({ where: { id: s.id, shopId: s.shopId, isActive: true } });
    if (!u || !(await bcrypt.compare(currentPin, u.pinHash))) return bad('PIN actuel incorrect', 401);
    const pinHash = await bcrypt.hash(newPin, 12);
    await prisma.user.update({ where: { id: u.id }, data: { pinHash, mustChangePin: false } });
    await audit(s.shopId, s.id, 'CHANGE_PIN', 'USER', s.id);
    return ok({ ok: true });
  } catch (e: any) {
    return bad(e.message, e.status || 500);
  }
}
