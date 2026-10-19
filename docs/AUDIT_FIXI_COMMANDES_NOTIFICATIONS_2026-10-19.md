# Fixi — audit ciblé du parcours commande → livraison → finances
Date : 19 octobre 2026 · Révision : notifications / sécurité / ergonomie

> Portée : revue du code des trois applications (Boutique, Supplier, Delivery), des API et des mécanismes de notifications, ainsi que vérification de la compilation CI et des logs Render. **Ce document n'est pas un audit exhaustif de tous les modules ni une recette mobile avec comptes réels.** Aucun paiement réel n'a été créé pour tester.

## Corrigé dans cette vague (code + tests)

| Priorité | Constat vérifiable dans le code initial | Correction |
|---|---|---|
| P0 | Le QR du bon de livraison et sa ligne « code de remise » exposaient le secret au livreur. | QR logistique **FIXI-TICKET:référence** sans secret ; le QR **FIXI-DELIVERY:code** reste réservé à l'app Boutique. |
| P0 | Des API livreur renvoyaient la propriété `deliveryCode` et parfois `delivery.proofCode`, permettant une fausse validation. | Réponses minimisées dans GET, PATCH, POST et tickets ; journal ne copie plus le code de preuve. |
| P0 | Une confirmation de remise échouée pouvait afficher « Livraison confirmée » parce que le helper silencieux interceptait l'erreur. | Requête explicite avec gestion des erreurs ; confirmation seulement après succès réel. |
| P1 | Le bouton « Confirmer » côté fournisseur pouvait sauter préparation et rendre la commande immédiatement disponible au livreur. | Parcours PENDING → CONFIRMED → PREPARING → READY_FOR_DELIVERY restauré. |
| P1 | L'annulation concurrente d'une commande pouvait remettre deux fois les pièces en stock. | Transition conditionnelle atomique avant la restitution des produits. |
| P1 | Un livreur pouvait être affecté ou réaffecté même sur une commande non prête/terminée. | Affectation vérifiée, refus des missions déjà affectées ; routage piloté par rôle. |
| P1 | Le catalogue et les commandes Boutique retournaient les propriétés internes du produit (coûts d'achat, prix internes, etc.). | Projection publique stricte ; stock affiché = stock disponible non réservé. |
| P1 | Les notifications de trois applications avaient le même signal et leurs liens Supplier ne fonctionnaient pas toujours. | Identités indépendantes, sons distincts, notifications dédoublonnées et liens d'écran corrigés. |
| P1 | L'arrivée physique du livreur n'était pas distinguée de la remise du colis. | Événement `ARRIVED_AT_SHOP` unique et horodaté, bouton « Je suis arrivé », notifications des 3 acteurs. |
| P2 | La recherche Boutique pouvait être réinitialisée par un rafraîchissement utilisant une ancienne valeur de recherche. | Requête basée sur la recherche courante ; polling réduit. |
| P2 | Les tableaux Supplier/Livreur réinterrogeaient de nombreuses API toutes les 5–6 secondes. | Fréquence réduite, temps réel et rafraîchissement au retour au premier plan conservés. |

## Identité de notification souhaitée

- **Supplier · nouvelle commande** : carte orange, mélodie ascendante `SUPPLIER_ORDER`, référence, boutique, montant, lien sur les commandes.
- **Boutique · état changé** : carte indigo, `SHOP_PROGRESS`, puis `SHOP_DELIVERED` à la remise.
- **Livreur · mission disponible** : carte turquoise, motif `DRIVER_MISSION` distinct et action « Accepter la mission » en push quand le navigateur la prend en charge.
- **Livreur · arrivée confirmée** : `DRIVER_ARRIVAL`, lieu/heure enregistrés, boutique et fournisseur informés.
- **Livreur · remise confirmée** : `DRIVER_SUCCESS`, carte de réussite, preuve et destinataire enregistrés.
- Les sons sont désactivables et courts. Les **sons personnalisés ne sont garantis que dans une page/PWA active après interaction** ; en arrière-plan, son, vibration et actions sont contrôlés par l'OS/navigateur. Les notifications Push requièrent VAPID, installation/autorisation selon appareil.

## Risques ouverts — à traiter avant une utilisation financière intensive

### P0 · Unification des encaissements (non corrigé ici)

Les chemins historiques `/api/delivery/events` (`COD_COLLECTED` et `DUE_COLLECTED`) et `/api/delivery/customers/[shopId]/due` peuvent modifier directement l'ERP alors que le nouveau flux `/api/supplier/settlements/driver` crée une collecte `PENDING` à confirmer. Cette coexistence peut produire des montants divergents ou un historique incomplet des espèces non encore remises au fournisseur.

**À faire :** un seul grand livre de référence par facture + livreur + boutique ; paiement en attente de confirmation ; preuve/reçu, idempotency key, clôture de tournée et remise partielle tracée ; scripts de rapprochement des anciennes écritures ; tests concurrents sur achats, retours et soldes.

### P0/P1 · Contrôle des transitions et documents historiques

Les bons déjà imprimés **avant** ce correctif ont pu contenir un code secret. Réévaluer/renouveler les codes des livraisons ouvertes dont un bon a été partagé ; cette opération nécessite une procédure explicite pour ne pas invalider silencieusement les codes de l'Atelier. Vérifier aussi les autres chemins Supplier de livraison manuelle : aucun `DELIVERED` ne devrait contourner la preuve de réception.

### P1 · Validation bout en bout

Tester en comptes réels de démonstration (pas en argent réel) : une commande, confirmation, préparation, affectation, arrivée, lecture du QR côté Atelier, remise, paiement partiel, litige et retour. Vérifier les notifications avec application ouverte, en arrière-plan, sur Android Chrome, iPhone PWA et tablette.

### P1 · Fiabilité des notifications à l'échelle

Le flux SSE est appuyé par un bus `EventEmitter` en mémoire, adapté à une instance unique. Une architecture multi-instance nécessitera un bus partagé (Redis/pubsub ou base/queue) et des notifications durables. Les rafraîchissements périodiques restent en secours.

### P2 · Cohérence UI et architecture des modules

Les interfaces utilisent encore de gros composants et un CSS global volumineux. Planifier une bibliothèque de composants partagés : navigation, cartes, statuts, factures, formulaires, fenêtres de confirmation, transactions, tableaux adaptatifs, textes et erreurs. Ne pas refondre simultanément tous les écrans avec risque de régression.

### P2 · Comptes et qualité de service

Examiner la protection anti-bruteforce des connexions, la gestion des privilèges dans les API non examinées, les sauvegardes et la supervision. Mettre en place un environnement de staging/démonstration et des tests E2E automatisés. **Échéance de la base Render gratuite connue pour novembre 2026 : prévoir sauvegarde et migration vers une base persistante payante.**

## Vérifications de livraison

Les étapes CI (Prisma Validate + Prisma Generate + TypeScript + tests + Next.js build) doivent être vertes avant fusion. Le déploiement Render ne doit être déclaré « prêt » qu'après statut `live`, synchronisation PostgreSQL, démarrage et absence d'erreur critique dans les derniers logs. Une compilation réussie ne remplace pas des tests réels des paiements ni les validations UX sur téléphone.
