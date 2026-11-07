/** Libellés français des codes du serveur (jamais de code brut à l'écran). */
export const STATUS_FR: Record<string, string> = {
  PENDING: 'Nouvelle', CONFIRMED: 'Confirmée', PREPARING: 'En préparation', READY: 'Prête', READY_FOR_DELIVERY: 'Prête', OUT_FOR_DELIVERY: 'En livraison',
  DELIVERED: 'Livrée', CANCELLED: 'Annulée', RETURNED: 'Retournée', PAID: 'Payée', PARTIAL: 'Partielle', UNPAID: 'Non payée', COMPLETED: 'Terminée',
  REFUNDED: 'Remboursé', ISSUED: 'Émis', DRAFT: 'Brouillon', SENT: 'Envoyé', ACCEPTED: 'Accepté', REJECTED: 'Refusé', CONVERTED: 'Converti',
  EXPIRED: 'Expiré', OPEN: 'Ouverte', CLOSED: 'Clôturée', PENDING_CASHIER: 'À clôturer', SUBMITTED: 'Déclarée', ACTIVE: 'Actif', INACTIVE: 'Inactif',
};
export const PAY_FR: Record<string, string> = { CASH: 'Espèces', CARD: 'Carte', TRANSFER: 'Virement', BANK_TRANSFER: 'Virement', CHEQUE: 'Chèque', CHECK: 'Chèque', D17: 'D17', FLOUCI: 'Flouci', CREDIT: 'À crédit', OTHER: 'Autre' };
const human = (c: unknown) => { const s = String(c ?? ''); if (!/^[A-Z0-9_]+$/.test(s)) return s || '—'; const t = s.replace(/_/g, ' ').toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); };
export const statusFr = (c: unknown) => STATUS_FR[String(c ?? '')] ?? human(c);
export const payFr = (c: unknown) => PAY_FR[String(c ?? '').toUpperCase()] ?? human(c);
