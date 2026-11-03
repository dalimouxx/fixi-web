'use client';
import { useEffect, useState } from 'react';
import { LayoutGrid } from 'lucide-react';

const KEY = 'fixi-android-app';
const PKG = process.env.NEXT_PUBLIC_TWA_PACKAGE_ID || 'tn.fixi.app';

/** Vrai dans l'application Android Fixi (le lancement indique « android-app://… »). */
export function useInAndroidApp() {
  const [inApp, setInApp] = useState(false);
  useEffect(() => {
    try {
      if (document.referrer.startsWith('android-app://')) localStorage.setItem(KEY, '1');
      setInApp(localStorage.getItem(KEY) === '1' && /Android/i.test(navigator.userAgent));
    } catch {}
  }, []);
  return inApp;
}

/** Lien qui ouvre l'application Android pour relier le widget (format « intent » compris par Chrome). */
export function widgetIntentUrl(token: string, lang: string, pkg = PKG) {
  const q = `token=${encodeURIComponent(token)}&lang=${lang === 'ar' ? 'ar' : 'fr'}`;
  return `intent://widget?${q}#Intent;scheme=fixiapp;package=${pkg};end`;
}

// Relie le widget de l'écran d'accueil Android à ce compte (atelier, fournisseur ou livreur).
// 1er toucher : Fixi prépare le jeton. 2e toucher : ouvre l'application (Chrome exige un geste pour ouvrir une appli).
export function AndroidWidgetButton({ space = 'atelier', className = 'btn btn-ghost btn-sm' }: { space?: 'atelier' | 'supplier' | 'delivery'; className?: string }) {
  const inApp = useInAndroidApp();
  const [href, setHref] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!inApp) return null;
  async function prepare() {
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/widget/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ space }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Widget indisponible');
      setHref(widgetIntentUrl(j.token, document.documentElement.lang));
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  if (href) return <a className="btn btn-primary btn-sm" href={href}><LayoutGrid size={16} /> Terminer : ouvrir le widget</a>;
  return <><button type="button" className={className} onClick={prepare} disabled={busy}><LayoutGrid size={16} /> {busy ? 'Préparation…' : 'Ajouter le widget Fixi'}</button>{error && <span className="fx-widget-error" role="status">{error}</span>}</>;
}
