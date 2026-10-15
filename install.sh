#!/bin/sh
set -eu
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker est requis. Installez Docker + Docker Compose puis relancez ce script."
  exit 1
fi
NEW=0
if [ ! -f .env ]; then
  NEW=1
  DBPASS=$(openssl rand -hex 18 2>/dev/null || head -c 64 /dev/urandom | base64 | tr -dc A-Za-z0-9 | head -c 36)
  AUTH=$(openssl rand -base64 48 2>/dev/null || head -c 48 /dev/urandom | base64)
  PAUTH=$(openssl rand -base64 48 2>/dev/null || head -c 48 /dev/urandom | base64)
  DATA=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
  CRON=$(openssl rand -hex 24 2>/dev/null || head -c 32 /dev/urandom | base64 | tr -dc A-Za-z0-9 | head -c 32)
  SUPPAUTH=$(openssl rand -base64 48 2>/dev/null || head -c 48 /dev/urandom | base64)
  VAPID=$(docker run --rm node:22-alpine node -e "const c=require('crypto');const {publicKey,privateKey}=c.generateKeyPairSync('ec',{namedCurve:'prime256v1'});const p=publicKey.export({format:'jwk'}),q=privateKey.export({format:'jwk'});const pub=Buffer.concat([Buffer.from([4]),Buffer.from(p.x,'base64url'),Buffer.from(p.y,'base64url')]).toString('base64url');console.log(pub+'|'+q.d)")
  VAPID_PUBLIC=$(printf "%s" "$VAPID" | cut -d'|' -f1)
  VAPID_PRIVATE=$(printf "%s" "$VAPID" | cut -d'|' -f2)
  PLATFORMPASS=$(openssl rand -base64 18 2>/dev/null | tr -dc 'A-Za-z0-9' | head -c 24 || echo 'ChangeMeFixi2026!')
  ADMINPIN=$(openssl rand -base64 24 2>/dev/null | tr -dc '0-9' | head -c 6 || true)
  [ "${#ADMINPIN}" -eq 6 ] || ADMINPIN=482731
  cat > .env <<EOT
POSTGRES_PASSWORD=$DBPASS
AUTH_SECRET=$AUTH
PLATFORM_AUTH_SECRET=$PAUTH
DATA_ENCRYPTION_KEY=$DATA
CRON_SECRET=$CRON
SUPPLIER_AUTH_SECRET=$SUPPAUTH
VAPID_PUBLIC_KEY=$VAPID_PUBLIC
VAPID_PRIVATE_KEY=$VAPID_PRIVATE
VAPID_SUBJECT=mailto:admin@localhost
WHATSAPP_GRAPH_VERSION=v23.0
FIXI_AI_ENABLED=true
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-5
ANTHROPIC_API_URL=https://api.anthropic.com/v1
NEXT_PUBLIC_APP_URL=http://localhost:3000
DEFAULT_SHOP_SLUG=atelier-principal
INITIAL_SHOP_SLUG=atelier-principal
INITIAL_SHOP_NAME="Mon Atelier"
INITIAL_SHOP_REGION="Gabès"
INITIAL_ADMIN_LOGIN=admin
INITIAL_ADMIN_PIN=$ADMINPIN
PLATFORM_ADMIN_LOGIN=platform
PLATFORM_ADMIN_PASSWORD=$PLATFORMPASS
BACKUP_RETENTION_DAYS=14
EOT
  chmod 600 .env
  echo ".env créé avec des secrets aléatoires."
fi

# Compléter automatiquement une configuration existante avec les secrets connectés manquants.
if ! grep -q '^SUPPLIER_AUTH_SECRET=' .env 2>/dev/null; then
  SUPPAUTH=$(openssl rand -base64 48 2>/dev/null || head -c 48 /dev/urandom | base64)
  printf '\nSUPPLIER_AUTH_SECRET=%s\n' "$SUPPAUTH" >> .env
fi
if ! grep -q '^VAPID_PUBLIC_KEY=.' .env 2>/dev/null || ! grep -q '^VAPID_PRIVATE_KEY=.' .env 2>/dev/null; then
  VAPID=$(docker run --rm node:22-alpine node -e "const c=require('crypto');const {publicKey,privateKey}=c.generateKeyPairSync('ec',{namedCurve:'prime256v1'});const p=publicKey.export({format:'jwk'}),q=privateKey.export({format:'jwk'});const pub=Buffer.concat([Buffer.from([4]),Buffer.from(p.x,'base64url'),Buffer.from(p.y,'base64url')]).toString('base64url');console.log(pub+'|'+q.d)")
  VAPID_PUBLIC=$(printf "%s" "$VAPID" | cut -d'|' -f1)
  VAPID_PRIVATE=$(printf "%s" "$VAPID" | cut -d'|' -f2)
  grep -q '^VAPID_PUBLIC_KEY=' .env && sed -i.bak "s|^VAPID_PUBLIC_KEY=.*|VAPID_PUBLIC_KEY=$VAPID_PUBLIC|" .env || printf 'VAPID_PUBLIC_KEY=%s\n' "$VAPID_PUBLIC" >> .env
  grep -q '^VAPID_PRIVATE_KEY=' .env && sed -i.bak "s|^VAPID_PRIVATE_KEY=.*|VAPID_PRIVATE_KEY=$VAPID_PRIVATE|" .env || printf 'VAPID_PRIVATE_KEY=%s\n' "$VAPID_PRIVATE" >> .env
  rm -f .env.bak
fi
grep -q '^VAPID_SUBJECT=' .env || printf 'VAPID_SUBJECT=mailto:admin@localhost\n' >> .env
grep -q '^WHATSAPP_GRAPH_VERSION=' .env || printf 'WHATSAPP_GRAPH_VERSION=v23.0\n' >> .env
grep -q '^FIXI_AI_ENABLED=' .env || printf 'FIXI_AI_ENABLED=true\n' >> .env
grep -q '^AI_PROVIDER=' .env || printf 'AI_PROVIDER=anthropic\n' >> .env
grep -q '^ANTHROPIC_API_KEY=' .env || printf 'ANTHROPIC_API_KEY=\n' >> .env
grep -q '^ANTHROPIC_MODEL=' .env || printf 'ANTHROPIC_MODEL=claude-sonnet-5\n' >> .env
grep -q '^ANTHROPIC_API_URL=' .env || printf 'ANTHROPIC_API_URL=https://api.anthropic.com/v1\n' >> .env

docker compose up -d --build

echo ""
echo "Fixi V10.1.0 est lancé : http://localhost:3000"
if [ "$NEW" -eq 1 ]; then
  echo ""
  echo "=== PREMIÈRE CONNEXION ATELIER ==="
  echo "Région        : Gabès"
  echo "Boutique      : Mon Atelier"
  echo "Profil        : Administrateur"
  echo "PIN initial   : $ADMINPIN"
  echo ""
  echo "=== ADMINISTRATION SAAS ==="
  echo "URL           : http://localhost:3000/saas"
  echo "Identifiant   : platform"
  echo "Mot de passe  : $PLATFORMPASS"
  echo ""
  echo "Conservez ces identifiants dans un gestionnaire de mots de passe."
else
  echo ""
  echo "Configuration .env existante conservée."
  echo "Si la première installation avait échoué avant d’afficher les identifiants :"
  echo "  grep -E '^(INITIAL_ADMIN_PIN|PLATFORM_ADMIN_PASSWORD)=' .env"
fi
echo "IMPORTANT : changez le PIN atelier après la première connexion et configurez HTTPS avant l’ouverture Internet."
