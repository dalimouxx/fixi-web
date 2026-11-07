# FIXI One — prototypes UX isolés (V1)

## Pourquoi ?
Les retours utilisateurs ont montré que des couches CSS successives ne suffisent pas à rendre FIXI lisible. FIXI One est une **reconstruction de l'expérience utilisateur**, avec une navigation et une hiérarchie réinventées. L'objectif est de choisir le design avant toute migration des écrans de production.

## Prototypes interactifs réalisés
Route sur la branche : `/design-preview/fixi-one` (elle n'existe pas sur la production tant que cette branche n'est pas fusionnée).

- **Supplier Desktop** : navigation claire en huit sections, tableau de bord, liste d'actions, commandes filtrables et recherche par client/produit, prix gros et détail, aperçu de caisse avec panier et quantités *en simulation*, alertes de démonstration et sections clients/dettes/livreurs/rapports.
- **Atelier Mobile** : écran d'accueil simplifié, Réception Express démontrée (marque/modèle/panne), réparations, commandes et dettes.
- **Livreur Mobile** : carte de mission lisible, grosse action unique avec progression Accepter → Démarrer → Arrivé → Livré, historique et caisse démo.

## Garde-fous
1. Aucun appel API, aucune session réelle, aucune donnée financière réelle.
2. Toutes les personnes, entreprises, références, prix et quantités sont **fictifs** et affichés comme tels.
3. Code isolé dans `src/components/fixi-one/` et `src/app/design-preview/fixi-one/`, styles **CSS Modules** encapsulés. Aucun changement du thème, des routes ou des composants de production.
4. Ne pas fusionner sur `main` avant validation du rendu, test responsive / clavier, correction des points d'ergonomie, puis décision explicite de migration.
5. Si un jour le prototype doit être déployé pour tests, le protéger avec contrôle d'accès; éviter d'exposer publiquement des fonctions simulant un système métier.
6. Le prototype sera transposé en composants réutilisables `Design Tokens → Shell → navigation → formulaires → tableaux → flux`, un module par PR.

## Critères de validation avec les utilisateurs
- Supplier : trouver une commande et ouvrir une simulation de caisse sans aide en moins de 30 s.
- Atelier : démarrer une réception en deux interactions et retrouver une dette fournisseur.
- Livreur : comprendre la prochaine étape de livraison sans formation, sans confondre prix de la commande et somme encaissée.
- Texte lisible et boutons faciles à toucher sur petit smartphone, écrans 390px et 320px, mode zoom.
- Notifications futures : signal visuel prioritaire + statut système clair + son testable et configurable, en respectant Android/iOS.
- Locale FR et arabe RTL à traiter durant l'intégration définitive; maquette initiale en FR.

## Direction visuelle proposée
- Blanc #FFFFFF, fond #F5F7F6, texte #17212B, accent vert #087F6D et sélection #E6F4EF.
- 3 tailles de titres, 1 style de texte courant, montants lisibles, 1 action principale par vue.
- L'interface Livreur **n'est pas** une version miniature de l'ERP Supplier.
