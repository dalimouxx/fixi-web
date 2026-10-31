# FIXI Smart Alerts V2 — recette sur téléphone
Date : 31 octobre 2026. **Aucune validation matérielle n'est présumée par ce document.**

## Objectif
Vérifier les notifications Supplier, Atelier et Livreur en premier plan, second plan et téléphone verrouillé. L'acceptation par une passerelle Push n'est pas une preuve d'affichage ou de sonnerie sur téléphone.

## Préconditions
- Utiliser trois comptes de test autorisés, un par rôle; ne jamais utiliser des transactions financières réelles pour les tests.
- HTTPS, notifications système autorisées, service worker actif, clé VAPID configurée.
- Android Chrome/PWA installée, et iPhone récent avec PWA ajoutée à l'écran d'accueil lorsque nécessaire.
- Un téléphone connecté sur Wi-Fi puis réseau mobile, un second téléphone pour déclencher un événement.
- Réglages volume et mode silencieux documentés; ne pas tenter de contourner les réglages OS.

## Test 1 — vérifier l'inscription de l'appareil
1. Ouvrir FIXI connecté au bon compte; ouvrir la cloche puis Diagnostic.
2. Contrôler service worker, abonnement navigateur et statut « Compte FIXI connecté à Push ».
3. Activer Push si nécessaire. Un abonnement déjà présent mais non associé au compte doit être rattaché, pas supprimé.
4. Déconnecter / reconnecter; vérifier que l'appareil reste rattaché au **bon compte**.
5. Si le serveur refuse l'abonnement, afficher l'erreur HTTP au lieu d'indiquer un faux succès.

## Test 2 — test sonore en application ouverte
1. Dans Diagnostic, « Tester le son » doit faire entendre la signature correspondant au rôle après interaction utilisateur.
2. Déplacer le volume de 80 à 30 %, puis à 0 %; confirmer la variation et la coupure.
3. Test avec écran non interactif au départ : message d'activation requis au lieu de promettre la lecture.
4. Vérifier chaque rôle, la lisibilité du toast, le lien de détail et l'absence de son quand silence activé.

## Test 3 — test Web Push
1. « Envoyer un Push test », constater « envoi accepté par la passerelle » ou une erreur réelle (absent/expiré/échec).
2. Vérifier manuellement l'affichage sur le téléphone; noter délai et éventuel son.
3. Répéter avec l'application au second plan, puis écran verrouillé.
4. Si la passerelle accepte mais rien ne s'affiche, vérifier permissions navigateur, OS, mode Concentration/Silence, économie batterie et installation PWA.
5. Confirmer la limite d'un test par minute par compte.
6. En cas d'abonnement expiré, le serveur doit le supprimer; réactiver ensuite Push.

## Test 4 — événement métier réel sur comptes de test
- Supplier : créer une commande atelier de test; le bon fournisseur reçoit une alerte.
- Livreur : nouvelle mission de test; le bon livreur voit l'alerte, mission et lien.
- Atelier : fournisseur confirme / prépare une commande fictive; atelier reçoit le changement.
- Déclencher deux commandes distinctes rapidement : deux notifications distinctes doivent rester visibles (sans se remplacer par type).
- Vérifier que la notification d'une société A n'arrive jamais sur un compte B.
- Ouvrir l'alerte depuis l'écran verrouillé et confirmer l'ouverture du bon écran autorisé.

## Test 5 — réseau et reprise
- Couper puis rétablir le réseau; vérifier le contenu du centre notifications après reconnexion.
- Ouvrir/fermer la PWA; tester les notifications en page visible et navigateur fermé.
- Déconnecter le compte : ne pas dévoiler de données protégées dans les notifications ou via un ancien abonnement.
- Vérifier que les mouvements financiers terminés restent terminés même si l'envoi Push échoue.

## Critères de sortie
- Pas d'échec HTTP Push ignoré comme « envoyé ».
- Pas de doublon de notification dans la même session ou remplacement intempestif de deux commandes différentes.
- Aucun accès cross-company/tenant.
- Test documenté par appareil/version navigateur/date/permissions/gateway accepted et réception réelle.
- La sonnerie sur écran verrouillé dépend de l'OS : elle n'est pas garantie par une PWA.
