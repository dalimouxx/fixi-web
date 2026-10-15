# Migration Fixi V7 → V8

1. Sauvegarder la V7 :
```bash
./backup.sh
```
2. Arrêter sans supprimer les volumes :
```bash
docker compose down
```
3. Décompresser V8 dans un nouveau dossier.
4. Copier l'ancien `.env` dans le nouveau dossier.
5. Lancer :
```bash
chmod +x install.sh
./install.sh
```

`prisma db push` ajoute les nouveaux modèles sans supprimer les réparations existantes.

## Important
Ne pas utiliser `docker compose down -v` sur une installation contenant des données à conserver.
