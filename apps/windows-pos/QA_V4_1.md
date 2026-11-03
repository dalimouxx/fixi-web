# FIXI Caisse Windows V4.1 — recette fonctionnelle avant mise en production

Ce document n'atteste pas que les tests ont été réalisés. Il décrit les contrôles à exécuter avec un **fournisseur de test**, des clients fictifs et une imprimante thermique configurée.

## Prérequis
- Installer l'artifact NSIS du dernier build V4.1 ; ne pas confondre avec la V3 ou V4 initiale.
- Se connecter comme OWNER/ADMIN/MANAGER, ouvrir une session de caisse et utiliser des références/articles de test.
- Préparer un lecteur USB Code128 et une imprimante thermique 80 mm (test complémentaire sur 58 mm).
- Vérifier qu'aucun réel fonds client n'est utilisé pendant cette recette.

## Scénarios indispensables
1. **Tarifs** : ouvrir le catalogue ; comparer détail et gros aux prix du fournisseur web. Sélectionner gros avec panier vide ; scanner un article et valider que le ticket et la vente ERP ont le même prix. Vérifier le refus serveur du prix inférieur au plancher pour les rôles non autorisés.
2. **Vente** : ouvrir la caisse, vendre deux articles, vérifier le mouvement stock unique, la référence WIN-… unique et l'impression lancée. Vérifier sur le ticket le nom légal, matricule fiscal et numéro de téléphone s'ils sont configurés.
3. **Scan ticket** : relire le code-barres Code128 imprimé dans Historique, retrouver la vente, ouvrir son détail, puis réimprimer deux fois la même référence sans nouvelle vente.
4. **Recherche** : retrouver des tickets par nom, téléphone, période et référence ; vérifier que les ventes d'un autre fournisseur ne sont jamais accessibles.
5. **Retour** : scanner le ticket, sélectionner quantité et état, rembourser une quantité partielle ; vérifier l'avoir, le stock (bon état uniquement) et les montants remboursés. Rejouer le même identifiant après une coupure ; aucun second remboursement.
6. **Client** : créer une fiche, revenir à la caisse avec ce client sélectionné et contrôler dans FIXI Supplier l'absence de doublon involontaire.
7. **Dettes globales** : créer trois ventes à crédit du même client ; encaisser un versement couvrant entièrement la première et partiellement la seconde. Vérifier les 3 soldes, le registre des paiements, la caisse et l'exactitude après actualisation.
8. **Idempotence paiement** : soumettre deux fois le même WINCUST-…, et exécuter simultanément deux versements sur la même dette ; résultat = montant reçu sans double comptabilisation.
9. **Recettes livreurs** : soumettre une tournée de test ; vérifier montant COD prévu et déclaré, clôturer avec montant réel. Une remise déjà clôturée ne doit pas pouvoir l'être une seconde fois. En cas d'écart, une observation est obligatoire.
10. **PIN et reprise** : activer le PIN, fermer Windows, rouvrir et vérifier la connexion par PIN. Contrôler la conservation du panier impayé et l'absence de nouveau paiement lors d'une reprise après coupure.
11. **Matériel** : vérifier scanner avec touche Entrée, stabilité du focus F2, impression correcte sur imprimante USB, caractères accentués, coupe papier et lisibilité du Code128.
12. **Rôles** : vérifier que le caissier ne peut pas créer un remboursement réservé au responsable, ni voir les tickets d'une autre société.

## Conditions de sortie
- Tous les cas ci-dessus doivent être marqués RÉUSSI sur des données de test, avec ticket imprimé et trace correspondante dans FIXI Cloud.
- Signaler toute différence entre la caisse Windows, l'ERP fournisseur, les dettes, les stocks et la recette livreur.
- Les essais de tickets/espèces ne prouvent pas à eux seuls la conformité fiscale de l'impression en Tunisie ; celle-ci nécessite une vérification des mentions légales et règles applicables.
