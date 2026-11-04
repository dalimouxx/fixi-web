# Fixi 18.0.0 — Un seul système de design (clair, sombre, arabe) et espace atelier

- **Jetons communs** : tous les écrans 17.x (inscription, produits, premiers pas, promos, relances, demandes de pièces, reprises, sécurité, croissance…) utilisent les couleurs du système Fixi (`--fx-*`) au lieu de couleurs figées : ils suivent automatiquement le mode sombre.
- **Mode sombre** : suit le réglage du téléphone/ordinateur tant que l’utilisateur n’a pas choisi ; bouton clair/sombre ajouté à l’espace fournisseur et à l’application livreur ; coquille fournisseur (menu, en-tête, panneaux, champs) entièrement sombre.
- **Arabe** : ~200 nouvelles traductions pour les écrans 17.x ; marges et alignements en propriétés logiques (droite ↔ gauche) ; flèches retournées ; montants, quantités et âges gardés de gauche à droite.
- **États communs** (`ui-states.tsx`) : squelettes de chargement, écran vide avec action, erreur avec « Réessayer » (utilisés dans Control → Croissance, puis dans la refonte atelier).
- **Détails natifs** : entrée douce des écrans, retour tactile homogène sur les boutons, pas de surbrillance grise au toucher, focus clavier visible, respect de « réduire les animations ».

## Espace atelier (18.0)
- Fiche réparation : titre lisible sur une ligne, actions regroupées à droite (ou dessous sur petit écran).
- Réparations : filtres rapides **Urgents**, **Bloqués 3 j+**, **Solde à encaisser** (compteurs), appliqués au Kanban, au tableau et à la vue téléphone.
- Caisse : champ de recherche net, liste lisible, écran vide avec action « Voir les réparations ».
