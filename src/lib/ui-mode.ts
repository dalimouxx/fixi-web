'use client';
import { useCallback, useEffect, useState } from 'react';

// Mode Simple (par défaut) : seules les fonctions du quotidien sont dans le menu.
// Mode Avancé : tous les modules (Conseils, Rappels automatiques, Réseau, Dépôts…).
// Le choix est mémorisé sur l'appareil, séparément pour l'Atelier et le Fournisseur.
export type UiMode = 'simple' | 'advanced';
type Surface = 'atelier' | 'supplier';

const key = (surface: Surface) => `fixi-ui-mode-${surface}`;
const EVENT = 'fixi:ui-mode';

export function readUiMode(surface: Surface): UiMode {
  try { return localStorage.getItem(key(surface)) === 'advanced' ? 'advanced' : 'simple'; }
  catch { return 'simple'; }
}

export function useUiMode(surface: Surface) {
  const [mode, setState] = useState<UiMode>('simple');
  useEffect(() => {
    setState(readUiMode(surface));
    const sync = () => setState(readUiMode(surface));
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync); };
  }, [surface]);
  const setMode = useCallback((next: UiMode) => {
    try { localStorage.setItem(key(surface), next); } catch {}
    setState(next);
    window.dispatchEvent(new Event(EVENT));
  }, [surface]);
  return { mode, setMode, advanced: mode === 'advanced' };
}
