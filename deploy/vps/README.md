# Fixi sur un VPS — mise en ligne et sauvegardes

Ce dossier installe tout Fixi sur un seul serveur (Ubuntu 22.04/24.04, 2 Go de RAM minimum) :

| Service | Rôle |
|---|---|
| `app` | l'application Fixi (même image que sur Render) |
| `db` | PostgreSQL 16, données dans un volume Docker |
| `caddy` | HTTPS automatique (certificat Let's Encrypt renouvelé tout seul) |
| `backup` | sauvegarde chiffrée chaque nuit à 02:30 + test de restauration chaque dimanche |

## 1. Préparer le serveur

```bash
curl -fsSL https://get.docker.com | sh
```

```bash
git clone https://github.com/dalimouxx/fixi-web.git && cd fixi-web/deploy/vps
```

Faites pointer votre domaine (enregistrement **A**) vers l'adresse IP du VPS.

## 2. Configurer

```bash
cp .env.example .env
```

Remplissez `.env`. Pour chaque secret :

```bash
openssl rand -base64 32
```

**Notez `BACKUP_PASSPHRASE` hors du serveur** (gestionnaire de mots de passe, papier dans un coffre). Sans elle, les sauvegardes sont illisibles — c'est voulu : un voleur de sauvegarde ne peut rien en faire.

## 3. Copie des sauvegardes hors du serveur (fortement conseillé)

Si le VPS brûle, des sauvegardes restées dessus ne servent à rien. Configurez une destination avec rclone (Google Drive, Backblaze B2, Dropbox, S3, OneDrive…) :

```bash
docker run --rm -it -v "$PWD/rclone:/config/rclone" rclone/rclone config
```

Créez par exemple un remote nommé `gdrive`, puis dans `.env` : `BACKUP_REMOTE=gdrive:fixi-sauvegardes`.

## 4. Alertes sur votre téléphone (Telegram)

1. Dans Telegram, parlez à **@BotFather** → `/newbot` → copiez le jeton dans `TELEGRAM_BOT_TOKEN`.
2. Envoyez un message à votre bot, puis ouvrez `https://api.telegram.org/bot<JETON>/getUpdates` et copiez `chat.id` dans `TELEGRAM_CHAT_ID`.

Vous recevrez : les erreurs du serveur et des navigateurs (regroupées, au plus une alerte par heure et par problème), une sauvegarde échouée ou absente depuis plus de 26 h, et le résultat du test de restauration hebdomadaire.

## 5. Démarrer

```bash
docker compose up -d --build
```

Vérifier que tout tourne :

```bash
docker compose ps
```

Lancer une sauvegarde tout de suite (sans attendre la nuit) :

```bash
docker compose exec backup sh -c '. /opt/fixi/env.sh && /opt/fixi/fixi-backup.sh'
```

Tester la restauration tout de suite :

```bash
docker compose exec backup sh -c '. /opt/fixi/env.sh && /opt/fixi/fixi-restore-test.sh'
```

L'état des sauvegardes et les dernières erreurs apparaissent dans **Fixi Control → Santé du système**.

## 6. En cas de panne : restaurer

Lister les sauvegardes disponibles :

```bash
docker compose exec backup ls -lh /backups
```

Restaurer (remplace toute la base — l'application doit être arrêtée) :

```bash
docker compose stop app
```

```bash
docker compose exec -it backup sh -c '. /opt/fixi/env.sh && /opt/fixi/fixi-restore.sh /backups/fixi-db-AAAAMMJJ-HHMM.dump.gpg "$DATABASE_URL"'
```

```bash
docker compose start app
```

Les photos et fichiers sont dans `fixi-fichiers-*.tgz.gpg` (même phrase de chiffrement, à décompresser dans le volume `app-data`).

## En attendant le VPS (Render)

Le travail GitHub **« Fixi sauvegarde nocturne »** (`.github/workflows/db-backup.yml`) sauvegarde déjà la base de Render chaque nuit, la chiffre, teste la restauration et garde 30 jours de copies. Il suffit d'ajouter dans GitHub → *Settings → Secrets and variables → Actions* :

- `FIXI_DATABASE_URL` : Render → votre base → **External Database URL**
- `BACKUP_PASSPHRASE` : la phrase de chiffrement
- (facultatif) `FIXI_APP_URL` + `FIXI_CRON_SECRET` pour l'affichage dans Fixi Control et les alertes
