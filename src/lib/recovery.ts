import crypto from 'crypto';

// Alphabet sans caractères ambigus (pas de 0/O, 1/I/L) : lisible au téléphone et sur papier.
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Code de secours : FIXI-XXXX-XXXX-XXXX (≈ 74 bits d'entropie). */
export function newRecoveryCode() {
  const bytes = crypto.randomBytes(15);
  const chars = [...bytes].map(b => ALPHA[b % ALPHA.length]).join('');
  return `FIXI-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

/** Normalise ce que tape l'utilisateur : majuscules, sans espaces ni tirets, O→0 évité. */
export function normalizeRecoveryCode(raw: unknown) {
  return String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^FIXI/, '');
}

/** PIN temporaire à 6 chiffres (réinitialisation par Fixi Control). */
export function temporaryPin() { return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0'); }
