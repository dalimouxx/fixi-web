# Dépannage réseau npm / Docker

Si le build s'arrête sur `npm install` avec `ECONNRESET`, le problème est la connexion entre Docker et le registre npm, pas Fixi.

1. Vérifier Docker -> npm :
   `docker run --rm node:22-alpine npm ping --registry=https://registry.npmjs.org/`
2. Si le ping réussit, relancer :
   `docker compose build web`
   puis `docker compose up -d`
3. Si le ping échoue, redémarrer Docker Desktop et tester sans VPN/proxy. Vérifier aussi DNS/proxy Docker Desktop.

V7.0.1 conserve le cache npm BuildKit et augmente fortement retries/timeouts, de sorte qu'une coupure temporaire n'oblige pas à tout retélécharger au build suivant.
