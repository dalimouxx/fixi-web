import { APK_URL } from '@/lib/apk';
// Lien court et stable vers la dernière version de l'application Android.
export function GET() { return Response.redirect(APK_URL, 302); }
