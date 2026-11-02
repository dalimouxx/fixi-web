// IMEI : 15 chiffres avec clé de Luhn. Les codes-barres peuvent ajouter des espaces ou un préfixe « IMEI ».
export function cleanImei(v: string) { return String(v || '').replace(/^\s*imei\s*[:#]?\s*/i, '').replace(/[\s.-]/g, ''); }

export function isImei(v: string) {
  const d = cleanImei(v);
  if (!/^\d{15}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) { let n = Number(d[i]); if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; } sum += n; }
  return sum % 10 === 0;
}
