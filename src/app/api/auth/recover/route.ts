import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { bad, ok } from '@/lib/http';
import { audit } from '@/lib/audit';
import { loginGuard, TOO_MANY } from '@/lib/login-guard';
import { normalizeRecoveryCode } from '@/lib/recovery';

/**
 * « Code PIN oublié » du gérant : code de secours + nouveau PIN.
 * Mêmes limites d'essais que la connexion. Le code est à usage unique (il faut en créer un nouveau ensuite).
 */
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const slug = String(b.shopSlug || ''), userId = String(b.userId || ''), code = normalizeRecoveryCode(b.code), newPin = String(b.newPin || '');
    if (!slug || !userId) return bad('Choisissez la boutique et le profil');
    if (!/^\d{6}$/.test(newPin)) return bad('Le nouveau code PIN doit contenir 6 chiffres');
    if (/^(\d)\1{5}$/.test(newPin) || newPin === '123456' || newPin === '654321') return bad('Choisissez un code PIN moins facile à deviner');
    const guard = loginGuard('recover', req, `${slug}:${userId}`);
    if (await guard.blocked()) return bad(TOO_MANY, 429);
    const shop = await prisma.shop.findFirst({ where: { slug, isActive: true }, select: { id: true } });
    const u = shop ? await prisma.user.findFirst({ where: { id: userId, shopId: shop.id, isActive: true } }) : null;
    const valid = !!u && u.role === UserRole.ADMIN && !!u.recoveryCodeHash && code.length >= 12 && await bcrypt.compare(code, u.recoveryCodeHash);
    if (!valid || !u) {
      await guard.fail();
      if (u && u.role !== UserRole.ADMIN) return bad('Seul le gérant utilise un code de secours. Demandez à votre gérant de changer votre code PIN (Équipe).', 403);
      return bad('Code de secours incorrect', 401);
    }
    await guard.success();
    await prisma.user.update({ where: { id: u.id }, data: { pinHash: await bcrypt.hash(newPin, 12), mustChangePin: false, recoveryCodeHash: null } });
    await audit(u.shopId, u.id, 'RECOVER_PIN', 'USER', u.id, { ip: guard.ip });
    return ok({ ok: true });
  } catch (e: any) { return bad(e?.message || 'Opération impossible', e?.status || 500); }
}
