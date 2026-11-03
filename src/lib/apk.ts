// Adresse du fichier APK de l'application Android (dernière version publiée par GitHub Actions).
export const APK_URL = process.env.FIXI_APK_URL || 'https://github.com/dalimouxx/fixi-web/releases/download/android-latest/Fixi.apk';
export const ANDROID_PAGE = '/android';
export function apkShareMessage(base: string, shop?: string) {
  return `${shop ? `${shop} : ` : ''}installez l’application Fixi sur votre téléphone Android.\n1. Ouvrez ce lien : ${base.replace(/\/$/, '')}${ANDROID_PAGE}\n2. Touchez « Télécharger », puis « Installer » (autorisez l’installation si Android le demande).\n3. Connectez-vous avec votre code.`;
}
