'use client';
import { useEffect } from 'react';

const NOISE = /ResizeObserver loop|Script error\.?$|chrome-extension:|moz-extension:|safari-extension:|Non-Error promise rejection|AbortError|Load failed|NetworkError|Failed to fetch/i;

/** Envoie au serveur les erreurs JavaScript des utilisateurs (5 au plus par page, sans doublon). */
export function reportClientError(message: string, stack = '') {
  try {
    const w = window as any; w.__fxErr = w.__fxErr || new Set<string>();
    if (!message || NOISE.test(message) || NOISE.test(stack) || w.__fxErr.has(message) || w.__fxErr.size >= 5) return;
    w.__fxErr.add(message);
    const body = JSON.stringify({ message, stack: stack.slice(0, 1500), path: location.pathname });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/client-error', new Blob([body], { type: 'application/json' }));
    else void fetch('/api/client-error', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } });
  } catch { /* jamais bloquant */ }
}

export function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportClientError(String(e.message || e.error?.message || ''), String(e.error?.stack || `${e.filename}:${e.lineno}`));
    const onRejection = (e: PromiseRejectionEvent) => { const r: any = e.reason; reportClientError(String(r?.message || r || ''), String(r?.stack || '')); };
    window.addEventListener('error', onError); window.addEventListener('unhandledrejection', onRejection);
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection); };
  }, []);
  return null;
}
