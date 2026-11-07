# Mettre Fixi en ligne sur un VPS Hostinger — pas à pas

Ce guide part de zéro : un VPS neuf, une base de données **vierge**, et un serveur qui se met à jour **tout seul** à chaque fois que vous fusionnez une pull request sur GitHub.

**Ce que vous aurez à la fin**

| | |
|---|---|
| Site | `https://fixi.votre-domaine.tn` (HTTPS automatique) |
| Base de données | vierge : un seul compte **Fixi Control**, les formules, le catalogue d'appareils, les formations. Aucune boutique de test, aucun code par défaut |
| Mises à jour | automatiques depuis GitHub (branche `main`), avec sauvegarde avant, vérification après et retour arrière si ça ne démarre pas |
| Sauvegardes | chaque nuit à 02:30 (heure de Tunis), chiffrées, test de restauration chaque dimanche |
| QR codes et liens | tous basés sur **une seule adresse** : celle de votre domaine |

Durée : environ 1 heure, dont 15 minutes d'attente pendant la première construction.

> Toutes les commandes se tapent sur le serveur, sauf mention contraire. Une commande = un bloc : copiez-la, collez-la, appuyez sur Entrée.

---

## 0. Ce qu'il vous faut avant de commencer

- Un **VPS Hostinger** : choisissez au moins « KVM 2 » (2 cœurs, 8 Go). Avec 4 Go ça marche aussi, mais la première construction est plus lente (l'étape 2 ajoute de la mémoire de secours).
- Au moment de créer le VPS, choisissez le système **Ubuntu 24.04**. Notez l'**adresse IP** et le **mot de passe root**.
- Un **nom de domaine** (celui de Hostinger ou un autre). On utilisera un sous-domaine, par exemple `fixi.votre-domaine.tn`.
- (Conseillé) Un compte **Telegram** pour recevoir les alertes sur votre téléphone.

---

## 1. Faire pointer le domaine vers le VPS

Dans la zone DNS de votre domaine (hPanel → Domaines → DNS / Nameservers), créez :

| Type | Nom | Valeur |
|---|---|---|
| **A** | `fixi` | l'adresse IP du VPS |

Supprimez tout enregistrement `AAAA` (IPv6) ou « parking » qui existerait sur ce même nom.

Vérifiez (sur votre ordinateur, pas sur le serveur) que l'adresse répond avec la bonne IP — cela peut prendre de 5 minutes à quelques heures :

```bash
nslookup fixi.votre-domaine.tn
```

> Sans cette étape, le certificat HTTPS ne peut pas être créé. Faites-la en premier, pendant que vous préparez le reste.

---

## 2. Se connecter et préparer le serveur

Connexion (depuis PowerShell / Terminal, ou le « Terminal navigateur » de hPanel) :

```bash
ssh root@ADRESSE_IP_DU_VPS
```

Mises à jour du système :

```bash
apt update && apt upgrade -y
```

Mémoire de secours de 4 Go (évite un plantage pendant la construction) :

```bash
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Pare-feu : on n'ouvre que la connexion à distance et le web.

```bash
apt install -y ufw fail2ban git curl cron && ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
```

Docker :

```bash
curl -fsSL https://get.docker.com | sh
```

Heure de Tunis pour le serveur :

```bash
timedatectl set-timezone Africa/Tunis
```

---

## 3. Récupérer le code depuis GitHub

```bash
git clone https://github.com/dalimouxx/fixi-web.git /opt/fixi
```

```bash
cd /opt/fixi/deploy/vps
```

> Toutes les commandes suivantes se lancent depuis ce dossier. Si vous vous reconnectez plus tard : `cd /opt/fixi/deploy/vps`.

---

## 4. Créer la configuration (secrets compris)

Une seule commande crée le fichier `.env` avec tous les secrets déjà générés. Remplacez par votre domaine :

```bash
./make-env.sh fixi.votre-domaine.tn
```

Le script affiche **deux choses à noter tout de suite** (gestionnaire de mots de passe ou papier dans un coffre) :

1. le **mot de passe de Fixi Control** (identifiant : `platform`) ;
2. la **phrase de chiffrement des sauvegardes**. Sans elle, une sauvegarde est illisible — c'est voulu : un voleur de sauvegarde ne peut rien en faire.

Le fichier `.env` contient aussi l'adresse du site. **Toutes les adresses des QR codes, étiquettes, liens de suivi, messages WhatsApp et factures partent de cette adresse** (`NEXT_PUBLIC_APP_URL`). Le serveur refuse de démarrer si elle manque.

### Alertes Telegram (conseillé, 3 minutes)

1. Dans Telegram, ouvrez **@BotFather** → `/newbot` → copiez le jeton.
2. Envoyez un message à votre nouveau bot, puis ouvrez dans un navigateur `https://api.telegram.org/bot<JETON>/getUpdates` et copiez le nombre après `"chat":{"id":`.
3. Ouvrez le fichier et complétez `TELEGRAM_BOT_TOKEN=` et `TELEGRAM_CHAT_ID=` :

```bash
nano .env
```

(Enregistrer : `Ctrl+O`, `Entrée`, quitter : `Ctrl+X`.)

Vous recevrez : les erreurs du serveur, une sauvegarde manquante ou échouée, et **chaque mise à jour réussie ou annulée**.

---

## 5. Démarrer Fixi

```bash
docker compose up -d --build
```

La première fois, comptez 10 à 15 minutes (construction de l'application). Pendant ce temps vous pouvez suivre le démarrage :

```bash
docker compose logs -f app
```

Vous devez voir, à la fin, la ligne :

> `Fixi seed OK (production : base vierge, aucune boutique de démonstration)`

puis `Ready`. Quittez le suivi avec `Ctrl+C` (l'application continue de tourner). Vérifiez que tout est en marche :

```bash
docker compose ps
```

Les services `db`, `app`, `caddy` et `backup` doivent être « Up » (et `app` « healthy »).

Ouvrez ensuite `https://fixi.votre-domaine.tn` : la page d'accueil de Fixi doit s'afficher avec le cadenas. Si le navigateur signale un problème de certificat, le domaine ne pointe pas encore vers le serveur (étape 1) : attendez, puis `docker compose restart caddy`.

---

## 6. Première connexion à Fixi Control

1. Allez sur `https://fixi.votre-domaine.tn/saas/login`.
2. Identifiant `platform`, mot de passe noté à l'étape 4.
3. Ouvrez **Outils → Double vérification → Activer** : votre compte pilote toute la plateforme, protégez-le avec votre téléphone.
4. Ouvrez **Santé du système**. La carte « **Prêt pour la mise en ligne ?** » vérifie l'adresse HTTPS, le nom de domaine, les clés, les sauvegardes… Elle doit passer au vert. Si une ligne reste orange ou rouge, son explication dit quoi faire.
5. Ouvrez **Identité** : renseignez le **téléphone** et l'**e-mail de support** (ils s'affichent dans les pages Conditions, Confidentialité et Mentions légales).

### Première sauvegarde, tout de suite

Sans attendre la nuit :

```bash
docker compose exec backup sh -c '. /opt/fixi/env.sh && /opt/fixi/fixi-backup.sh'
```

Et le test de restauration (il restaure la sauvegarde dans une base temporaire et vérifie son contenu) :

```bash
docker compose exec backup sh -c '. /opt/fixi/env.sh && /opt/fixi/fixi-restore-test.sh'
```

Retournez dans **Santé du système** : les deux lignes « sauvegarde » passent au vert.

---

## 7. Activer les mises à jour automatiques depuis GitHub

```bash
./install-autodeploy.sh
```

C'est tout. À partir de maintenant :

> **Vous fusionnez une pull request sur `main` → dans les 2 minutes, le serveur se met à jour.**

Ce que fait le serveur à chaque nouvelle version, dans l'ordre :

1. **sauvegarde** de la base (une copie juste avant) ;
2. **construit** la nouvelle version **sans toucher à l'ancienne** : si la construction échoue, le site continue de tourner tel quel ;
3. **remplace** l'ancienne version (coupure d'environ une minute) ;
4. **vérifie** que l'application répond (jusqu'à 5 minutes) ;
5. si elle ne répond pas : **retour automatique** à la version précédente ;
6. vous prévient sur Telegram dans tous les cas : ✅ mise à jour réussie, ❌ annulée (le site reste en ligne), 🚨 hors ligne (rare : intervention nécessaire).

Une version refusée n'est pas retentée en boucle : elle le sera à la prochaine version fusionnée.

Commandes utiles :

```bash
./deploy.sh --status
```

(version en ligne, version refusée éventuelle, dernières lignes du journal)

```bash
./deploy.sh --force
```

(remet en ligne tout de suite — utile après avoir modifié `.env`)

```bash
touch .state/pause
```

(met les mises à jour en pause ; pour reprendre : `rm .state/pause`)

**Règle d'or** : ne fusionnez que des pull requests dont les vérifications GitHub sont **vertes**. Les vérifications tournent sur la pull request, pas après la fusion : le serveur ne peut pas les attendre, il se protège avec les points 1 à 5 ci-dessus.

**Mettre à jour la nuit seulement** (facultatif) : dans `.env`, `DEPLOY_ONLY_BETWEEN=01-06` (entre 01 h et 06 h, heure de Tunis). Les versions fusionnées la journée attendent alors la nuit.

**Base de données** : à chaque démarrage, le serveur met le schéma à jour **sans jamais supprimer de données**. Si une version demandait une suppression, elle serait refusée et annulée automatiquement.

---

## 8. QR codes et liens : comment ça marche, et le test à faire

**Un seul réglage** : `NEXT_PUBLIC_APP_URL` dans `.env` (déjà rempli par `make-env.sh`). Il commande :

- les QR codes et étiquettes (réparation, garantie, occasion) ;
- les pages de suivi client et les liens WhatsApp ;
- les invitations fournisseur, le partage de catalogue, les liens de paiement ;
- le plan du site et les pages légales.

D'autres QR (affiche d'arrivée au comptoir, QR de l'application Android, QR de documents) prennent **l'adresse affichée dans le navigateur** : **ouvrez toujours Fixi par `https://fixi.votre-domaine.tn`**, jamais par l'adresse IP ni par l'ancienne adresse de test (Render).

**Test à faire une fois (5 minutes)** :

1. Créez un atelier de test (page d'inscription), puis enregistrez une réparation.
2. Imprimez (ou affichez) l'étiquette : scannez le QR avec votre téléphone → la page de suivi doit s'ouvrir en `https://fixi.votre-domaine.tn/...`.
3. Affichez l'affiche d'arrivée (page **Nouvelle réparation**, bandeau « **Affiche QR** ») : scannez-la avec un téléphone, le formulaire d'enregistrement doit s'ouvrir sur votre domaine.
4. Dans Fixi Control → **Santé du système** : les lignes « Adresse publique en HTTPS » et « Nom de domaine à vous » sont vertes.

**Si vous changez de domaine un jour** : modifiez `FIXI_DOMAIN` et `NEXT_PUBLIC_APP_URL` dans `.env`, lancez `./deploy.sh --force`, et refaites les étiquettes déjà imprimées (leur QR contient l'ancienne adresse). Gardez donc le domaine définitif dès le départ.

---

## 9. Caisse Windows et application Android

Les deux se construisent sur GitHub, sans rien installer chez vous. Il faut d'abord leur donner l'adresse du site, **une seule fois** :

1. GitHub → dépôt `fixi-web` → **Settings → Secrets and variables → Actions → onglet Variables → New repository variable**.
2. Nom : `FIXI_PUBLIC_URL` — Valeur : `https://fixi.votre-domaine.tn`.

**Caisse Windows** : onglet **Actions → « FIXI Windows EXE build » → Run workflow**. À la fin, téléchargez l'installateur dans « Artifacts ». L'adresse du serveur est alors **préremplie** à la connexion. Une caisse déjà installée : changez une fois le champ « Serveur » à la connexion.

**Application Android** : onglet **Actions → « Fixi Android (APK) » → Run workflow**. À la fin, le résumé de l'exécution affiche une **empreinte SHA-256**. Copiez-la dans `.env` :

```bash
nano .env
```

ligne `TWA_SHA256=` (sans elle, l'application Android affiche une barre d'adresse). Puis :

```bash
./deploy.sh --force
```

---

## 10. Sauvegardes : les mettre aussi hors du serveur

Si le VPS disparaît, des sauvegardes restées dessus disparaissent avec lui. Copiez-les chaque nuit vers un autre endroit (Google Drive, Dropbox, Backblaze…) avec rclone :

```bash
docker run --rm -it -v "$PWD/rclone:/config/rclone" rclone/rclone config
```

Créez par exemple une destination nommée `gdrive`, puis dans `.env` : `BACKUP_REMOTE=gdrive:fixi-sauvegardes`, et :

```bash
./deploy.sh --force
```

Dans Hostinger (hPanel → VPS → Sauvegardes / Instantanés), activez aussi la sauvegarde ou l'instantané automatique du serveur : c'est une deuxième couche.

Restaurer après une panne : voir `README.md` (section « En cas de panne : restaurer »).

---

## 11. Repartir d'une base vierge après vos tests (avant le lancement officiel seulement)

Vous allez tester en conditions réelles : ça crée des ateliers, des réparations, des ventes de test. Avant le vrai lancement, vous pouvez tout effacer et repartir de zéro :

> ⚠️ **Efface toutes les données : boutiques, clients, réparations, photos.** À ne jamais faire après le lancement. Faites d'abord une sauvegarde (étape 6).

```bash
docker compose stop app
```

```bash
docker compose exec db psql -U fixi -d postgres -c "DROP DATABASE fixi" -c "CREATE DATABASE fixi"
```

```bash
docker run --rm -v fixi_app-data:/d alpine sh -c 'rm -rf /d/*'
```

```bash
docker compose start app
```

Au redémarrage, l'application recrée le schéma et les données de référence : vous retrouvez une base vierge avec votre compte Fixi Control.

---

## 12. Quitter Render

Une fois que tout fonctionne sur le VPS (et seulement alors) :

1. Dans Render, suspendez le service web (ne le supprimez qu'après quelques jours de recul).
2. Dans GitHub → Actions, désactivez « Fixi sauvegarde nocturne » (il sauvegardait la base Render ; le VPS a sa propre sauvegarde).
3. Il n'y a aucune donnée à migrer : la base du VPS est neuve.

---

## 13. Entretien régulier

- Une fois par mois : `apt update && apt upgrade -y`, puis `reboot` de temps en temps. Les services redémarrent tout seuls ; testez un `reboot` une fois pour en être sûr, puis `docker compose ps`.
- Après une mise à jour du système, vérifiez que la mise à jour automatique est toujours active : `./deploy.sh --status`.
- Place disque : `df -h /` (les journaux sont limités, les anciennes images sont nettoyées à chaque mise à jour).

---

## 14. Si quelque chose ne va pas

| Symptôme | Que faire |
|---|---|
| Le site ne s'ouvre pas | `docker compose ps` puis `docker compose logs --tail 80 app` |
| Erreur de certificat | Le domaine ne pointe pas encore sur le VPS : `nslookup fixi.votre-domaine.tn`, puis `docker compose restart caddy` |
| La construction s'arrête (mémoire) | Vérifiez la mémoire de secours : `free -h` (étape 2), puis relancez `docker compose up -d --build` |
| « required variable … is missing » | Une valeur manque dans `.env` : `nano .env` |
| Une mise à jour a été annulée (Telegram ❌) | Le site fonctionne sur l'ancienne version. Cause : `./deploy.sh --status` et `tail -n 60 .state/deploy.log`. Corrigez sur GitHub, fusionnez : la prochaine version sera tentée |
| Revenir à une version précise | `git reset --hard IDENTIFIANT_DE_VERSION` puis `docker compose up -d --build` puis `touch .state/pause` (sinon le serveur re-déploie la dernière) |
| Mot de passe de Fixi Control perdu (ou téléphone perdu) | `./reset-control-password.sh` (propose aussi de désactiver la double vérification) |
| Redémarrer l'application | `docker compose restart app` |
| Tout redémarrer | `docker compose up -d` |
| Restaurer une sauvegarde | `README.md`, section « En cas de panne : restaurer » |

---

## Check-list finale

- [ ] Le domaine pointe vers le VPS et `https://…` s'ouvre avec le cadenas
- [ ] Fixi Control : connexion OK, double vérification activée, « Prêt pour la mise en ligne ? » au vert
- [ ] Mot de passe Control et phrase de sauvegarde notés **hors du serveur**
- [ ] Première sauvegarde + test de restauration faits (au vert dans Santé du système)
- [ ] Copie des sauvegardes hors serveur (rclone) configurée
- [ ] Alertes Telegram reçues (essayez : `./deploy.sh --force` envoie un message de mise à jour)
- [ ] `./install-autodeploy.sh` fait ; `./deploy.sh --status` répond
- [ ] Test QR code fait avec un téléphone
- [ ] `FIXI_PUBLIC_URL` renseignée sur GitHub ; caisse Windows et application Android reconstruites
- [ ] Un `reboot` du serveur testé : tout remonte seul
- [ ] Render suspendu, sauvegarde nocturne Render désactivée
