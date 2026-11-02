'use client';
import { ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

// Feuille toujours montée : l'ouverture et la fermeture sont des transitions CSS
// sur transform, donc interruptibles (un double toucher repart de la position courante).
export function FxSheet({ open, onClose, side = 'side', title, subtitle, children, label }: {
  open: boolean; onClose: () => void; side?: 'side' | 'bottom'; title: ReactNode; subtitle?: ReactNode; children: ReactNode; label: string;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', onKey);
    return () => { removeEventListener('keydown', onKey); previous?.focus?.({ preventScroll: true }); };
  }, [open, onClose]);
  return <>
    <div className="fx-scrim" data-open={open} onClick={onClose} aria-hidden="true" />
    <section className={`fx-sheet fx-sheet--${side}`} data-open={open} role="dialog" aria-modal="true" aria-label={label} inert={!open}>
      {side === 'bottom' && <div className="fx-sheet-grip" aria-hidden="true" />}
      <header className="fx-sheet-head">
        <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        <button ref={closeRef} type="button" className="fx-icon-btn" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
      </header>
      <div className="fx-sheet-body">{children}</div>
    </section>
  </>;
}
