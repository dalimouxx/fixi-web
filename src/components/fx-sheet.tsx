'use client';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Feuille toujours montée : l'ouverture et la fermeture sont des transitions CSS
// sur transform, donc interruptibles (un double toucher repart de la position courante).
export function FxSheet({ open, onClose, side = 'side', title, subtitle, children, label }: {
  open: boolean; onClose: () => void; side?: 'side' | 'bottom'; title: ReactNode; subtitle?: ReactNode; children: ReactNode; label: string;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // Rendu dans <body> : un en-tête avec filtre/flou ne peut plus « capturer » la feuille.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', onKey);
    return () => { removeEventListener('keydown', onKey); previous?.focus?.({ preventScroll: true }); };
  }, [open, onClose]);
  if (!mounted) return null;
  return createPortal(<>
    <div className="fx-scrim" data-open={open} onClick={onClose} aria-hidden="true" />
    <section className={`fx-sheet fx-sheet--${side}`} data-open={open} role="dialog" aria-modal="true" aria-label={label} inert={!open}>
      {side === 'bottom' && <div className="fx-sheet-grip" aria-hidden="true" />}
      <header className="fx-sheet-head">
        <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        <button ref={closeRef} type="button" className="fx-icon-btn" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
      </header>
      <div className="fx-sheet-body">{children}</div>
    </section>
  </>, document.body);
}
