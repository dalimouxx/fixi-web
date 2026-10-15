# Fixi Web 10.1.0 — Claude / Anthropic

- API Claude Messages intégrée directement côté serveur, sans SDK npm supplémentaire.
- Modèle par défaut : `claude-sonnet-5`.
- Fixi Brain : fallback Claude pour questions libres sur agrégats boutique.
- Smart Vision : analyse photo via Claude multimodal.
- Copilot vocal : parsing local immédiat puis enrichissement Claude si configuré.
- Bouton Paramètres `Tester Claude`.
- Variables Docker sécurisées `ANTHROPIC_*`.
- Script `configure-claude.sh` avec saisie masquée.
- Ancienne IA compatible Chat Completions conservée comme option boutique.
- Aucun secret inclus dans le ZIP.
