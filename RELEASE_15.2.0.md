# Fixi 15.2.0 — Widget Android, écrans atelier, dates en arabe

- **Widget Fixi sur l'écran d'accueil Android** (natif) : appareils prêts, en cours, en attente de pièce, clients à relancer et encaissé du jour ; toucher « Prêts » ouvre la caisse, le reste ouvre l'accueil ; actualisation toutes les 30 min ou d'un toucher, dernières données gardées hors connexion. Liaison depuis l'application : Plus → « Widget écran d'accueil » (jeton en lecture seule `WidgetToken`, aucun nom ni téléphone de client).
- **Écrans refaits** : Clients (appeler / WhatsApp en un toucher), Rendez-vous (agenda par jour, confirmer, « Client venu », rappel WhatsApp), Caisse (montant attendu en grand, écart calculé en direct à la fermeture), Achats, Équipe (rôles expliqués, code à 6 chiffres), Abonnement (textes lisibles, statuts en français).
- **Dates en arabe** : mois et jours tunisiens (جانفي، فيفري… / الإثنين…) partout où une date française s'affiche, plus ~80 nouveaux textes traduits.

Base de données : modèle `WidgetToken` (ajouté par `prisma db push`).
