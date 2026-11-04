# Fixi 17.4.0 — Ajouter des produits devient simple (fournisseur) · Caisse Windows 0.9.0

## Espace fournisseur — « Ajouter des produits »
- **Rapide** : 3 champs seulement (nom, prix, stock). SKU généré (ECR-APL-0001…), catégorie / marque / qualité devinées depuis le nom (« Écran iPhone 13 OLED » → Écrans · Apple · OLED). Le reste est dans « Plus d’options » (coût avec marge, grossiste, photo depuis l’appareil photo, emplacement, garantie…).
- **Scanner pour créer** : lecteur USB ou caméra. Code déjà au catalogue → proposé au réapprovisionnement. Code connu sur le réseau Fixi → nom, catégorie, marque, qualité et photo pré-remplis (jamais les prix, stocks ni le nom du fournisseur).
- **Dupliquer / Créer une variante** : un clic sur une fiche reprend tout sauf code-barres et SKU.
- **En série** : tableau façon Excel, une ligne par produit, collage direct depuis Excel, lignes à corriger en rouge.
- **Excel** : modèle .xlsx à télécharger, import .xlsx ou .csv, aperçu modifiable avant d’enregistrer ; un code-barres/SKU existant met à jour prix et stock.
- API : `POST /api/supplier/products` (SKU et catégorie facultatifs), `GET …/lookup`, `POST …/bulk` (500 lignes), `POST …/parse`, `GET …/template`.

## Caisse Windows 0.9.0 — rôles
- Gérant (propriétaire, admin, manager) et responsable stock : bouton **Nouvelle pièce** (F6) et, au scan d’un code inconnu, la fiche de création s’ouvre directement (nom pré-rempli si connu sur le réseau), puis la pièce est ajoutée au panier.
- Caissier : message « demandez au gérant de créer la pièce ». Le serveur revérifie le rôle.
- Tests : `tests/v17-4.test.ts`.
