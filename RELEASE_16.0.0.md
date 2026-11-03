# Fixi 16.0.0 — 11 nouveautés atelier, fournisseur et gestion

**Atelier**
- **Commander la pièce depuis la réparation** : le bouton ouvre le catalogue fournisseur déjà filtré, par exemple « écran Galaxy A54 ». Il apparaît sur la fiche et sur les cartes « Attente pièce ».
- **Alerte IMEI suspect** : on peut signaler un IMEI perdu ou volé. À la réception, Fixi prévient si d'autres ateliers l'ont signalé, sans jamais dire lesquels.
- **Prix conseillé du réseau** : médiane et fourchette pour la même panne sur le même modèle, sur les 12 derniers mois. Rien ne s'affiche sous 3 ateliers différents, aucun atelier n'est nommé, et un toucher reprend le prix.
- **Note vocale** : jusqu'à 60 secondes, enregistrée avec la réparation et réécoutable dans « Photos, documents & signatures ».
- **Écran client au comptoir** (`/comptoir` sur une tablette ou un vieux téléphone) : le bouton « Montrer au client » y affiche l'appareil, la panne, le prix et la garantie, et le client signe la prise en charge avec le doigt.
- **Paiement en plusieurs fois** : de 2 à 6 échéances mensuelles sur le reste à payer, avec leur état (payée, aujourd'hui, en retard). Une ligne « échéance(s) à encaisser » apparaît sur l'accueil, et un rappel WhatsApp part automatiquement avec WhatsApp Cloud API.

**Fournisseur**
- **Catalogue partageable par WhatsApp** : page publique `/catalogue/[société]`, privée par défaut et activable ou désactivable. On y trouve recherche, prix et disponibilité, avec les boutons « Commander sur Fixi » et WhatsApp.
- **Tournée optimisée du livreur** : l'ordre des arrêts part de la position GPS du livreur et va au plus proche, avec les kilomètres et l'itinéraire Google Maps complet.
- **À racheter bientôt** : moyenne commandée par semaine sur 8 semaines, quantité à racheter pour tenir 2 semaines, et bouton « Racheter ».

**Gestion**
- **Rapport du mois** (`/app/rapport-mensuel`) : encaissé, bénéfice estimé, pannes les plus fréquentes, techniciens et modes de paiement. Il s'imprime en PDF.
  - Un bandeau l'annonce sur l'accueil du 1er au 7 du mois.
  - Il est envoyé sur WhatsApp au gérant du 1er au 3 du mois, avec WhatsApp Cloud API.
- **Export pour le comptable** : un fichier Excel par mois, avec les feuilles Résumé, Encaissements, Dépenses et Factures & TVA.

Base de données : `RepairInstallment`, `ImeiReport`, `AttachmentType.VOICE_NOTE`, `Shop.counterRepairCode` / `counterUpdatedAt` / `lastMonthlyReport`, `SupplierCompany.publicCatalog`. Dépendance ajoutée : `exceljs`.
