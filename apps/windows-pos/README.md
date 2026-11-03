# FIXI Caisse Windows — prototype Tauri

Ce dossier contient le **socle de bureau**, indépendant du serveur Next.js actuel. Il s'agit d'une interface prototype, **pas d'une caisse connectée ni d'un système d'encaissement réel**.

## Pré-requis Windows
Node 22, Rust stable, Microsoft C++ Build Tools et Microsoft Edge WebView2; suivre les prérequis Tauri 2.

## Lancer
Dans `apps/windows-pos` :

```bash
npm install
npm run tauri dev
```

Pour construire l'installateur Windows (après configuration de l'icône et validation des dépendances) :

```bash
npm run tauri build
```

## Intégration réelle (à faire)
Partager la logique du POS fournisseur avec un package compatible navigateur, ajouter une API authentifiée FIXI, scanner et impressions natives. Ne jamais considérer les opérations du prototype comme des ventes ou écritures financières. L'offline SQLite et la synchronisation sont des travaux ultérieurs nécessitant idempotence, vérification des accès et gestion des conflits.
