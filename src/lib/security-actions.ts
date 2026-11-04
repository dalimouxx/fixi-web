import { prisma } from './prisma';
import { newTotpSecret, verifyTotp } from './totp';
import { setupPayload } from './two-factor';

type Kind = 'supplier' | 'platform';
const table = (k: Kind) => (k === 'supplier' ? prisma.supplierAccount : prisma.platformAdmin) as any;

/** Actions de sécurité communes : activer/désactiver la double vérification, déconnecter tous les appareils. */
export async function securityAction(kind: Kind, id: string, label: string, b: any) {
  const t = table(kind);
  const a = await t.findUnique({ where: { id }, select: { id: true, totpSecret: true, totpEnabled: true, sessionVersion: true } });
  if (!a) throw Object.assign(new Error('Compte introuvable'), { status: 404 });
  const action = String(b?.action || '');
  if (action === 'setup') {
    if (a.totpEnabled) throw Object.assign(new Error('La double vérification est déjà active'), { status: 409 });
    const secret = newTotpSecret();
    await t.update({ where: { id }, data: { totpSecret: secret } });
    return { step: 'scan', ...(await setupPayload(secret, label, 'Fixi')) };
  }
  if (action === 'enable') {
    if (!a.totpSecret) throw Object.assign(new Error('Recommencez la configuration'), { status: 400 });
    if (!verifyTotp(a.totpSecret, b.code)) throw Object.assign(new Error('Code incorrect : vérifiez l’heure du téléphone et réessayez'), { status: 400 });
    // Activer invalide les autres sessions et appareils de confiance.
    await t.update({ where: { id }, data: { totpEnabled: true, sessionVersion: { increment: 1 } } });
    return { enabled: true, relogin: true };
  }
  if (action === 'disable') {
    if (!a.totpEnabled) return { enabled: false };
    if (!verifyTotp(a.totpSecret, b.code)) throw Object.assign(new Error('Code incorrect'), { status: 400 });
    await t.update({ where: { id }, data: { totpEnabled: false, totpSecret: null, sessionVersion: { increment: 1 } } });
    return { enabled: false, relogin: true };
  }
  if (action === 'logout-all') {
    await t.update({ where: { id }, data: { sessionVersion: { increment: 1 } } });
    return { relogin: true };
  }
  throw Object.assign(new Error('Action inconnue'), { status: 400 });
}

export async function securityState(kind: Kind, id: string) {
  const a = await table(kind).findUnique({ where: { id }, select: { totpEnabled: true } });
  return { enabled: !!a?.totpEnabled };
}
