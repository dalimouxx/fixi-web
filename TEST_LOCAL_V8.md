# Tests locaux Fixi V8

Après installation : `http://localhost:3000`

## Réception Express
- `/app/repairs/new`
- Entrer un téléphone client existant.
- Choisir marque et modèle.
- Sélectionner une panne rapide.
- Créer la réparation.

## Catalogue appareils
- `/app/device-catalog`
- Ajouter une marque et un modèle.
- Vérifier qu'il apparaît à la réception.

## Compatibility Hub
- `/app/compatibility`
- Rechercher `Smart 5`.
- Rechercher `LCD-SMART5-COMP`.
- Ajouter une correspondance testée.

## Caisse Simple
- `/app/cashier`
- Encaisser une réparation prête.
- Tester Espèces et monnaie.
- Une fois le solde à zéro, tester `Livrer l'appareil`.
- Cash Pro : `/app/cashier/pro`.

## Factures
- `/app/documents`
- Créer une facture sans réparation et encaisser depuis sa fiche.
- Créer une facture liée à une réparation et vérifier la synchronisation du paiement.
- Vérifier `/app/payments`.

## Abonnements
- Boutique : `/app/subscription`
- Control : `/saas` → Abonnements.
- Créer un plan `135 DT / 45 jours`.
- Envoyer une demande depuis la boutique.
- Valider depuis Control.
