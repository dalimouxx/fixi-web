# cPanel / hébergement Node.js — Fixi V5

La méthode recommandée reste un VPS Docker. Sur un cPanel compatible Node.js :
1. Créer PostgreSQL et son utilisateur.
2. Définir `DATABASE_URL`, `AUTH_SECRET`, `PLATFORM_AUTH_SECRET`, `DATA_ENCRYPTION_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL` et les variables initiales de `.env.example`.
3. Installer les dépendances avec `npm install`.
4. Exécuter `npm run setup`.
5. Construire avec `npm run build`.
6. Démarrer avec `npm run start`.

Le stockage `/data` doit être persistant et inscriptible. Les fonctions Docker de sauvegarde automatique ne sont pas disponibles telles quelles sur un hébergement mutualisé ; configurez un cron cPanel pour PostgreSQL + fichiers.
