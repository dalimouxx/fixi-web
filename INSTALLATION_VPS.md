# Installation VPS — Fixi V5

## Prérequis
Ubuntu/Debian récent, Docker Engine + Docker Compose, domaine et HTTPS via Nginx/Caddy/Traefik.

## Installation
```bash
unzip Fixi-Web-5.0.0.zip
cd fixi-web
chmod +x install.sh backup.sh restore.sh
./install.sh
```

Configurer ensuite `NEXT_PUBLIC_APP_URL=https://votre-domaine.tld` dans `.env`, puis :
```bash
docker compose up -d --build
```

Ne publiez pas PostgreSQL sur Internet. Seul le port Web doit être exposé derrière un reverse proxy HTTPS.

## Sauvegarde
```bash
./backup.sh
```
Le conteneur `backup` effectue aussi une sauvegarde quotidienne avec la rétention définie par `BACKUP_RETENTION_DAYS`.
