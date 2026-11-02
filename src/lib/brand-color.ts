// Couleur de l'atelier : utilisée sur le reçu et la page de suivi vue par ses clients.
export const DEFAULT_SHOP_COLOR = '#c2500a';
export const SHOP_COLOR_PRESETS = ['#c2500a', '#d92d20', '#1570ef', '#0e9384', '#079455', '#6938ef', '#c11574', '#344054'];

export function isHexColor(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
}

function rgb(hex: string) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map(c => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string) { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); }

/** Texte lisible sur la couleur : blanc si le contraste suffit, sinon presque noir. */
export function onColor(hex: string) { return contrast(hex, '#ffffff') >= 3 ? '#ffffff' : '#101828'; }

/** Variables CSS à poser sur la page ; une couleur absente ou invalide retombe sur l'orange Fixi. */
export function shopBrandVars(hex?: string | null): Record<string, string> {
  const c = isHexColor(hex) ? hex.toLowerCase() : DEFAULT_SHOP_COLOR;
  const [r, g, b] = rgb(c);
  return { '--shop-brand': c, '--shop-brand-soft': `rgba(${r},${g},${b},.12)`, '--shop-on-brand': onColor(c) };
}
