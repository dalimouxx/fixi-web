# Fixi 16.1.0 — serveur pour FIXI Caisse Windows 6

- **Vente sans doublon** : une vente renvoyée avec la même référence (caisse hors ligne, double clic) rend la vente déjà enregistrée, même si deux envois arrivent en même temps.
- **Stock protégé** : la vente échoue proprement si le stock a changé entre-temps, au lieu de passer en négatif.
- **Article libre** : une ligne sans fiche produit (main-d'œuvre, accessoire), avec un nom et un prix, sans toucher au stock.
- **Remise** : elle est refusée si elle dépasse le montant de la vente.
- **Démarrage de la caisse** : il renvoie aussi les ventes des 30 derniers jours par article (les plus vendus en premier), le téléphone des clients (pour WhatsApp), le logo de la société et le nom du caissier.
- **Résumé de caisse** (`/api/supplier/desktop/v4/cash-summary`) : espèces attendues pour la clôture guidée et chiffres des rapports X et Z.
