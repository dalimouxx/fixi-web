# Migration Fixi V5 → V6

## 1. Sauvegarder V5
Dans l'ancien dossier :
```bash
./backup.sh
docker compose down
```

## 2. Décompresser V6
Conservez une copie du dossier V5. Copiez **uniquement** votre ancien `.env` dans le nouveau dossier V6.

Pour une migration existante, copiez votre ancien `.env` dans le dossier V6 puis lancez `./install.sh`. Le script conserve les variables existantes et ajoute automatiquement les secrets V6 manquants (`SUPPLIER_AUTH_SECRET`, paire VAPID, `VAPID_SUBJECT`, version WhatsApp). Il ne remplace pas vos secrets V5 existants.

## 3. Compléter les secrets V6 et reconstruire
```bash
chmod +x install.sh
./install.sh
```
Le script complète automatiquement les nouvelles variables V6 manquantes dans votre `.env`, puis exécute le build Docker.
Le démarrage exécute Prisma sur la base existante et ajoute les champs/tables V6 sans supprimer les données existantes.

## 4. Vérifier
```bash
docker compose ps
docker compose logs -f web
```
Puis ouvrir :
- `http://localhost:3000/api/health`
- `http://localhost:3000/login`
- `http://localhost:3000/saas`
- `http://localhost:3000/supplier/login`

## 5. Configurer les services optionnels
Dans **Paramètres → Fixi V6 · Intégrations** : WhatsApp Cloud, Konnect, Push et IA externe.
