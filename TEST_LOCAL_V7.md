# Test local Fixi V7

## 1. Démarrage

```bash
./install.sh
```

Puis ouvrez :
- Landing : `http://localhost:3000`
- Annuaire : `http://localhost:3000/stores`
- Control : `http://localhost:3000/saas`

## 2. Publier une boutique de test

Dans **Fixi Control → Annuaire** :
1. Ouvrez une boutique.
2. Activez « Afficher cette boutique dans l’annuaire public ».
3. Ajoutez ville et adresse.
4. Ajoutez latitude / longitude.
5. Choisissez quelques services.
6. Renseignez les horaires.
7. Enregistrez.

Rechargez `/stores`.

## 3. Tester la recherche
- recherchez le nom de la boutique ;
- filtrez la région ;
- filtrez un service ;
- cliquez sur Appeler / WhatsApp / Voir ;
- ouvrez la fiche publique.

## 4. Tester la localisation
Sur Chrome/Edge, cliquez **La plus proche**. Autorisez la géolocalisation pour le site local si le navigateur le permet. Sur un téléphone du même réseau, utilisez l’adresse IP locale du PC. La géolocalisation Web peut nécessiter HTTPS hors `localhost` selon le navigateur.

## 5. Tester la Landing V7
Vérifiez :
- démo interactive ;
- onglets par rôle ;
- Cash Pro ;
- recherche boutique intégrée ;
- simulateur ;
- FAQ ;
- responsive téléphone/tablette.
