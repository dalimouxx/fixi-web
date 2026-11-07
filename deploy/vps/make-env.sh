#!/usr/bin/env bash
# Crée le fichier .env du VPS avec tous les secrets déjà générés.
#   ./make-env.sh fixi.mon-domaine.tn
# Ne remplace jamais un .env existant.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

domain="${1:-}"
domain="${domain#https://}"; domain="${domain#http://}"; domain="${domain%%/*}"; domain="$(printf '%s' "$domain" | tr 'A-Z' 'a-z')"
if ! [[ "$domain" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$ ]]; then
  echo "Usage : ./make-env.sh votre-domaine.tn   (exemple : ./make-env.sh fixi.mon-atelier.tn)" >&2
  exit 1
fi
if [ -e .env ]; then
  echo "Le fichier .env existe déjà : rien n'a été modifié. Supprimez-le d'abord si vous voulez le refaire." >&2
  exit 1
fi
command -v openssl >/dev/null || { echo "openssl est requis (apt install -y openssl)." >&2; exit 1; }

b64()  { openssl rand -base64 32 | tr -d '\n'; }
word() { local w=""; while [ "${#w}" -lt "$1" ]; do w="$w$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9')"; done; printf '%s' "${w:0:$1}"; }

umask 077
cp .env.example .env
set_kv() { sed -i "s|^$1=.*|$1=$2|" .env; }

set_kv FIXI_DOMAIN "$domain"
set_kv NEXT_PUBLIC_APP_URL "https://$domain"
set_kv POSTGRES_PASSWORD "$(openssl rand -hex 24)"
for k in AUTH_SECRET PLATFORM_AUTH_SECRET SUPPLIER_AUTH_SECRET DELIVERY_AUTH_SECRET DATA_ENCRYPTION_KEY CRON_SECRET; do set_kv "$k" "$(b64)"; done
# Clés des notifications push (VAPID : courbe P-256), générées avec openssl.
b64url() { base64 -w0 | tr '+/' '-_' | tr -d '='; }
vk="$(mktemp)"; trap 'rm -f "$vk"' EXIT
openssl ecparam -name prime256v1 -genkey -noout -out "$vk" 2>/dev/null
vapid_priv="$(openssl ec -in "$vk" -outform DER 2>/dev/null | tail -c +8 | head -c 32 | b64url)"
vapid_pub="$(openssl ec -in "$vk" -pubout -outform DER 2>/dev/null | tail -c 65 | b64url)"
set_kv VAPID_PRIVATE_KEY "$vapid_priv"
set_kv VAPID_PUBLIC_KEY "$vapid_pub"
set_kv VAPID_SUBJECT "mailto:contact@$domain"
control_pw="$(word 20)"
backup_pw="$(word 32)"
set_kv PLATFORM_ADMIN_PASSWORD "$control_pw"
set_kv BACKUP_PASSPHRASE "$backup_pw"

cat <<EOF

✅ Fichier .env créé (lisible uniquement par vous).

   Adresse du site ......... https://$domain

   ➜ NOTEZ CES DEUX VALEURS MAINTENANT, dans votre gestionnaire de mots de passe ou sur papier :

   Fixi Control — identifiant : platform
   Fixi Control — mot de passe : $control_pw

   Phrase de chiffrement des sauvegardes :
   $backup_pw

   (Sans la phrase, les sauvegardes sont illisibles. Elles restent aussi dans le fichier .env du serveur.)

Étape suivante : docker compose up -d --build
EOF
