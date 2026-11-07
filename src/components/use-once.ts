'use client';
import { useEffect, useState } from 'react';

/** Charge une fois (et quand `key` change) — sans le rafraîchissement automatique de useApi, pour les requêtes lourdes. */
export function useOnce<T>(url: string, key = 0) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let stop = false;
    fetch(url, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => { if (!stop) setData(j); }).catch(() => {});
    return () => { stop = true; };
  }, [url, key]);
  return { data };
}
