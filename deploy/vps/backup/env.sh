# Le cron n'hérite pas des variables du conteneur : on les recharge depuis l'environnement du PID 1.
while IFS= read -r -d '' kv; do case "$kv" in DATABASE_URL=*|BACKUP_*|KEEP_*|UPLOADS_DIR=*|APP_URL=*|CRON_SECRET=*|RESTORE_ADMIN_URL=*|RCLONE_*) export "$kv";; esac; done < /proc/1/environ
