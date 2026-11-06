import crypto from 'crypto';
import { prisma } from './prisma';

/**
 * Alertes techniques de la plateforme (pas des ateliers).
 * Canaux, au choix, dans les variables d'environnement :
 *  - TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID : message Telegram (gratuit, instantané sur le téléphone) ;
 *  - ALERT_WEBHOOK_URL : POST JSON {text, content} (Discord, Slack, Google Chat, n8n, Make…).
 * Les erreurs identiques sont regroupées (SystemEvent.fingerprint) et ne déclenchent au plus
 * qu'une alerte par heure, pour ne jamais inonder le téléphone.
 */

export type AlertKind = 'SERVER_ERROR' | 'CLIENT_ERROR' | 'BACKUP_OK' | 'BACKUP_FAIL' | 'RESTORE_TEST_OK' | 'RESTORE_TEST_FAIL' | 'BACKUP_MISSING';

const THROTTLE_MS = 60 * 60_000;
const APP = () => process.env.NEXT_PUBLIC_APP_URL || 'Fixi';

export function alertChannels() {
  return { telegram: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID), webhook: !!process.env.ALERT_WEBHOOK_URL };
}

/** Envoie un message sur les canaux configurés. Ne lève jamais d'erreur (une alerte ne doit pas casser l'app). */
export async function sendAlert(text: string) {
  const body = `🛠️ ${APP()}\n${text}`.slice(0, 3900);
  const jobs: Promise<unknown>[] = [];
  const signal = AbortSignal.timeout(8000);
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    jobs.push(fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: body, disable_web_page_preview: true }),
    }));
  }
  if (process.env.ALERT_WEBHOOK_URL) {
    jobs.push(fetch(process.env.ALERT_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal, body: JSON.stringify({ text: body, content: body }) }));
  }
  const res = await Promise.allSettled(jobs);
  return res.some(r => r.status === 'fulfilled');
}

/** Empreinte stable : même message + même endroit = même problème (les nombres et identifiants sont ignorés). */
export function fingerprint(kind: string, message: string, where = '') {
  const norm = (s: string) => s.replace(/[0-9a-f]{20,}/gi, '#').replace(/\d+/g, '0').slice(0, 300);
  return crypto.createHash('sha256').update(`${kind}|${norm(message)}|${norm(where)}`).digest('hex').slice(0, 40);
}

/** Enregistre un événement (regroupé) et prévient si nécessaire. */
export async function recordEvent(kind: AlertKind, message: string, details: Record<string, unknown> = {}, opts: { where?: string; alert?: boolean } = {}) {
  const fp = fingerprint(kind, message, opts.where);
  const now = new Date();
  try {
    // Un succès range automatiquement les alertes correspondantes (sauvegarde revenue, restauration réparée).
    if (kind === 'BACKUP_OK') await prisma.systemEvent.updateMany({ where: { kind: { in: ['BACKUP_MISSING', 'BACKUP_FAIL'] }, resolvedAt: null }, data: { resolvedAt: now } });
    if (kind === 'RESTORE_TEST_OK') await prisma.systemEvent.updateMany({ where: { kind: 'RESTORE_TEST_FAIL', resolvedAt: null }, data: { resolvedAt: now } });
    const ev = await prisma.systemEvent.upsert({
      where: { fingerprint: fp },
      create: { kind, fingerprint: fp, message: message.slice(0, 1000), details: details as any },
      update: { count: { increment: 1 }, lastAt: now, details: details as any, resolvedAt: null },
    });
    const due = !ev.notifiedAt || now.getTime() - ev.notifiedAt.getTime() > THROTTLE_MS;
    if (opts.alert !== false && due) {
      const icon = kind.endsWith('_OK') ? '✅' : kind === 'CLIENT_ERROR' ? '📱' : '🚨';
      const sent = await sendAlert(`${icon} ${label(kind)}${ev.count > 1 ? ` (×${ev.count})` : ''}\n${message.slice(0, 600)}${opts.where ? `\n📍 ${opts.where}` : ''}`);
      if (sent) await prisma.systemEvent.update({ where: { id: ev.id }, data: { notifiedAt: now } });
    }
    return ev;
  } catch {
    // Base indisponible : on tente quand même de prévenir.
    if (opts.alert !== false) await sendAlert(`🚨 ${label(kind)}\n${message.slice(0, 600)}`);
    return null;
  }
}

export function label(kind: string) {
  return ({ SERVER_ERROR: 'Erreur serveur', CLIENT_ERROR: 'Erreur dans le navigateur', BACKUP_OK: 'Sauvegarde réussie', BACKUP_FAIL: 'Sauvegarde ÉCHOUÉE', RESTORE_TEST_OK: 'Test de restauration réussi', RESTORE_TEST_FAIL: 'Test de restauration ÉCHOUÉ', BACKUP_MISSING: 'Aucune sauvegarde récente' } as Record<string, string>)[kind] || kind;
}

/** Erreur serveur (appelée par instrumentation.onRequestError). */
export async function reportServerError(err: unknown, where: string) {
  const e = err as any;
  const message = String(e?.message || e || 'Erreur inconnue');
  // Erreurs « normales » (accès refusé, introuvable) : pas d'alerte.
  if (/UNAUTHENTICATED|FORBIDDEN|NEXT_NOT_FOUND|NEXT_REDIRECT/.test(message)) return null;
  return recordEvent('SERVER_ERROR', message, { stack: String(e?.stack || '').split('\n').slice(0, 8).join('\n'), digest: e?.digest }, { where });
}
