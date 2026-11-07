'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { isLightOnly } from '@/lib/theme-scope';

/** Remet le bon thème à chaque changement d'écran (navigation sans rechargement). */
export function ThemeScope() {
  const p = usePathname() || '';
  useEffect(() => {
    let dark = false;
    try { dark = localStorage.getItem('fixi-theme') === 'dark'; } catch {}
    document.documentElement.dataset.theme = dark && !isLightOnly(p) ? 'dark' : 'light';
  }, [p]);
  return null;
}
