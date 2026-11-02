import crypto from 'crypto';

// Code court et non devinable pour le lien d'invitation (/fournisseur/<code>).
export function inviteCode() {
  return crypto.randomBytes(6).toString('base64url');
}

export function inviteLink(base: string, code: string) {
  return `${(base || '').replace(/\/$/, '')}/fournisseur/${encodeURIComponent(code)}`;
}

export function inviteMessage(v: { supplier: string; shop: string; link: string }) {
  return `Bonjour ${v.supplier}, c’est ${v.shop}. Je commande mes pièces avec Fixi : je vois votre catalogue, je commande en un toucher et je suis la livraison. `
    + `Vous recevez chaque commande avec une alerte et vous la confirmez en un geste. L’espace fournisseur Fixi Connect est gratuit pour démarrer.\n`
    + `Demandez votre espace ici : ${v.link}`;
}

export function cleanText(v: unknown, max = 120) {
  return String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function cleanPhone(v: unknown) {
  const d = String(v ?? '').replace(/[^\d+]/g, '');
  return d.length >= 8 && d.length <= 16 ? d : '';
}
