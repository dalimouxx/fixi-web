/**
 * Supprimer un article : vraie suppression s'il n'a jamais servi, sinon archivage (caché partout,
 * historique, factures et statistiques intacts, restaurable).
 */
export type Usage = Record<string, number>;
export function deleteMode(usage: Usage): 'DELETE' | 'ARCHIVE' {
  return Object.values(usage).some(n => n > 0) ? 'ARCHIVE' : 'DELETE';
}
export function deleteMessage(name: string, mode: 'DELETE' | 'ARCHIVE') {
  return mode === 'DELETE' ? `« ${name} » supprimé.` : `« ${name} » archivé : il a déjà servi (ventes, réparations ou achats), son historique est gardé. Vous pouvez le restaurer depuis « Archivés ».`;
}
/** Rôles fournisseur qui voient les prix d'achat et coûts moyens. */
export const SUPPLIER_COST_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'STOCK', 'ACCOUNTANT'];
export function stripCosts<T extends Record<string, any>>(p: T): T {
  const { purchasePrice, averageCost, minimumPrice, ...rest } = p as any;
  return rest as T;
}
