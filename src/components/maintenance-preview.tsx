'use client';
import { useEffect, useState } from 'react';
import { MaintenanceScreen } from './maintenance-gate';

/** Aperçu de l'écran de maintenance (Fixi Control → Aperçu). */
export function MaintenancePreview() {
  const [now, setNow] = useState(() => Date.now()); const [tip, setTip] = useState(0);
  const [until] = useState(() => new Date(Date.now() + 15 * 60_000).toISOString());
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/platform/maintenance', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => { if (j?.message) setMessage(j.message); }).catch(() => {});
    const a = setInterval(() => setNow(Date.now()), 1000), b = setInterval(() => setTip(x => (x + 1) % 4), 4000);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);
  return <MaintenanceScreen message={message} until={until} now={now} tip={tip} />;
}
