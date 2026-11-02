'use client';
import { useEffect, useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import { api } from './ui';

const KEY = 'fixi-android-app';
/** Vrai dans l'application Android Fixi (le lancement indique « android-app://tn.fixi.app »). */
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

// Relie le widget de l'écran d'accueil Android à ce compte (jeton en lecture seule).
export function AndroidWidgetButton({ className = 'btn btn-ghost btn-sm' }: { className?: string }) {
  const inApp = useInAndroidApp();
  const [busy, setBusy] = useState(false);
  if (!inApp) return null;
  async function link() {
    setBusy(true);
    try {
      const { token } = await api('/api/widget/token', { method: 'POST' });
      location.href = `fixiapp://widget?token=${encodeURIComponent(token)}&host=${encodeURIComponent(location.host)}`;
    } catch (e: any) { alert(e.message); } finally { setBusy(false); }
  }
  return <button type="button" className={className} onClick={link} disabled={busy}><LayoutGrid size={16} /> {busy ? 'Connexion…' : 'Widget écran d’accueil'}</button>;
}
