# Fixi Web 10.0.4

Correctif de migration non destructive pour les bases existantes.

- Les champs `updatedAt` obligatoires disposent maintenant de `@default(now()) @updatedAt`.
- Corrige le blocage `prisma db push` sur `Plan.updatedAt` quand des plans existent déjà.
- Aucun `--force-reset` nécessaire et aucune suppression de données.
- Inclut les correctifs V10.0.1 à V10.0.3.
