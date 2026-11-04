# Fixi 18.3.0 — finalisation

## Vérification complète
- Parcours de toutes les vues (bureau, mobile, sombre, arabe) : écrans en erreur corrigés.
- Audit d’accès des routes 17.3 → 18.2 : statistiques et événements des livreurs partenaires comptés correctement (filtrés par livreur, pas par société).
- Nouveau test de bout en bout « livraison complète » : livreur créé → commande préparée → affectation → journée ouverte → mauvais code refusé → livraison avec code + signature → l’atelier voit la signature → reprise demandée, acceptée et ramassée → retour clôturé → statistiques du livreur.
- Test livreurs partenaires : refusé pendant l’essai.

## Centre d’aide
- Page publique `/aide` : guide pas à pas atelier / fournisseur / livreur + FAQ, en français et en arabe.
- Liens « Aide » sur l’accueil, la connexion et le plan du site.
- Control › Croissance : message de présentation prêt à copier ou envoyer sur WhatsApp (FR/AR).

## Design, thème, animations
- Mode sombre : cartes réparations, tuiles et chiffres fournisseur, bouton Personnaliser lisibles.
- Le mode clair reste le défaut ; le sombre s’active depuis le bouton (choix mémorisé).
- Passage clair ↔ sombre en fondu (si le navigateur le permet), entrée douce des pages, tuiles qui se soulèvent au survol ; tout est coupé si « réduire les animations » est activé.
- Inscription en arabe : plus de défilement horizontal, panneau gauche traduit.
- « Bien démarrer » ne plante plus si la réponse est incomplète.
- Traductions arabes ajoutées : application livreur, filtres réparations, tuiles fournisseur.
