/**
 * Droits des employés d'un fournisseur — UNE seule table, utilisée par le serveur (contrôle à chaque action)
 * et envoyée à la caisse Windows (menus et boutons affichés selon le rôle).
 * 🔐 = action possible avec le « code gérant » saisi sur place (voir supplier-approval.ts).
 */
export const SUPPLIER_PERMS = [
  'sell', 'cash', 'discount', 'refund', 'customers', 'customerPay', 'customerView',
  'productCreate', 'stockIn', 'inventory', 'productEdit', 'productPrice', 'productArchive', 'promo', 'masters', 'priceTiers', 'seeCost',
  'purchases', 'vendors', 'vendorPay', 'expenses',
  'documents', 'quotes', 'orders', 'ordersPrepare', 'deliveryAssign', 'driverCash',
  'reports', 'reportsStock', 'reportsOwnCash', 'team', 'warehouses',
] as const;
export type SupplierPerm = (typeof SUPPLIER_PERMS)[number];

const ALL = [...SUPPLIER_PERMS];
const by = (...p: SupplierPerm[]) => p;

export const ROLE_PERMS: Record<string, SupplierPerm[]> = {
  OWNER: ALL,
  ADMIN: ALL,
  MANAGER: ALL.filter(p => p !== 'team'),
  STOCK: by('productCreate', 'stockIn', 'inventory', 'productEdit', 'productArchive', 'masters', 'seeCost', 'purchases', 'vendors', 'orders', 'ordersPrepare', 'reportsStock', 'warehouses'),
  SALES: by('sell', 'cash', 'customers', 'customerPay', 'customerView', 'quotes', 'orders', 'ordersPrepare', 'reportsOwnCash'),
  CASHIER: by('sell', 'cash', 'customers', 'customerPay', 'customerView', 'driverCash', 'reportsOwnCash'),
  ACCOUNTANT: by('customerView', 'seeCost', 'purchases', 'vendors', 'vendorPay', 'expenses', 'documents', 'quotes', 'driverCash', 'reports'),
  DELIVERY_MANAGER: by('orders', 'deliveryAssign'),
  DRIVER: [],
};

/** Actions qu'un employé sans le droit peut faire avec le code gérant saisi sur place. */
export const APPROVABLE: SupplierPerm[] = ['discount', 'refund'];

/** Rôles autorisés à ouvrir la caisse Windows. */
export const DESKTOP_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SALES', 'CASHIER', 'STOCK', 'ACCOUNTANT'] as const;

export function can(role: string | null | undefined, perm: SupplierPerm) {
  return (ROLE_PERMS[String(role || '')] || []).includes(perm);
}
export function permsOf(role: string | null | undefined): SupplierPerm[] {
  return [...(ROLE_PERMS[String(role || '')] || [])];
}
/** Rôles qui ont un droit (pour les requireSupplierRole existants). */
export function rolesWith(perm: SupplierPerm): string[] {
  return Object.entries(ROLE_PERMS).filter(([, p]) => p.includes(perm)).map(([r]) => r);
}

export const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Propriétaire', ADMIN: 'Administrateur', MANAGER: 'Responsable', STOCK: 'Magasinier', SALES: 'Vendeur',
  CASHIER: 'Caissier', ACCOUNTANT: 'Comptable', DELIVERY_MANAGER: 'Responsable livraison', DRIVER: 'Livreur',
};

/** Remise maximale sans code gérant (en % du montant avant remise). */
export function discountPct(subtotalBefore: number, discountTotal: number) {
  return subtotalBefore > 0 ? Math.round((discountTotal / subtotalBefore) * 10000) / 100 : 0;
}
