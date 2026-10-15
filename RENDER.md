# Déployer Fixi sur Render

## Architecture de test

Le fichier `render.yaml` crée :

- un Web Service Docker `fixi-web` ;
- une base Render Postgres `fixi-db` ;
- un healthcheck sur `/api/health`.

La version de test utilise les plans gratuits quand ils sont disponibles.

## Valeurs demandées au premier Blueprint

Render demandera les valeurs marquées `sync: false` :

- `INITIAL_ADMIN_PIN` : exactement 6 chiffres, par exemple `482731` ;
- `PLATFORM_ADMIN_PASSWORD` : mot de passe fort ;
- `ANTHROPIC_API_KEY` : nouvelle clé Anthropic (ne réutilisez pas une clé exposée) ;
- `NEXT_PUBLIC_APP_URL` : URL Render finale, par exemple `https://fixi-web.onrender.com`.

Si vous ne connaissez pas encore l'URL exacte au premier écran, vous pouvez renseigner temporairement l'URL prévue puis la corriger dans Environment après création du service.

## Démarrage

Render utilise :

- build : Dockerfile ;
- pre-deploy : `npx prisma db push && npm run db:seed` ;
- start : `npm run start` ;
- healthcheck : `/api/health`.

## Fichiers uploadés

Sur une instance Render sans disque persistant, le système de fichiers est éphémère. Pour une mise en production avec photos, logos et pièces jointes persistantes, passer le Web Service sur une offre compatible avec Persistent Disk et monter le disque sur :

`/app/data`

## Après le premier déploiement

Tester :

- `/api/health`
- `/`
- `/login`
- `/saas`
- `/stores`

Puis créer une réparation de test et vérifier Réception Express, Caisse Simple, Compatibility Hub et Fixi Brain.
