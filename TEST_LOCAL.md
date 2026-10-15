# Tester Fixi V5 en local — Windows + Docker Desktop

## 1. Préparer
Installez Docker Desktop et Git for Windows. Démarrez Docker Desktop jusqu’à ce que le moteur soit `Running`.

## 2. Installer
Dans Git Bash, dans le dossier `fixi-web` :
```bash
chmod +x install.sh backup.sh restore.sh
./install.sh
```

## 3. Ouvrir
- Landing : `http://localhost:3000`
- Connexion boutique : `http://localhost:3000/login`
- Control Center : `http://localhost:3000/saas`
- Santé : `http://localhost:3000/api/health`

## 4. Retrouver les secrets
Si une installation précédente a créé `.env` mais s’est arrêtée avant l’affichage :
```bash
grep -E '^(INITIAL_ADMIN_PIN|PLATFORM_ADMIN_PASSWORD)=' .env
```

## 5. Vérifier Docker
```bash
docker compose ps
docker compose logs -f web
```

## 6. Scénario conseillé
1. Connexion admin et changement du PIN initial.
2. Configurer la boutique.
3. Créer réception, technicien et caissier avec PIN 6 chiffres.
4. Créer une réparation et suivre Reçu → Diagnostic → Réparation → Prêt.
5. Ajouter une pièce et contrôler la baisse du stock.
6. Encaisser en plusieurs paiements et contrôler le solde.
7. Livrer uniquement après règlement complet.
8. Tester `/queue?shop=atelier-principal`.
9. Ouvrir le QR/lien de suivi dans une fenêtre privée.
10. Ouvrir `/saas`, vérifier LED et CA, modifier abonnement, envoyer un message et créer une campagne Ads.
11. Ouvrir `/app/brain` et tester « Combien j’ai gagné cette semaine ? ».
12. Ouvrir `/app/insights` et contrôler Business Score + prévision de stock.
13. Créer une réparation puis vérifier diagnostic, technicien et prix suggérés.
14. Avant « Prêt », compléter la checklist qualité.
15. Créer un devis et tester son acceptation depuis le lien public.
16. Tester `/app/automations`, `/app/marketing`, `/app/appointments` et `/kiosk?shop=atelier-principal`.

## 7. Tester depuis un téléphone
Sur le même Wi-Fi, exécutez `ipconfig`, récupérez l’IPv4 du PC puis ouvrez `http://IP-DU-PC:3000`.

## 8. Arrêter / relancer
```bash
docker compose down
docker compose up -d
```
Les données restent dans les volumes Docker.
