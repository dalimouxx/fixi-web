# Fixi 17.0.0 — dictée réparée, nouvelle identité, application livreur pro

**Dictée et commandes vocales**
- **Cause de la panne** : le serveur interdisait le micro à toutes les pages (`Permissions-Policy: microphone=()`), donc la dictée, le copilote vocal, Fixi Brain et la note vocale ne pouvaient jamais démarrer. Le micro est maintenant autorisé pour Fixi seulement.
- **Pendant la dictée** : le texte s'affiche en direct. Si ça bloque, un message clair dit pourquoi : micro refusé, pas d'Internet, rien entendu, langue indisponible. En arabe, si `ar-TN` n'est pas disponible, la dictée passe automatiquement à l'arabe standard.

**Identité commune**
- Police **Manrope** partout : Fixi Web et Caisse Windows. Elle est intégrée à l'application, donc elle marche aussi hors connexion.
- Chiffres alignés, appui tactile animé, blocs qui apparaissent en cascade, pastille animée sur l'onglet actif, bandeaux de notification avec une entrée animée.
- **Atelier et fournisseur** : l'accueil commence par un bandeau sombre de la journée (date, résumé, chiffres du jour).

**Application livreur (mobile)**
- **En-tête** : avatar, état de la connexion et notifications.
- **Bandeau de service** : en service ou hors service, interrupteur « Disponible », livrées, encaissé et incidents du jour, GPS, fin de journée.
- **Nouvelles missions** : carte mise en avant, **glisser pour accepter**, et une vibration, un son et un bandeau à chaque nouvelle mission.
- **Livraison en cours** :
  - étapes Acceptée → En route → Arrivé → Remise ;
  - montant à encaisser bien visible ;
  - gros boutons Itinéraire, Appeler, Encaisser, Dû client, Bon, Problème ;
  - **glisser pour partir / je suis arrivé / confirmer la remise**.
- **Prochains arrêts** numérotés, avec optimisation de la tournée.
- **Onglets en bas** (Missions, Dus, Historique, Ma caisse), aussi sur la page Caisse.
- **Menu du livreur** : langue, taille du texte, widget, signaler un problème, déconnexion.
- **Connexion** refaite.

**Caisse Windows 0.8.0 — thème FIXI Pro**
- Vrai logo FIXI (menu, connexion, verrouillage, écran client) et écran de démarrage animé.
- Heure et date en haut de la caisse.
- Couleur et icône par catégorie sur chaque produit (écrans, batteries, connecteurs, caméras…).
- Panier façon ticket de caisse, total en grand, boutons aux couleurs de la marque, connexion refaite.
