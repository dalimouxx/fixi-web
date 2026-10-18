import type { SubscriptionStatus } from '@prisma/client';
import { prisma } from './prisma';

/**
 * Fixi Connect grants free access to supplier shopping and delivery history.
 * A paid subscription only unlocks workshop modules while active and unexpired.
 * Suspended, cancelled, past-due and expired plans downgrade to Connect; data remains intact.
 */
export type FixiAccessTier = 'CONNECT' | 'PRO';
export type SubscriptionEntitlement = {
  status: SubscriptionStatus;
  endsAt: Date | string | null;
  plan: { code: string } | null;
};

export function resolveFixiAccess(subscription: SubscriptionEntitlement | null, now = new Date()): FixiAccessTier {
  if (!subscription || !subscription.plan || subscription.plan.code.toUpperCase() === 'CONNECT') return 'CONNECT';
  if (subscription.status !== 'ACTIVE' && subscription.status !== 'TRIAL') return 'CONNECT';
  if (subscription.endsAt && new Date(subscription.endsAt).getTime() <= now.getTime()) return 'CONNECT';
  return 'PRO';
}

export const CONNECT_APP_PREFIXES = [
  '/app/suppliers', '/app/mes-dettes',
  '/app/subscription', '/app/upgrade',
  '/app/support', '/app/notifications', '/app/updates',
] as const;

export function isConnectAppPath(pathname: string): boolean {
  const pathnameOnly = pathname.split('?')[0].split('#')[0];
  return CONNECT_APP_PREFIXES.some(prefix => pathnameOnly === prefix || pathnameOnly.startsWith(prefix + '/'));
}

/** Called only from authenticated platform-admin endpoints, never from a public request. */
export async function ensureConnectPlan() {
  return prisma.plan.upsert({
    where: { code: 'CONNECT' },
    create: {
      code: 'CONNECT', name: 'Fixi Connect – Gratuit',
      description: 'Catalogue fournisseurs, commandes, suivi des livraisons, dettes, factures et preuves.',
      price: 0, priceMonthly: 0, durationValue: 1, durationUnit: 'YEAR',
      maxShops: 1, maxUsersPerShop: 5, publicVisible: true, active: true,
      features: {
        tier: 'CONNECT',
        supplierMarket: true, orders: true, deliveryTracking: true,
        invoices: true, supplierDebts: true, supplierPayments: true,
        returns: true, repairs: false, stock: false, cashier: false,
      },
    },
    update: {},
  });
}
