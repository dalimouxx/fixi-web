# Passage V3 → V4

## Avant toute mise à niveau
1. Faire `./backup.sh`.
2. Conserver l’ancien `.env`.
3. Arrêter l’application : `docker compose down`.
4. Remplacer le code par V4 sans supprimer `.env`, `backups` ni les volumes Docker.
5. Lancer `docker compose up -d --build`.

Le démarrage exécute `prisma db push` et ajoute les nouvelles colonnes/tables sans supprimer volontairement les données existantes.

## PIN 6 chiffres
V4 impose exactement 6 chiffres. Les comptes V3 déjà créés avec 4 chiffres doivent recevoir un nouveau PIN depuis **Équipe**. Le compte admin initial V3 récent utilisait déjà 6 chiffres.

## Région
Une ancienne boutique encore marquée `Non classée` reçoit `INITIAL_SHOP_REGION` au seed (Gabès par défaut). La région peut ensuite être modifiée depuis Fixi Control.
