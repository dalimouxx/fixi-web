# Fixi Web 10.0.2

Correctif de build TypeScript pour Fixi Parts Market.

## Correction

- Les rôles autorisés à publier une annonce Marketplace sont maintenant typés explicitement comme `UserRole[]`.
- Les transitions de demandes Marketplace utilisent des tableaux `MarketRequestStatus[]` explicitement typés.
- Cela corrige l’erreur TypeScript `UserRole is not assignable to ADMIN | RECEPTION | TECHNICIAN` pendant `next build`.
- Aucun changement de schéma Prisma ni de données.

## Mise à jour

Conserver `.env` et les volumes Docker, remplacer le code puis exécuter :

```bash
docker compose up -d --build
```

Ne pas utiliser `docker compose down -v`.
