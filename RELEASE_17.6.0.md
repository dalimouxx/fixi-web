# Fixi 17.6.0 — Encaisser plus vite, livrer sans attente

## Fournisseur
- **Relances de paiement** (onglet « Qui me doit ») : clients en retard triés par ancienneté (couleur J+7 / J+15 / J+30), relevé de compte, message WhatsApp prêt, relance en un clic (notification dans Fixi pour les ateliers).
- **Relances automatiques** activables : une relance par palier, jamais deux en 5 jours ; passe quotidienne au chargement du tableau et via la tâche planifiée `POST /api/system/supplier-jobs` (`x-cron-secret`).
- **Plafond de crédit appliqué aux commandes des ateliers** : la commande qui le dépasserait est refusée avec le montant à régler.
- **« En attente »** sur les fiches produits : nombre d’ateliers qui attendent une pièce épuisée.

## Atelier
- **« Me prévenir »** sur une pièce épuisée : notification dès son retour en stock.
- **« Votre livreur arrive dans ~N min »** (notification + badge sur le suivi), calculé sur le GPS.
- Premiers pas : « Je suis à la boutique : utiliser ma position » pour enregistrer la position GPS de l’atelier.

## Livreur
- Nouveau motif **« Atelier fermé »**, motifs rapides, **photo de preuve** et position GPS jointes aux incidents.
- Client absent / atelier fermé : **nouvelle tentative programmée automatiquement** (3 passages maximum), atelier et fournisseur prévenus.
- La première arrivée chez un atelier sans position enregistrée fixe sa position GPS.
