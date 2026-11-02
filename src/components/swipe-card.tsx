'use client';
import { ReactNode, useRef, useState } from 'react';
import { haptic } from '@/lib/haptics';

const THRESHOLD = 88;

// Carte glissable sur téléphone : vers la droite = action principale (ex. « Prêt »),
// vers la gauche = action secondaire (ex. « Appeler »). Le défilement vertical reste prioritaire.
export function SwipeCard({ children, className, right, left, ...rest }: {
  children: ReactNode; className?: string;
  right?: { label: string; icon?: ReactNode; onSwipe: () => void };
  left?: { label: string; icon?: ReactNode; onSwipe: () => void };
  [k: string]: any;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; axis: 'x' | 'y' | null; armed: boolean } | null>(null);
  const moved = useRef(false);

  function down(e: React.PointerEvent) {
    if (e.pointerType === 'mouse') return; // glisser = geste tactile ; à la souris on garde les boutons
    start.current = { x: e.clientX, y: e.clientY, axis: null, armed: false };
    moved.current = false;
  }
  function move(e: React.PointerEvent) {
    const s = start.current; if (!s) return;
    const x = e.clientX - s.x, y = e.clientY - s.y;
    if (!s.axis) { if (Math.abs(x) < 8 && Math.abs(y) < 8) return; s.axis = Math.abs(x) > Math.abs(y) * 1.2 ? 'x' : 'y'; if (s.axis === 'x') { setDragging(true); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } }
    if (s.axis !== 'x') return;
    moved.current = true;
    let v = x;
    if ((v > 0 && !right) || (v < 0 && !left)) v = v / 5; // résistance s'il n'y a pas d'action de ce côté
    if (Math.abs(v) > THRESHOLD) v = Math.sign(v) * (THRESHOLD + (Math.abs(v) - THRESHOLD) / 3);
    const armed = Math.abs(v) >= THRESHOLD;
    if (armed !== s.armed) { s.armed = armed; if (armed) haptic('tap'); }
    setDx(v);
  }
  function up() {
    const s = start.current; start.current = null; setDragging(false);
    if (s?.axis === 'x' && s.armed) { if (dx > 0) right?.onSwipe(); else left?.onSwipe(); }
    setDx(0);
  }
  // Un glissement ne doit pas ouvrir la fiche (lien à l'intérieur de la carte).
  function click(e: React.MouseEvent) { if (moved.current) { e.preventDefault(); e.stopPropagation(); moved.current = false; } }

  const side = dx > 0 ? 'right' : dx < 0 ? 'left' : '';
  const armed = Math.abs(dx) >= THRESHOLD;
  return <div className="fx-swipe" data-side={side} data-armed={armed || undefined}>
    {right && <div className="fx-swipe-bg fx-swipe-bg--right" aria-hidden="true">{right.icon}<span>{right.label}</span></div>}
    {left && <div className="fx-swipe-bg fx-swipe-bg--left" aria-hidden="true"><span>{left.label}</span>{left.icon}</div>}
    <article {...rest} className={className} style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dragging ? 'none' : undefined }}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClickCapture={click}>
      {children}
    </article>
  </div>;
}
