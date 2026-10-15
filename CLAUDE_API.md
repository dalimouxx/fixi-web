# Claude / Anthropic dans Fixi V10.1

Fixi utilise l'API Claude uniquement côté serveur. La clé ne doit jamais être placée dans un fichier client, une variable `NEXT_PUBLIC_*` ou le code source.

## 1. Sécurité
La clé envoyée dans une conversation doit être révoquée dans Anthropic Console. Créez une nouvelle clé avant de configurer Fixi.

## 2. Configuration recommandée
Depuis Git Bash, dans `fixi-web` :

```bash
chmod +x configure-claude.sh
./configure-claude.sh
```

Le script demande la clé de manière masquée et ajoute les variables nécessaires dans `.env`.

Configuration équivalente manuelle :

```env
FIXI_AI_ENABLED=true
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=VOTRE_NOUVELLE_CLE
ANTHROPIC_MODEL=claude-sonnet-5
ANTHROPIC_API_URL=https://api.anthropic.com/v1
```

Puis :

```bash
docker compose up -d --force-recreate web
```

Un rebuild n'est pas nécessaire pour changer uniquement la clé ou le modèle.

## 3. Test dans Fixi
Connectez-vous comme gérant :

`Paramètres -> Claude / Anthropic -> Tester Claude`

Un test réussi affiche le modèle et la réponse `OK`.

## 4. Fonctions reliées
- Fixi Brain : Claude répond aux questions libres à partir d'agrégats préparés par Fixi.
- Analyse photo / Smart Vision : Claude peut analyser marque, modèle, couleur et dommages visibles.
- Copilot vocal Réception Express : Fixi effectue d'abord un parsing local puis Claude peut améliorer la normalisation marque/modèle/panne.

Les questions financières prédéfinies de Brain restent calculées par Fixi/SQL pour éviter qu'un modèle invente les chiffres.

## 5. Clé boutique optionnelle
L'ancien connecteur IA compatible `chat/completions` reste disponible dans Paramètres pour une clé propre à une boutique. Si une clé Anthropic centrale est configurée dans `.env`, elle est prioritaire pour Claude.

## 6. Désactivation
```env
FIXI_AI_ENABLED=false
```
Puis :
```bash
docker compose up -d --force-recreate web
```
Fixi revient aux fonctions Smart locales.
