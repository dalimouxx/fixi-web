import crypto from 'crypto';
import { prisma } from './prisma';

/** Adresse du client : la DERNIÈRE valeur de X-Forwarded-For est celle ajoutée par le
 * proxy de l'hébergeur (Render) ; les premières peuvent être inventées par le client. */
export function clientIp(req: Request) {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return req.headers.get('x-real-ip') || 'local';
}

type Rule = { scope: string; max: number; minutes: number };
const hash = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

/**
 * Limite les essais de connexion sur trois axes à la fois :
 * - adresse + compte (erreur de frappe normale) ;
 * - compte seul, quelle que soit l'adresse (empêche de contourner en changeant d'IP) ;
 * - adresse seule (empêche d'essayer beaucoup de comptes depuis un même appareil).
 */
export function loginGuard(space: string, req: Request, account: string) {
  const ip = clientIp(req);
  const acc = account.trim().toLowerCase();
  const rules: (Rule & { key: string })[] = [
    { scope: 'ip+account', max: 5, minutes: 5, key: hash(`${space}:${ip}:${acc}`) },
    { scope: 'account', max: 10, minutes: 15, key: hash(`${space}:acct:${acc}`) },
    { scope: 'ip', max: 30, minutes: 15, key: hash(`${space}:ip:${ip}`) },
  ];
  return {
    ip,
    /** true si une des limites est atteinte. */
    async blocked() {
      const now = new Date();
      const rows = await prisma.loginGuard.findMany({ where: { keyHash: { in: rules.map(r => r.key) } } });
      return rules.some(r => { const g = rows.find(x => x.keyHash === r.key); return !!g && g.resetAt > now && g.count >= r.max; });
    },
    async fail() {
      const now = new Date();
      for (const r of rules) {
        const g = await prisma.loginGuard.findUnique({ where: { keyHash: r.key } });
        const active = g && g.resetAt > now;
        const count = (active ? g!.count : 0) + 1;
        const resetAt = active ? g!.resetAt : new Date(Date.now() + r.minutes * 60_000);
        await prisma.loginGuard.upsert({ where: { keyHash: r.key }, update: { count, resetAt }, create: { keyHash: r.key, count, resetAt } });
      }
    },
    /** Succès : on efface les compteurs liés au compte (pas celui de l'adresse). */
    async success() {
      await prisma.loginGuard.deleteMany({ where: { keyHash: { in: [rules[0].key, rules[1].key] } } }).catch(() => {});
    },
  };
}

export const TOO_MANY = 'Trop de tentatives. Réessayez dans quelques minutes.';
