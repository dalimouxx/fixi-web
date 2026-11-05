'use client';
import { useEffect, useState } from 'react';
import { FixiAnimatedLogo } from './fixi-animated-logo';

/**
 * Marque de la barre latérale Fixi Max : logo animé + nom + sous-titre.
 * Si la plateforme a un logo personnalisé (marque blanche), il est utilisé à la place.
 */
export function FixiBrand({ subtitle }: { subtitle?: string }) {
  const [b, setB] = useState<{ logoDataUrl?: string; appName?: string } | null>(null);
  useEffect(() => {
    fetch('/api/public/branding').then(r => (r.ok ? r.json() : null)).then(setB).catch(() => {});
  }, []);
  const name = b?.appName || 'fixi';
  return (
    <div className="fxm-brand">
      {b?.logoDataUrl ? <img src={b.logoDataUrl} alt="" className="fxm-brand-img" /> : <FixiAnimatedLogo size={42} />}
      <div className="fxm-brand-text">
        <b>{name}{name === 'fixi' && <em>.</em>}</b>
        {subtitle && <small>{subtitle}</small>}
      </div>
    </div>
  );
}
