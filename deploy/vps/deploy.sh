#!/usr/bin/env bash
# Mise à jour automatique de Fixi depuis GitHub (lancé par cron toutes les 2 minutes, voir install-autodeploy.sh).
#
#   ./deploy.sh            met à jour si une nouvelle version est sur GitHub (sinon ne fait rien)
#   ./deploy.sh --force    remet en ligne même si rien n'a changé, ou retente une version qui avait échoué
#   ./deploy.sh --status   affiche la version en ligne et les dernières lignes du journal
#
# Sécurités :
#   1. sauvegarde de la base juste avant chaque mise à jour ;
#   2. la nouvelle version est construite AVANT d'arrêter l'ancienne : si la construction échoue, rien ne change ;
#   3. on attend que l'application réponde ; sinon retour automatique à la version précédente ;
#   4. une version qui a échoué n'est pas retentée en boucle (elle le sera à la prochaine version, ou avec --force) ;
#   5. message Telegram / webhook à chaque mise à jour réussie ou annulée.
#
# Pause : « touch .state/pause » suspend les mises à jour, « rm .state/pause » les reprend.
set -uo pipefail

VPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$VPS_DIR/../.." && pwd)"
STATE_DIR="${FIXI_STATE_DIR:-$VPS_DIR/.state}"
LOG="$STATE_DIR/deploy.log"
mkdir -p "$STATE_DIR"
cd "$REPO_DIR" || exit 1

HEALTH_TRIES="${FIXI_HEALTH_TRIES:-60}"   # 60 x 5 s = 5 minutes pour démarrer
HEALTH_STEP="${FIXI_HEALTH_STEP:-5}"

envval() { grep -E "^$1=" "$VPS_DIR/.env" 2>/dev/null | tail -n1 | cut -d= -f2- | tr -d "\r\"'"; }
now()    { TZ=Africa/Tunis date '+%F %T'; }
log()    { echo "$(now) $*" >> "$LOG"; }
short()  { git rev-parse --short "$1" 2>/dev/null || echo "$1"; }
compose(){ docker compose -f "$VPS_DIR/docker-compose.yml" --project-directory "$VPS_DIR" "$@"; }

# Garde le journal à une taille raisonnable.
if [ -f "$LOG" ] && [ "$(stat -c %s "$LOG" 2>/dev/null || echo 0)" -gt 2000000 ]; then tail -n 2000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"; fi

notify() {
  local msg="$1" tok chat hook
  tok="$(envval TELEGRAM_BOT_TOKEN)"; chat="$(envval TELEGRAM_CHAT_ID)"; hook="$(envval ALERT_WEBHOOK_URL)"
  if [ -n "$tok" ] && [ -n "$chat" ]; then
    curl -fsS -m 15 "https://api.telegram.org/bot$tok/sendMessage" --data-urlencode "chat_id=$chat" --data-urlencode "text=$msg" >/dev/null 2>&1 || true
  fi
  if [ -n "$hook" ]; then
    local js; js="$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$msg" 2>/dev/null || echo '"Fixi"')"
    curl -fsS -m 15 -H 'content-type: application/json' -d "{\"text\":$js,\"content\":$js}" "$hook" >/dev/null 2>&1 || true
  fi
  return 0
}

wait_healthy() {
  local i cid st
  for i in $(seq 1 "$HEALTH_TRIES"); do
    cid="$(compose ps -q app 2>/dev/null | head -n1)"
    if [ -n "$cid" ]; then
      st="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid" 2>/dev/null || true)"
      [ "$st" = "healthy" ] && return 0
    fi
    sleep "$HEALTH_STEP"
  done
  return 1
}

in_window() {
  local w h from to; w="$(envval DEPLOY_ONLY_BETWEEN)"
  [ -z "$w" ] && return 0
  from="${w%-*}"; to="${w#*-}"; h="$(TZ=Africa/Tunis date +%-H)"
  from=$((10#$from)); to=$((10#$to))
  if [ "$from" -le "$to" ]; then [ "$h" -ge "$from" ] && [ "$h" -lt "$to" ]; else [ "$h" -ge "$from" ] || [ "$h" -lt "$to" ]; fi
}

BRANCH="$(envval DEPLOY_BRANCH)"; BRANCH="${BRANCH:-main}"

if [ "${1:-}" = "--status" ]; then
  echo "Version du code sur le serveur : $(short HEAD) — $(git log -1 --format=%s HEAD)"
  echo "Dernière version mise en ligne avec succès : $(short "$(cat "$STATE_DIR/deployed" 2>/dev/null || echo HEAD)")"
  [ -f "$STATE_DIR/failed" ] && echo "Version refusée (ne démarre pas) : $(short "$(cat "$STATE_DIR/failed")")"
  [ -f "$STATE_DIR/pause" ] && echo "⏸  Mises à jour automatiques EN PAUSE (rm $STATE_DIR/pause pour reprendre)"
  echo "--- journal ---"; tail -n 15 "$LOG" 2>/dev/null || echo "(vide)"
  exit 0
fi

FORCE=0; [ "${1:-}" = "--force" ] && FORCE=1

exec 9>"$STATE_DIR/lock"
flock -n 9 || exit 0

[ "$FORCE" = 0 ] && [ -f "$STATE_DIR/pause" ] && exit 0

if ! git fetch -q origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH" 2>>"$LOG"; then
  log "GitHub injoignable : on réessaiera"
  exit 0
fi
remote="$(git rev-parse "origin/$BRANCH")"
current="$(git rev-parse HEAD)"
deployed="$(cat "$STATE_DIR/deployed" 2>/dev/null || true)"
failed="$(cat "$STATE_DIR/failed" 2>/dev/null || true)"

# Première exécution après une installation manuelle : la version en place est la version en ligne.
if [ -z "$deployed" ] && [ "$remote" = "$current" ] && [ "$FORCE" = 0 ]; then echo "$remote" > "$STATE_DIR/deployed"; exit 0; fi

if [ "$FORCE" = 0 ]; then
  [ "$remote" = "$deployed" ] && exit 0
  [ "$remote" = "$failed" ] && exit 0
  in_window || exit 0
fi

prev="$current"
subject="$(git log -1 --format=%s "$remote" 2>/dev/null || echo '')"
log "▶ Mise à jour $(short "$prev") → $(short "$remote") : $subject"

# 1) Sauvegarde juste avant (si le service de sauvegarde tourne).
if [ -n "$(compose ps -q backup 2>/dev/null)" ]; then
  if timeout 600 docker compose -f "$VPS_DIR/docker-compose.yml" --project-directory "$VPS_DIR" exec -T backup sh -c '. /opt/fixi/env.sh && /opt/fixi/fixi-backup.sh' >>"$LOG" 2>&1; then
    log "sauvegarde avant mise à jour : OK"
  else
    log "sauvegarde avant mise à jour : ÉCHEC (on continue, la sauvegarde de la nuit reste valable)"
    notify "⚠️ Fixi : la sauvegarde avant mise à jour a échoué. La mise à jour continue."
  fi
fi

# 2) Nouveau code, puis construction. Si la construction échoue, l'ancienne version continue de tourner.
if ! git reset -q --hard "$remote" >>"$LOG" 2>&1; then log "impossible de récupérer le code"; exit 1; fi
if ! compose up -d --build >>"$LOG" 2>&1; then
  log "✗ la construction a échoué : l'ancienne version reste en ligne"
  git reset -q --hard "$prev" >>"$LOG" 2>&1
  echo "$remote" > "$STATE_DIR/failed"
  notify "❌ Fixi : la version $(short "$remote") ne se construit pas. L'ancienne version reste en ligne. ($subject)"
  exit 1
fi

# 3) On attend que l'application réponde.
if wait_healthy; then
  echo "$remote" > "$STATE_DIR/deployed"; rm -f "$STATE_DIR/failed"
  docker image prune -f >/dev/null 2>&1 || true
  docker builder prune -f --filter "until=72h" >/dev/null 2>&1 || true
  log "✓ en ligne : $(short "$remote")"
  notify "✅ Fixi mis à jour : $(short "$remote") — $subject"
  exit 0
fi

# 4) Échec : retour à la version précédente.
log "✗ l'application ne répond pas : retour à $(short "$prev")"
git reset -q --hard "$prev" >>"$LOG" 2>&1
echo "$remote" > "$STATE_DIR/failed"
compose up -d --build >>"$LOG" 2>&1
if wait_healthy; then
  log "↩ retour à la version précédente réussi"
  notify "❌ Fixi : la version $(short "$remote") ne démarre pas. Retour automatique à $(short "$prev") : le site fonctionne. ($subject)"
else
  log "🚨 la version précédente ne répond pas non plus"
  notify "🚨 Fixi est HORS LIGNE : ni la version $(short "$remote") ni $(short "$prev") ne démarrent. Il faut intervenir (voir deploy/vps/.state/deploy.log)."
fi
exit 1
