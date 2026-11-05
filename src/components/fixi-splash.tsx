'use client';
import { useEffect, useState } from 'react';
import { FixiAnimatedLogo } from './fixi-animated-logo';

/** Durée minimale d'affichage : le temps que le logo et le mot « fixi. » s'animent. */
const MIN_MS = 1900;
const MAX_MS = 4000;

/**
 * Script à placer dans <head> : décide AVANT le premier affichage si l'écran
 * d'ouverture doit apparaître (une fois par session, jamais si « réduire les
 * animations » est activé). Évite que la page clignote avant le logo.
 */
export const FIXI_SPLASH_HEAD_SCRIPT =
  "try{if(sessionStorage.getItem('fixi-splash-seen')!=='1'&&!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)){sessionStorage.setItem('fixi-splash-seen','1');document.documentElement.dataset.splash='1'}}catch(e){}";

/**
 * Écran d'ouverture animé (logo + « fixi. » + barre de progression),
 * affiché à l'ouverture de l'application puis effacé en fondu.
 * Le HTML est rendu côté serveur ; le CSS ne le montre que si html[data-splash].
 */
export function FixiSplash({ label = 'Préparation de votre espace…' }: { label?: string }) {
  const [phase, setPhase] = useState<'show' | 'leaving' | 'hidden'>('show');

  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.splash !== '1') { setPhase('hidden'); return; }
    const started = performance.now();
    let leaveTimer: ReturnType<typeof setTimeout> | undefined;
    const leave = () => {
      const wait = Math.max(0, MIN_MS - (performance.now() - started));
      leaveTimer = setTimeout(() => setPhase('leaving'), wait);
    };
    if (document.readyState === 'complete') leave();
    else window.addEventListener('load', leave, { once: true });
    const safety = setTimeout(() => setPhase('leaving'), MAX_MS);
    return () => {
      window.removeEventListener('load', leave);
      clearTimeout(safety);
      if (leaveTimer) clearTimeout(leaveTimer);
    };
  }, []);

  useEffect(() => {
    if (phase !== 'leaving') return;
    const t = setTimeout(() => { delete document.documentElement.dataset.splash; setPhase('hidden'); }, 450);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === 'hidden') return null;
  return (
    <div className={'fxm-splash' + (phase === 'leaving' ? ' is-leaving' : '')} role="status" aria-live="polite" aria-label="Ouverture de Fixi">
      <span className="fxm-blob b1" aria-hidden="true" />
      <span className="fxm-blob b2" aria-hidden="true" />
      <div className="fxm-splash-mark">
        <span className="fxm-splash-halo" aria-hidden="true" />
        <FixiAnimatedLogo size={128} />
      </div>
      <div className="fxm-splash-word" aria-hidden="true"><span>f</span><span>i</span><span>x</span><span>i</span><span>.</span></div>
      <div className="fxm-splash-bar" aria-hidden="true"><i /></div>
      <div className="fxm-splash-text">{label}</div>
    </div>
  );
}
