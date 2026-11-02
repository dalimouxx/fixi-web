'use client';
import { useEffect, useState } from 'react';
import { ALargeSmall } from 'lucide-react';

// Gros caractères : tout l'écran est agrandi de 15 % (textes, boutons, icônes),
// mémorisé sur ce téléphone. Appliqué avant l'affichage par un script dans <head>.
const KEY = 'fixi-text-size';
const EVENT = 'fixi:text-size';

export function setLargeText(on: boolean) {
  try { localStorage.setItem(KEY, on ? 'large' : 'normal'); } catch {}
  document.documentElement.dataset.text = on ? 'large' : 'normal';
  window.dispatchEvent(new Event(EVENT));
}

export function TextSizeToggle({ variant = 'icon' }: { variant?: 'icon' | 'row' }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(document.documentElement.dataset.text === 'large');
    sync(); window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  if (variant === 'row') return <div className="fx-set-row">
    <span><b><ALargeSmall size={16} /> Gros caractères</b><small>Agrandit tout l’écran : pratique pour mieux lire ou sur un écran abîmé.</small></span>
    <button type="button" role="switch" aria-checked={on} aria-label="Gros caractères" className="fx-switch" onClick={() => setLargeText(!on)}><span /></button>
  </div>;
  return <button type="button" className="fx-icon-btn" aria-pressed={on} onClick={() => setLargeText(!on)}
    title={on ? 'Taille normale' : 'Gros caractères'} aria-label={on ? 'Revenir à la taille normale' : 'Activer les gros caractères'}><ALargeSmall size={19} /></button>;
}
