/** Règles pures de l'inscription publique d'un atelier (testables sans base). */
export const GOUVERNORATS = [
  'Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa', 'Jendouba', 'Kairouan',
  'Kasserine', 'Kébili', 'Le Kef', 'Mahdia', 'La Manouba', 'Médenine', 'Monastir', 'Nabeul',
  'Sfax', 'Sidi Bouzid', 'Siliana', 'Sousse', 'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan',
];

/** Nom de boutique → identifiant d'URL (sans accents, minuscules, tirets). */
export function slugify(name: string) {
  const s = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '');
  return s.length >= 3 ? s : `atelier-${s || 'fixi'}`;
}

/** Téléphone tunisien → 8 chiffres (accepte +216 / 00216 / espaces). null si invalide. */
export function normalizePhone(raw: string) {
  let d = String(raw || '').replace(/[^\d]/g, '');
  if (d.startsWith('00216')) d = d.slice(5); else if (d.startsWith('216') && d.length === 11) d = d.slice(3);
  return /^[2-9]\d{7}$/.test(d) ? d : null;
}

/** PIN trop simple (000000, 123456, 654321…). */
export function weakPin(pin: string) {
  if (/^(\d)\1{5}$/.test(pin)) return true;
  const up = '01234567890', down = '09876543210';
  return up.includes(pin) || down.includes(pin);
}

export type SignupInput = { shopName: string; region: string; city: string; fullName: string; phone: string; pin: string; pinConfirm: string; accept: boolean };
export type SignupClean = { shopName: string; region: string; city: string | null; fullName: string; phone: string; pin: string };

export function validateSignup(b: Partial<SignupInput>): { ok: true; value: SignupClean } | { ok: false; error: string } {
  const shopName = String(b.shopName || '').trim().replace(/\s+/g, ' ');
  const fullName = String(b.fullName || '').trim().replace(/\s+/g, ' ');
  const region = String(b.region || '').trim();
  const city = String(b.city || '').trim().slice(0, 80) || null;
  const pin = String(b.pin || '');
  if (shopName.length < 3 || shopName.length > 60) return { ok: false, error: 'Nom de la boutique : 3 à 60 caractères' };
  if (!GOUVERNORATS.includes(region)) return { ok: false, error: 'Choisissez votre gouvernorat' };
  if (fullName.length < 3 || fullName.length > 60) return { ok: false, error: 'Votre nom complet : 3 à 60 caractères' };
  const phone = normalizePhone(String(b.phone || ''));
  if (!phone) return { ok: false, error: 'Numéro de téléphone invalide (8 chiffres)' };
  if (!/^\d{6}$/.test(pin)) return { ok: false, error: 'Le code PIN doit contenir 6 chiffres' };
  if (weakPin(pin)) return { ok: false, error: 'Code PIN trop simple, choisissez-en un autre' };
  if (pin !== String(b.pinConfirm || '')) return { ok: false, error: 'Les deux codes PIN ne correspondent pas' };
  if (!b.accept) return { ok: false, error: 'Cochez la case d’accord pour continuer' };
  return { ok: true, value: { shopName, region, city, fullName, phone, pin } };
}
