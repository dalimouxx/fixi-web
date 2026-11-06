'use client';
import type { ReactNode } from 'react';

const CONFETTI = ['#FF7A18', '#FF3D77', '#8B5CF6', '#22D3EE', '#34D399', '#FCD34D'];

/** Écran de succès de la caisse (coche dessinée + confettis), commun réparations et vente comptoir. */
export function CashSuccess({ amount, title, subtitle, children }: { amount: string; title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return <div className="fxm-cash-success" role="status" aria-live="polite">
    <div className="fxm-cash-burst" aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => { const a = i / 14 * Math.PI * 2, r = 90 + (i % 3) * 25; return <span key={i} style={{ '--dx': `${Math.round(Math.cos(a) * r)}px`, '--dy': `${Math.round(Math.sin(a) * r)}px`, background: CONFETTI[i % 6], animationDelay: `${0.35 + (i % 4) * 0.05}s` } as any} />; })}
      <svg width="112" height="112" viewBox="0 0 84 84"><defs><linearGradient id="fxm-okg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#34D399" /><stop offset="1" stopColor="#22D3EE" /></linearGradient></defs>
        <circle className="fxm-draw" cx="42" cy="42" r="38" fill="none" stroke="url(#fxm-okg)" strokeWidth="5" />
        <path className="fxm-draw fxm-draw--late" d="M26 43l11 11 21-23" fill="none" stroke="#34D399" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </div>
    <div className="fxm-num fxm-gt fxm-cash-success-amount">{amount}</div>
    <b>{title}</b>
    {subtitle && <small>{subtitle}</small>}
    <div className="fxm-cash-success-actions">{children}</div>
  </div>;
}
