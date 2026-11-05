'use client';
import { useEffect, useRef, useState } from 'react';

/** Chiffre qui défile jusqu'à sa valeur (une seule fois par changement ; immédiat si « réduire les animations »). */
export function CountUp({ value, format }: { value: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  useEffect(() => {
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (calm) { setShown(value); from.current = value; return; }
    const start = from.current, t0 = performance.now(); let raf = 0;
    const tick = (t: number) => { const x = Math.min(1, (t - t0) / 1200); const v = start + (value - start) * (1 - Math.pow(1 - x, 3)); setShown(v); if (x < 1) raf = requestAnimationFrame(tick); else from.current = value; };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  const isInt = Number.isInteger(value);
  return <span className="fxm-num">{format ? format(shown) : (isInt ? Math.round(shown) : shown).toLocaleString('fr-FR')}</span>;
}

/** Courbe des encaissements des derniers jours, qui se dessine à l'affichage. */
export function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return <div className="fxm-spark fxm-spark--empty" aria-hidden="true" />;
  const w = 300, h = 110, max = Math.max(...points, 1), step = w / (points.length - 1);
  const xy = points.map((v, i) => [i * step, h - 8 - (v / max) * (h - 20)]);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const last = xy[xy.length - 1];
  return <svg className="fxm-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="fxm-sp1" x1="0" x2="1"><stop offset="0" stopColor="#FF7A18" /><stop offset=".5" stopColor="#FF3D77" /><stop offset="1" stopColor="#A78BFA" /></linearGradient>
      <linearGradient id="fxm-sp2" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#FF3D77" stopOpacity=".28" /><stop offset="1" stopColor="#FF3D77" stopOpacity="0" /></linearGradient></defs>
    <path className="fxm-up" style={{ '--d': '.6s' } as any} d={`${line} L${w},${h} L0,${h} Z`} fill="url(#fxm-sp2)" />
    <path className="fxm-draw" d={line} fill="none" stroke="url(#fxm-sp1)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx={last[0]} cy={last[1]} r="5.5" fill="#fff" stroke="#FF3D77" strokeWidth="3" />
  </svg>;
}

/** Anneau de pourcentage qui se remplit. */
export function Ring({ pct }: { pct: number }) {
  const c = 2 * Math.PI * 52;
  return <svg className="fxm-ring" width="120" height="120" viewBox="0 0 132 132" aria-hidden="true">
    <defs><linearGradient id="fxm-rg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#FF7A18" /><stop offset="1" stopColor="#8B5CF6" /></linearGradient></defs>
    <circle cx="66" cy="66" r="52" fill="none" stroke="var(--fxm-line)" strokeWidth="12" />
    <circle className="fxm-ring-p" cx="66" cy="66" r="52" fill="none" stroke="url(#fxm-rg)" strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 66 66)" style={{ '--c': c } as any} />
    <text x="66" y="74" textAnchor="middle" fill="currentColor" className="fxm-ring-t">{pct}%</text>
  </svg>;
}
