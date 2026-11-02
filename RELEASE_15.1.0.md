# Fixi 15.1.0 — Relances, étiquettes, écrans refaits, arabe, paiement en ligne, application Android

**Atelier**
- **Relance des appareils prêts non récupérés** : liste « Appareils prêts à relancer » sur l'accueil (1re relance à 3 jours, 2e à 7 jours), bouton WhatsApp avec message et lien de suivi prêts. Envoi **automatique** chaque heure si l'atelier a WhatsApp Cloud API (`src/instrumentation.ts` lance les automatisations sans service cron séparé ; `FIXI_INTERNAL_CRON=off` pour couper).
- **Étiquette appareil** à imprimer (rouleau 50 × 30 mm) : code, client, appareil, panne, QR vers la fiche et 1 à 4 copies (`/label/[code]`, bouton « Étiquette » sur la réparation).
- **Scanner l'IMEI** à la réception (écran `*#06#` ou boîte), avec contrôle de la clé de Luhn.
- **Résumé du jour en une phrase** en tête de l'accueil.
- **Écrans refaits** : Stock (+/− en un toucher, « À racheter » → Commander), Dépenses (catégories en grandes touches, total du mois), Garanties & retours, Devis & factures (« Non payées » en tête), Analyses (« À faire » d'abord, pièces à racheter), Pièce compatible ?.

**Réseau**
- **Inviter mon fournisseur** : lien WhatsApp vers `/fournisseur/[code]`, le fournisseur demande son espace, Fixi Control voit la demande (page Fournisseurs).
- **Paiement de l'abonnement en ligne** (carte, e-DINAR, wallet via Konnect), activation automatique après vérification du paiement auprès de Konnect. Actif seulement avec `KONNECT_PLATFORM_WALLET_ID` et `KONNECT_PLATFORM_API_KEY` ; D17 et virement restent proposés.

**Arabe et finitions**
- ~330 textes des écrans refaits traduits, plus les textes avec nombres (« 8 j sans changement », « · reste 130 DT »…).
- Montants affichés « 180 DT » même en arabe ; bouton de langue intégré aux menus (atelier, fournisseur, livreur) au lieu du bouton flottant ; textes des cartes de commande fournisseur agrandis.

**Application Android**
- Projet Trusted Web Activity généré et compilé sur GitHub (workflow « Fixi Android (APK) », `android/build-twa.mjs`) : APK à installer et AAB pour le Play Store, raccourcis Réception / Fournisseur / Livreur, lien de confiance `/.well-known/assetlinks.json` (`TWA_SHA256`).

Base de données : `Repair.pickupReminderCount`, `Repair.pickupRemindedAt`, modèle `SupplierInvite` (ajoutés par `prisma db push`).
