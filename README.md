# Fixi Web V10.0.0

Fixi V10 conserve les modules V9 et ajoute l’écosystème réseau demandé : **Parts Market, SOS Pièce, Expert Call, Academy / Knowledge, Copilot vocal Réception Express, Fixi Care / garantie digitale, Client Wallet et Offline Sync sécurisé**.

## Installation rapide

```bash
chmod +x install.sh
./install.sh
```

Puis ouvrir `http://localhost:3000`.

## Modules V10

- **Marché pièces** : annonces entre réparateurs, demandes, réservations contrôlées et suivi vendeur/acheteur.
- **SOS Pièce** : demande urgente globale ou régionale, offres des boutiques et choix d’une réponse.
- **Expert Call** : demande d’aide technique, acceptation par un autre réparateur et chat privé.
- **Academy / Knowledge** : parcours de formation + connaissances Community confirmées.
- **Copilot vocal** : remplit la Réception Express depuis une dictée FR/AR dans les navigateurs compatibles.
- **Fixi Care** : plans de services récurrents et activation par client.
- **Garantie digitale** : carte privée générée lors de la livraison.
- **Client Wallet** : réparations, soldes, devis/factures, garanties, Care, rendez-vous et fidélité.
- **Offline Sync** : réception locale sécurisée et synchronisation idempotente au retour du réseau. Les paiements restent volontairement en ligne.

## Mise à niveau depuis V9

Lire `UPGRADE_V9_V10.md`. **Ne jamais lancer `docker compose down -v`** si vous souhaitez conserver PostgreSQL et les uploads.

## Tests

Voir `TEST_LOCAL_V10.md` et `VALIDATION.md`.

## Claude / Anthropic (V10.1)
Fixi Brain, Smart Vision et le Copilot vocal peuvent utiliser Claude côté serveur. La clé reste dans `.env` et n'est jamais envoyée au navigateur. Voir `CLAUDE_API.md` et utiliser `./configure-claude.sh` pour une configuration masquée.
