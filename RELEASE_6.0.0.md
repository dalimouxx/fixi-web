# Fixi Web 6.0.0 — Connected Business

Fixi V6 transforme V5 en écosystème connecté tout en conservant le fonctionnement local sans services externes.

## Nouveautés majeures
- Fixi Cash Pro : espace 3 colonnes, recherche/scan, raccourcis, paiements combinés, remise contrôlée, historique, livraison et lien de paiement.
- Paiement client : liens sécurisés, Konnect optionnel, webhook idempotent et simulateur local hors production.
- WhatsApp Cloud API optionnelle avec journal d'envoi et fallback `wa.me`.
- Notifications Web Push (VAPID) et abonnements par utilisateur.
- Photo/caméra à la réception et identification visuelle optionnelle via une API IA multimodale compatible Chat Completions.
- Fixi Brain peut utiliser une IA externe optionnelle uniquement sur des agrégats métier lorsqu'une question sort des analyses locales.
- Fixi Supplier : portail fournisseur séparé, catalogue, stock, commandes, livreur, suivi et réception directe dans le stock boutique.
- Vue Réseau / Franchise pour les tenants multi-boutiques.
- Fixi Ads Business : validation, budget, forfait/CPM/CPC, dépenses, impressions, clics et QR scans.
- Landing Page V6 et identité orange premium conservées.

## Principe important
WhatsApp Cloud, Konnect et l'IA externe sont facultatifs. Fixi continue de fonctionner sans ces clés : les fonctions concernées utilisent un fallback ou restent simplement désactivées.
