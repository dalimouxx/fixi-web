#!/usr/bin/env bash
# Teste deploy/vps/deploy.sh avec un vrai dépôt git et un faux « docker » : nouvelle version, version qui ne démarre pas
# (retour arrière), construction impossible, pause, fenêtre de nuit, absence de nouvelle tentative en boucle.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fail=0
ok()  { echo "  ok   $1"; }
bad() { echo "  FAIL $1"; fail=1; }
check() { if eval "$2"; then ok "$1"; else bad "$1"; fi; }

export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null
G="git -c user.name=t -c user.email=t@t -c init.defaultBranch=main"

# --- dépôt distant + dépôt « VPS »
$G init -q --bare "$T/remote.git"
$G clone -q "$T/remote.git" "$T/seed" 2>/dev/null
mkdir -p "$T/seed/deploy/vps"
cp "$ROOT/deploy/vps/deploy.sh" "$T/seed/deploy/vps/deploy.sh"
echo "services: {}" > "$T/seed/deploy/vps/docker-compose.yml"
printf '.env\n.state/\n' > "$T/seed/.gitignore"
echo "v1" > "$T/seed/app.txt"
( cd "$T/seed" && $G add -A && $G commit -qm "v1" && $G push -q origin HEAD:main )
$G clone -q "$T/remote.git" "$T/vps" 2>/dev/null
printf 'TELEGRAM_BOT_TOKEN=TOK\nTELEGRAM_CHAT_ID=CHAT\nDEPLOY_BRANCH=main\n' > "$T/vps/deploy/vps/.env"

# --- faux docker / curl
mkdir -p "$T/bin"; export CALLS="$T/calls.log"; : > "$CALLS"; export REPO="$T/vps"
cat > "$T/bin/docker" <<'EOF'
#!/usr/bin/env bash
echo "docker $*" >> "$CALLS"
case "$*" in
  *" ps -q app"*)    echo cid-app ;;
  *" ps -q backup"*) echo cid-backup ;;
  *"exec -T backup"*) exit "${FAKE_BACKUP_RC:-0}" ;;
  *"up -d --build"*) grep -q NOBUILD "$REPO/app.txt" && exit 1; exit 0 ;;
  "inspect "*)       if grep -q BAD "$REPO/app.txt"; then echo unhealthy; else echo healthy; fi ;;
  *) exit 0 ;;
esac
EOF
cat > "$T/bin/curl" <<'EOF'
#!/usr/bin/env bash
echo "curl $*" >> "$CALLS"; exit 0
EOF
chmod +x "$T/bin/docker" "$T/bin/curl"
export PATH="$T/bin:$PATH" FIXI_HEALTH_TRIES=2 FIXI_HEALTH_STEP=0

DEPLOY="$T/vps/deploy/vps/deploy.sh"; STATE="$T/vps/deploy/vps/.state"
publish() { ( cd "$T/seed" && echo "$1" > app.txt && $G add -A && $G commit -qm "version $1" && $G push -q origin HEAD:main ); }
head_of() { git -C "$T/vps" rev-parse HEAD; }
remote_of() { git -C "$T/remote.git" rev-parse main; }
ups() { grep -c "up -d --build" "$CALLS" || true; }
reset_calls() { : > "$CALLS"; }

echo "1. première exécution : la version en place est enregistrée, rien n'est reconstruit"
bash "$DEPLOY"
check "version enregistrée" '[ "$(cat "$STATE/deployed")" = "$(head_of)" ]'
check "aucun appel docker" '[ ! -s "$CALLS" ]'

echo "2. rien de nouveau : on ne fait rien"
bash "$DEPLOY"
check "aucun appel docker" '[ ! -s "$CALLS" ]'

echo "3. nouvelle version saine : sauvegarde, construction, mise en ligne, message"
publish v2; reset_calls; bash "$DEPLOY"
check "code mis à jour" '[ "$(head_of)" = "$(remote_of)" ]'
check "version marquée en ligne" '[ "$(cat "$STATE/deployed")" = "$(remote_of)" ]'
check "sauvegarde avant la construction" '[ "$(grep -n "exec -T backup" "$CALLS" | head -1 | cut -d: -f1)" -lt "$(grep -n "up -d --build" "$CALLS" | head -1 | cut -d: -f1)" ]'
check "message Telegram de réussite" 'grep -q "api.telegram.org" "$CALLS" && grep -q "mis à jour" "$CALLS"'
GOOD="$(head_of)"

echo "4. version qui ne démarre pas : retour automatique à la précédente"
publish v3-BAD; reset_calls; bash "$DEPLOY"
check "code revenu à la version précédente" '[ "$(head_of)" = "$GOOD" ]'
check "version marquée refusée" '[ "$(cat "$STATE/failed")" = "$(remote_of)" ]'
check "la version en ligne reste la bonne" '[ "$(cat "$STATE/deployed")" = "$GOOD" ]'
check "reconstruction de l'ancienne version (2 constructions)" '[ "$(ups)" = "2" ]'
check "message d'annulation" 'grep -q "Retour automatique" "$CALLS"'

echo "5. la version refusée n'est pas retentée en boucle"
reset_calls; bash "$DEPLOY"; bash "$DEPLOY"
check "aucun appel docker" '[ ! -s "$CALLS" ]'

echo "6. construction impossible : l'ancienne version reste en ligne, sans arrêt"
publish v4-NOBUILD; reset_calls; bash "$DEPLOY"
check "code revenu à la version précédente" '[ "$(head_of)" = "$GOOD" ]'
check "une seule tentative de construction" '[ "$(ups)" = "1" ]'
check "version marquée refusée" '[ "$(cat "$STATE/failed")" = "$(remote_of)" ]'
check "message construction impossible" 'grep -q "ne se construit pas" "$CALLS"'

echo "7. --force retente la version refusée"
reset_calls; bash "$DEPLOY" --force
check "nouvelle tentative" '[ "$(ups)" = "1" ]'

echo "8. pause"
publish v5; touch "$STATE/pause"; reset_calls; bash "$DEPLOY"
check "rien en pause" '[ ! -s "$CALLS" ]'
rm -f "$STATE/pause"; bash "$DEPLOY"
check "reprise après la pause" '[ "$(cat "$STATE/deployed")" = "$(remote_of)" ]'

echo "9. fenêtre de nuit (heure de Tunis, avec passage minuit)"
h="$(TZ=Africa/Tunis date +%-H)"
publish v6; reset_calls
printf 'TELEGRAM_BOT_TOKEN=TOK\nTELEGRAM_CHAT_ID=CHAT\nDEPLOY_ONLY_BETWEEN=%s-%s\n' "$(( (h+2)%24 ))" "$(( (h+3)%24 ))" > "$T/vps/deploy/vps/.env"
bash "$DEPLOY"
check "hors fenêtre : on attend" '[ ! -s "$CALLS" ]'
printf 'TELEGRAM_BOT_TOKEN=TOK\nTELEGRAM_CHAT_ID=CHAT\nDEPLOY_ONLY_BETWEEN=%s-%s\n' "$h" "$(( (h+1)%24 ))" > "$T/vps/deploy/vps/.env"
bash "$DEPLOY"
check "dans la fenêtre : mise en ligne" '[ "$(cat "$STATE/deployed")" = "$(remote_of)" ]'

echo "10. --status"
out="$(bash "$DEPLOY" --status)"
check "affiche la version et le journal" 'echo "$out" | grep -q "Dernière version mise en ligne" && echo "$out" | grep -q "journal"'

[ "$fail" = 0 ] && echo "TOUT EST OK" || { echo "ÉCHECS"; exit 1; }
