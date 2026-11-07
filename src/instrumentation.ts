// Tâches périodiques internes : lance les automatisations (dont la relance des appareils prêts)
// toutes les heures depuis le serveur lui-même, sans service cron séparé.
// Désactivable avec FIXI_INTERNAL_CRON=off. Nécessite CRON_SECRET.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.FIXI_INTERNAL_CRON === 'off' || !process.env.CRON_SECRET) return;
  const g = globalThis as any;
  if (g.__fixiCron) return;
  const port = process.env.PORT || '3000';
  const call = (path: string) => fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST', headers: { 'x-cron-secret': String(process.env.CRON_SECRET) } }).catch(() => {});
  // Automatisations + surveillance (sauvegarde récente, erreurs) toutes les heures.
  const run = () => { void call('/api/system/automations/run'); void call('/api/system/watchdog'); void call('/api/system/daily'); };
  g.__fixiCron = { first: setTimeout(run, 2 * 60_000), every: setInterval(run, 60 * 60_000) };
}

/** Toute erreur serveur (page, API, action) est enregistrée et signalée sur Telegram / webhook. */
// L'import est À L'INTÉRIEUR du bloc « nodejs » : Next.js l'élimine ainsi du paquet « edge »
// (où les modules Node comme crypto n'existent pas — sinon toute l'application plante).
export async function onRequestError(err: unknown, request: { path: string; method: string }, context: { routeType?: string; routePath?: string }) {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { reportServerError } = await import('./lib/alerts');
      await reportServerError(err, `${request.method} ${context.routePath || request.path}${context.routeType ? ` (${context.routeType})` : ''}`);
    } catch { /* jamais bloquant */ }
  }
}
