# FIXI Caisse Windows & étiquettes — spécification V1
Date : 2026-10-20
Statut : conception (aucune migration ni fonctionnalité déployée)

## Objectif
Étendre le module existant `src/components/supplier-pos.tsx` en caisse Windows installable, en respectant la capture fournisseur communiquée par le propriétaire. Conserver FIXI Web comme source métier et éviter de dupliquer les ventes, dettes et stocks.

## Architecture
- Interface : React + TypeScript et composants métier partagés; le dépôt utilise actuellement Next.js 15 / React 19 / Prisma / PostgreSQL.
- Windows : shell Tauri 2 en application séparée, adapté aux routes/API serveur; ne pas supposer que l'application Next.js serveur peut être intégrée telle quelle dans une WebView hors ligne.
- Offline : SQLite local chiffré ou protégé selon l'OS; file des commandes locales, identifiants UUID, synchronisation idempotente, résolution des conflits; aucun paiement/stock partagé ne doit être réputé confirmé sans validation serveur.
- Drivers : abstraction `PrintProvider` pour imprimantes tickets et étiquettes, avec capacités configurables; liaison/native Windows à tester avec modèles d'imprimantes réels.

## UX caisse
Respecter la référence utilisateur (menu vertical gauche, catégories/produits au centre, panier et totaux à droite).
Parcours : ouvrir session; choisir entrepôt; scanner SKU ou code-barres; ajouter au panier; quantité/remise autorisée; choisir client; encaisser comptant, mixte ou partiel; valider transaction unique; imprimer ticket; consulter détail et retour.
Écrans : caisse, produits, stock, clients, comptes/dettes, historiques, retours/avoirs, sessions, réglages imprimantes, studio étiquettes.
Modes fournisseur/atelier définis par rôle et permissions, sans exposer prix d'achat à l'atelier.

## Étiquettes produit
- Deux modèles : compact et complet.
- Champs : nom produit, référence/SKU, fournisseur (nom affichable; s'il est indisponible signaler manquant), marque/modèle, prix selon configuration, identifiant/barcode Code 128, signature FIXI; option date réception / n° lot.
- Distinction capitale : étiquette **produit** répétée pour N unités (même code SKU) vs étiquette **unité sérialisée** (N codes uniques suivis par unité). Ne jamais générer un même identifiant unitaire unique pour plusieurs colis différents.
- Formats configurables 40×30, 50×30, 60×40 mm et profils personnalisés; DPI/calibrage, marges, noir/blanc, rotation, densité, aperçu 1:1.
- Déclencheurs : création/édition produit; réception stock; sélection en masse; réimpression. Par défaut, quantité imprimée = quantité réceptionnée, modifiable avant validation.
- Travail impression avec `jobId`, ligne(s), nombre de copies, état (créé/envoyé/confirmé/erreur), poste, opérateur, horodatage, tentatives; journal et réimpression justifiée. Une impression n'augmente jamais le stock.
- Vérifier scanner sur impression réelle; ne pas utiliser simplement un dessin de barres sans encodage Code 128 valide.

## Transactions et audit
- Vente immuable après validation : corrections par avoir, retour ou remboursement tracé.
- Paiement partiel : un solde restant dû unique calculé sur écritures; éviter les paiements doubles par idempotency key.
- Livraison : montant reçu par livreur, montant transmis au fournisseur, preuves, statut de confirmation et écart de caisse suivis séparément; un versement au livreur n'est pas automatiquement un règlement fournisseur.
- Multi-entrepôts, réservations et stock réellement disponible; pas de stock négatif sans permission explicite.
- Sauvegarde locale, autorisations rôles, journal des opérations critiques et restauration après panne.
- Risque ouvert préexistant : le document `docs/AUDIT_FIXI_COMMANDES_NOTIFICATIONS_2026-10-19.md` signale un besoin P0 d'unifier les encaissements livreur/fournisseur avant extension d'un POS connecté.

## Critères de recette
1. 20 pièces identiques -> 20 étiquettes produit, même SKU, code lisible, bon fournisseur et FIXI visibles.
2. 20 pièces sérialisées -> 20 identifiants uniques, correspondances stables en stock.
3. Plusieurs SKU dans le même lot -> quantités exactes, pas d'étiquette manquante/dupliquée.
4. Reprise d'impression après erreur -> journal fiable et possibilité de cibler les manquants.
5. Une vente offline synchronisée deux fois -> une seule vente comptabilisée.
6. Paiement partiel puis retour -> solde cohérent, avoir et écritures explicites.
7. Tickets 58/80mm et étiquettes sur matériel réel -> impression correctement alignée.
8. Caisse Windows et Web -> mêmes références et aucune divergence de stock après synchronisation.

## Découpage livraison
P0 : stabiliser grand livre, états du POS et opérations idempotentes.
P1 : interface fournisseur/atelier commune, tickets, scan, paiement et stock.
P2 : studio étiquettes, génération Code 128, aperçu, lots et pilotes.
P3 : packaging Tauri Windows, SQLite, sync offline, tests appareils et installation.
P4 : validation pilote avant ouverture à l'ensemble des abonnés.
