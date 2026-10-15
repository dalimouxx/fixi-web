# Mise à niveau Fixi V6 → V7

1. Depuis V6, sauvegardez les données :

```bash
./backup.sh
```

2. Arrêtez V6 :

```bash
docker compose down
```

3. Décompressez Fixi V7 dans un nouveau dossier.
4. Copiez uniquement votre ancien fichier `.env` dans le nouveau dossier `fixi-web`.
5. Lancez :

```bash
chmod +x install.sh backup.sh restore.sh
./install.sh
```

Le démarrage Docker exécute `prisma db push`. Les nouveaux champs d’annuaire sont ajoutés à la base existante. `publicServices` possède une valeur par défaut vide et toutes les boutiques existantes restent `publicVisible=false`, donc aucune boutique n’est publiée automatiquement.

## Après migration

Connectez-vous à :

`http://localhost:3000/saas`

Puis ouvrez **Annuaire** et configurez pour chaque boutique :
- ville ;
- adresse ;
- téléphone / WhatsApp ;
- latitude / longitude ;
- services ;
- horaires ;
- logo / couverture ;
- visibilité publique.

L’annuaire public est disponible sur :

`http://localhost:3000/stores`
