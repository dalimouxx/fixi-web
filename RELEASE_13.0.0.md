# Fixi 13.0.0 — Alertes fournisseur et accessibilité

- **WhatsApp « nouvelle commande »** : chaque commande d'une boutique envoie un WhatsApp au fournisseur (réglage dans Sons et alertes : interrupteur, numéro, message d'essai). Envoi par le compte WhatsApp Business de la plateforme ; modèle Meta approuvé requis (`WHATSAPP_NEW_ORDER_TEMPLATE`, 3 variables : boutique, référence, montant). Nouveaux champs `SupplierCompany.whatsappAlertsEnabled` / `whatsappAlertPhone`.
- **Confirmer depuis la notification** : la notification « Nouvelle commande » propose « Confirmer la commande » ; le téléphone confirme sans ouvrir l'application et affiche le résultat.
- **Gros caractères** : bouton Aa (menu Atelier, Fournisseur, en-tête Livreur, réglages des alertes). Agrandit tout l'écran de 15 %, mémorisé sur le téléphone, appliqué avant l'affichage.
- **Vidéos d'aide de 30 s** (sous-titres darija + français) : installer Fixi, activer les alertes et le son. Accessibles depuis la carte d'installation, les réglages des alertes et le bouton « ? ».
