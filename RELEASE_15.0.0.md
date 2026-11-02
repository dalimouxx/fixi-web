# Fixi 15.0.0 — Saisie rapide, lecture d'un coup d'œil, image de l'atelier

**Saisie plus rapide**
- **Pannes courantes en un toucher** à la réception (écran, batterie, connecteur, ne s'allume pas, eau, caméra, son, logiciel), avec icône ; le prix de « Pannes & prix » est repris automatiquement, les pannes propres à l'atelier suivent.
- **Photos de l'appareil à la prise en charge** : l'appareil photo arrière s'ouvre directement, jusqu'à 4 photos réduites (~1600 px) puis envoyées comme « Avant réparation ».
- **Dictée de la panne** : bouton micro à côté du champ (français ou arabe selon la langue).
- **Bouton « + » central** dans la barre du bas pour une nouvelle réparation.

**Lecture plus claire**
- **Frise d'étapes** Reçu → Diagnostic → (Attente pièce) → En réparation → Prêt → Rendu sur la fiche réparation et la page de suivi client.
- **Ancienneté** : carte bordée d'orange après 3 jours sans changement, de rouge après 7, avec « N j sans changement ».
- **Glisser une carte** sur téléphone : vers la droite = étape suivante, vers la gauche = appeler le client (vibration au point de validation).
- **Arabe en vrai miroir** : flèches, chevrons, menus latéraux, recherche, numéros et codes isolés en LTR.

**Image de l'atelier**
- **Couleur de l'atelier** (8 couleurs ou au choix) dans Paramètres → Boutique ; appliquée au reçu et à la page de suivi, avec le logo.
- **Aperçu WhatsApp du lien de suivi** : nom et logo de l'atelier (`/api/public/shop-logo/[slug]`), sans donnée client.
- **Page de suivi client refaite** : étape en cours en grand, date prévue, reste à payer, boutons Appeler et WhatsApp, devis, garantie, avis.

**Fournisseur**
- **Catalogue en grille de photos** : grandes images, prix bien visible, bouton « Ajouter » puis compteur, barre panier collante sur téléphone.
- **Commandes en colonnes** sur ordinateur (À confirmer / À préparer / Prêtes / En livraison) : glisser une commande enchaîne les étapes ; « En livraison » ouvre l'affectation du livreur.

**Finitions**
- **Vibration** courte à chaque action enregistrée, triple vibration en cas d'erreur (Android).
- **Illustrations sur les écrans vides**.
- **Visite guidée en 3 écrans** au premier lancement (atelier et fournisseur), relançable depuis l'aide.

Base de données : nouveau champ `Shop.brandColor` (facultatif), ajouté par `prisma db push` au déploiement.
