# Service de sauvegarde Fixi pour le VPS : pg_dump 16 + gpg + rclone + cron.
FROM postgres:16-alpine
RUN apk add --no-cache bash gnupg rclone curl tzdata coreutils findutils
ENV TZ=Africa/Tunis
COPY scripts/backup/ /opt/fixi/
COPY deploy/vps/backup/crontab /etc/crontabs/root
COPY deploy/vps/backup/env.sh /opt/fixi/env.sh
RUN chmod +x /opt/fixi/*.sh
CMD ["crond", "-f", "-l", "2"]
