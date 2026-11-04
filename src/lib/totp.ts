import crypto from 'crypto';

/** TOTP (RFC 6238) compatible Google Authenticator, Microsoft Authenticator, 2FAS… — sans dépendance. */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer) {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string) {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0; const out: number[] = [];
  for (const ch of clean) { value = (value << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}

export const newTotpSecret = () => base32Encode(crypto.randomBytes(20));

export function totpAt(secret: string, counter: number, digits = 6) {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', base32Decode(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 10 ** digits).padStart(digits, '0');
}

/** Code valide sur la période actuelle ± 1 (30 s de décalage d'horloge toléré). */
export function verifyTotp(secret: string | null | undefined, code: unknown, now = Date.now()) {
  const c = String(code ?? '').replace(/\s/g, '');
  if (!secret || !/^\d{6}$/.test(c)) return false;
  const t = Math.floor(now / 30000);
  return [-1, 0, 1].some(d => crypto.timingSafeEqual(Buffer.from(totpAt(secret, t + d)), Buffer.from(c)));
}

export function otpauthUri(secret: string, account: string, issuer = 'Fixi') {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
