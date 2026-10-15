#!/bin/sh
set -eu
if [ ! -f .env ]; then
  echo "Fichier .env introuvable. Lancez d'abord ./install.sh"
  exit 1
fi
printf "Nouvelle clé Anthropic (saisie masquée) : "
if [ -t 0 ]; then stty -echo; fi
IFS= read -r KEY
if [ -t 0 ]; then stty echo; fi
printf "\n"
if [ -z "$KEY" ]; then echo "Clé vide : aucune modification."; exit 1; fi
TMP=.env.claude.tmp
awk '!/^ANTHROPIC_API_KEY=/' .env > "$TMP"
printf 'ANTHROPIC_API_KEY=%s\n' "$KEY" >> "$TMP"
mv "$TMP" .env
chmod 600 .env 2>/dev/null || true
grep -q '^FIXI_AI_ENABLED=' .env || printf 'FIXI_AI_ENABLED=true\n' >> .env
grep -q '^AI_PROVIDER=' .env || printf 'AI_PROVIDER=anthropic\n' >> .env
grep -q '^ANTHROPIC_MODEL=' .env || printf 'ANTHROPIC_MODEL=claude-sonnet-5\n' >> .env
grep -q '^ANTHROPIC_API_URL=' .env || printf 'ANTHROPIC_API_URL=https://api.anthropic.com/v1\n' >> .env
echo "Claude est configuré dans .env. La clé n'est pas affichée."
echo "Relancez : docker compose up -d --force-recreate web"
