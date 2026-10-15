# Test local Fixi V10

## 1. Démarrage

```bash
docker compose up -d --build
docker compose ps
docker compose logs --no-color --tail=150 web
```

Vérifier `http://localhost:3000/api/health` puis `http://localhost:3000/login`.

## 2. Parts Market

- Créer deux boutiques/utilisateurs de test.
- Boutique A publie une pièce.
- Boutique B envoie une demande.
- Boutique A accepte puis termine la transaction.

## 3. SOS Pièce

- Boutique A lance un SOS régional.
- Boutique B répond avec quantité/prix.
- Boutique A choisit l’offre.

## 4. Expert Call

- Boutique A crée une demande.
- Boutique B l’accepte.
- Tester les messages privés entre les deux boutiques.

## 5. Academy / Knowledge

- Ouvrir `/app/academy`.
- Valider une leçon.
- Vérifier que les contenus Community confirmés apparaissent dans Knowledge Hub.

## 6. Copilot vocal

Dans Chrome/Edge, ouvrir Réception Express puis dicter :
`Client Mohamed, 21 555 497, Samsung A15, écran cassé`.
Contrôler les champs remplis avant validation.

## 7. Care / Wallet / garantie

- Créer un plan Fixi Care et l’activer pour un client.
- Livrer une réparation avec garantie.
- Depuis la fiche client, ouvrir Client Wallet.
- Vérifier la carte de garantie digitale.

## 8. Offline Sync

- Ouvrir `/offline-reception.html` pendant que Fixi est encore accessible.
- Couper Internet/réseau.
- Ajouter une réception.
- Reconnecter le réseau et ouvrir `/app/offline`.
- Synchroniser.
- Vérifier qu’un second sync ne crée pas de doublon.

## Sécurité

Ne pas tester de paiement réel en mode Offline : V10 refuse volontairement ce workflow.
