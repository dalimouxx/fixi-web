import { SignJWT, jwtVerify } from 'jose';
import QRCode from 'qrcode';
import { otpauthUri } from './totp';

/** Jeton « appareil de confiance » (30 jours) : évite de redemander le code à chaque connexion sur le même appareil. */
const key = () => new TextEncoder().encode((process.env.SESSION_SECRET || process.env.PLATFORM_AUTH_SECRET || 'dev-trust-secret-change-me') + ':2fa-trust');
export const TRUST_DAYS = 30;

export async function issueTrust(kind: 'supplier' | 'platform', id: string, version: number) {
  return new SignJWT({ k: kind, v: version }).setProtectedHeader({ alg: 'HS256' }).setSubject(id).setIssuedAt().setExpirationTime(`${TRUST_DAYS}d`).sign(key());
}

export async function checkTrust(token: unknown, kind: 'supplier' | 'platform', id: string, version: number) {
  if (typeof token !== 'string' || token.length > 2000) return false;
  try { const { payload } = await jwtVerify(token, key()); return payload.sub === id && payload.k === kind && Number(payload.v) === version; } catch { return false; }
}

export async function setupPayload(secret: string, account: string, issuer: string) {
  const uri = otpauthUri(secret, account, issuer);
  return { secret, uri, qr: await QRCode.toDataURL(uri, { margin: 1, width: 240 }) };
}

export const TOTP_REQUIRED = 'Code de vérification requis';
