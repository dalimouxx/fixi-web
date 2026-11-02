// Petite vibration de confirmation (Android ; iPhone ignore l'API sans erreur).
// Désactivable par l'utilisateur : localStorage « fixi-haptics » = "off".
const patterns = { tap: 8, success: 14, error: [30, 60, 30], warn: [18, 40] } as const;
export type HapticKind = keyof typeof patterns;

export function hapticsEnabled() {
  try { return localStorage.getItem('fixi-haptics') !== 'off'; } catch { return true; }
}

export function haptic(kind: HapticKind = 'success') {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
  if (!hapticsEnabled()) return false;
  try { return navigator.vibrate(patterns[kind] as any); } catch { return false; }
}

/** Les appels qui modifient quelque chose (POST, PUT, PATCH, DELETE) vibrent en cas de succès. */
export function isMutation(init?: { method?: string }) {
  const m = String(init?.method || 'GET').toUpperCase();
  return m !== 'GET' && m !== 'HEAD';
}
