# Mise à niveau Fixi V4 → V5

## 1. Sauvegarder V4
Depuis l’ancien dossier :
```bash
./backup.sh
docker compose down
```

## 2. Décompresser V5
Décompressez `Fixi-Web-5.0.0.zip` dans un nouveau dossier et copiez **uniquement votre ancien `.env`** dans le nouveau `fixi-web/`. Ne copiez pas `node_modules`.

## 3. Vérifier `.env`
V5 réutilise les secrets V4. Vérifiez surtout `POSTGRES_PASSWORD`, `AUTH_SECRET`, `PLATFORM_AUTH_SECRET`, `DATA_ENCRYPTION_KEY`, `CRON_SECRET`, `INITIAL_ADMIN_PIN` et `PLATFORM_ADMIN_PASSWORD`.

## 4. Rebuild
```bash
docker compose up -d --build
```
Le conteneur applique `prisma db push` au démarrage puis le seed. Les nouveaux modèles/champs V5 sont ajoutés à la base existante. Les anciens devis reçoivent un token public lors du seed.

## 5. Contrôler
```bash
docker compose ps
docker compose logs -f web
```
Puis ouvrir `http://localhost:3000/api/health`.

## Notes migration
- Les réparations V4 sans checklist reçoivent automatiquement leur checklist qualité lorsqu’elles sont consultées/amenées vers “Prêt”.
- Les données V4 existantes sont conservées.
- Les PIN restent obligatoirement à 6 chiffres.
