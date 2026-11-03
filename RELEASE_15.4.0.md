# Fixi 15.4.0 — Sons Fixi même téléphone verrouillé (application Android)

- L'application Android affiche les notifications de Fixi dans ses propres canaux, chacun avec son son :
  - **Nouvelles commandes** : tiroir-caisse répété 3 fois ;
  - **Nouvelles livraisons** : alerte forte répétée 3 fois ;
  - **Suivi en cours** : clochette ;
  - **Terminé** : montée joyeuse ;
  - **Autres messages** : son doux.
- Ces sons sont joués par le téléphone lui-même, donc audibles écran verrouillé.
- Le résumé de l'écran verrouillé et le suivi de livraison restent silencieux (canal « Résumé et suivi »).
- Chaque son se change dans Paramètres Android → Notifications → Fixi ; une note l'indique sous « Alertes activées ».
- Le service worker indique la catégorie dans l'étiquette de la notification (`fx-orders|…`) ; sans l'application Android, rien ne change.
