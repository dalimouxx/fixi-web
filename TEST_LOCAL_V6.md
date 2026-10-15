# Test local Fixi V6

## Installation neuve (recommandée pour le premier test)
Avec Docker Desktop démarré :
```bash
chmod +x install.sh
./install.sh
```
Ouvrir `http://localhost:3000`.

## Scénario Cash Pro
1. Créer un caissier avec PIN 6 chiffres.
2. Créer une réparation, définir un prix, la passer à Prêt.
3. Ouvrir `/app/cashier`.
4. Tester un paiement combiné : Espèces + D17.
5. Tester une remise supérieure au seuil et vérifier la demande du PIN gérant.
6. Vérifier le reçu, le reste, puis la livraison.

## Paiement en ligne local
En environnement non-production, si Konnect est désactivé, Fixi génère un lien MANUAL de test. Ouvrir le lien `/pay/...` et utiliser la simulation locale.

## Supplier
1. Dans `/saas/suppliers`, créer une société et un compte fournisseur.
2. Se connecter sur `/supplier/login`.
3. Ajouter plusieurs produits avec stock.
4. Dans la boutique, ouvrir `/app/suppliers` et commander.
5. Côté fournisseur : confirmer → préparer → prêt → en livraison → livré.
6. Côté boutique : `Réceptionner en stock` et vérifier Stock + Mouvements.

## Push
Autoriser les notifications depuis le bouton Push de la barre supérieure. Les Push nécessitent des clés VAPID valides et HTTPS hors localhost.

## Fixi Ads Business
Créer une campagne dans `/saas`, choisir budget et CPM/CPC, l'activer, puis vérifier Queue/Track/Landing et les compteurs.

## Réseau / franchise
Créer plusieurs boutiques sous le même client/tenant depuis Fixi Control, puis ouvrir `/app/network` depuis une des boutiques administratrices.
