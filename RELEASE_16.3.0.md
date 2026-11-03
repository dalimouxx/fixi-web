# Fixi 16.3.0 — factures, tarifs clients, inventaire, signalement

**Caisse Windows 0.7.0** (installée automatiquement par la mise à jour)
- **Facture à partir d'un ticket** : numéro qui se suit (FAC-2026-…), client avec son matricule fiscal, HT et TVA par taux, timbre fiscal (1 DT) au choix, impression A4. Si la facture existe déjà, elle est réimprimée avec le même numéro.
- **Prix propre à chaque client** : choisir un client applique automatiquement son tarif (détail ou gros), sa remise négociée en % et les prix dégressifs par quantité. Le gérant règle le tarif, la remise et le plafond dans « Clients ».
- **Plafond de crédit visible** : sous le client, la caisse affiche ce qu'il doit déjà et son plafond, et prévient avant que la vente ne fasse dépasser ce plafond.
- **Reçu de versement** imprimé après chaque paiement de dette, avec le reste à payer.
- **Inventaire au scanner** : chaque scan compte une pièce, l'écart avec le stock s'affiche, et le gérant valide pour corriger le stock. Les articles non comptés ne changent pas.
- **Gros catalogue fluide** : les produits s'affichent par paquets de 120.
- **Signaler un problème** depuis les Réglages.

**Fixi Web**
- **Caisse fournisseur** :
  - article libre, paniers en attente, tarif et remise du client appliqués automatiquement, plafond de crédit visible ;
  - « Facture numérotée » après une vente ;
  - comptage des billets et des pièces à la clôture.
- **Rapports fournisseur** : nouveaux panneaux « Les plus rentables » et « Marge faible ou à perte ».
- **Bouton « Signaler un problème »** pour l'atelier, le fournisseur et le livreur (avec une capture d'écran si besoin). Les signalements arrivent dans l'admin Fixi, onglet Support.

Base de données : `SupplierErpCustomer.priceMode` et `discountPct`, `SupplierCommercialDocument.stamp`, nouveau modèle `ProblemReport`.
