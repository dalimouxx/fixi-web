import crypto from 'crypto';
function key() {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) throw new Error('DATA_ENCRYPTION_KEY manquant');
  const b=Buffer.from(raw,'base64');
  if (b.length!==32) throw new Error('DATA_ENCRYPTION_KEY doit contenir 32 octets en base64');
  return b;
}
export function encryptSecret(value?: string | null) {
  if (!value) return null;
  const iv=crypto.randomBytes(12); const cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);
  const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
  const tag=cipher.getAuthTag();
  return Buffer.concat([iv,tag,encrypted]).toString('base64');
}
export function decryptSecret(value?: string | null) {
  if (!value) return null;
  try { const b=Buffer.from(value,'base64'); const iv=b.subarray(0,12); const tag=b.subarray(12,28); const data=b.subarray(28); const d=crypto.createDecipheriv('aes-256-gcm',key(),iv); d.setAuthTag(tag); return Buffer.concat([d.update(data),d.final()]).toString('utf8'); } catch { return null; }
}
