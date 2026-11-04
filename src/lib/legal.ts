/**
 * Textes légaux de Fixi (17.5). MODÈLES rédigés pour une plateforme SaaS en Tunisie :
 * ils doivent être relus par un juriste avant d'être considérés comme définitifs.
 * Passer LEGAL_VALIDATED à true une fois la relecture faite (le bandeau « version provisoire » disparaît).
 */
export const LEGAL_VALIDATED = false;
export const LEGAL_UPDATED = '4 novembre 2026';

export type LegalDoc = { slug: 'conditions' | 'confidentialite' | 'mentions-legales'; title: string; intro: string; sections: { h: string; p: string[] }[] };
type Ctx = { app: string; email: string; phone: string };

export function legalDocs(c: Ctx): LegalDoc[] {
  const contact = [c.email && `par e-mail à ${c.email}`, c.phone && `par téléphone ou WhatsApp au ${c.phone}`].filter(Boolean).join(' ou ') || 'depuis la rubrique Support de l’application';
  return [
    { slug: 'conditions', title: 'Conditions d’utilisation', intro: `Ces conditions encadrent l’utilisation de ${c.app} par les ateliers de réparation, les fournisseurs et les livreurs.`, sections: [
      { h: '1. Le service', p: [`${c.app} est un logiciel en ligne qui permet de gérer les réparations, le stock, la caisse, les commandes aux fournisseurs et leurs livraisons.`, `L’offre gratuite « ${c.app} Connect » donne accès au catalogue des fournisseurs, aux commandes, aux livraisons, aux factures et aux dettes fournisseurs. Les offres payantes ajoutent les modules décrits sur la page Tarifs.`] },
      { h: '2. Création du compte', p: ['Vous devez fournir des informations exactes (nom de la boutique, gouvernorat, nom du gérant, téléphone) et les tenir à jour.', 'Le gérant est responsable des codes PIN et des comptes des employés qu’il crée. Un code PIN est personnel et ne doit pas être partagé.'] },
      { h: '3. Essai et abonnements', p: ['Un essai gratuit peut être proposé une seule fois par atelier. Aucun paiement n’est demandé pendant l’essai ; à son terme, le compte revient automatiquement à l’offre gratuite.', 'Les abonnements payants sont réglés selon les moyens indiqués dans l’application. Sans renouvellement, le compte revient à l’offre gratuite : les modules payants sont désactivés, les données ne sont pas supprimées.'] },
      { h: '4. Vos données', p: [`Les données saisies (clients, réparations, ventes, produits) vous appartiennent. ${c.app} les traite uniquement pour fournir le service, comme décrit dans la politique de confidentialité.`, `Pour aider les fournisseurs à créer leurs fiches produits, ${c.app} peut proposer le nom, la catégorie, la marque et la photo d’un produit déjà présent sur le réseau à partir de son code-barres. Les prix, les stocks et l’identité du fournisseur ne sont jamais partagés.`] },
      { h: '5. Usage acceptable', p: ['Il est interdit d’utiliser le service pour vendre des produits illicites ou volés, de tenter d’accéder aux données d’un autre compte, ou de perturber le fonctionnement de la plateforme.', `${c.app} peut suspendre un compte en cas de manquement grave, après avoir informé le gérant lorsque c’est possible.`] },
      { h: '6. Disponibilité et responsabilité', p: [`${c.app} met tout en œuvre pour que le service soit disponible et sécurisé, sans pouvoir garantir une disponibilité sans interruption.`, 'Les ventes, factures et déclarations fiscales restent sous la responsabilité de chaque professionnel.'] },
      { h: '7. Résiliation', p: [`Vous pouvez arrêter d’utiliser ${c.app} à tout moment et demander l’export ou la suppression de vos données ${contact}.`] },
      { h: '8. Droit applicable', p: ['Ces conditions sont soumises au droit tunisien. En cas de litige, une solution amiable sera recherchée avant toute action devant les tribunaux compétents.'] },
    ] },
    { slug: 'confidentialite', title: 'Politique de confidentialité', intro: `Comment ${c.app} collecte, utilise et protège les données personnelles, conformément à la loi organique n° 2004-63 du 27 juillet 2004 relative à la protection des données à caractère personnel.`, sections: [
      { h: '1. Données collectées', p: ['Compte : nom de la boutique, gouvernorat, ville, adresse, nom et téléphone du gérant et des employés.', 'Activité : réparations, clients de l’atelier, ventes, stock, commandes, livraisons (y compris la position du livreur pendant une livraison en cours), factures et paiements.', 'Technique : journaux de connexion et adresse IP, utilisés pour la sécurité (limitation des tentatives, détection d’abus).'] },
      { h: '2. Pourquoi', p: ['Fournir le service, sécuriser les comptes, assurer le support, envoyer les notifications utiles (commande, livraison, réparation prête) et améliorer l’application.', `${c.app} ne vend aucune donnée personnelle.`] },
      { h: '3. Qui y a accès', p: ['Chaque atelier ou fournisseur ne voit que ses propres données et celles nécessaires à une commande commune (par exemple l’adresse de livraison pour le fournisseur et le livreur).', `L’équipe ${c.app} peut y accéder pour le support et la sécurité. L’hébergeur technique traite les données pour le compte de ${c.app}.`] },
      { h: '4. Durée de conservation', p: ['Les données sont conservées tant que le compte est actif, puis supprimées ou anonymisées sur demande, sous réserve des obligations légales de conservation des documents comptables.'] },
      { h: '5. Vos droits', p: [`Vous pouvez demander l’accès, la rectification ou la suppression de vos données ${contact}. Les clients d’un atelier s’adressent d’abord à cet atelier, qui reste responsable des données qu’il saisit.`] },
      { h: '6. Sécurité', p: ['Codes PIN et mots de passe protégés par hachage, connexions chiffrées, limitation des tentatives, journal des actions sensibles.'] },
    ] },
    { slug: 'mentions-legales', title: 'Mentions légales', intro: `Informations sur l’éditeur de ${c.app}.`, sections: [
      { h: 'Éditeur', p: [`${c.app} — plateforme éditée depuis Gabès, Tunisie.`, 'Raison sociale, matricule fiscal et adresse du siège : à compléter.'] },
      { h: 'Contact', p: [`Vous pouvez nous joindre ${contact}.`] },
      { h: 'Propriété intellectuelle', p: [`Le logiciel, la marque ${c.app}, les logos et les contenus de la plateforme sont protégés. Les données et logos des utilisateurs restent leur propriété.`] },
    ] },
  ];
}
