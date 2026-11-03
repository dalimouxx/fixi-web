# Fixi 15.3.0 — Widget pour tous les espaces, APK en téléchargement direct, fournisseur lisible

- **Widget Android corrigé et étendu** : il s'adapte à la taille (petite taille = une ligne avec les 3 chiffres, sans rien de coupé). Le contenu dépend de l'espace relié :
  - atelier : prêts, en cours, en attente de pièce, avec les clients à relancer et l'encaissé du jour ;
  - fournisseur : à confirmer, à préparer, prêtes, avec les commandes en livraison et les livrées du jour ;
  - livreur : mes missions, disponibles, livrées, avec l'encaissé du jour.
  La liaison se fait en 2 touchers (« Ajouter le widget Fixi » puis « Terminer »), car Chrome exige un geste pour ouvrir l'application. Le bouton est disponible dans l'atelier (menu Plus), l'espace fournisseur et l'application livreur.
- **Téléchargement direct de l'APK** : page `/android` (bouton Télécharger, 3 étapes, QR code pour l'ordinateur) et lien court `/telecharger/android`.
  - Chaque modification de l'application Android sur `main` recompile l'APK et le publie (version GitHub « android-latest »).
  - La fenêtre d'installation propose l'APK sur Android.
  - L'écran Équipe a un bouton « Envoyer par WhatsApp » pour transmettre le lien aux techniciens.
- **Onglets secondaires du fournisseur** : l'en-tête ne recouvre plus les sous-onglets sur téléphone, les champs de recherche ne sont plus écrasés, et la taille minimale des textes est passée de 7–9 px à 12 px.
- Environ 30 nouveaux textes traduits en arabe.

Base de données : `WidgetToken.kind`, `WidgetToken.companyId`, `WidgetToken.shopId` devient facultatif.
