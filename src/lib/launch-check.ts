/**
 * « Prêt pour la mise en ligne ? » : vérifications avant d'ouvrir Fixi au public (VPS ou Render).
 * Fonction pure (testable) : on lui passe l'environnement et quelques faits lus en base.
 */
export type LaunchFacts = {
  backupAgeHours: number | null; restoreOkAgeDays: number | null; errors24h: number;
  platformAdmins: number; platformAdminsWithout2fa: number;
  shops: number; shopsWithoutRecovery: number; openProblems: number;
  /** E-mail ou téléphone de contact renseigné dans Fixi Control → Identité (pages légales, aide). */
  hasContact?: boolean;
};
export type LaunchCheck = { key: string; label: string; ok: boolean; level: 'bad' | 'warn'; hint: string };

const DEV_SECRETS = /dev-|change|changez|secret-?123|example|xxx/i;
const strong = (v?: string) => !!v && v.length >= 32 && !DEV_SECRETS.test(v);

export function launchChecks(env: Record<string, string | undefined>, f: LaunchFacts): LaunchCheck[] {
  const secrets = ['AUTH_SECRET', 'PLATFORM_AUTH_SECRET', 'SUPPLIER_AUTH_SECRET', 'DELIVERY_AUTH_SECRET'];
  const weak = secrets.filter(k => !strong(env[k]));
  const values = secrets.map(k => env[k]).filter(Boolean);
  const url = env.NEXT_PUBLIC_APP_URL || '';
  return [
    { key: 'secrets', label: 'Clés de session fortes et différentes', ok: !weak.length && new Set(values).size === values.length, level: 'bad',
      hint: weak.length ? `À remplir (32 caractères minimum, « openssl rand -base64 32 ») : ${weak.join(', ')}` : 'Chaque espace doit avoir sa propre clé.' },
    { key: 'encryption', label: 'Chiffrement des données sensibles (CIN, jetons)', ok: strong(env.DATA_ENCRYPTION_KEY), level: 'bad', hint: 'DATA_ENCRYPTION_KEY manquante ou trop courte. Ne la changez plus jamais une fois en production.' },
    { key: 'cron', label: 'Tâches automatiques protégées', ok: (env.CRON_SECRET || '').length >= 16, level: 'bad', hint: 'CRON_SECRET (16 caractères minimum) protège les envois automatiques et les sauvegardes.' },
    { key: 'https', label: 'Adresse publique en HTTPS', ok: /^https:\/\/[^/]+\.[a-z]{2,}/i.test(url) && !/localhost|127\.0\.0\.1/.test(url), level: 'bad', hint: url ? `NEXT_PUBLIC_APP_URL = ${url}` : 'NEXT_PUBLIC_APP_URL manquante (liens de suivi, QR, messages).' },
    { key: 'domain', label: 'Nom de domaine à vous', ok: /^https:\/\//i.test(url) && !/\.onrender\.com|\.vercel\.app|localhost/i.test(url), level: 'warn', hint: 'Une adresse du type fixi.votre-domaine.tn inspire confiance (QR, SMS, factures) et ne change pas si vous changez d’hébergeur.' },
    { key: 'contact', label: 'Contact visible (pages légales et aide)', ok: f.hasContact !== false, level: 'warn', hint: 'Renseignez l’e-mail et le téléphone de support dans Fixi Control → Identité.' },
    { key: 'alerts', label: 'Alertes sur votre téléphone', ok: !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) || !!env.ALERT_WEBHOOK_URL, level: 'warn', hint: 'TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (ou ALERT_WEBHOOK_URL) : sans eux, une panne passe inaperçue.' },
    { key: 'backup', label: 'Sauvegarde de moins de 26 h', ok: f.backupAgeHours !== null && f.backupAgeHours <= 26, level: 'bad', hint: f.backupAgeHours === null ? 'Aucune sauvegarde reçue. Lancez-en une (deploy/vps/README.md, étape 5).' : `Dernière sauvegarde il y a ${Math.round(f.backupAgeHours)} h.` },
    { key: 'restore', label: 'Restauration testée cette semaine', ok: f.restoreOkAgeDays !== null && f.restoreOkAgeDays <= 8, level: 'warn', hint: 'Une sauvegarde jamais restaurée n’est pas une sauvegarde : lancez le test de restauration.' },
    { key: '2fa', label: 'Double authentification des super admins', ok: f.platformAdmins > 0 && f.platformAdminsWithout2fa === 0, level: 'warn', hint: `${f.platformAdminsWithout2fa} compte(s) Fixi Control sans code à 6 chiffres (Outils → Sécurité).` },
    { key: 'recovery', label: 'Codes de secours des gérants', ok: f.shopsWithoutRecovery === 0, level: 'warn', hint: `${f.shopsWithoutRecovery} boutique(s) sur ${f.shops} : le gérant n’a pas encore créé son code de secours (Paramètres → Sécurité).` },
    { key: 'errors', label: 'Aucune erreur serveur ces dernières 24 h', ok: f.errors24h === 0, level: 'warn', hint: `${f.errors24h} erreur(s) à regarder ci-dessous.` },
    { key: 'problems', label: 'Problèmes signalés traités', ok: f.openProblems === 0, level: 'warn', hint: `${f.openProblems} signalement(s) en attente (onglet Support).` },
  ];
}

export function launchScore(checks: LaunchCheck[]) {
  const bad = checks.filter(c => !c.ok && c.level === 'bad').length;
  const warn = checks.filter(c => !c.ok && c.level === 'warn').length;
  return { ready: bad === 0, bad, warn, done: checks.filter(c => c.ok).length, total: checks.length };
}
