# Fixi 17.5.0 — Croissance, fidélisation et sécurité · Caisse Windows 0.10.0

## 1. Premiers pas (ateliers en offre gratuite)
- Carte « Premiers pas » en haut de l’espace fournisseurs, calculée depuis les vraies données : adresse de livraison (modifiable directement), première commande, invitation du fournisseur habituel, première livraison, essai Pro.
- Bienvenue WhatsApp automatique à l’inscription si un modèle Meta est configuré (`WHATSAPP_WELCOME_TEMPLATE`, 1 variable : nom de la boutique) ; sinon relance manuelle depuis Control.

## 2. Essai Fixi Pro en un clic
- Les modules payants n’affichent plus un mur : page « Fixi Pro » qui met en avant le module demandé (réparations, stock, caisse…) avec le bouton « Essayer Fixi Pro N jours ».
- Un seul essai par atelier, sans paiement, retour automatique à l’offre gratuite. Durée = jours d’essai réglés sur l’offre dans Control (sinon 14 jours sur l’offre la moins chère).

## 3. Pages légales
- /conditions, /confidentialite (loi organique 2004-63), /mentions-legales ; liens dans l’inscription et le pied de page. Modèles à faire relire : `LEGAL_VALIDATED` dans `src/lib/legal.ts` retire le bandeau « version provisoire ».

## 4. Control → Croissance
- Nouveaux ateliers (30 j / 7 j), activation (commande sous 7 jours), revenu mensuel, essais en cours, abonnements perdus, inscriptions par jour et par gouvernorat.
- Listes « nouveaux inscrits », « essais qui se terminent », « inactifs depuis 7 jours » avec message WhatsApp prêt à envoyer.

## 5. Robots de parcours (CI)
- `e2e/flows.spec.ts` sur PostgreSQL neuf : inscription → essai Pro → création fournisseur → produit en 3 champs + promo → commande atelier au prix promo → réception fournisseur → double vérification admin.

## 6. Facture électronique (préparation)
- Panneau « Préparation à la facture électronique » (factures fournisseur) : matricule fiscal, raison sociale, clients pros sans matricule, TVA des produits, et démarches TunTrust / TTN. La génération TEIF viendra avec la documentation technique fournie par TTN à l’adhésion.

## 7. Fidélisation fournisseur ↔ atelier
- « Recommander » sur chaque commande ; « Vos pièces habituelles » avec la quantité habituelle.
- Promotions fournisseur : prix promo réellement appliqué à la commande (vérifié par le serveur), prix barré et badge côté atelier, notification aux ateliers clients (5 par jour max), arrêt à tout moment.

## 8. Sécurité des comptes
- Double vérification (Google/Microsoft Authenticator, 2FAS) pour l’admin Control et les comptes fournisseurs, appareil de confiance 30 jours.
- « Déconnecter tous les appareils » (versions de session).
- Caisse Windows 0.10.0 : case « Code de vérification » quand le compte est protégé ; appareil mémorisé 30 jours.
