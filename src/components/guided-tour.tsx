'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PlusCircle, Palette, MessageCircle, BellRing, PackageCheck, Truck, ChevronRight, ChevronLeft } from 'lucide-react';
import { haptic } from '@/lib/haptics';

type Slide = { icon: any; tone: string; title: string; text: string; tip?: string };

const tours: Record<'atelier' | 'supplier', Slide[]> = {
  atelier: [
    { icon: PlusCircle, tone: 'brand', title: 'Recevez un appareil', text: 'Touchez « + » (en bas sur téléphone)\u00a0: numéro du client, modèle, panne en un toucher, une photo. C’est tout.', tip: 'Le micro permet de dicter la panne.' },
    { icon: Palette, tone: 'info', title: 'Suivez chaque réparation', text: 'Chaque couleur est une étape. Une carte orange ou rouge attend depuis trop longtemps.', tip: 'Glissez une carte vers la droite : « Prêt ». Vers la gauche : appeler le client.' },
    { icon: MessageCircle, tone: 'success', title: 'Prévenez et encaissez', text: 'Quand c’est prêt, Fixi prépare le message WhatsApp avec le lien de suivi. À la remise, la caisse calcule le reste à payer.' },
  ],
  supplier: [
    { icon: BellRing, tone: 'brand', title: 'Les commandes arrivent avec un son', text: 'Chaque nouvelle commande d’un réparateur sonne et s’affiche en haut. Vous pouvez la confirmer depuis la notification.' },
    { icon: PackageCheck, tone: 'info', title: 'Confirmer → Préparer → Prête', text: 'Un seul bouton par étape. Sur ordinateur, glissez la commande d’une colonne à l’autre.' },
    { icon: Truck, tone: 'success', title: 'Livrez et encaissez', text: 'Affectez un livreur : le réparateur suit la livraison et l’encaissement reste lié à la facture.' },
  ],
};

const key = (space: string) => `fixi-tour-${space}-v1`;

/** Visite en 3 écrans, une seule fois par espace et par appareil. Peut être relancée depuis l'aide. */
export function GuidedTour({ space }: { space: 'atelier' | 'supplier' }) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  useEffect(() => {
    let seen = true;
    try { seen = !!localStorage.getItem(key(space)); } catch {}
    const t = seen ? null : setTimeout(() => setOpen(true), 900);
    const replay = () => { setI(0); setOpen(true); };
    window.addEventListener('fixi:tour', replay);
    return () => { if (t) clearTimeout(t); window.removeEventListener('fixi:tour', replay); };
  }, [space]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') setI(v => Math.max(0, v - 1)); };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  });
  const slides = tours[space];
  function close() { try { localStorage.setItem(key(space), String(Date.now())); } catch {} setOpen(false); }
  function next() { if (i >= slides.length - 1) { haptic('success'); close(); } else setI(i + 1); }
  if (!open) return null;
  const s = slides[i]; const Icon = s.icon;
  return createPortal(<div className="fx-tour" role="dialog" aria-modal="true" aria-label="Découvrir Fixi">
    <div className="fx-tour-card" key={i}>
      <button type="button" className="fx-tour-skip" onClick={close}>Passer</button>
      <div className={`fx-tour-art fx-tour-art--${s.tone}`} aria-hidden="true"><Icon /></div>
      <small className="fx-tour-count">{i + 1} / {slides.length}</small>
      <h2>{s.title}</h2>
      <p>{s.text}</p>
      {s.tip && <p className="fx-tour-tip">{s.tip}</p>}
      <div className="fx-tour-dots" aria-hidden="true">{slides.map((_, j) => <i key={j} className={j === i ? 'on' : ''} />)}</div>
      <div className="fx-tour-actions">
        {i > 0 ? <button type="button" className="btn btn-ghost" onClick={() => setI(i - 1)}><ChevronLeft size={18} className="fx-flip" /> Retour</button> : <span />}
        <button type="button" className="btn btn-primary" onClick={next} autoFocus>{i === slides.length - 1 ? 'Commencer' : 'Suivant'} {i < slides.length - 1 && <ChevronRight size={18} className="fx-flip" />}</button>
      </div>
    </div>
  </div>, document.body);
}

export function replayTour() { window.dispatchEvent(new Event('fixi:tour')); }
