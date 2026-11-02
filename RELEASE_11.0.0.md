# Fixi 11.0.0 — « Simple »

Objectif : rendre Fixi clair et simple pour le réparateur et le fournisseur de base.

## Visuel
- **Un seul système de design** (`src/app/fixi-design-system.css`). Les 11 anciennes feuilles restent dans la couche CSS `legacy` : le nouveau système passe toujours devant, sans course à la spécificité.
- Une seule couleur d'action (orange Fixi), contraste vérifié. **Couleurs de statut fixes** partout : Reçu gris, Diagnostic indigo, En réparation bleu, Attente pièce jaune, Prêt vert, Livré noir.
- Texte de base 16 px, boutons et champs de 48 px (tactile au comptoir), police système (meilleur rendu de l'arabe).
- Thème clair par défaut, sombre optionnel ; respect de « réduire les animations », « réduire la transparence » et « contraste élevé ».
- Animations sobres : retour au toucher immédiat (120 ms), feuilles d'aide/menu interruptibles (280 ms), aucune animation sur la recherche ouverte au clavier.

## Atelier
- **Menu en 6 entrées** au lieu de 38 : Accueil, Réparations, Clients, Caisse, Pièces, Plus. Noms en français simple (Conseils, Rappels automatiques, Ce que je dois…).
- **Mode Simple / Avancé** (en bas du menu). Simple par défaut : les modules experts sont masqués du menu mais restent accessibles par la recherche.
- Menu filtré par rôle (le technicien voit « Mes réparations », le stock et la compatibilité).
- **Barre d'onglets mobile** (Accueil, Réparations, Caisse, Pièces, Plus).
- **Accueil « Que voulez-vous faire ? »** : 4 grosses tuiles, 3 chiffres, « À faire maintenant », derniers appareils. Graphiques en Mode Avancé.
- **Fiche réparation** : bouton « étape suivante » (diagnostic → réparation → prêt → encaisser et rendre), messages **WhatsApp en un clic** (FR/AR), **« Commander chez mon fournisseur »** quand une pièce manque.
- **Fin de journée** (`/app/fin-de-journee`) : encaissé par mode, dépenses, net, appareils reçus/rendus, prêts à récupérer, envoi WhatsApp / impression.
- **Recherche universelle** (Ctrl K ou barre du haut) : téléphone, code, IMEI, client, pièce, facture.
- **Aide contextuelle** (bouton « ? ») pour chaque écran, en français et en arabe, avec emplacement pour une vidéo courte.
- Connexion : boutique mémorisée, on choisit directement son profil puis son code.
- Choix de la langue au premier lancement.
- Messages d'erreur compréhensibles (plus de `MODULE_PREMIUM_REQUIS` à l'écran).
- **Données de démonstration** : proposées à la fin de l'assistant de démarrage, supprimables dans Paramètres.
- Paramètres : réglages techniques (IA, intégrations) visibles seulement en Mode Avancé.

## Fournisseur
- **Menu en 6 entrées** au lieu de 17 : Accueil, Vendre, Produits, Clients & argent, Livraison, Plus, avec sous-onglets.
- Mode Simple / Avancé (Dépôts, Prix par quantité, Comptage, Catégories, Mes fournisseurs, Bénéfice en Avancé).
- Accueil : 4 actions, 3 chiffres en Mode Simple, accès « Fin de journée ».

## Plateforme
- **Mesure d'usage** : chaque écran Atelier ouvert est compté (sans donnée client). Fixi Control → onglet « Usage des écrans » liste les écrans utilisés et ceux jamais ouverts.

## Base de données
- Nouveau modèle `UsageEvent` (créé automatiquement par `prisma db push` au déploiement, aucune donnée existante modifiée).

## Nouvelles routes
- `GET /api/search`, `GET /api/reports/end-of-day`, `GET|POST|DELETE /api/demo-data`, `POST /api/usage`, `GET /api/platform/usage`.
