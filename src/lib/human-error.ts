// Traduit les codes techniques renvoyés par l'API en phrases compréhensibles
// par un réparateur ou un fournisseur. Aucun code brut ne doit atteindre l'écran.
const exact: Record<string, string> = {
  UNAUTHENTICATED: 'Votre session a expiré. Reconnectez-vous pour continuer.',
  FORBIDDEN: 'Votre rôle ne permet pas cette action. Demandez au gérant de la boutique.',
  MODULE_PREMIUM_REQUIS: 'Cette fonction fait partie de Fixi Pro. Ouvrez « Abonnement » pour voir les offres.',
  'Erreur serveur': 'Un problème est survenu de notre côté. Réessayez dans un instant.',
  'Failed to fetch': 'Connexion internet interrompue. Vérifiez le réseau puis réessayez.',
  'Load failed': 'Connexion internet interrompue. Vérifiez le réseau puis réessayez.',
  'NetworkError when attempting to fetch resource.': 'Connexion internet interrompue. Vérifiez le réseau puis réessayez.',
};

export function humanError(raw: unknown): string {
  const message = String((raw as any)?.message ?? raw ?? '').trim();
  if (!message) return exact['Erreur serveur'];
  if (exact[message]) return exact[message];
  if (/^\[?\s*\{\s*"code"/.test(message) || message.includes('"issues"'))
    return 'Certaines informations sont manquantes ou incorrectes. Vérifiez le formulaire.';
  if (/prisma|P20\d\d|Invalid `|ECONNREFUSED|Unexpected token/i.test(message))
    return exact['Erreur serveur'];
  return message;
}
