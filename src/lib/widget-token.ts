import crypto from 'crypto';
export const newWidgetToken = () => crypto.randomBytes(32).toString('base64url');
export const hashWidgetToken = (t: string) => crypto.createHash('sha256').update(String(t)).digest('hex');
export const MAX_WIDGET_TOKENS = 10;
