// Tâches périodiques internes : lance les automatisations (dont la relance des appareils prêts)
// toutes les heures depuis le serveur lui-même, sans service cron séparé.
// Désactivable avec FIXI_INTERNAL_CRON=off. Nécessite CRON_SECRET.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.FIXI_INTERNAL_CRON === 'off' || !process.env.CRON_SECRET) return;
  const g = globalThis as any;
  if (g.__fixiCron) return;
  const port = process.env.PORT || '3000';
  const run = () => fetch(`http://127.0.0.1:${port}/api/system/automations/run`, { method: 'POST', headers: { 'x-cron-secret': String(process.env.CRON_SECRET) } }).catch(() => {});
  g.__fixiCron = { first: setTimeout(run, 2 * 60_000), every: setInterval(run, 60 * 60_000) };
}
