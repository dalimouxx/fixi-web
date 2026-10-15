# Migration Fixi V8 → V9

1. Depuis V8, effectuer une sauvegarde :
   ```bash
   ./backup.sh
   ```
2. Arrêter les services sans supprimer les volumes :
   ```bash
   docker compose down
   ```
3. Décompresser V9 dans un nouveau dossier.
4. Copier l'ancien fichier `.env` dans le dossier `fixi-web` V9.
5. Lancer :
   ```bash
   chmod +x install.sh
   ./install.sh
   ```
6. Prisma ajoutera les tables Community sans effacer les données existantes.
7. Tester `/app/community`, puis basculer FR / AR avec le bouton langue.

**Ne jamais utiliser `docker compose down -v` sur une installation contenant des données à conserver.**
