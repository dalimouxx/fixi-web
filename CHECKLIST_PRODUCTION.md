# Checklist production Fixi V6

- [ ] `NEXT_PUBLIC_APP_URL` utilise HTTPS.
- [ ] Certificat TLS actif et renouvellement automatique.
- [ ] Secrets `.env` aléatoires, protégés et non commités.
- [ ] PIN initial changé et PIN utilisateurs à 6 chiffres.
- [ ] Mot de passe Fixi Control conservé dans un gestionnaire de mots de passe.
- [ ] Sauvegarde **et restauration** réellement testées.
- [ ] PostgreSQL non exposé publiquement.
- [ ] Volume `/app/data` persistant pour photos, signatures et médias.
- [ ] Rôles et seuils Cash Pro vérifiés : remise maximale, PIN gérant, session cash, livraison avec solde.
- [ ] Paiements combinés, remboursements et clôture de caisse testés.
- [ ] WhatsApp Cloud testé avant activation générale ; fallback `wa.me` vérifié.
- [ ] Konnect testé en Sandbox avant passage production et webhook HTTPS validé.
- [ ] Notifications Push testées sous HTTPS.
- [ ] Clé IA externe facultative testée sans exposer de données client sensibles.
- [ ] Supplier Marketplace : compte fournisseur, commande, livraison et réception stock testés.
- [ ] Campagnes Ads testées sur Queue / Track / Landing ; budgets et modèles CPM/CPC vérifiés.
- [ ] Limite reverse proxy adaptée aux médias publicitaires et photos.
- [ ] Régions, boutiques, abonnements et alertes Fixi Control vérifiés.
- [ ] Politique de confidentialité, publicité, paiement et consentements adaptée à votre juridiction.


## Annuaire public V7
- [ ] Les boutiques à publier ont `publicVisible` activé volontairement.
- [ ] Adresse, ville et téléphone sont vérifiés.
- [ ] Latitude/longitude correspondent à la bonne boutique.
- [ ] WhatsApp utilise un numéro professionnel.
- [ ] Horaires et services publics sont à jour.
- [ ] Les liens `/stores` et `/sitemap.xml` fonctionnent en HTTPS.
