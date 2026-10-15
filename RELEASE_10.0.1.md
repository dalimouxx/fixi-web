# Fixi Web 10.0.1

Correctif de build Prisma pour Fixi V10.

## Correction
- Suppression de la relation orpheline `DeviceModel.marketListings` qui n'avait pas de relation inverse dans `PartMarketListing`.
- Le Parts Market conserve `compatibleModels` comme liste de modèles texte, conformément à son fonctionnement actuel.
- Aucun changement destructif de base de données.

## Mise à jour depuis 10.0.0
Conserver votre `.env` et vos volumes Docker. Remplacer le code par 10.0.1 puis lancer :

```bash
docker compose up -d --build
```

Ne pas utiliser `docker compose down -v`.
