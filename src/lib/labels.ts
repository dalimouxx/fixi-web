/**
 * Libellés français des codes techniques affichés à l'écran (moyens de paiement, statuts, actions du journal).
 * Règle : jamais de code brut (CASH, PENDING, REMOVE_PART…) devant l'utilisateur.
 */
const PAY: Record<string, string> = {
  CASH: 'Espèces', ESPECES: 'Espèces', CARD: 'Carte', CB: 'Carte', TPE: 'Carte (TPE)', TRANSFER: 'Virement', BANK_TRANSFER: 'Virement',
  BANK: 'Virement', VIREMENT: 'Virement', CHECK: 'Chèque', CHEQUE: 'Chèque', D17: 'D17', ONLINE: 'En ligne', MOBILE: 'Paiement mobile',
  WALLET: 'Portefeuille', CREDIT: 'À crédit', DEBT: 'À crédit', KONNECT: 'Konnect', FLOUCI: 'Flouci', MIXED: 'Mixte', OTHER: 'Autre',
  COD: 'Paiement à la livraison', GIFT: 'Bon cadeau', DEPOSIT: 'Acompte',
};

const STATUS: Record<string, string> = {
  PENDING: 'En attente', CONFIRMED: 'Confirmée', ACCEPTED: 'Acceptée', PREPARING: 'En préparation', READY: 'Prête',
  OUT_FOR_DELIVERY: 'En livraison', IN_TRANSIT: 'En route', PICKED_UP: 'Récupérée', ARRIVED: 'Arrivée', DELIVERED: 'Livrée',
  CANCELLED: 'Annulée', CANCELED: 'Annulée', REJECTED: 'Refusée', FAILED: 'Échec', RETURNED: 'Retournée', REFUSED: 'Refusée',
  PAID: 'Payée', UNPAID: 'Non payée', PARTIAL: 'Partiellement payée', PARTIALLY_PAID: 'Partiellement payée', OVERDUE: 'En retard',
  DRAFT: 'Brouillon', SENT: 'Envoyée', ISSUED: 'Émise', CONVERTED: 'Convertie', OPEN: 'Ouverte', CLOSED: 'Clôturée',
  ACTIVE: 'Active', INACTIVE: 'Inactive', PAUSED: 'En pause', SUSPENDED: 'Suspendue', EXPIRED: 'Expirée', TRIAL: 'Essai',
  SUBMITTED: 'Envoyé', VERIFIED: 'Vérifié', APPROVED: 'Validé', DONE: 'Terminé', COMPLETED: 'Terminé', IN_PROGRESS: 'En cours',
  WAITING_SHOP: 'Réponse envoyée', WAITING_SUPPORT: 'En attente du support', RESOLVED: 'Résolu', NEW: 'Nouveau',
  IN: 'Entrée', OUT: 'Sortie',
};

const ACTION: Record<string, string> = {
  LOGIN: 'Connexion', LOGOUT: 'Déconnexion', CREATE: 'Création', UPDATE: 'Modification', DELETE: 'Suppression', ARCHIVE: 'Archivage',
  RESTORE: 'Restauration', EXPORT: 'Export', IMPORT: 'Import', PRINT: 'Impression',
  ADD_PART: 'Pièce ajoutée', REMOVE_PART: 'Pièce retirée', CREATE_RECEIVED: 'Appareil reçu', STATUS_CHANGE: 'Changement d’étape',
  SUPPORT_ACCESS: 'Accès du support Fixi', COUNTER_SALE: 'Vente comptoir', COUNTER_REFUND: 'Remboursement comptoir',
  PRINT_ATTESTATION: 'Attestation imprimée', EXPORT_REGISTER: 'Registre exporté', EXPORT_FULL: 'Export complet des données',
  RECOVERY_CODE: 'Code de secours créé', CHANGE_PIN: 'Code PIN changé', PLATFORM_RESET_PIN: 'PIN réinitialisé par Fixi',
  RECOVER_PIN: 'PIN récupéré', PAYMENT: 'Encaissement', REFUND: 'Remboursement', CASH_OPEN: 'Ouverture de caisse',
  CASH_CLOSE: 'Clôture de caisse', DISCOUNT: 'Remise', PRICE_CHANGE: 'Prix modifié', STOCK_ADJUST: 'Ajustement de stock',
};

const ENTITY: Record<string, string> = {
  USER: 'Utilisateur', SHOP: 'Boutique', REPAIR: 'Réparation', CLIENT: 'Client', CUSTOMER: 'Client', PAYMENT: 'Paiement',
  EXPENSE: 'Dépense', SUPPLIER: 'Fournisseur', STOCK: 'Stock', STOCK_ITEM: 'Article de stock', PRODUCT: 'Produit',
  PURCHASE: 'Achat', DOCUMENT: 'Document', INVOICE: 'Facture', QUOTE: 'Devis', ORDER: 'Commande', CASH_SESSION: 'Caisse',
  SETTINGS: 'Paramètres', USED_PHONE: 'Téléphone d’occasion', OCCASION: 'Téléphone d’occasion', WARRANTY: 'Garantie',
  APPOINTMENT: 'Rendez-vous', COUNTER_SALE: 'Vente comptoir', SUBSCRIPTION: 'Abonnement', DATA: 'Données',
};

const STOCK_REASON: Record<string, string> = {
  STOCK: 'Stock', STOCK_IN: 'Entrée de stock', PURCHASE: 'Achat', SALE: 'Vente', CONSUME: 'Consommation', RETURN: 'Retour',
  ADJUST: 'Ajustement', ADJUSTMENT: 'Ajustement', TRANSFER: 'Transfert', LOSS: 'Perte', INITIAL: 'Stock initial',
};

/** « BANK_TRANSFER » → « Bank transfer » : dernier recours pour un code inconnu. */
export function humanize(code: unknown) {
  const s = String(code ?? '').trim();
  if (!s) return '—';
  if (!/^[A-Z0-9_]+$/.test(s)) return s;
  const t = s.replace(/_/g, ' ').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
const pick = (m: Record<string, string>) => (code: unknown) => m[String(code ?? '').toUpperCase()] ?? humanize(code);

export const payLabel = pick(PAY);
export const statusLabel = pick(STATUS);
export const actionLabel = pick(ACTION);
export const entityLabel = pick(ENTITY);
export const stockReasonLabel = pick(STOCK_REASON);
