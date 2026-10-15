# Migration Fixi V9 → V10

1. Dans V9, créer une sauvegarde :
   ```bash
   ./backup.sh
   docker compose down
   ```
2. Décompresser V10 dans un nouveau dossier.
3. Copier **uniquement** votre ancien fichier `.env` dans le nouveau dossier `fixi-web`.
4. Lancer :
   ```bash
   chmod +x install.sh backup.sh restore.sh
   ./install.sh
   ```
5. Le démarrage exécute `prisma db push` puis le seed de migration.

## Migration automatique

- Les anciens clients reçoivent un token Client Wallet.
- Les réparations déjà livrées et encore configurées avec une garantie reçoivent une carte de garantie digitale.
- Les cours Academy de démarrage sont créés une seule fois.
- Les données V9 sont conservées.

## Important

N’utilisez pas `docker compose down -v` : cette option supprime les volumes PostgreSQL et les uploads.
