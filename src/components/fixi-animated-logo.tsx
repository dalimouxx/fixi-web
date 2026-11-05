import type { CSSProperties } from 'react';

/**
 * Logo Fixi animé : anneau arc-en-ciel qui tourne et « F » qui se dessine.
 * Reprend le tracé de FixiMark (F + croix de réparation).
 */
export function FixiAnimatedLogo({ size = 128, className = '' }: { size?: number; className?: string }) {
  const gradId = `fxm-logo-grad-${size}`;
  return (
    <span className={'fxm-logo' + (className ? ' ' + className : '')} style={{ '--fxm-logo-size': `${size}px` } as CSSProperties} aria-hidden="true">
      <span className="fxm-logo-core">
        <svg viewBox="0 0 38 38" fill="none" strokeLinecap="round" strokeLinejoin="round" focusable="false">
          <defs>
            <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#FF9A4D" />
              <stop offset="1" stopColor="#FF3D77" />
            </linearGradient>
          </defs>
          <path className="fxm-logo-f" d="M11 30V9.5a2 2 0 0 1 2-2h15" stroke={`url(#${gradId})`} strokeWidth="5.2" />
          <path className="fxm-logo-f" d="M11 18.5h13.2" stroke={`url(#${gradId})`} strokeWidth="5.2" />
          <path className="fxm-logo-f" d="m23 29.5 6.5-6.5m0 6.5L23 23" stroke="#FFFFFF" strokeWidth="3.8" />
        </svg>
      </span>
    </span>
  );
}
