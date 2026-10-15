# Fixi Web 10.0.3

Correctif de robustesse Docker pour les connexions instables pendant `npm install`.

- cache npm BuildKit conservé ;
- cache Prisma `~/.cache/prisma` conservé ;
- `prefer-offline` activé ;
- jusqu'à 5 tentatives automatiques de `npm install` ;
- délai progressif entre les tentatives ;
- aucune modification du schéma métier, de la base ou des fonctions V10.

Ce correctif cible notamment les erreurs `ECONNRESET` de `@prisma/engines/scripts/postinstall.js`.
