# Fixi 17.3.0 — Inscription libre des ateliers

- Nouvelle page publique **/inscription** : un réparateur crée seul son compte (boutique, gouvernorat, ville, gérant, téléphone, code PIN à 6 chiffres).
- Le compte reçoit automatiquement l’offre **Fixi Connect gratuite** (abonnement actif, sans date de fin, 0 DT) et le gérant est connecté directement sur l’espace fournisseurs.
- Contrôles : 24 gouvernorats, téléphone tunisien (+216), PIN trop simple refusé, confirmation du PIN, un compte par numéro, 3 inscriptions par adresse et par 24 h, champ piège anti-robots, identifiant de boutique unique généré depuis le nom.
- Boutons « Commencer », « Essayer gratuitement », « Créer mon atelier » et « Choisir » de la page d’accueil → /inscription ; lien « Créer un compte gratuit » sous la connexion.
- Tests : `tests/v17-3.test.ts`.
