# Fixi — Phase 2 (début d'année)

Notes enregistrées avant la mise en ligne sur le VPS. Rien de ceci n'est codé : la phase 1 est livrée (PR jusqu'à #88).
Chaque idée a été vérifiée dans le code au moment de la proposition : elle n'existe pas encore.
⭐ = idée « génie » (forte valeur pour peu de travail).

## Priorité 1 — à faire en premier (retours du terrain d'abord)

Ces cinq-là avaient été recommandés avant le lancement. Les refaire passer en premier, après avoir lu les premiers retours d'utilisateurs réels.

1. ⭐ **Clôture de caisse « à l'aveugle »** : le caissier compte sans voir le montant attendu ; un écart est signalé au gérant. Meilleure protection contre les vols de caisse.
2. ⭐ **Alertes anti-fraude** : remises répétées, annulations, remboursements après la fermeture, tiroir ouvert sans vente. Message au gérant.
3. ⭐ **Carnet de santé du téléphone (IMEI)** : historique complet d'un IMEI (réparations, pièces, garanties). À la réception : « Cet appareil est revenu sous garantie : réparation du 12/10, technicien Ali ».
4. **Acompte à la réception**, déduit automatiquement à l'encaissement et imprimé sur le ticket.
5. ⭐ **Données personnelles (loi tunisienne, INPDP)** : consentement à la réception, suppression des données d'un client sur demande, effacement automatique des CIN au-delà du délai légal. Important avant d'ouvrir au grand public.

## Priorité 2 — après les premiers retours

**Atelier / réparations**
- ⭐ **Chronomètre technicien** : « Commencer / Terminer » par réparation → rentabilité réelle par type de panne (ex. écran iPhone = 20 min = 45 DT de marge/heure).
- **Prix conseillé** : prix de la pièce chez les fournisseurs + main-d'œuvre habituelle de l'atelier.

**Caisse / comptoir**
- **Cartes cadeaux / bons d'achat** avec QR, vendus au comptoir.

**Téléphones d'occasion**
- ⭐ **Certificat Fixi** : QR sur l'étiquette → contrôles faits, batterie, historique, garantie.
- **Publication en un clic** : texte prêt à copier pour Facebook Marketplace / groupes, avec photo et prix.

**Stock**
- **Stock dormant** : pièces sans mouvement depuis 90 jours, avec proposition de promo ou de revente au réseau.
- **Inventaire tournant** : 5 articles à compter par jour au scanner, sans fermer la boutique.

**Fournisseurs**
- ⭐ **Import des prix** : le fournisseur ré-importe son Excel modifié ; les ateliers qui suivent ces pièces sont prévenus (« Écran A54 : −10 DT »).
- **Classement des ateliers clients** (meilleurs payeurs, en baisse, perdus) avec relance WhatsApp en un clic.

**Livreurs**
- **Code de livraison à 4 chiffres** donné au client ou à l'atelier + photo à la remise (le code de reprise existe déjà ; étendre à la livraison côté client).

**Client final**
- ⭐ **Paiement du devis en ligne** (Flouci ou D17) depuis la page de suivi, avant même de venir.
- **Écran salle d'attente** (TV de la boutique) : « Ticket 42 : prêt ✅ ».

**Fixi Control**
- **Score de santé de chaque boutique** (utilisation, erreurs, paiements) pour prévoir les départs.
- **Rapport hebdomadaire de la plateforme** sur Telegram : nouvelles boutiques, CA, erreurs, sauvegardes.
- **Alertes** : boutique inactive depuis 7 jours, gros écart de caisse, abonnement qui expire.

**Autres idées retenues pendant les retouches finales**
- **Export comptable mensuel** pour le comptable de l'atelier.
- **Règles automatiques par défaut pour les nouvelles boutiques** : aujourd'hui, un atelier créé par l'inscription n'a aucune règle (relance appareil prêt, alerte stock faible, écart de caisse) tant que l'on ne relance pas l'initialisation ou qu'il ne les crée pas lui-même dans « Rappels automatiques ». À décider : les activer à l'inscription.

## À décider avec vous

- Le caissier garde-t-il le droit de faire des **dépenses** de caisse ? Aujourd'hui il ne l'a pas (voir `src/lib/supplier-permissions.ts`).
- Chaque gérant fournisseur doit créer son **code gérant** (Équipe → Droits) pour que les remises et remboursements dépassant les limites puissent être validés en caisse.

## Suivi technique à ne pas oublier

- Quand le domaine définitif est choisi : renseigner `FIXI_PUBLIC_URL` dans les variables GitHub (caisse Windows et application Android) — voir `deploy/vps/GUIDE_HOSTINGER.md`.
- Après la première version Android signée : copier l'empreinte SHA-256 dans `TWA_SHA256` du serveur.
- Règle de base de données : ne jamais ajouter de contrainte `@@unique` sur une table existante (`prisma db push` sans perte de données) ; utiliser `@@index` + contrôle dans l'API.
