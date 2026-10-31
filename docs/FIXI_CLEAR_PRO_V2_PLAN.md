# FIXI Clear Pro V2 — feuille de route validée

Date : 31 octobre 2026. Ce document décrit les exigences du projet. Les éléments non cochés restent à développer et tester.

## 1. Système visuel commun
- Thème clair par défaut ; primaire #2563EB, texte #0F172A, fond #F6F8FC, surface #FFF, bordure #E2E8F0, accent orange #F59E0B modéré.
- Police Inter et prise en charge complète de l’arabe RTL (Noto Sans Arabic), titres lisibles, corps de texte 16 px, zones tactiles >=44 px, WCAG AA.
- Composants réutilisables : navigation, barres haut/bas, formulaires, tableaux, cartes, recherche, états, toasts et chargements.
- Animations limitées à 150–250 ms, respect « Réduire les animations ».

## 2. Refonte par application
- Landing : proposition de valeur claire, démo, captures réelles, bénéfices par métier, tarifs et contact.
- Réparateur/Atelier : Réception Express, dossiers, commandes, dettes, garantie et navigation mobile fiable.
- Supplier : ventes gros/détail, stock, caisse, clients, commandes, retours, dettes et livreurs.
- Livreur : boutons larges, missions, itinéraire, scan preuve, encaissement, remises et alertes immédiates.
- Admin : abonnements, organisations, rôles, facturation, support, anomalies et audit.
- Caisse Windows : scanner, panier conservé, tickets Code128 imprimés/retrouvables, PIN, règlements globaux, retours et clôtures de tournée.

## 3. Notifications FIXI Smart Alerts — P0
- Différencier Supplier (nouvelle commande, préparation, remise de recettes, incident), Atelier (commande/livraison/réparation/dette), Livreur (mission/arrivée/livraison/recette), Admin (fraude, support, incidents).
- Grande notification visuelle avec rôle, référence, contexte et bouton d’accès direct, audible en page active après interaction.
- Volume réglable, bouton test, diagnostic permission Service Worker/Push, erreur serveur claire et Push test vers son propre compte.
- Push en arrière-plan et sur écran verrouillé sous contrôle des permissions navigateur/Android/iOS ; sons personnalisés non garantis par simple PWA quand téléphone verrouillé.
- Déduplication par événement/destinataire et rôles, journal de transmission, protection contre la fuite de données et accusé de réception pour les missions urgentes.
- Recette sur Android, iPhone avec PWA installée si nécessaire, et PC : ouvert/fermé/verrouillé/reconnexion, notifications reçues une seule fois et liées au bon dossier.

## 4. Étiquettes
- Format par défaut demandé : 40 mm de largeur × 20 mm de hauteur, en paysage ; pilote Windows configuré identiquement, taille 100 %, marges page 0.
- Nom produit, fournisseur, tag FIXI, référence courte et code-barres Code128 noir sur blanc.
- Échantillon à imprimer et rescanner sur imprimante physique avant validation. Les références longues non scannables sont refusées.
- Anciennes tailles 50×30 et 60×40 conservées.

## 5. Suite et critères de validation
P0 : stabilité financière, étiquettes physiques, Push et son sur appareils réels.
P1 : refonte progressive des écrans Supplier, Atelier, Livreur, Admin et landing.
P2 : rapport Z, paiement mixte, IMEI/numéro de série, garantie, impressions ESC/POS sans dialogue et supervision avancée.
Chaque lot : pull request séparée, compilation et tests automatiques, contrôle mobile/desktop, tests de rôles, validation métier et procédure de retour arrière.

## État de réalisation du premier lot
La PR de phase 1 introduit les tokens Clear Pro, des notifications plus lisibles, test sonore, volume, diagnostic Push et envoi d’un Push de test. Ces ajouts ne constituent pas une validation de réception sur téléphone réel ni une refonte complète de tous les écrans.
