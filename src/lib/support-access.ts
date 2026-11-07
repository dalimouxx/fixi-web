import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { UserRole } from '@prisma/client';
import { prisma } from './prisma';
import { createSession, destroySession } from './auth';
import { createSupplierSession, destroySupplierSession } from './supplier-auth';
import type { PlatformSession } from './platform-auth';

/**
 * Mode support : le super admin (Fixi Control) ouvre l'espace d'une boutique ou d'un fournisseur
 * pour régler un problème. Garde-fous :
 *  - motif obligatoire, accès limité à 1 heure ;
 *  - journal (SupportAccess) visible dans Fixi Control + trace dans le journal de la boutique / du fournisseur ;
 *  - la boutique est prévenue (notification) ;
 *  - bandeau permanent « Mode support » avec bouton « Quitter ».
 */
export const SUPPORT_TTL_SECONDS = 60 * 60;
export const SUPPORT_COOKIE = 'fixi_support';
export const SUPPORT_UI_COOKIE = 'fixi_support_ui';
export type SupportKind = 'SHOP' | 'SUPPLIER';
export type SupportTicket = { accessId: string; kind: SupportKind; targetName: string; adminName: string };

const secret = () => new TextEncoder().encode(process.env.PLATFORM_AUTH_SECRET || process.env.AUTH_SECRET || 'dev-platform-secret-change-now-123456789');

export function cleanReason(v: unknown) {
  const r = String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
  return r.length >= 5 ? r : null;
}

/** Valeur lisible par le navigateur (affichage du bandeau uniquement, aucune autorisation). */
export function uiCookieValue(t: Pick<SupportTicket, 'kind' | 'targetName' | 'adminName'>, expiresAt: Date) {
  return encodeURIComponent(JSON.stringify({ k: t.kind, n: t.targetName.slice(0, 60), a: t.adminName.slice(0, 40), e: expiresAt.getTime() }));
}

type Target = { kind: SupportKind; targetId: string; targetName: string; home: string; open: () => Promise<void>; trace: (accessId: string) => Promise<unknown> };

async function shopTarget(id: string, admin: PlatformSession, reason: string): Promise<Target> {
  const shop = await prisma.shop.findUnique({ where: { id }, select: { id: true, name: true, slug: true, tenantId: true, isActive: true } });
  if (!shop) throw Object.assign(new Error('Boutique introuvable'), { status: 404 });
  if (!shop.isActive) throw Object.assign(new Error('Boutique suspendue : réactivez-la avant d’y accéder.'), { status: 409 });
  const user = await prisma.user.findFirst({ where: { shopId: shop.id, isActive: true, role: UserRole.ADMIN }, orderBy: [{ mustChangePin: 'asc' }, { createdAt: 'asc' }] });
  if (!user) throw Object.assign(new Error('Aucun gérant actif dans cette boutique'), { status: 409 });
  return {
    kind: 'SHOP', targetId: shop.id, targetName: shop.name, home: '/app/dashboard',
    open: () => createSession({ id: user.id, shopId: shop.id, tenantId: shop.tenantId, role: user.role, fullName: user.fullName, shopName: shop.name, shopSlug: shop.slug, support: admin.fullName }, SUPPORT_TTL_SECONDS),
    trace: async accessId => {
      await prisma.auditLog.create({ data: { shopId: shop.id, action: 'SUPPORT_ACCESS', entity: 'Support', entityId: accessId, metadata: { by: admin.fullName, reason } } });
      const { notifyShop } = await import('./notifications');
      await notifyShop(shop.id, 'Le support Fixi a ouvert votre espace', `${admin.fullName} intervient pour : ${reason}. Accès limité à 1 heure.`, '/app/audit', undefined, [UserRole.ADMIN]).catch(() => null);
    },
  };
}

async function supplierTarget(id: string, admin: PlatformSession, reason: string): Promise<Target> {
  const company = await prisma.supplierCompany.findUnique({ where: { id }, select: { id: true, name: true, active: true } });
  if (!company) throw Object.assign(new Error('Fournisseur introuvable'), { status: 404 });
  if (!company.active) throw Object.assign(new Error('Fournisseur désactivé : réactivez-le avant d’y accéder.'), { status: 409 });
  const accounts = await prisma.supplierAccount.findMany({ where: { companyId: company.id, isActive: true, role: { in: ['OWNER', 'ADMIN'] } }, orderBy: { createdAt: 'asc' } });
  const a = accounts.find(x => x.role === 'OWNER') || accounts[0];
  if (!a) throw Object.assign(new Error('Aucun compte gérant actif chez ce fournisseur'), { status: 409 });
  return {
    kind: 'SUPPLIER', targetId: company.id, targetName: company.name, home: '/supplier',
    open: () => createSupplierSession({ id: a.id, companyId: company.id, fullName: a.fullName, companyName: company.name, role: a.role as any, sv: a.sessionVersion, support: admin.fullName }, SUPPORT_TTL_SECONDS),
    trace: accessId => prisma.supplierAuditEvent.create({ data: { companyId: company.id, action: 'SUPPORT_ACCESS', entity: 'Support', entityId: accessId, metadata: { by: admin.fullName, reason } } }),
  };
}

export async function startSupportAccess(admin: PlatformSession, kind: SupportKind, id: string, reason: string, ip?: string | null) {
  const target = kind === 'SHOP' ? await shopTarget(id, admin, reason) : await supplierTarget(id, admin, reason);
  const expiresAt = new Date(Date.now() + SUPPORT_TTL_SECONDS * 1000);
  // Un seul accès ouvert par navigateur : on clôt le précédent.
  await endSupportAccess().catch(() => null);
  const access = await prisma.supportAccess.create({ data: { adminId: admin.id, adminName: admin.fullName, kind, targetId: target.targetId, targetName: target.targetName, reason, ip: ip || null, expiresAt } });
  await target.open();
  await target.trace(access.id).catch(() => null);
  const ticket: SupportTicket = { accessId: access.id, kind, targetName: target.targetName, adminName: admin.fullName };
  const token = await new SignJWT(ticket).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(Math.floor(expiresAt.getTime() / 1000)).sign(secret());
  const c = await cookies();
  const secure = process.env.NODE_ENV === 'production';
  c.set(SUPPORT_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: SUPPORT_TTL_SECONDS });
  c.set(SUPPORT_UI_COOKIE, uiCookieValue(ticket, expiresAt), { httpOnly: false, sameSite: 'lax', secure, path: '/', maxAge: SUPPORT_TTL_SECONDS });
  return { accessId: access.id, url: target.home, expiresAt };
}

export async function readSupportTicket(): Promise<SupportTicket | null> {
  const t = (await cookies()).get(SUPPORT_COOKIE)?.value;
  if (!t) return null;
  try { return (await jwtVerify(t, secret())).payload as unknown as SupportTicket; } catch { return null; }
}

/** Quitte le mode support : ferme la session ouverte pour l'intervention et clôt le journal. */
export async function endSupportAccess() {
  const ticket = await readSupportTicket();
  const c = await cookies();
  c.set(SUPPORT_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  c.set(SUPPORT_UI_COOKIE, '', { path: '/', maxAge: 0 });
  if (!ticket) return null;
  if (ticket.kind === 'SHOP') await destroySession(); else await destroySupplierSession();
  await prisma.supportAccess.updateMany({ where: { id: ticket.accessId, endedAt: null }, data: { endedAt: new Date() } });
  return ticket;
}
