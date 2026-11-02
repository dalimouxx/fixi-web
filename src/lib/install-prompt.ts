'use client';
// Chrome/Edge/Samsung envoient « beforeinstallprompt » très tôt, parfois avant que React
// ait monté le composant d'installation : on le capture dès le chargement du module.
type Listener = () => void;
let deferred: any = null;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach(l => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => { e.preventDefault(); deferred = e; notify(); });
  window.addEventListener('appinstalled', () => { deferred = null; notify(); });
}

export function onInstallChange(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; }
export const canPromptInstall = () => !!deferred;

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable';
  const e = deferred; deferred = null; notify();
  try { await e.prompt(); const choice = await e.userChoice; return choice?.outcome === 'accepted' ? 'accepted' : 'dismissed'; }
  catch { return 'unavailable'; }
}

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

/** iPhone / iPad dans Safari : pas d'invite automatique, il faut l'expliquer. */
export function isIosSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

export const INSTALL_OPEN_EVENT = 'fixi:install-open';
export function openInstallHelp() { window.dispatchEvent(new Event(INSTALL_OPEN_EVENT)); }
